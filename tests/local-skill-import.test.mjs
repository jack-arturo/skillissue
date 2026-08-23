import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "catalog", "local-skill-release.json");
const publicationPath = path.join(root, "catalog", "autovault-publication.json");
const auditScript = path.join(root, "scripts", "audit-local-skills.mjs");
const importScript = path.join(root, "scripts", "import-local-skills.mjs");
const approved = "autovault-brand-system";
const existingPublic = [
  "automem", "autovault-skill", "awtrix-board", "babysit", "browser-hand",
  "cli-installer-ux", "cloudflare-commerce-deploy", "cloudflare-emdash-cms-deploy",
  "cloudflare-lead-capture", "cloudflare-ops", "commit-message", "docs-screenshot-packager",
  "entity-dossier", "flashspace", "home-assistant-operator", "html-asset-renderer",
  "jacks-writing-style", "long-haul-parallel-repair", "mcp-builder", "mcp-registry-maintainer",
  "pirsch-analytics-bootstrap", "raycast", "resend-cli", "skill-author", "triage-autohub-runtime",
].sort();
const admittedPublic = [
  "autovault-brand-system", "award-travel-research", "brand-bible-author", "bubble-tea-tui-builder",
  "building-emdash-site", "ci-cost-audit", "clerk-cloudflare-auth", "clerk-cloudflare-commerce-bootstrap",
  "context-engineering-audit", "creating-plugins", "elevenlabs-automem-memory", "emdash-cli",
  "midjourney-iteration", "phala-gpu-tee-deploy", "quest-passthrough-camera-capture",
  "repo-demo-video-director", "repo-demo-video-publisher", "stripe-commerce-checkout", "tui-design",
  "unity-ai-collaboration", "unity-quest-build", "video-toolkit", "wordpress-theme-to-emdash",
].sort();

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "skillissue-local-skills-"));
  const source = path.join(directory, "vault");
  fs.mkdirSync(source);
  return { directory, source };
}

function makeBundle(source, name = approved) {
  const bundle = path.join(source, name);
  fs.mkdirSync(bundle, { recursive: true });
  fs.writeFileSync(path.join(bundle, "SKILL.md"), `---\nname: ${name}\n---\n`);
  return bundle;
}

function run(script, args, options = {}) {
  return execFileSync(process.execPath, [script, ...args, "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
  });
}

