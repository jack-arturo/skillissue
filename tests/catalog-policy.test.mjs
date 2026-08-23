import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hidden = [
  "autojack-delegate",
  "codex-review",
  "inbox-triage",
  "release-readiness",
  "session-consolidate"
];
const removed = ["dev-browser", "voiceink-2-upgrade"];

test("publication registry is an explicit 48-skill allowlist", () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(root, "catalog", "autovault-publication.json"), "utf-8")
  );
  const publicNames = Object.entries(registry.skills)
    .filter(([, entry]) => entry.visibility === "public")
    .map(([name]) => name)
    .sort();
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.target, "skillissue");
  assert.equal(publicNames.length, 48);
  assert.deepEqual(
    registry.skills["codex-review"],
    { visibility: "hidden", replacement: "babysit" }
  );
  for (const name of hidden) assert.equal(registry.skills[name].visibility, "hidden");
});

test("committed publication snapshot covers every public bundle", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, "catalog", "autovault-publication.json"), "utf-8"));
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, "catalog", "autovault-sync.json"), "utf-8"));
  const publicNames = Object.entries(registry.skills)
    .filter(([, entry]) => entry.visibility === "public")
    .map(([name]) => name)
    .sort();
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.hashAlgorithm, "sha256");
  assert.deepEqual(snapshot.skills.map((skill) => skill.name).sort(), publicNames);
  for (const skill of snapshot.skills) {
    assert.match(skill.contentHash, /^[a-f0-9]{64}$/);
    assert.match(skill.bundleHash, /^[a-f0-9]{64}$/);
    assert.ok(skill.fileCount >= 2);
  }
});

test("strict build exposes only public skills and writes canonical redirects", () => {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillissue-catalog-"));
  const reportPath = path.join(siteDir, "report.json");
  const repositoryReport = path.join(root, "catalog", "report.json");
  const reportBefore = fs.readFileSync(repositoryReport, "utf-8");
  try {
    execFileSync(process.execPath, ["scripts/build-catalog.mjs", "--strict"], {
      cwd: root,
      stdio: "pipe",
      env: {
        ...process.env,
        SKILLISSUE_SITE_DIR: siteDir,
        SKILLISSUE_REPORT_PATH: reportPath
      }
    });

    const skillDirs = fs
      .readdirSync(path.join(siteDir, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.equal(skillDirs.length, 48);

    const metadata = JSON.parse(fs.readFileSync(path.join(siteDir, "skills.json"), "utf-8"));
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    const packageSourcePin = execFileSync("git", ["log", "-1", "--format=%H", "--", "skills"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const generatedHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    assert.equal(metadata.publicCount, 48);
    assert.equal(metadata.skills.length, 48);
    assert.equal(metadata.packageSourcePin, packageSourcePin);
    assert.equal(report.packageSourcePin, packageSourcePin);
    assert.notEqual(packageSourcePin, generatedHead, "package source pin is not the generator-only output commit");
    const browserHand = metadata.skills.find((skill) => skill.name === "browser-hand");
    assert.ok(browserHand);
    for (const field of [
      "summary", "description", "storyUrl", "category", "tags", "agents",
      "featured", "resourceCount", "runnable", "cliInstall", "mcpInstall",
      "sourceUrl", "packageSourcePin",
    ]) assert.notEqual(browserHand[field], undefined, `metadata includes ${field}`);
    assert.match(browserHand.cliInstall, new RegExp(`@${packageSourcePin}:skills/browser-hand/SKILL\\.md`));
    assert.match(browserHand.sourceUrl, new RegExp(`/blob/${packageSourcePin}/skills/browser-hand/SKILL\\.md`));

    const explorer = fs.readFileSync(path.join(siteDir, "skills", "index.html"), "utf-8");
    assert.match(explorer, /data-catalog-explorer/);
    assert.match(explorer, /id="explorer-data" type="application\/json"/);
    assert.match(explorer, /src="\/assets\/catalog-explorer\.js"/);
    assert.doesNotMatch(explorer, /role="listbox"/);
    assert.match(explorer, /href="\/skills\/browser-hand\/"/);
    assert.match(explorer, /\\u003c/);
    assert.equal(fs.existsSync(path.join(siteDir, "assets", "catalog-explorer.js")), true);
    for (const asset of [
      "apple-touch-icon.png", "favicon-32.png", "favicon-512.jpg",
      "favicon-512.png", "favicon.svg", "og.png",
    ]) assert.equal(fs.existsSync(path.join(siteDir, "assets", asset)), true, `${asset} is generated from source`);

    const redirects = fs.readFileSync(path.join(siteDir, "_redirects"), "utf-8");
    assert.match(redirects, /^\/skills\/dev-browser\/ \/skills\/browser-hand\/ 301$/m);
    assert.match(redirects, /^\/skills\/codex-review\/ \/skills\/babysit\/ 301$/m);

    const generated = [
      fs.readFileSync(path.join(siteDir, "skills.json"), "utf-8"),
      fs.readFileSync(path.join(siteDir, "llms.txt"), "utf-8"),
      fs.readFileSync(path.join(siteDir, "sitemap.xml"), "utf-8")
    ].join("\n");
    for (const name of [...hidden, ...removed]) {
      assert.equal(generated.includes(`/skills/${name}/`), false, `${name} leaked into generated catalog`);
    }
    assert.match(generated, /https:\/\/skillissue\.sh\/skills\/browser-hand\//);
  } finally {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }
  assert.equal(fs.readFileSync(repositoryReport, "utf-8"), reportBefore);
});
