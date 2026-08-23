#!/usr/bin/env node
/**
 * Build site/ from skills/* SSOT (GitHub repo tree).
 * No local AutoVault required — Pages CI has the git checkout.
 *
 *   skills/<name>/SKILL.md   — installable package
 *   skills/<name>/story.md   — public narrative (site-only content)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const siteTarget = process.env.SKILLISSUE_SITE_DIR
  ? path.resolve(process.env.SKILLISSUE_SITE_DIR)
  : path.join(root, "site");
const reportTarget = process.env.SKILLISSUE_REPORT_PATH
  ? path.resolve(process.env.SKILLISSUE_REPORT_PATH)
  : path.join(root, "catalog", "report.json");
const skillsDir = path.join(root, "skills");
const contentStory = path.join(root, "content/story");
const REPO = "jack-arturo/skillissue";
const GENERATED_SENTINEL = ".skillissue-generated";
const cssSourcePath = path.join(__dirname, "site.css");
const explorerSourcePath = path.join(__dirname, "catalog-explorer.js");
const detailSourcePath = path.join(__dirname, "skill-detail.js");
const cssSource = fs.readFileSync(cssSourcePath);
const explorerSource = fs.readFileSync(explorerSourcePath);
const detailSource = fs.readFileSync(detailSourcePath);

function fingerprint(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

const cssAssetName = `site.${fingerprint(cssSource)}.css`;
const explorerAssetName = `catalog-explorer.${fingerprint(explorerSource)}.js`;
const detailAssetName = `skill-detail.${fingerprint(detailSource)}.js`;

function canonicalizePath(candidate) {
  const missing = [];
  let current = candidate;
  while (true) {
    try {
      return path.join(fs.realpathSync(current), ...missing.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

function containsPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validateGeneratedTarget() {
  const canonicalTarget = canonicalizePath(siteTarget);
  const canonicalRoot = fs.realpathSync(root);
  if (
    canonicalTarget === path.parse(canonicalTarget).root ||
    containsPath(canonicalTarget, canonicalRoot)
  ) {
    throw new Error(`Unsafe generated output target: ${siteTarget}. Choose the repository site/ directory or a dedicated generated directory.`);
  }
  if (fs.existsSync(siteTarget) && fs.lstatSync(siteTarget).isSymbolicLink()) {
    throw new Error(`Unsafe generated output target: ${siteTarget} must not be a symlink.`);
  }
  const defaultTarget = path.join(root, "site");
  if (process.env.SKILLISSUE_SITE_DIR && siteTarget !== defaultTarget && fs.existsSync(siteTarget)) {
    const entries = fs.readdirSync(siteTarget);
    if (entries.length && !entries.includes(GENERATED_SENTINEL)) {
      throw new Error(`Override output target is populated but not owned by this build (missing ${GENERATED_SENTINEL}): ${siteTarget}`);
    }
  }
}

function assertCommittedSkillTree() {
  let status;
  try {
    status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--ignored=matching", "--", "skills"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch (error) {
    throw new Error(`Cannot verify that skills/ is committed before generating install pins: ${error.message}`);
  }
  if (status) {
    throw new Error(`Refusing to generate stale package pins: commit all skills/ changes first. Dirty paths:\n${status}`);
  }
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON placed inside a script element must not be able to close that element. */
function jsonForScript(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${code}`;
  });
}

function listBundleFiles(directory, relative = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(directory, entry.name);
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listBundleFiles(child, childRelative));
    else if (entry.isFile()) files.push({ path: childRelative, absolute: child, mode: fs.statSync(child).mode });
  }
  return files;
}

function hashFiles(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update((file.mode & 0o111) === 0 ? "100644" : "100755");
    hash.update("\0");
    hash.update(file.path);
    hash.update("\0");
    hash.update(fs.readFileSync(file.absolute));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function normalList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function frontmatterMap(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]+[^\\n]+\\n?)*)`, "m"));
  if (!match) return {};
  return Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.match(/^\s+([A-Za-z0-9_-]+):\s*(.+)$/))
      .filter(Boolean)
      .map(([, field, value]) => [field, value.trim().replace(/^['"]|['"]$/g, "")]),
  );
}

function hasRunnableBundleMember(files) {
  return files.some((file) =>
    (file.mode & 0o111) !== 0 ||
    /^bin\//.test(file.path) ||
    /^scripts\/.*\.(?:[cm]?js|ts|py|sh|bash|zsh|rb|pl)$/i.test(file.path),
  );
}

function bundleFileKind(file) {
  const ext = path.extname(file.path).toLowerCase();
  if (/^scripts\//.test(file.path) || (file.mode & 0o111) !== 0) return "script";
  if ([".md", ".mdx", ".txt"].includes(ext)) return "reference";
  if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) return "config";
  return "resource";
}

function bundleFileGroup(file) {
  if (file.path === "SKILL.md") return "root";
  const group = file.path.split("/")[0];
  return ["references", "assets", "agents", "bin", "scripts"].includes(group) ? group : "other";
}

function bundleFileTitle(file) {
  if (file.path === "SKILL.md") return "SKILL.md";
  return path.basename(file.path, path.extname(file.path)).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function bundleFileSummary(file) {
  const group = bundleFileGroup(file);
  if (file.path === "SKILL.md") return "Primary agent instructions, frontmatter, workflow, and declared resource manifest.";
  if (group === "references") return "Reference material bundled with this skill.";
  if (group === "assets") return "Reusable asset bundled with this skill.";
  if (group === "agents") return "Agent-specific metadata bundled with this skill.";
  if (group === "scripts" || group === "bin") return "Runnable package helper. Inspect before running.";
  return "Bundled package file.";
}

function bundleBytes(files) {
  return files.reduce((total, file) => total + fs.statSync(file.absolute).size, 0);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return "main";
  }
}

/**
 * Install URLs must name an immutable commit that contains the package tree,
 * not whichever later commit happened to regenerate site output.
 */
function packageSourceSha() {
  try {
    const sourcePin = execSync("git log -1 --format=%H -- skills", {
      cwd: root,
      encoding: "utf8",
    }).trim();
    return sourcePin || gitSha();
  } catch {
    return gitSha();
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const fm = {};
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    let val = m[2];
    if (val === ">" || val === ">-" || val === "|" || val === "|-") {
      const parts = [];
      i++;
      while (
        i < lines.length &&
        (/^\s+/.test(lines[i]) || lines[i].trim() === "")
      ) {
        if (lines[i].trim()) parts.push(lines[i].replace(/^\s+/, ""));
        i++;
      }
      fm[key] = parts.join(" ").trim();
      continue;
    }
    if (!val) {
      // YAML block sequence: key on its own line, followed by "- item" lines
      let j = i + 1;
      const items = [];
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(
          lines[j]
            .replace(/^\s*-\s+/, "")
            .trim()
            .replace(/^["']|["']$/g, ""),
        );
        j++;
      }
      if (items.length) {
        fm[key] = items;
        i = j;
        continue;
      }
      fm[key] = "";
      i++;
      continue;
    }
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, "").trim();
    }
    i++;
  }
  const verMatch = raw.match(/version:\s*["']?([\d.]+)/);
  if (verMatch) fm.version = verMatch[1];
  return { fm, body };
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const html = [];
  let inList = false;
  let listTag = "ul";
  let inCode = false;
  let codeBuf = [];
  let inTable = false;
  let tableRows = [];
  let inBq = false;
  let bqBuf = [];

  const flushList = () => {
    if (inList) {
      html.push(`</${listTag}>`);
      inList = false;
    }
  };
  const flushTable = () => {
    if (!inTable) return;
    if (tableRows.length) {
      const [header, ...rest] = tableRows;
      const body = rest.filter(
        (r) => !r.every((c) => /^:?-+:?$/.test(c.trim())),
      );
      html.push('<div class="table-wrap"><table>');
      html.push(
        "<thead><tr>" +
          header.map((c) => `<th>${inline(c.trim())}</th>`).join("") +
          "</tr></thead>",
      );
      html.push("<tbody>");
      for (const row of body) {
        html.push(
          "<tr>" +
            row.map((c) => `<td>${inline(c.trim())}</td>`).join("") +
            "</tr>",
        );
      }
      html.push("</tbody></table></div>");
    }
    inTable = false;
    tableRows = [];
  };
  const flushBq = () => {
    if (!inBq) return;
    html.push(
      `<blockquote>${bqBuf.map((l) => inline(l)).join("<br>")}</blockquote>`,
    );
    inBq = false;
    bqBuf = [];
  };
  const inline = (s) => {
    let t = esc(s);
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<figure class="chart"><img src="$2" alt="$1" loading="lazy" /></figure>',
    );
    t = t.replace(
      /\[([^\]]+)\]\((https?:[^)]+|\/[^)]+|\.\.\/([a-z0-9]+(?:-[a-z0-9]+)*)\/story\.md)\)/g,
      (_, label, href, localSkill) => {
        const canonicalHref = localSkill ? `/skills/${localSkill}/` : href;
        const rel = canonicalHref.startsWith("http") ? ' rel="noopener"' : "";
        return `<a href="${canonicalHref}"${rel}>${label}</a>`;
      },
    );
    return t;
  };
  const parseRow = (line) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushList();
      flushTable();
      flushBq();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        html.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    // Allow raw HTML blocks for inline SVG figures (lines starting with <)
    if (/^<\/?(figure|div|svg|img|table|section)\b/i.test(line.trim())) {
      flushList();
      flushTable();
      flushBq();
      html.push(line);
      continue;
    }
    if (/^> /.test(line) || line === ">") {
      flushList();
      flushTable();
      if (!inBq) inBq = true;
      bqBuf.push(line.replace(/^>\s?/, ""));
      continue;
    }
    if (inBq && !/^>/.test(line)) flushBq();

    if (/^\|/.test(line) && line.includes("|")) {
      flushList();
      flushBq();
      if (!inTable) inTable = true;
      tableRows.push(parseRow(line));
      continue;
    }
    if (inTable) flushTable();

    if (/^### /.test(line)) {
      flushList();
      html.push(`<h3>${esc(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      flushList();
      html.push(`<h2>${esc(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      flushList();
      html.push(`<h2>${esc(line.slice(2))}</h2>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList || listTag !== "ul") {
        flushList();
        listTag = "ul";
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList || listTag !== "ol") {
        flushList();
        listTag = "ol";
        html.push("<ol>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^\d+\.\s/, ""))}</li>`);
    } else if (/^---+$/.test(line.trim())) {
      flushList();
      html.push("<hr>");
    } else if (!line.trim()) {
      flushList();
    } else {
      flushList();
      // Image-only paragraph: unwrap double figure from inline
      const imgOnly = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgOnly) {
        html.push(
          `<figure class="chart"><img src="${esc(imgOnly[2])}" alt="${esc(imgOnly[1])}" loading="lazy" /><figcaption>${esc(imgOnly[1])}</figcaption></figure>`,
        );
      } else {
        html.push(`<p>${inline(line)}</p>`);
      }
    }
  }
  flushList();
  flushTable();
  flushBq();
  if (inCode) html.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  return html.join("\n");
}