function safelyRemove(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

test("audit and import default to deterministic safe dry runs", () => {
  const { directory, source } = fixture();
  try {
    const bundle = makeBundle(source);
    fs.mkdirSync(path.join(bundle, "bin"));
    fs.writeFileSync(path.join(bundle, "bin", "run"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    fs.mkdirSync(path.join(bundle, "resources"));
    fs.writeFileSync(path.join(bundle, "resources", "note.txt"), "public guidance\n");

    const audit = JSON.parse(run(auditScript, ["--source", source, "--skill", approved]));
    const environmentAudit = JSON.parse(run(auditScript, ["--skill", approved], {
      env: { AUTOVAULT_SKILLS_PATH: source },
    }));
    const firstImport = JSON.parse(run(importScript, ["--source", source, "--skill", approved]));
    const secondImport = JSON.parse(run(importScript, ["--source", source, "--skill", approved]));

    assert.equal(audit.dryRun, true);
    assert.deepEqual(environmentAudit.packages, audit.packages);
    assert.equal(firstImport.dryRun, true);
    assert.deepEqual(firstImport.actions, secondImport.actions);
    assert.deepEqual(audit.packages[0].files, ["SKILL.md", "bin/run", "resources/note.txt"]);
    assert.equal(fs.existsSync(path.join(root, "skills", approved, "bin", "run")), false);
  } finally {
    safelyRemove(directory);
  }
});

test("apply copies regular files, preserves executable modes, and omits AutoVault metadata", () => {
  const { directory, source } = fixture();
  const destination = `tests/.local-skill-import-${path.basename(directory)}`;
  try {
    const bundle = makeBundle(source);
    fs.mkdirSync(path.join(bundle, "bin"));
    const executable = path.join(bundle, "bin", "run");
    fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    fs.mkdirSync(path.join(bundle, "resources", ".autovault-cache"), { recursive: true });
    fs.writeFileSync(path.join(bundle, ".autovault-state"), "ignore me\n");
    fs.writeFileSync(path.join(bundle, "resources", ".autovault-cache", "private.json"), "ignore me\n");

    const result = JSON.parse(run(importScript, [
      "--source", source,
      "--skill", approved,
      "--destination", destination,
      "--apply",
    ]));
    const output = path.join(root, destination, approved);
    assert.equal(result.dryRun, false);
    assert.equal(fs.readFileSync(path.join(output, "SKILL.md"), "utf8").includes(approved), true);
    assert.equal(fs.statSync(path.join(output, "bin", "run")).mode & 0o111, 0o111);
    assert.equal(fs.existsSync(path.join(output, ".autovault-state")), false);
    assert.equal(fs.existsSync(path.join(output, "resources", ".autovault-cache")), false);
  } finally {
    safelyRemove(path.join(root, destination));
    safelyRemove(directory);
  }
});

test("unsafe roots and entries fail closed, and overwrite requires an explicit flag", () => {
  const { directory, source } = fixture();
  const destination = `tests/.local-skill-import-${path.basename(directory)}`;
  try {
    const bundle = makeBundle(source);
    fs.writeFileSync(path.join(bundle, "unsafe.txt"), "no links\n");
    fs.symlinkSync(path.join(bundle, "unsafe.txt"), path.join(bundle, "linked.txt"));
    const symlink = spawnSync(process.execPath, [auditScript, "--source", source, "--skill", approved], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(symlink.status, 0);
    assert.match(symlink.stderr, /symlink/i);
    fs.rmSync(path.join(bundle, "linked.txt"));
    fs.symlinkSync(path.join(bundle, "unsafe.txt"), path.join(bundle, ".autovault-link"));
    const metadataSymlink = spawnSync(process.execPath, [auditScript, "--source", source, "--skill", approved], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(metadataSymlink.status, 0);
    assert.match(metadataSymlink.stderr, /symlink/i);
    fs.rmSync(path.join(bundle, ".autovault-link"));
    const special = path.join(bundle, "named-pipe");
    execFileSync("mkfifo", [special]);
    const specialFile = spawnSync(process.execPath, [auditScript, "--source", source, "--skill", approved], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(specialFile.status, 0);
    assert.match(specialFile.stderr, /special file/i);
    fs.rmSync(special);
    const metadataSpecial = path.join(bundle, ".autovault-pipe");
    execFileSync("mkfifo", [metadataSpecial]);
    const metadataSpecialFile = spawnSync(process.execPath, [auditScript, "--source", source, "--skill", approved], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(metadataSpecialFile.status, 0);
    assert.match(metadataSpecialFile.stderr, /special file/i);
    fs.rmSync(metadataSpecial);
    const metadataDirectory = path.join(bundle, ".autovault-cache");
    fs.mkdirSync(metadataDirectory);
    fs.symlinkSync(path.join(bundle, "unsafe.txt"), path.join(metadataDirectory, "nested-link"));
    const nestedMetadataSymlink = spawnSync(process.execPath, [auditScript, "--source", source, "--skill", approved], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(nestedMetadataSymlink.status, 0);
    assert.match(nestedMetadataSymlink.stderr, /symlink/i);
    fs.rmSync(path.join(metadataDirectory, "nested-link"));
    const nestedMetadataSpecial = path.join(metadataDirectory, "nested-pipe");
    execFileSync("mkfifo", [nestedMetadataSpecial]);
    const nestedMetadataSpecialFile = spawnSync(process.execPath, [auditScript, "--source", source, "--skill", approved], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(nestedMetadataSpecialFile.status, 0);
    assert.match(nestedMetadataSpecialFile.stderr, /special file/i);
    fs.rmSync(metadataDirectory, { recursive: true, force: true });

    assert.throws(
      () => run(importScript, ["--source", source, "--skill", approved, "--destination", "../outside"]),
      /destination.*traversal/i,
    );
    assert.throws(
      () => run(importScript, ["--source", source, "--skill", approved, "--destination", directory]),
      /destination.*relative/i,
    );

    fs.mkdirSync(path.join(root, destination, approved), { recursive: true });
    assert.throws(
      () => run(importScript, ["--source", source, "--skill", approved, "--destination", destination, "--apply"]),
      /already exists.*--overwrite.*--apply/i,
    );
    const dryReplacement = JSON.parse(run(importScript, [
      "--source", source,
      "--skill", approved,
      "--destination", destination,
      "--overwrite",
    ]));
    assert.equal(dryReplacement.dryRun, true);
    assert.deepEqual(dryReplacement.actions[0], {
      operation: "replace",
      package: approved,
      path: `${destination}/${approved}`,
    });
    assert.doesNotThrow(() => run(importScript, [
      "--source", source,
      "--skill", approved,
      "--destination", destination,
      "--apply",
      "--overwrite",
    ]));

    const overlappingSource = path.join(root, destination, "vault");
    makeBundle(overlappingSource);
    assert.throws(
      () => run(importScript, [
        "--source", overlappingSource,
        "--skill", approved,
        "--destination", destination,
        "--apply",
        "--overwrite",
      ]),
      /source root.*overlaps.*destination/i,
    );
    assert.equal(fs.existsSync(path.join(overlappingSource, approved, "SKILL.md")), true);

    const sourceRootSymlink = path.join(directory, "source-link");
    fs.symlinkSync(source, sourceRootSymlink);
    assert.throws(
      () => run(auditScript, ["--source", sourceRootSymlink, "--skill", approved]),
      /source root.*symlink/i,
    );
  } finally {
    safelyRemove(path.join(root, destination));
    safelyRemove(directory);
  }
});

test("source roots cannot equal or overlap an applied destination", () => {
  const base = path.join(root, "tests", `.local-skill-overlap-${process.pid}-${Date.now()}`);
  try {
    const equalRoot = path.join(base, "equal");
    makeBundle(equalRoot);
    const ancestorRoot = path.join(base, "ancestor");
    makeBundle(ancestorRoot);
    const descendantDestination = path.join(base, "descendant");
    const descendantRoot = path.join(descendantDestination, "vault");
    makeBundle(descendantRoot);

    for (const [source, destination] of [
      [equalRoot, path.relative(root, equalRoot)],
      [ancestorRoot, path.relative(root, path.join(ancestorRoot, "destination"))],
      [descendantRoot, path.relative(root, descendantDestination)],
    ]) {
      assert.throws(
        () => run(importScript, [
          "--source", source,
          "--skill", approved,
          "--destination", destination,
          "--apply",
          "--overwrite",
        ]),
        /source root.*overlaps.*destination/i,
      );
    }
  } finally {
    safelyRemove(base);
  }
});

test("release manifest exactly admits the approved cohort and preserves registry policy", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const publication = JSON.parse(fs.readFileSync(publicationPath, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.packages.slice().sort(), admittedPublic);
  for (const name of admittedPublic) {
    assert.deepEqual(publication.skills[name], { visibility: "public" }, `${name} is public`);
  }
  const publicNames = Object.entries(publication.skills)
    .filter(([, entry]) => entry.visibility === "public")
    .map(([name]) => name)
    .sort();
  assert.deepEqual(publicNames, [...existingPublic, ...admittedPublic].sort());
  assert.deepEqual(publication.skills["codex-review"], { visibility: "hidden", replacement: "babysit" });
  assert.deepEqual(publication.skills["dev-browser"], { visibility: "hidden", replacement: "browser-hand" });
});
