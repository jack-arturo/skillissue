#!/usr/bin/env node
/**
 * Dry-run-first importer for the approved local-skill release manifest.
 * Apply only after reviewing `npm run skills:audit` output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditLocalSkills,
  parseAuditArgs,
  repositoryRoot,
} from "./audit-local-skills.mjs";

function fail(message) {
  throw new Error(message);
}

function safeDestination(value) {
  if (path.isAbsolute(value)) fail("Destination must be relative to the repository");
  const parts = value.split(/[\\/]+/);
  if (!value || parts.some((part) => !part || part === "." || part === "..")) {
    fail("Destination must not contain traversal");
  }
  const destination = path.resolve(repositoryRoot, parts.join(path.sep));
  const relative = path.relative(repositoryRoot, destination);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("Destination escapes the repository");
  }
  const normalized = relative.split(path.sep).join("/");
  let current = repositoryRoot;
  for (const part of normalized.split("/")) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        fail(`Destination must not pass through a symlink: ${normalized}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { relative: normalized, absolute: destination };
}

function parseImportArgs(argv) {
  const baseArgs = [];
  const args = { apply: false, overwrite: false, destination: "skills" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--destination") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("--destination requires a value");
      args.destination = value;
      index += 1;
    } else {
      baseArgs.push(arg);
    }
  }
  Object.assign(args, parseAuditArgs(baseArgs));
  return args;
}

function packageDestination(destination, packageName) {
  const output = path.resolve(destination.absolute, packageName);
  const relative = path.relative(destination.absolute, output);
  if (relative !== packageName || path.isAbsolute(relative)) {
    fail(`Destination for ${packageName} is unsafe`);
  }
  return output;
}

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

function pathsOverlap(left, right) {
  const relative = path.relative(left, right);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function buildActions(audit, destination, replacements) {
  const actions = [];
  for (const item of audit.packages) {
    if (replacements.has(item.name)) {
      actions.push({ operation: "replace", package: item.name, path: `${destination.relative}/${item.name}` });
    }
    for (const directory of item.directories) {
      actions.push({ operation: "mkdir", package: item.name, path: `${destination.relative}/${item.name}/${directory}` });
    }
    for (const file of item.files) {
      actions.push({ operation: "copy", package: item.name, path: `${destination.relative}/${item.name}/${file}` });
    }
  }
  return actions;
}

function auditSignature(audit) {
  return JSON.stringify(audit.packages.map(({ source: ignored, ...item }) => item));
}

function walkStagedPackage(fileSystem, directory, relative = "") {
  const files = [];
  const directories = [];
  for (const entry of fileSystem.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      directories.push(childRelative);
      const nested = walkStagedPackage(fileSystem, absolute, childRelative);
      files.push(...nested.files);
      directories.push(...nested.directories);
    } else if (entry.isFile()) {
      files.push(childRelative);
    } else {
      fail(`Staged package contains an unsupported entry: ${childRelative}`);
    }
  }
  return { files, directories };
}

function verifyStagedPackage(item, stage, fileSystem) {
  const staged = walkStagedPackage(fileSystem, stage);
  assertSameList(staged.files, item.files, `${item.name} staged files`);
  assertSameList(staged.directories, item.directories, `${item.name} staged directories`);
  for (const file of item.files) {
    const source = fs.readFileSync(path.join(item.source, file));
    const target = fileSystem.readFileSync(path.join(stage, file));
    if (!source.equals(target)) fail(`Staged copy differs from audited source: ${item.name}/${file}`);
    const mode = fileSystem.statSync(path.join(stage, file)).mode & 0o777;
    if (mode !== item.fileModes[file]) fail(`Staged file mode differs from audit: ${item.name}/${file}`);
  }
  for (const directory of item.directories) {
    const mode = fileSystem.statSync(path.join(stage, directory)).mode & 0o777;
    if (mode !== item.directoryModes[directory]) fail(`Staged directory mode differs from audit: ${item.name}/${directory}`);
  }
}

function assertSameList(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    fail(`${label} do not match the audit`);
  }
}

function stagePackage(item, output, fileSystem) {
  const stage = fileSystem.mkdtempSync(path.join(path.dirname(output), `.${path.basename(output)}.import-stage-`));
  try {
    for (const directory of item.directories) {
      const target = path.join(stage, directory);
      fileSystem.mkdirSync(target, { recursive: true });
      fileSystem.chmodSync(target, item.directoryModes[directory]);
    }
    for (const file of item.files) {
      const source = path.join(item.source, file);
      const target = path.join(stage, file);
      fileSystem.mkdirSync(path.dirname(target), { recursive: true });
      fileSystem.copyFileSync(source, target);
      fileSystem.chmodSync(target, item.fileModes[file]);
    }
    verifyStagedPackage(item, stage, fileSystem);
    return stage;
  } catch (error) {
    fileSystem.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function unusedSibling(fileSystem, output, kind) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = path.join(
      path.dirname(output),
      `.${path.basename(output)}.import-${kind}-${process.pid}-${Date.now()}-${attempt}`,
    );
    if (!fileSystem.existsSync(candidate)) return candidate;
  }
  fail(`Could not reserve a ${kind} path for ${path.basename(output)}`);
}

function swapStagedPackages(stagedPackages, fileSystem) {
  const completed = [];
  try {
    for (const entry of stagedPackages) {
      const backup = fileSystem.existsSync(entry.output)
        ? unusedSibling(fileSystem, entry.output, "backup")
        : null;
      if (backup) fileSystem.renameSync(entry.output, backup);
      try {
        fileSystem.renameSync(entry.stage, entry.output);
      } catch (error) {
        if (backup) {
          try {
            fileSystem.renameSync(backup, entry.output);
          } catch (restoreError) {
            throw new Error(`Import swap failed for ${entry.item.name}: ${error.message}; restoring its backup also failed: ${restoreError.message}`, { cause: error });
          }
        }
        throw error;
      }
      completed.push({ ...entry, backup });
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of completed.reverse()) {
      try {
        fileSystem.renameSync(entry.output, entry.stage);
        if (entry.backup) fileSystem.renameSync(entry.backup, entry.output);
      } catch (rollbackError) {
        rollbackErrors.push(`${entry.item.name}: ${rollbackError.message}`);
      }
    }
    const suffix = rollbackErrors.length ? `; rollback failures: ${rollbackErrors.join("; ")}` : "";
    throw new Error(`Import transaction failed: ${error.message}${suffix}`, { cause: error });
  }

  for (const entry of completed) {
    if (entry.backup) fileSystem.rmSync(entry.backup, { recursive: true, force: false });
  }
}

export function importLocalSkills({ source, skills, destination: rawDestination = "skills", apply = false, overwrite = false, fileSystem = fs } = {}) {
  const destination = safeDestination(rawDestination);
  const audit = auditLocalSkills({ source, skills });
  const resolvedDestination = canonicalizePath(destination.absolute);
  if (pathsOverlap(audit.sourceRoot, resolvedDestination) || pathsOverlap(resolvedDestination, audit.sourceRoot)) {
    fail("Source root overlaps the repository destination");
  }
  const outputs = audit.packages.map((item) => ({ item, output: packageDestination(destination, item.name) }));
  const replacements = new Set();
  for (const { item, output } of outputs) {
    let exists = false;
    try {
      if (fs.lstatSync(output).isSymbolicLink()) fail(`Destination must not be a symlink: ${item.name}`);
      exists = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (exists && !overwrite) {
      fail(`Destination already exists for ${item.name}; rerun with --overwrite to review the replacement plan, then add --apply to replace it`);
    }
    if (exists) replacements.add(item.name);
  }
  const result = {
    dryRun: !apply,
    sourceRoot: audit.sourceRoot,
    destination: destination.relative,
    packages: audit.packages.map(({ source: ignored, ...item }) => item),
    actions: buildActions(audit, destination, replacements),
  };
  if (!apply) return result;

  fileSystem.mkdirSync(destination.absolute, { recursive: true });
  const stagedPackages = [];
  try {
    for (const { item, output } of outputs) {
      stagedPackages.push({ item, output, stage: stagePackage(item, output, fileSystem) });
    }
    const finalAudit = auditLocalSkills({ source, skills });
    if (auditSignature(audit) !== auditSignature(finalAudit)) {
      fail("Approved source packages changed while the import was being staged; rerun the audit and import");
    }
    swapStagedPackages(stagedPackages, fileSystem);
  } finally {
    for (const { stage } of stagedPackages) {
      if (fileSystem.existsSync(stage)) fileSystem.rmSync(stage, { recursive: true, force: true });
    }
  }
  return result;
}

function help() {
  return `Usage: npm run skills:import -- [--source <directory>] [--skill <approved-name>] [--destination <relative-dir>] [--apply] [--overwrite] [--json]\n\nThe default is a dry run. Existing packages are refused unless --overwrite is supplied; replacement happens only with --apply --overwrite.`;
}

function render(result) {
  const lines = [result.dryRun ? "DRY RUN — no files are copied" : "APPLIED", `SOURCE ${result.sourceRoot}`, `DESTINATION ${result.destination}`];
  for (const action of result.actions) lines.push(`${result.dryRun ? "PLAN" : "DONE"} ${action.operation.toUpperCase()} ${action.path}`);
  return lines.join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseImportArgs(process.argv.slice(2));
    if (args.help) {
      console.log(help());
    } else {
      const result = importLocalSkills(args);
      console.log(args.json ? JSON.stringify(result, null, 2) : render(result));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