function loadDenylist() {
  const p = path.join(root, "catalog/denylist.txt");
  if (!fs.existsSync(p)) return new Set();
  return new Set(
    fs
      .readFileSync(p, "utf8")
      .split("\n")
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter(Boolean),
  );
}

function loadPublicationRegistry() {
  const registryPath = path.join(root, "catalog/autovault-publication.json");
  if (!fs.existsSync(registryPath)) return null;
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (registry.schemaVersion !== 1 || !registry.skills) {
    throw new Error(`Invalid publication registry: ${registryPath}`);
  }
  return registry;
}

/** Catalog groups — aliases collapse ops/operations, meta/hub, etc. */
const CATALOG_GROUPS = {
  agents: { label: "agents", order: 1 },
  cloudflare: { label: "cloudflare", order: 2 },
  git: { label: "git", order: 3 },
  browser: { label: "browser", order: 4 },
  desktop: { label: "desktop", order: 5 },
  ops: { label: "ops", order: 6 },
  mcp: { label: "mcp", order: 7 },
  writing: { label: "writing", order: 8 },
  workflow: { label: "workflow", order: 9 },
};

const CATEGORY_TO_GROUP = {
  analytics: "cloudflare",
  cloudflare: "cloudflare",
  deployment: "cloudflare",
  browser: "browser",
  desktop: "desktop",
  git: "git",
  review: "git",
  hub: "agents",
  meta: "agents",
  orchestration: "agents",
  iot: "ops",
  operations: "ops",
  ops: "ops",
  mcp: "mcp",
  docs: "writing",
  design: "writing",
  writing: "writing",
  terminal: "workflow",
  workflow: "workflow",
  research: "agents",
};

function catalogGroup(category) {
  const key = String(category || "")
    .toLowerCase()
    .trim();
  return CATEGORY_TO_GROUP[key] || key || "ops";
}

function groupOrderOf(id) {
  return CATALOG_GROUPS[id]?.order ?? 99;
}

function clampBlurb(text, max = 180) {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 80 ? cut.slice(0, sp) : cut).replace(/[,;:]\s*$/, "")}…`;
}

function extractWhy(body) {
  const m = String(body || "").match(
    /##\s+Why[^\n]*\n+([\s\S]*?)(?=\n##\s|$)/i,
  );
  if (!m) return "";
  const para = m[1]
    .split(/\n\n+/)
    .map((p) =>
      p
        .replace(/^#+\s+.*$/gm, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .find((p) => p.length > 24);
  return para || "";
}

function cardSummary(storyFm, storyBody, skillFm, name) {
  const fromStory = String(storyFm.summary || "").trim();
  if (fromStory) return clampBlurb(fromStory);
  const why = extractWhy(storyBody);
  if (why) return clampBlurb(why);
  return clampBlurb(skillFm.description || name);
}

function skillCard(s) {
  const tags = (s.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");
  return `<a class="card${s.featured ? " featured" : ""}" href="/skills/${esc(s.name)}/" data-category="${esc(s.category)}" data-featured="${s.featured ? "1" : "0"}">
  <div class="card-top"><h3>${esc(s.name)}</h3>
  ${s.featured ? '<span class="badge">featured</span>' : ""}
  </div>
  <p>${esc(s.summary)}</p>
  <div class="meta">${tags}<span class="tag">v${esc(s.version)}</span></div>
