#!/usr/bin/env node
/**
 * Audit an explicitly approved local AutoVault skill cohort before migration.
 *
 * The local vault is input only. This script never writes into the repository.
 * Set AUTOVAULT_SKILLS_PATH or supply --source <directory>; do not supply both.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDir, "..");
export const releaseManifestPath = path.join(repositoryRoot, "catalog", "local-skill-release.json");

function fail(message) {
  throw new Error(message);
}

function safeRelative(relativePath, label) {
  if (!relativePath || path.isAbsolute(relativePath)) fail(`${label} must be relative`);
  const parts = relativePath.split(/[\\/]+/);
  if (parts.some((part) => !part || part === "." || part === "..")) {
    fail(`${label} must not contain traversal`);
  }
  return parts.join(path.sep);
}

function beneath(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} escapes its bundle root`);
  }
}

export function readReleaseManifest() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(releaseManifestPath, "utf8"));
  } catch (error) {
    fail(`Cannot read release manifest: ${error.message}`);
  }
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.packages)) {
    fail("Release manifest must contain schemaVersion 1 and a packages array");
  }
  if (new Set(manifest.packages).size !== manifest.packages.length) {
    fail("Release manifest contains duplicate package names");
  }
  for (const name of manifest.packages) {
    if (typeof name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      fail(`Release manifest contains unsafe package name: ${String(name)}`);
    }
  }
  return manifest;
}

export function parseAuditArgs(argv) {
  const args = { skills: [], json: false, help: false, source: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source" || arg === "--skill") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      index += 1;
      if (arg === "--source") {
        if (args.source) fail("--source may be supplied only once");
        args.source = value;
      } else {
        args.skills.push(value);
      }
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }
  return args;
}

export function resolveSourceRoot(explicitSource) {
  if (explicitSource && process.env.AUTOVAULT_SKILLS_PATH) {
    fail("Source root is ambiguous: use --source or AUTOVAULT_SKILLS_PATH, not both");
  }
  const supplied = explicitSource || process.env.AUTOVAULT_SKILLS_PATH;
  if (!supplied) {
    fail("A source root is required: set AUTOVAULT_SKILLS_PATH or pass --source <directory>");
  }
  const sourceRoot = path.resolve(supplied);
  let stat;
  try {
    stat = fs.lstatSync(sourceRoot);
  } catch (error) {
    fail(`Cannot inspect source root ${sourceRoot}: ${error.message}`);
  }
  if (stat.isSymbolicLink()) fail("Source root must not be a symlink");
  if (!stat.isDirectory()) fail("Source root must be a directory");
  if (fs.existsSync(path.join(sourceRoot, "SKILL.md"))) {
    fail("Source root is ambiguous: expected a directory containing named skill bundles");
  }
  return fs.realpathSync(sourceRoot);
}

function auditTree(bundleRoot) {
  const files = [];
  const directories = [];
  const omitted = [];

  function visit(directory, relativeDirectory = "", withinMetadata = false) {
    const entries = fs.readdirSync(directory).sort();
    for (const entry of entries) {
      const relative = relativeDirectory ? path.posix.join(relativeDirectory, entry) : entry;
      const absolute = path.join(directory, entry);
      beneath(bundleRoot, absolute, `Entry ${relative}`);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) fail(`Rejected symlink: ${relative}`);
      if (!stat.isDirectory() && !stat.isFile()) fail(`Rejected special file: ${relative}`);
      const omittedMetadata = withinMetadata || entry.startsWith(".autovault-");
      if (omittedMetadata) {
        if (!withinMetadata) omitted.push(relative);
        if (stat.isDirectory()) visit(absolute, relative, true);
        continue;
      }
      if (stat.isDirectory()) {
        directories.push({ path: relative, mode: stat.mode & 0o777 });
        visit(absolute, relative);
      } else {
        files.push({ path: relative, mode: stat.mode & 0o777 });
      }
    }
  }

  visit(bundleRoot);
  if (!files.some((file) => file.path === "SKILL.md")) {
    fail("Bundle must contain a regular SKILL.md file");
  }
  return { files, directories, omitted };
}

function selectPackages(manifest, requested) {
  const allowed = new Set(manifest.packages);
  for (const name of requested) {
    if (!allowed.has(name)) fail(`Package is not approved for this release: ${name}`);
    safeRelative(name, "Package name");
  }
  const selected = new Set(requested);
  return manifest.packages.filter((name) => requested.length === 0 || selected.has(name));
}

/**
 * Read-only audit used by both CLI scripts. It does not follow links or accept
 * non-regular/non-directory bundle members.
 */
export function auditLocalSkills({ source, skills = [] } = {}) {
  const manifest = readReleaseManifest();
  const sourceRoot = resolveSourceRoot(source);
  const packages = [];
  for (const name of selectPackages(manifest, skills)) {
    const bundleRoot = path.join(sourceRoot, name);
    beneath(sourceRoot, bundleRoot, `Bundle ${name}`);
    let stat;
    try {
      stat = fs.lstatSync(bundleRoot);
    } catch (error) {
      fail(`Approved bundle is missing: ${name} (${error.code || error.message})`);
    }
    if (stat.isSymbolicLink()) fail(`Rejected symlink bundle: ${name}`);
    if (!stat.isDirectory()) fail(`Bundle must be a directory: ${name}`);
    const tree = auditTree(bundleRoot);
    packages.push({
      name,
      source: bundleRoot,
      files: tree.files.map((file) => file.path),
      fileModes: Object.fromEntries(tree.files.map((file) => [file.path, file.mode])),
      directories: tree.directories.map((directory) => directory.path),
      directoryModes: Object.fromEntries(tree.directories.map((directory) => [directory.path, directory.mode])),
      omitted: tree.omitted,
    });
  }
  return { dryRun: true, sourceRoot, packages };
}

export function auditHelp() {
  return `Usage: npm run skills:audit -- [--source <directory>] [--skill <approved-name>] [--json]\n\nReads AUTOVAULT_SKILLS_PATH when --source is omitted. Audits all approved packages by default and never writes files.`;
}

function renderAudit(result) {
  const lines = ["DRY RUN — no files are copied", `SOURCE ${result.sourceRoot}`];
  for (const item of result.packages) {
    lines.push(`PLAN ${item.name} (${item.files.length} files)`);
    for (const file of item.files) lines.push(`  COPY ${item.name}/${file}`);
    for (const omitted of item.omitted) lines.push(`  OMIT ${item.name}/${omitted}`);
  }
  return lines.join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseAuditArgs(process.argv.slice(2));
    if (args.help) {
      console.log(auditHelp());
    } else {
      const result = auditLocalSkills(args);
      console.log(args.json ? JSON.stringify(result, null, 2) : renderAudit(result));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
