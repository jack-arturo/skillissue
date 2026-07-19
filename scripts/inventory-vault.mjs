#!/usr/bin/env node
/**
 * Scan ~/.autovault/skills (or AUTOVAULT_SKILLS_PATH) and write catalog/vault-index.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const vaultRoot =
  process.env.AUTOVAULT_SKILLS_PATH ||
  path.join(process.env.HOME || "", ".autovault/skills");

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
      while (i < lines.length && (/^\s+/.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim()) parts.push(lines[i].replace(/^\s+/, ""));
        i++;
      }
      fm[key] = parts.join(" ").trim();
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
  // nested metadata.version
  const verMatch = raw.match(/version:\s*["']?([\d.]+)/);
  if (verMatch && !fm.version) fm.version = verMatch[1];
  if (fm.metadata && typeof fm.metadata === "string") {
    /* ignore */
  }
  return { fm, body };
}

function listSkills(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Vault not found: ${dir}`);
    process.exit(1);
  }
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const skillDir = path.join(dir, name);
    if (!fs.statSync(skillDir).isDirectory()) continue;
    const skillMd = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillMd)) continue;
    const text = fs.readFileSync(skillMd, "utf8");
    const { fm, body } = parseFrontmatter(text);
    const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
    let resourceCount = 0;
    try {
      resourceCount = fs
        .readdirSync(skillDir, { withFileTypes: true })
        .filter((d) => d.name !== "SKILL.md" && !d.name.startsWith("."))
        .length;
    } catch {
      /* ignore */
    }
    out.push({
      name: fm.name || name,
      dirName: name,
      description: (fm.description || "").replace(/\s+/g, " ").trim(),
      category: fm.category || "uncategorized",
      version: fm.version || "?",
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      agents: Array.isArray(fm.agents) ? fm.agents : [],
      license: fm.license || "",
      resourceCount,
      contentHash: hash,
      bodyChars: body.length,
    });
  }
  return out;
}

const skills = listSkills(vaultRoot);
const catalogDir = path.join(root, "catalog");
fs.mkdirSync(catalogDir, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  vaultRoot,
  count: skills.length,
  skills,
};
const outPath = path.join(catalogDir, "vault-index.json");
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${skills.length} skills → ${outPath}`);