</a>`;
}

function shellLayout({ title, description, path: pagePath, body, active }) {
  const nav = [
    ["/", "home", "home"],
    ["/skills/", "skills", "skills"],
    ["/essays/", "essays", "essays"],
    ["/install/", "install", "install"],
    ["/about/", "about", "about"],
  ]
    .map(
      ([href, id, label]) =>
        `<a href="${href}"${active === id ? ' aria-current="page"' : ""}>${label}</a>`,
    )
    .join("\n        ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://skillissue.sh${esc(pagePath)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#0a0c0f">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="https://skillissue.sh/assets/og.png">
<meta property="og:url" content="https://skillissue.sh${esc(pagePath)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/${cssAssetName}">
<link rel="alternate" type="application/json" href="/skills.json" title="Skills catalog">
</head>
<body>
  <header class="top" id="topbar">
    <div class="wrap top-inner">
      <a class="brand" href="/">
        <span class="brand-mark" aria-hidden="true">$</span>
        <span>skillissue.sh</span>
      </a>
      <nav class="links" aria-label="Primary">
        ${nav}
        <a href="/skills.json">skills.json</a>
        <a href="https://github.com/jack-arturo/skillissue" rel="noopener">github</a>
      </nav>
    </div>
  </header>
  <main>
${body}
  </main>
  <footer>
    <div class="wrap foot-inner">
      <div>
        <span class="foot-mono">skillissue.sh</span>
        · MIT ·
        <a href="https://autovault.dev">AutoVault</a> ·
        <a href="https://automem.ai">AutoMem</a> ·
        <a href="/skills.json">skills.json</a>
      </div>
      <div class="foot-mono">packages on github · install via AutoVault</div>
    </div>
  </footer>
  <script>
    (function(){
      var t=document.getElementById('topbar');
      if(!t)return;
      var on=function(){t.classList.toggle('scrolled',window.scrollY>8)};
      window.addEventListener('scroll',on,{passive:true});on();
      document.addEventListener('click',async function(e){
        var b=e.target.closest('[data-copy]');if(!b)return;
        try{await navigator.clipboard.writeText(b.getAttribute('data-copy'));
          var p=b.textContent;b.textContent='copied';b.classList.add('copied');
          setTimeout(function(){b.textContent=p;b.classList.remove('copied')},1200);
        }catch(_){b.textContent='failed'}
      });
      document.addEventListener('click',function(e){
        var tab=e.target.closest('[data-install-tab]');if(!tab)return;
        var card=tab.closest('[data-install-mode]');if(!card)return;
        var mode=tab.getAttribute('data-install-tab');card.setAttribute('data-install-mode',mode);
        card.querySelectorAll('[data-install-tab]').forEach(function(button){button.setAttribute('aria-pressed',String(button===tab))});
        card.querySelectorAll('[data-install-panel]').forEach(function(panel){panel.hidden=panel.getAttribute('data-install-panel')!==mode});
      });
    })();
  </script>
</body>
</html>
`;
}

// --- load skills from repo tree ---
const deny = loadDenylist();
const publicationRegistry = loadPublicationRegistry();
assertCommittedSkillTree();
const packageSourcePin = packageSourceSha();
const shortPackageSourcePin = packageSourcePin.slice(0, 7);
const publicSkills = [];
const bundleSnapshots = [];
const errors = [];
const report = {
  public: 0,
  skipped: [],
  missingNarrative: [],
  missingSkillMd: [],
};

if (!fs.existsSync(skillsDir)) {
  console.error("Missing skills/ directory — GitHub SSOT required");
  process.exit(1);
}

