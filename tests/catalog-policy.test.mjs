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

test("publication registry is an explicit 25-skill allowlist", () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(root, "catalog", "autovault-publication.json"), "utf-8")
  );
  const publicNames = Object.entries(registry.skills)
    .filter(([, entry]) => entry.visibility === "public")
    .map(([name]) => name)
    .sort();
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.target, "skillissue");
  assert.equal(publicNames.length, 25);
  assert.deepEqual(
    registry.skills["codex-review"],
    { visibility: "hidden", replacement: "babysit" }
  );
  for (const name of hidden) assert.equal(registry.skills[name].visibility, "hidden");
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
    assert.equal(skillDirs.length, 25);

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
  } finally {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }
  assert.equal(fs.readFileSync(repositoryReport, "utf-8"), reportBefore);
});
