#!/usr/bin/env node
/**
 * Harvest AutoHub tool-filter / mcp-tools evolution from git history.
 *
 * Usage (from skillissue or any cwd):
 *   node scripts/harvest-tool-timeline.mjs \
 *     --repo ~/Projects/OpenAI/autohub \
 *     --out content/data/tool-timeline.json
 *
 * Requires a local clone of verygoodplugins/autohub (or compatible config layout).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const repo = path.resolve(
  arg("--repo", path.join(root, "../autohub"))
);
const outPath = path.resolve(
  root,
  arg("--out", "content/data/tool-timeline.json")
);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function safeShow(cwd, sha, file) {
  try {
    return git(cwd, "show", `${sha}:${file}`);
  } catch {
    return "";
  }
}

function countMcpTools(data) {
  if (!data || typeof data !== "object") return null;
  const servers = data.servers;
  if (!servers || typeof servers !== "object") {
    if (Array.isArray(data.tools)) return data.tools.length;
    if (data.tools && typeof data.tools === "object") return Object.keys(data.tools).length;
    return null;
  }
  let n = 0;
  for (const sv of Object.values(servers)) {
    if (!sv || typeof sv !== "object") continue;
    const t = sv.tools;
    if (Array.isArray(t)) n += t.length;
    else if (t && typeof t === "object") n += Object.keys(t).length;
  }
  return n;
}

function countMcpServers(data) {
  if (!data?.servers || typeof data.servers !== "object") return null;
  return Object.keys(data.servers).length;
}

function analyzeTf(data) {
  if (!data || typeof data !== "object") return {};
  const groups = data.toolGroups || data.groups || {};
  const profiles = data.profiles || {};
  const rules = data.contextRules || data.rules || [];
  let essentialTools = null;
  if (groups && typeof groups === "object" && groups.essential) {
    const ess = groups.essential;
    if (Array.isArray(ess)) essentialTools = ess.length;
    else if (ess && typeof ess === "object") {
      const t = ess.tools || ess.toolIds;
      if (Array.isArray(t)) essentialTools = t.length;
    }
  }
  return {
    groups: groups && typeof groups === "object" ? Object.keys(groups).length : null,
    profiles: profiles && typeof profiles === "object" ? Object.keys(profiles).length : null,
    contextRules: Array.isArray(rules) ? rules.length : null,
    essentialTools,
    alwaysEnabled: Array.isArray(data.alwaysEnabled) ? data.alwaysEnabled.length : null,
    disabled: Array.isArray(data.disabled) ? data.disabled.length : null,
  };
}

const sampleDates = [
  "2025-09-15", "2025-10-01", "2025-10-15", "2025-11-01", "2025-11-15",
  "2025-12-01", "2025-12-15", "2026-01-01", "2026-01-15", "2026-02-01",
  "2026-02-15", "2026-03-01", "2026-03-15", "2026-04-01", "2026-04-15",
  "2026-05-01", "2026-05-15", "2026-06-01", "2026-06-15", "2026-06-26",
  "2026-07-01", "2026-07-10", "2026-07-20",
];

if (!fs.existsSync(path.join(repo, ".git"))) {
  console.error(`No git repo at ${repo}`);
  process.exit(1);
}

const timeline = [];
let prevKey = null;

for (const d of sampleDates) {
  let sha;
  try {
    sha = git(repo, "rev-list", "-1", `--before=${d}T23:59:59`, "HEAD");
  } catch {
    continue;
  }
  if (!sha) continue;

  const point = { date: d, sha: sha.slice(0, 12), fullSha: sha };

  const tfRaw = safeShow(repo, sha, "config/tool-filters.json");
  if (tfRaw.startsWith("{")) {
    try {
      const tf = JSON.parse(tfRaw);
      for (const [k, v] of Object.entries(analyzeTf(tf))) {
        point[`tf_${k}`] = v;
      }
    } catch (e) {
      point.tf_error = String(e.message || e).slice(0, 80);
    }
  } else {
    point.tf_missing = true;
  }

  const mtRaw = safeShow(repo, sha, "config/mcp-tools.json");
  if (mtRaw.startsWith("{")) {
    try {
      const mt = JSON.parse(mtRaw);
      point.mcpTools = countMcpTools(mt);
      point.mcpServers = countMcpServers(mt);
    } catch (e) {
      point.mt_error = String(e.message || e).slice(0, 80);
    }
  } else {
    point.mt_missing = true;
  }

  const key = JSON.stringify([
    point.mcpTools,
    point.tf_groups,
    point.tf_essentialTools,
    point.tf_contextRules,
    point.tf_profiles,
  ]);
  if (key === prevKey) continue;
  prevKey = key;
  timeline.push(point);
  console.log(
    point.date,
    `tools=${point.mcpTools ?? "—"}`,
    `groups=${point.tf_groups ?? "—"}`,
    `essential=${point.tf_essentialTools ?? "—"}`,
    `rules=${point.tf_contextRules ?? "—"}`
  );
}

const headSha = git(repo, "rev-parse", "HEAD");
const tfNow = JSON.parse(
  fs.readFileSync(path.join(repo, "config/tool-filters.json"), "utf8")
);
const mtNow = JSON.parse(
  fs.readFileSync(path.join(repo, "config/mcp-tools.json"), "utf8")
);
const current = {
  date: new Date().toISOString().slice(0, 10),
  sha: headSha.slice(0, 12),
  fullSha: headSha,
  label: "HEAD",
  ...Object.fromEntries(
    Object.entries(analyzeTf(tfNow)).map(([k, v]) => [`tf_${k}`, v])
  ),
  mcpTools: countMcpTools(mtNow),
  mcpServers: countMcpServers(mtNow),
};

// Keep offline bench notes stable unless re-authored
let previous = {};
if (fs.existsSync(outPath)) {
  try {
    previous = JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch {
    /* ignore */
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  repo: "verygoodplugins/autohub",
  method:
    "Sample git rev-list --before each date; parse config/tool-filters.json and config/mcp-tools.json. Deduped consecutive identical metric tuples.",
  current,
  timeline,
  offlineBenchmarks: previous.offlineBenchmarks || {
    source: "AutoMem + AutoHub local tool-calling spike notes (2026-06-16, 2026-06-26)",
    spike_2026_06_16: {
      setup:
        "13-prompt eval, real stdio MCP, curated ~10-tool read-only catalog, M5 Max",
      models: [
        {
          name: "hermes3:8b",
          correctTool: 0.89,
          correctArgs: 0.78,
          loopCompletion: 1.0,
          abstention: 1.0,
          secPerTurn: 1.2,
          verdict: "GO",
        },
        {
          name: "huihui_ai/qwen3.6-abliterated:35b-a3b",
          correctTool: 1.0,
          correctArgs: 1.0,
          loopCompletion: 0.22,
          verdict: "NO — fails to close loop",
        },
        {
          name: "qwen3-coder:30b",
          correctTool: 0.78,
          verdict: "NO — systematic blind spots, heavier",
        },
      ],
      conclusion:
        "Local grunt-work FC feasible only with separate small FC-tuned model + curated catalog",
    },
    voice_core_2026_06_26: {
      LOCAL_NATIVE_CORE_TOOLS: 20,
      issues_fixed: [
        "Tool set swung 2→5→17 starving follow-ups → fake tool calls",
        "Changing tool block busts MLX prompt cache",
        "request_tool_group was server-tool not reachable from offline loop (4th most-used overall, 277 calls)",
      ],
      fix: "Stable ~20-tool core every local native turn + onToolGroupRequest mid-loop merge",
    },
  },
  skillsBenchExternal: previous.skillsBenchExternal || {
    note: "External research for skills non-monotonic returns — cite arXiv, not our numbers",
    skillsBench: "https://arxiv.org/html/2602.12670v1",
    agentSkillsSurvey: "https://arxiv.org/html/2602.12430v3",
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${outPath} (${timeline.length} timeline points)`);