for (const name of fs.readdirSync(skillsDir).sort()) {
  const dir = path.join(skillsDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const publication = publicationRegistry?.skills?.[name];
  if (publicationRegistry && publication?.visibility !== "public") {
    report.skipped.push(name);
    continue;
  }
  if (deny.has(name)) {
    report.skipped.push(name);
    continue;
  }
  const skillPath = path.join(dir, "SKILL.md");
  const storyPath = path.join(dir, "story.md");
  if (!fs.existsSync(skillPath)) {
    report.missingSkillMd.push(name);
    if (strict) errors.push(`missing SKILL.md: ${name}`);
    continue;
  }
  const skillRaw = fs.readFileSync(skillPath, "utf8");
  const { fm: skillFm } = parseFrontmatter(skillRaw);
  let storyFm = {};
  let storyBody = "";
  if (fs.existsSync(storyPath)) {
    const storyRaw = fs.readFileSync(storyPath, "utf8");
    const parsed = parseFrontmatter(storyRaw);
    storyFm = parsed.fm;
    storyBody = parsed.body;
  }
  const visibility = storyFm.visibility || "public";
  if (visibility !== "public") {
    report.skipped.push(name);
    continue;
  }
  const summary = cardSummary(storyFm, storyBody, skillFm, name);
  const description =
    (skillFm.description || "").replace(/\s+/g, " ").trim() || summary || name;
  const version = skillFm.version || storyFm.version_pin || "1.0.0";
  const provenance = storyFm.provenance || "house";
  const featured = storyFm.featured === true || storyFm.featured === "true";
  const category = String(storyFm.category || skillFm.category || "ops").toLowerCase().trim() || "ops";
  const group = catalogGroup(category);
  const bodyTrim = storyBody.trim();
  const hasNarrative =
    bodyTrim.length > 80 &&
    (/##\s+Why/i.test(storyBody) ||
      /##\s+History/i.test(storyBody) ||
      /##\s+How/i.test(storyBody) ||
      /##\s+Origin/i.test(storyBody));
  if (!hasNarrative) {
    report.missingNarrative.push(name);
    if (strict) errors.push(`public skill lacks story narrative: ${name}`);
  }

  const installId = `${REPO}@${packageSourcePin}:skills/${name}/SKILL.md`;
  const cliInstall = `autovault add ${installId} --sync-profiles`;
  const mcpInstall = `add_skill({ source: "github", identifier: "${installId}" })`;
  const sourceUrl = `https://github.com/${REPO}/blob/${packageSourcePin}/skills/${name}/SKILL.md`;
  const rawSourceUrl = `https://raw.githubusercontent.com/${REPO}/${packageSourcePin}/skills/${name}/SKILL.md`;
  const storyUrl = `https://skillissue.sh/skills/${name}/`;
  const bundleFiles = listBundleFiles(dir);
  const publishedBundleFiles = bundleFiles.filter((file) => file.path !== "story.md");
  const resourceFiles = bundleFiles.filter(
    (file) => file.path !== "SKILL.md" && file.path !== "story.md",
  );
  const resourceCount = resourceFiles.length;
  const runnable = hasRunnableBundleMember(resourceFiles);
  const capabilities = frontmatterMap(skillRaw, "capabilities");
  const requiresSecrets = normalList(skillFm["requires-secrets"]);
  const bundleSize = bundleBytes(bundleFiles);
  bundleSnapshots.push({
    name,
    version,
    contentHash: crypto.createHash("sha256").update(skillRaw).digest("hex"),
    bundleHash: hashFiles(bundleFiles),
    fileCount: bundleFiles.length,
  });

  publicSkills.push({
    name: skillFm.name || name,
    title: storyFm.title || skillFm.name || name,
    summary,
    description,
    category,
    group,
    version,
    tags: normalList(storyFm.tags || skillFm.tags),
    agents: normalList(skillFm.agents),
    featured,
    provenance,
    source: provenance,
    license: skillFm.license || "MIT",
    related: storyFm.related || [],
    first_used: storyFm.first_used || "",
    bodyHtml: mdToHtml(storyBody || `## ${name}\n\n${summary}`),
    skillSource: skillRaw,
    capabilities,
    requiresSecrets,
    cliInstall,
    mcpInstall,
    sourceUrl,
    rawSourceUrl,
    storyUrl,
    installId,
    resourceCount,
    resourceFiles: resourceFiles.map((file) => ({
      path: file.path,
      kind: bundleFileKind(file),
      bytes: fs.statSync(file.absolute).size,
    })),
    publishedBundleFiles,
    bundleFileCount: resourceFiles.length + 1,
    bundleSize,
    runnable,
  });
  report.public++;
}

publicSkills.sort((a, b) => {
  const ga = groupOrderOf(a.group);
  const gb = groupOrderOf(b.group);
  if (ga !== gb) return ga - gb;
  if (a.group !== b.group) return a.group.localeCompare(b.group);
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
  return a.name.localeCompare(b.name);
});

if (strict && errors.length) {
  console.error("STRICT FAIL:\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}

validateGeneratedTarget();
if (fs.existsSync(siteTarget) && !fs.lstatSync(siteTarget).isDirectory()) {
  throw new Error(`Generated output target must be a directory: ${siteTarget}`);
}
fs.mkdirSync(path.dirname(siteTarget), { recursive: true });
let stagingDir = fs.mkdtempSync(path.join(path.dirname(siteTarget), `.${path.basename(siteTarget)}.build-stage-`));
const siteDir = stagingDir;
process.once("exit", () => {
  if (stagingDir && fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
});

const reportRelative = path.relative(siteTarget, reportTarget);
if (reportRelative === "") throw new Error("SKILLISSUE_REPORT_PATH must name a file, not the generated output directory");
const reportInsideTarget = reportRelative !== ".." && !reportRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(reportRelative);
const generatedReportPath = reportInsideTarget ? path.join(siteDir, reportRelative) : reportTarget;

// CSS
fs.mkdirSync(path.join(siteDir, "assets"), { recursive: true });
fs.writeFileSync(path.join(siteDir, "assets", cssAssetName), cssSource);
fs.writeFileSync(path.join(siteDir, "assets", explorerAssetName), explorerSource);
fs.writeFileSync(path.join(siteDir, "assets", detailAssetName), detailSource);
for (const skill of publicSkills) {
  for (const file of skill.publishedBundleFiles) {
    const target = path.join(siteDir, "bundles", skill.name, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file.absolute, target);
  }
}
// Essay charts (SVG) + harvest data for transparency
const contentAssets = path.join(root, "content/assets");
if (fs.existsSync(contentAssets)) {
  fs.cpSync(contentAssets, path.join(siteDir, "assets"), { recursive: true });
}
const timelineJson = path.join(root, "content/data/tool-timeline.json");
if (fs.existsSync(timelineJson)) {
  fs.mkdirSync(path.join(siteDir, "assets/data"), { recursive: true });
  fs.copyFileSync(
    timelineJson,
    path.join(siteDir, "assets/data/tool-timeline.json"),
  );
}

// skills.json
const skillsJson = {
  name: "skillissue",
  url: "https://skillissue.sh",
  description:
    "Jack Arturo's personal/agent skills collection — packages on GitHub, install via AutoVault.",
  updated: new Date().toISOString().slice(0, 10),
  packageSourcePin,
  packageSourcePinShort: shortPackageSourcePin,
  repo: REPO,
  publicCount: publicSkills.length,
  install: {
    autovault: `autovault add ${REPO}@${packageSourcePin}:skills/<name>/SKILL.md --sync-profiles`,
    bootstrap: "https://autovault.sh",
  },
  featured: publicSkills.filter((s) => s.featured).map((s) => s.name),
  skills: publicSkills.map((s) => ({
    name: s.name,
    title: s.title,
    category: s.category,
    group: s.group,
    summary: s.summary,
    description: s.description,
    version: s.version,
    tags: s.tags,
    agents: s.agents,
    featured: !!s.featured,
    provenance: s.provenance,
    source: s.source,
    license: s.license,
    firstUsed: s.first_used,
    references: s.related.length,
    cliInstall: s.cliInstall,
    mcpInstall: s.mcpInstall,
    sourceUrl: s.sourceUrl,
    rawSourceUrl: s.rawSourceUrl,
    storyUrl: s.storyUrl,
    url: s.storyUrl,
    installId: s.installId,
    resourceCount: s.resourceCount,
    bundleFileCount: s.bundleFileCount,
    bundleSize: s.bundleSize,
    resources: s.resourceFiles,
    capabilities: s.capabilities,
    requiresSecrets: s.requiresSecrets,
    runnable: s.runnable,
    packageSourcePin,
  })),
};
fs.writeFileSync(
  path.join(siteDir, "skills.json"),
  JSON.stringify(skillsJson, null, 2) + "\n",
);

// per-skill pages
for (const s of publicSkills) {
  const dir = path.join(siteDir, "skills", s.name);
  fs.mkdirSync(dir, { recursive: true });
  const featuredBadge = s.featured ? '<span class="badge">featured</span>' : "";
  const related = (s.related || [])
    .filter((n) => publicSkills.some((p) => p.name === n))
    .map((n) => `<a class="tag" href="/skills/${esc(n)}/">${esc(n)}</a>`)
    .join(" ");
  const tags = (s.tags || [])
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");
  const viewerFiles = s.publishedBundleFiles.map((file) => ({
    path: file.path,
    kind: file.path === "SKILL.md" ? "markdown" : bundleFileKind(file),
    group: bundleFileGroup(file),
    title: bundleFileTitle(file),
    summary: bundleFileSummary(file),
    bytes: fs.statSync(file.absolute).size,
    url: `/bundles/${s.name}/${file.path}`,
  }));
  const groupLabels = { root: "Skill root", references: "Reference docs", assets: "Assets", agents: "Agent metadata", bin: "Commands", scripts: "Scripts", other: "Other files" };
  const resourceTree = ["root", "references", "assets", "agents", "bin", "scripts", "other"].map((group) => {
    const files = viewerFiles.filter((file) => file.group === group);
    if (!files.length) return "";
    return `<div class="package-resource-group"><p>${groupLabels[group]}</p>${files.map((file) => `<div class="package-resource-row"><button type="button" data-package-file="${esc(file.path)}"><span class="package-file-kind">${esc(file.kind)}</span><span><strong>${esc(file.title)}</strong><small>${esc(file.path)} · ${esc(formatBytes(file.bytes))}</small></span></button><a href="${esc(file.url)}" rel="noopener">raw</a></div>`).join("")}</div>`;
  }).join("");
  const capabilityRows = Object.entries(s.capabilities).length
    ? Object.entries(s.capabilities).map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")
    : '<div><dt>Capabilities</dt><dd>Not declared</dd></div>';
  const secrets = s.requiresSecrets.length
    ? `<p class="muted">Requires: ${esc(s.requiresSecrets.join(", "))}</p>`
    : '<p class="muted">No secrets declared by this package.</p>';
  const body = `<div data-package-detail>
    <section class="skill-package">
      <div class="wrap">
        <p class="package-breadcrumb"><a href="/skills/">Skills</a><span>/</span><span>${esc(s.provenance)}</span><span>/</span><span>${esc(s.name)}</span></p>
        <div class="skill-package-top">
          <div class="skill-package-intro">
            <span class="explorer-mark" aria-hidden="true">${esc(explorerMark(s.name))}</span>
            <div><p class="explorer-kicker">Hosted skill bundle · ${esc(s.provenance)} · ${esc(s.category)}</p><h1>${esc(s.title)}</h1><p class="lede">${esc(s.summary)}</p></div>
          </div>
          <aside class="skill-install-card">
            <span>Pinned install</span><code>${esc(s.cliInstall)}</code>
            <div><button type="button" class="btn btn-primary" data-copy="${esc(s.cliInstall)}">Copy install</button><a class="btn btn-ghost" href="${esc(s.rawSourceUrl)}" rel="noopener">Raw</a></div>
          </aside>
        </div>
        <dl class="skill-facts">
          <div><dt>Version</dt><dd>v${esc(s.version)}</dd></div>
          <div><dt>License</dt><dd>${esc(s.license)}</dd></div>
          <div><dt>Targets</dt><dd>${esc((s.agents?.length ? s.agents : ["general"]).join(", "))}</dd></div>
          <div><dt>Bundle</dt><dd>${s.bundleFileCount} files · ${s.resourceCount} resources${s.runnable ? " · runnable" : ""} · ${esc(formatBytes(s.bundleSize))}</dd></div>
        </dl>
        <div class="meta skill-meta">${tags}<span class="badge">${esc(s.provenance)}</span>${featuredBadge}</div>
        <nav class="package-nav" aria-label="Package sections"><button type="button" data-package-tab="overview" aria-selected="true">Overview</button><button type="button" data-package-tab="bundle" aria-selected="false">Bundle <span>${s.bundleFileCount}</span></button><button type="button" data-package-tab="permissions" aria-selected="false">Permissions</button><button type="button" data-package-tab="provenance" aria-selected="false">Provenance</button><button type="button" data-package-tab="source" aria-selected="false">Source</button></nav>
      </div>
    </section>
    <section><div class="wrap package-detail-grid">
      <main class="package-panels prose">
        <section class="package-section" id="overview" data-package-panel="overview"><div class="package-overview"><p class="explorer-kicker">Overview</p>${s.bodyHtml}${related ? `<h3>Related skills</h3><div class="meta">${related}</div>` : ""}</div></section>
        <section class="package-section" id="bundle" data-package-panel="bundle"><div class="skill-resources"><div class="section-head"><div><p class="explorer-kicker">Bundle contents</p><h2>Inspect every package file</h2></div><span class="bundle-count">${s.bundleFileCount} files</span></div><p class="muted">Select a file to preview it from this public package. Script-like files are inspection-only.</p><div class="package-bundle-grid"><nav class="package-resource-tree" aria-label="Bundle files">${resourceTree}</nav><article class="package-resource-preview" data-package-preview><div class="package-resource-preview-head"><div><span data-package-preview-kind>markdown</span><strong data-package-preview-name>SKILL.md</strong></div><a data-package-preview-raw href="/bundles/${esc(s.name)}/SKILL.md">view raw →</a></div><div class="package-resource-summary"><h3>Inspect the bundle</h3><p data-package-preview-summary>Primary agent instructions, frontmatter, workflow, and declared resource manifest.</p></div><pre data-package-preview-content>Select a package file to inspect it.</pre></article></div></div></section>
        <section class="package-section" id="permissions" data-package-panel="permissions"><p class="explorer-kicker">Permissions</p><h2>Declared capability surface</h2><dl class="permission-facts">${capabilityRows}</dl>${secrets}</section>
        <section class="package-section" id="provenance" data-package-panel="provenance"><p class="explorer-kicker">Provenance</p><h2>Public, pinned, and inspectable</h2><p>This ${esc(s.provenance)} package is installed from the Git commit shown above. Its source, bundle files, and declared surface are available before you run it.</p><dl class="permission-facts"><div><dt>Source model</dt><dd>GitHub package bundle</dd></div><div><dt>Package pin</dt><dd><code>${esc(shortPackageSourcePin)}</code></dd></div><div><dt>Compatibility</dt><dd>${esc((s.agents?.length ? s.agents : ["general"]).join(", "))}</dd></div></dl></section>
        <section class="package-section" id="source" data-package-panel="source"><p class="explorer-kicker">Source</p><h2>SKILL.md</h2><p><a href="${esc(s.rawSourceUrl)}" rel="noopener">Open the raw source</a></p><pre class="package-source"><code>${esc(s.skillSource)}</code></pre></section>
      </main>
      <aside class="package-rail"><section><p>Compatibility</p>${(s.agents?.length ? s.agents : ["general"]).map((agent) => `<div><span>${esc(agent)}</span><b>declared</b></div>`).join("")}</section><section><p>Metadata</p><dl><dt>version</dt><dd>${esc(s.version)}</dd><dt>size</dt><dd>${esc(formatBytes(s.bundleSize))}</dd><dt>license</dt><dd>${esc(s.license)}</dd><dt>source</dt><dd>${esc(s.provenance)}</dd></dl></section><section><p>Permission summary</p>${Object.entries(s.capabilities).map(([key, value]) => `<div><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join("") || "<div><span>capabilities</span><b>not declared</b></div>"}</section></aside>
    </div></section>
    <script id="package-data" type="application/json">${jsonForScript({ files: viewerFiles })}</script><script type="module" src="/assets/${detailAssetName}"></script>
  </div>`;
  fs.writeFileSync(
    path.join(dir, "index.html"),
    shellLayout({
      title: `${s.name} — skillissue.sh`,
      description: s.summary,
      path: `/skills/${s.name}/`,
      body,
      active: "skills",
    }),
  );
}

// catalog — the links below are the no-JavaScript experience. The module only
// refines them into a searchable, shareable Explorer.
fs.mkdirSync(path.join(siteDir, "skills"), { recursive: true });
const explorerData = {
  packageSourcePin,
  skills: publicSkills.map((s) => ({
    name: s.name,
    title: s.title,
    summary: s.summary,
    description: s.description,
    storyUrl: s.storyUrl,
    category: s.category,
    group: s.group,
    tags: s.tags,
    agents: s.agents,
    featured: s.featured,
    version: s.version,
    provenance: s.provenance,
    source: s.source,
    license: s.license,
    firstUsed: s.first_used,
    references: s.related.length,
    resourceCount: s.resourceCount,
    bundleFileCount: s.bundleFileCount,
    bundleSize: s.bundleSize,
    runnable: s.runnable,
    cliInstall: s.cliInstall,
    mcpInstall: s.mcpInstall,
    sourceUrl: s.sourceUrl,
    rawSourceUrl: s.rawSourceUrl,
    packageSourcePin,
  })),
};
function explorerMark(name) {
  return name.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function explorerResourceLabel(skill) {
  return `${skill.resourceCount} resource${skill.resourceCount === 1 ? "" : "s"}`;
}

function explorerAgentPills(skill) {
  const agents = skill.agents?.length ? skill.agents : ["general"];
  return agents.slice(0, 3).map((agent) => `<span class="explorer-agent">${esc(agent)}</span>`).join("");
}

function fallbackExplorerCard(skill) {
  return `<article class="explorer-card" data-explorer-card data-skill="${esc(skill.name)}">
  <header class="explorer-card-head">
    <span class="explorer-mark" data-explorer-mark aria-hidden="true">${esc(explorerMark(skill.name))}</span>
    <div><p class="explorer-kicker">public package · ${esc(skill.provenance)} · ${esc(skill.category)}</p><h2><a href="/skills/${esc(skill.name)}/">${esc(skill.title || skill.name)}</a></h2></div>
  </header>
  <p class="explorer-card-summary">${esc(skill.summary)}</p>
  <div class="explorer-agent-row" aria-label="Agent targets">${explorerAgentPills(skill)}</div>
  <footer class="explorer-card-footer"><span>v${esc(skill.version)} · ${esc(skill.license || "MIT")} · ${esc(explorerResourceLabel(skill))}${skill.runnable ? " · runnable" : ""}</span><div><a href="${esc(skill.rawSourceUrl)}" rel="noopener">Raw</a><button type="button" class="explorer-copy" data-copy="${esc(skill.cliInstall)}">Copy install</button></div></footer>
</article>`;
}

const fallbackRows = publicSkills.map(fallbackExplorerCard).join("\n");
const firstSkill = publicSkills[0];

fs.writeFileSync(
  path.join(siteDir, "skills/index.html"),
  shellLayout({
    title: "Skills — skillissue.sh",
    description: "Jack Arturo's public agent skills — packages on GitHub, install via AutoVault.",
    path: "/skills/",
    body: `
    <section class="hero catalog-hero"><div class="wrap">
      <div class="prompt"><span class="dot"></span> ${publicSkills.length} public · package source ${esc(shortPackageSourcePin)}</div>
      <h1>Skills Explorer</h1>
      <p class="lede">A public package directory. Scan the bundle, copy a pinned install, or open the package when you need the deeper notes.</p>
    </div></section>
    <section class="catalog-body"><div class="wrap">
      <div class="explorer" data-catalog-explorer>
        <form class="explorer-facets" aria-label="Filter skills">
          <label for="explorer-q">Search</label>
          <input class="search" id="explorer-q" name="q" type="search" placeholder="name, summary, description, tag" autocomplete="off" spellcheck="false">
          <label for="explorer-category">Category</label>
          <select id="explorer-category" name="category"><option value="">All categories</option></select>
          <label for="explorer-agent">Agent</label>
          <select id="explorer-agent" name="agent"><option value="">All agents</option></select>
          <label for="explorer-source">Source</label>
          <select id="explorer-source" name="source"><option value="">All sources</option></select>
          <label class="explorer-check"><input type="checkbox" name="featured"> Featured only</label>
          <label for="explorer-resources">Package resources</label>
          <select id="explorer-resources" name="resources"><option value="">Any package</option><option value="yes">Has resources</option><option value="none">No resources</option></select>
          <p class="section-note" data-explorer-count aria-live="polite">Showing ${publicSkills.length} of ${publicSkills.length} skills</p>
        </form>
        <div class="explorer-main"><div class="explorer-toolbar"><div class="explorer-sort" role="group" aria-label="Sort skills"><span>Sort</span><button type="button" data-explorer-sort="referenced" aria-pressed="true">Most referenced</button><button type="button" data-explorer-sort="recent" aria-pressed="false">Recent</button><button type="button" data-explorer-sort="name" aria-pressed="false">Name</button></div><div class="explorer-view" role="group" aria-label="Result view"><button type="button" data-explorer-view="grid" aria-pressed="true">Grid</button><button type="button" data-explorer-view="list" aria-pressed="false">List</button></div></div><div class="explorer-results" data-explorer-results aria-label="Skill results">${fallbackRows}</div></div>
      </div>
    </div></section>
    <script id="explorer-data" type="application/json">${jsonForScript(explorerData)}</script>
    <script type="module" src="/assets/${explorerAssetName}"></script>`,
    active: "skills",
  }),
);

// home
const featured = publicSkills
  .filter((s) => s.featured)
  .sort((a, b) => a.name.localeCompare(b.name));
const featCards = featured
  .map(
    (s) => `<a class="card featured" href="/skills/${esc(s.name)}/">
  <div class="card-top"><h3>${esc(s.name)}</h3><span class="badge">featured</span></div>
  <p>${esc(s.summary)}</p>
</a>`,
  )
  .join("\n");

const sampleCli =
  publicSkills.find((s) => s.name === "cloudflare-ops")?.cliInstall ||
  publicSkills[0]?.cliInstall ||
  "";

fs.writeFileSync(
  path.join(siteDir, "index.html"),
  shellLayout({
    title: "skillissue.sh — agent skills that earn their keep",
    description:
      "Jack Arturo's personal/agent skills. Packages live on GitHub; install with AutoVault.",
    path: "/",
    body: `
    <section class="hero">
      <div class="wrap">
        <div class="prompt"><span class="dot"></span> live · ${publicSkills.length} public skills · package source ${esc(shortPackageSourcePin)}</div>
        <h1><span class="path">skillissue</span>.sh<span class="cursor" aria-hidden="true"></span></h1>
        <p class="lede">
          Jack Arturo’s personal/agent skills —
          the ones that <strong>earn their keep</strong>.
          Packages live in this GitHub repo. Install with AutoVault. Not a marketplace.
        </p>
        <div class="cta-row">
          <a class="btn btn-primary" href="/skills/">Browse skills</a>
          <a class="btn btn-ghost" href="/install/">Install with AutoVault</a>
          <a class="btn btn-ghost" href="/about/">The story</a>
        </div>
        <div class="term" aria-label="Example terminal session">
          <div class="term-bar"><i></i><i></i><i></i><span class="term-title">zsh · skillissue</span></div>
          <div class="term-body">
            <div><span class="dim">$</span> <span class="cmd">${esc(sampleCli)}</span></div>
            <div class="ok">✓ package from github · vault syncs claude-code · codex · cursor</div>
            <div class="amber"># if your agent still can't ship… skill issue</div>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><b>${publicSkills.length}</b><span>public skill pages</span></div>
          <div class="stat"><b>${featured.length}</b><span>featured</span></div>
          <div class="stat"><b>${esc(shortPackageSourcePin)}</b><span>package-source install pin</span></div>
        </div>
      </div>
    </section>
    <section id="featured">
      <div class="wrap">
        <div class="section-head"><h2>Featured</h2><div class="section-note">house skills that pull weight</div></div>
        <div class="grid">${featCards}</div>
      </div>
    </section>
    <section id="newsletter">
      <div class="wrap">
        <div class="section-head"><h2>Get drops</h2><div class="section-note">occasional · no spam</div></div>
        <div class="panel" style="max-width:36rem">
          <h3>Skills that earn their keep</h3>
          <p>Occasional notes when a new skill ships or an old one levels up. Unsubscribe anytime.</p>
          <form class="signup" id="signup" action="/api/signup" method="POST">
            <input type="email" name="email" required placeholder="you@example.com" autocomplete="email" class="search" style="margin-bottom:0.6rem">
            <input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
            <input type="hidden" name="source" value="skillissue-hub">
            <button type="submit" class="btn btn-primary">Subscribe</button>
            <p class="form-msg" id="signup-msg" hidden></p>
          </form>
        </div>
      </div>
    </section>
    <section>
      <div class="wrap about" style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:1.25rem">
        <div>
          <h2>Why this exists</h2>
          <p class="muted">AutoVault holds the runtime vault on your machine. This repo holds the public packages. skillissue.sh is the shelf — stories plus <code>autovault add</code>.</p>
          <p><a href="/about/">Read the stack story →</a></p>
        </div>
        <div class="callout">
          <h3>$ whoami</h3>
          <p>Jack Arturo — Very Good Plugins, AutoHub, AutoMem, AutoVault. Personal tooling made public where useful.</p>
        </div>
      </div>
    </section>
    <script>
    (function(){
      var f=document.getElementById('signup'); if(!f)return;
      f.addEventListener('submit',async function(e){
        e.preventDefault();
        var msg=document.getElementById('signup-msg');
        var fd=new FormData(f);
        var body=Object.fromEntries(fd.entries());
        try{
          var r=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'fetch'},body:JSON.stringify(body)});
          var j={}; try{j=await r.json()}catch(_){}
          msg.hidden=false;
          msg.textContent=r.ok?(j.message||'Signed up.'):(j.error||'Signup failed — try again later.');
        }catch(_){msg.hidden=false;msg.textContent='Network error — try again later.'}
      });
    })();
    </script>`,
    active: "home",
  }),
);

function storyPage(slug, fallbackTitle, fallbackMd, active) {
  const p = path.join(contentStory, `${slug}.md`);
  let title = fallbackTitle;
  let bodyMd = fallbackMd;
  if (fs.existsSync(p)) {
    const { fm, body } = parseFrontmatter(fs.readFileSync(p, "utf8"));
    title = fm.title || fallbackTitle;
    bodyMd = body;
  }
  const dir = path.join(siteDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.html"),
    shellLayout({
      title: `${title} — skillissue.sh`,
      description: title,
      path: `/${slug}/`,
      body: `<section class="hero" style="padding-bottom:1rem"><div class="wrap"><h1>${esc(title)}</h1></div></section>
    <section style="padding-top:0"><div class="wrap prose">${mdToHtml(bodyMd)}</div></section>`,
      active,
    }),
  );
}

storyPage(
  "about",
  "About",
  `## The short version

skillissue.sh is the public shelf for skills Jack actually runs. **Packages live in this GitHub repo** under \`skills/\`. You install them with [AutoVault](https://autovault.dev). Memory for the agents lives in [AutoMem](https://automem.ai).

## The longer version

I build tools for agents the way I used to build WordPress plugins — ship something that survives real use, then package the pattern so the next agent doesn't re-learn it cold.

**Very Good Plugins** paid the bills. **AutoHub** became the agent runtime. **AutoMem** gave assistants durable memory. **AutoVault** is where skills get validated, signed, and synced across Claude Code, Codex, Cursor, and friends.

This site is not a registry and not a clone of autovault.dev. It's a shelf with install pins into the same git tree you can read on GitHub.
`,
  "about",
);

storyPage(
  "install",
  "Install",
  `## 1. Get AutoVault

If you don't have it yet:

\`\`\`
curl -fsSL https://autovault.sh | sh
\`\`\`

Or see [autovault.dev quick-start](https://autovault.dev/quick-start).

## 2. Add a skill from this repo

Every public skill page has a copy button. Pattern:

\`\`\`
autovault add jack-arturo/skillissue@<sha>:skills/<name>/SKILL.md --sync-profiles
\`\`\`

The \`@sha\` pin is the last committed package-source revision, so installs stay reproducible even when the site itself is rebuilt later. Packages are multi-file when needed (resources, bin scripts) — that's why we use GitHub source, not a lone SKILL.md URL.

## 3. What AutoVault does

1. Fetches the skill bundle at that commit  
2. Validates / signs into your local vault  
3. Syncs into agent skill directories (Claude Code, Codex, Cursor, …)

You do **not** need an AutoVault MCP server for day-to-day use after sync — the files land where the agent already looks.

## MCP form

\`\`\`
add_skill({ source: "github", identifier: "jack-arturo/skillissue@<sha>:skills/<name>/SKILL.md" })
\`\`\`
`,
  "install",
);

// Essays from content/essays/*.md
const essaysDir = path.join(root, "content/essays");
const essayIndex = [];
if (fs.existsSync(essaysDir)) {
  for (const file of fs
    .readdirSync(essaysDir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const raw = fs.readFileSync(path.join(essaysDir, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    if (fm.visibility === "internal") continue;
    const slug = file.replace(/\.md$/, "");
    const title = fm.title || slug;
    const description = fm.description || title;
    essayIndex.push({ slug, title, description, date: fm.date || "" });
    const dir = path.join(siteDir, "essays", slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      shellLayout({
        title: `${title} — skillissue.sh`,
        description,
        path: `/essays/${slug}/`,
        body: `<section class="hero" style="padding-bottom:1rem"><div class="wrap">
          <div class="prompt"><span class="dot"></span> essay${fm.date ? ` · ${esc(fm.date)}` : ""}</div>
          <h1>${esc(title)}</h1>
          ${description ? `<p class="lede">${esc(description)}</p>` : ""}
        </div></section>
        <section style="padding-top:0"><div class="wrap prose">${mdToHtml(body)}</div></section>`,
        active: "essays",
      }),
    );
  }
}
if (essayIndex.length) {
  fs.mkdirSync(path.join(siteDir, "essays"), { recursive: true });
  const cards = essayIndex
    .map(
      (e) => `<a class="card featured" href="/essays/${esc(e.slug)}/">
  <div class="card-top"><h3>${esc(e.title)}</h3>${e.date ? `<span class="tag">${esc(e.date)}</span>` : ""}</div>
  <p>${esc(e.description)}</p>
</a>`,
    )
    .join("\n");
  fs.writeFileSync(
    path.join(siteDir, "essays/index.html"),
    shellLayout({
      title: "Essays — skillissue.sh",
      description: "Long-form writing on skills, MCP, and context discipline.",
      path: "/essays/",
      body: `<section class="hero" style="padding-bottom:1.5rem"><div class="wrap"><h1>Essays</h1>
        <p class="lede">Longer writing about skills, tools, and not drowning your agent.</p></div></section>
        <section style="padding-top:0"><div class="wrap"><div class="grid">${cards}</div></div></section>`,
      active: "essays",
    }),
  );
}

storyPage(
  "changelog",
  "Changelog",
  `## 0.3.2 — 2026-07-20

- Essay tightened to friendly overview + deep-post link
- Git-harvested tool timeline JSON + SVG chart suite (floor vs registry, evolution, offline benches)
- Markdown renderer: tables, blockquotes, figures, ordered lists

## 0.3.1 — 2026-07-20

- Essay: Skills Are the New MCP Bloat

## 0.3.0 — 2026-07-20

- GitHub SSOT: packages under \`skills/<name>/\` (SKILL.md + story.md)
- AutoVault install rows (CLI + MCP) pinned to the immutable package-source commit
- Email list: D1 LEAD_DB + Resend
- Removed typo-domain marketing copy

## 0.2.0 — 2026-07-20

- Catalog generator + 30 narratives

## 0.1.0 — 2026-07-19

- Initial hub on Cloudflare Pages
`,
  "home",
);

// llms + sitemap + robots + headers
const llms = `# skillissue.sh

> Jack Arturo's personal/agent skills. Packages on GitHub; install with AutoVault.

## Site
- Home: https://skillissue.sh/
- Catalog: https://skillissue.sh/skills/
- Machine catalog: https://skillissue.sh/skills.json
- Source packages: https://github.com/jack-arturo/skillissue/tree/${packageSourcePin}/skills
- Package-source install pin: ${packageSourcePin}

## Install
\`\`\`
autovault add jack-arturo/skillissue@${packageSourcePin}:skills/<name>/SKILL.md --sync-profiles
\`\`\`

## Public skills (${publicSkills.length})
${publicSkills.map((s) => `- ${s.name} (v${s.version}) — ${s.description}`).join("\n")}
`;
fs.writeFileSync(path.join(siteDir, "llms.txt"), llms);

const urls = [
  "/",
  "/skills/",
  "/essays/",
  "/about/",
  "/install/",
  "/changelog/",
  "/skills.json",
  "/llms.txt",
  ...publicSkills.map((s) => `/skills/${s.name}/`),
  ...essayIndex.map((e) => `/essays/${e.slug}/`),
];
fs.writeFileSync(
  path.join(siteDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>https://skillissue.sh${u}</loc><changefreq>weekly</changefreq></url>`,
      )
      .join("\n") +
    `\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(siteDir, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: https://skillissue.sh/sitemap.xml\n`,
);
const redirects = Object.entries(publicationRegistry?.skills || {})
  .filter(([, entry]) => entry.visibility === "hidden" && entry.replacement)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, entry]) => `/skills/${name}/ /skills/${entry.replacement}/ 301`)
  .join("\n");
fs.writeFileSync(path.join(siteDir, "_redirects"), redirects ? `${redirects}\n` : "");
fs.writeFileSync(
  path.join(siteDir, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/skills.json
  Cache-Control: public, max-age=300

/llms.txt
  Cache-Control: public, max-age=300
`,
);

report.generatedAt = new Date().toISOString();
report.packageSourcePin = packageSourcePin;
report.packageSourcePinShort = shortPackageSourcePin;
report.publicSkills = publicSkills.map((s) => s.name);
const reportJson = JSON.stringify(report, null, 2) + "\n";
if (reportInsideTarget) {
  fs.mkdirSync(path.dirname(generatedReportPath), { recursive: true });
  fs.writeFileSync(generatedReportPath, reportJson);
}
fs.writeFileSync(path.join(siteDir, GENERATED_SENTINEL), "skillissue generated output v1\n");

function unusedBuildSibling(kind) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = path.join(
      path.dirname(siteTarget),
      `.${path.basename(siteTarget)}.build-${kind}-${process.pid}-${Date.now()}-${attempt}`,
    );
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not reserve a generated output ${kind} path beside ${siteTarget}`);
}

let previousSite = null;
if (fs.existsSync(siteTarget)) {
  previousSite = unusedBuildSibling("backup");
  fs.renameSync(siteTarget, previousSite);
}
try {
  fs.renameSync(stagingDir, siteTarget);
  stagingDir = null;
} catch (error) {
  if (previousSite) {
    try {
      fs.renameSync(previousSite, siteTarget);
    } catch (restoreError) {
      throw new Error(`Generated output swap failed: ${error.message}; restoring the previous target also failed: ${restoreError.message}`, { cause: error });
    }
  }
  throw new Error(`Generated output swap failed; the previous target was restored: ${error.message}`, { cause: error });
}
if (previousSite) fs.rmSync(previousSite, { recursive: true, force: false });

if (!reportInsideTarget) {
  fs.mkdirSync(path.dirname(reportTarget), { recursive: true });
  fs.writeFileSync(reportTarget, reportJson);
}
if (!process.env.SKILLISSUE_SITE_DIR && !process.env.SKILLISSUE_REPORT_PATH) {
  fs.writeFileSync(
    path.join(root, "catalog", "autovault-sync.json"),
    JSON.stringify({
      schemaVersion: 3,
      target: "skillissue",
      hashAlgorithm: "sha256",
      bundleHashAlgorithm: "git-mode-path-bytes-v1",
      skills: bundleSnapshots.sort((a, b) => a.name.localeCompare(b.name)),
    }, null, 2) + "\n",
  );
}

console.log(
  `Built site: ${report.public} public from skills/ · package source ${shortPackageSourcePin}`,
);
if (report.missingNarrative.length) {
  console.warn("Missing narrative:", report.missingNarrative.join(", "));
}
