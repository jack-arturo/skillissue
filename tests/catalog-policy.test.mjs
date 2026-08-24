import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
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

function publicBundleFiles(directory, relative = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const filePath = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...publicBundleFiles(absolute, filePath));
    else if (entry.isFile()) files.push({ absolute, path: filePath, mode: fs.statSync(absolute).mode });
  }
  return files;
}

function independentBundleHash(files) {
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
  assert.equal(snapshot.schemaVersion, 3);
  assert.equal(snapshot.hashAlgorithm, "sha256");
  assert.equal(snapshot.bundleHashAlgorithm, "git-mode-path-bytes-v1");
  assert.deepEqual(snapshot.skills.map((skill) => skill.name).sort(), publicNames);
  for (const skill of snapshot.skills) {
    const directory = path.join(root, "skills", skill.name);
    const files = publicBundleFiles(directory);
    assert.equal(
      skill.contentHash,
      crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, "SKILL.md"))).digest("hex"),
      `${skill.name} content hash matches the committed package`,
    );
    assert.equal(skill.bundleHash, independentBundleHash(files), `${skill.name} bundle hash matches modes, paths, and bytes`);
    assert.equal(skill.fileCount, files.length, `${skill.name} file count matches the committed package`);
  }
});

test("build rejects unsafe and populated unowned output targets without changing them", () => {
  for (const target of [path.parse(root).root, root, path.dirname(root)]) {
    const result = spawnSync(process.execPath, ["scripts/build-catalog.mjs", "--strict"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SKILLISSUE_SITE_DIR: target },
    });
    assert.notEqual(result.status, 0, `rejects ${target}`);
    assert.match(result.stderr, /unsafe generated output target/i);
  }

  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillissue-unowned-output-"));
  const marker = path.join(siteDir, "keep.txt");
  fs.writeFileSync(marker, "not generated\n");
  try {
    const result = spawnSync(process.execPath, ["scripts/build-catalog.mjs", "--strict"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SKILLISSUE_SITE_DIR: siteDir },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /generated sentinel|not owned/i);
    assert.equal(fs.readFileSync(marker, "utf8"), "not generated\n");
  } finally {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }
});

test("build refuses to advertise a pin when the skills tree is not committed", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "skillissue-dirty-pin-"));
  const alternateIndex = path.join(fixture, "index");
  const siteDir = path.join(fixture, "site");
  const gitIndexRaw = execFileSync("git", ["rev-parse", "--git-path", "index"], { cwd: root, encoding: "utf8" }).trim();
  const gitIndex = path.isAbsolute(gitIndexRaw) ? gitIndexRaw : path.join(root, gitIndexRaw);
  fs.copyFileSync(gitIndex, alternateIndex);
  const env = { ...process.env, GIT_INDEX_FILE: alternateIndex };
  try {
    execFileSync("git", ["update-index", "--force-remove", "skills/midjourney-iteration/SKILL.md"], {
      cwd: root,
      env,
      stdio: "pipe",
    });
    const result = spawnSync(process.execPath, ["scripts/build-catalog.mjs", "--strict"], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, SKILLISSUE_SITE_DIR: siteDir },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /commit all skills\/ changes first|stale package pins/i);
    assert.equal(fs.existsSync(siteDir), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("build rejects ignored untracked skill files without changing its output target", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "skillissue-ignored-pin-"));
  const siteDir = path.join(fixture, "site");
  const ignoredSkillFile = path.join(root, "skills", "automem", ".env");
  assert.equal(fs.existsSync(ignoredSkillFile), false, `${ignoredSkillFile} must not pre-exist`);
  fs.mkdirSync(siteDir);
  fs.writeFileSync(ignoredSkillFile, "TEST_ONLY=ignored\n");
  try {
    const result = spawnSync(process.execPath, ["scripts/build-catalog.mjs", "--strict"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SKILLISSUE_SITE_DIR: siteDir },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /commit all skills\/ changes first|stale package pins/i);
    assert.deepEqual(fs.readdirSync(siteDir), []);
  } finally {
    fs.rmSync(ignoredSkillFile, { force: true });
    fs.rmSync(fixture, { recursive: true, force: true });
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
    assert.equal(metadata.publicCount, 48);
    assert.equal(metadata.skills.length, 48);
    assert.equal(metadata.packageSourcePin, packageSourcePin);
    assert.equal(report.packageSourcePin, packageSourcePin);
    assert.equal(fs.existsSync(path.join(siteDir, ".skillissue-generated")), true);
    const browserHand = metadata.skills.find((skill) => skill.name === "browser-hand");
    assert.ok(browserHand);
    for (const field of [
      "summary", "description", "storyUrl", "category", "tags", "agents",
      "featured", "provenance", "resourceCount", "runnable", "cliInstall", "mcpInstall",
      "sourceUrl", "rawSourceUrl", "packageSourcePin",
    ]) assert.notEqual(browserHand[field], undefined, `metadata includes ${field}`);
    assert.match(browserHand.cliInstall, new RegExp(`@${packageSourcePin}:skills/browser-hand/SKILL\\.md`));
    assert.match(browserHand.sourceUrl, new RegExp(`/blob/${packageSourcePin}/skills/browser-hand/SKILL\\.md`));
    assert.match(browserHand.rawSourceUrl, new RegExp(`raw.githubusercontent.com/${metadata.repo}/${packageSourcePin}/skills/browser-hand/SKILL\\.md`));
    const stripeCheckout = metadata.skills.find((skill) => skill.name === "stripe-commerce-checkout");
    const awtrixBoard = metadata.skills.find((skill) => skill.name === "awtrix-board");
    const cloudflareOps = metadata.skills.find((skill) => skill.name === "cloudflare-ops");
    assert.deepEqual(stripeCheckout.requiresSecrets, ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
    assert.deepEqual(awtrixBoard.capabilities.tools, ["Bash"]);
    assert.equal(cloudflareOps.references, 6, "reference sort uses inbound public links");

    const explorer = fs.readFileSync(path.join(siteDir, "skills", "index.html"), "utf-8");
    assert.match(explorer, /data-catalog-explorer/);
    assert.match(explorer, /id="explorer-data" type="application\/json"/);
    const explorerAsset = explorer.match(/src="\/assets\/(catalog-explorer\.[a-f0-9]{12}\.js)"/)?.[1];
    const cssAsset = explorer.match(/href="\/assets\/(site\.[a-f0-9]{12}\.css)"/)?.[1];
    assert.ok(explorerAsset, "Explorer references a content-fingerprinted module");
    assert.ok(cssAsset, "Explorer references content-fingerprinted CSS");
    assert.doesNotMatch(explorer, /role="listbox"/);
    assert.match(explorer, /href="\/skills\/browser-hand\/"/);
    assert.match(explorer, /class="explorer-card"/);
    assert.match(explorer, /data-explorer-card/);
    assert.match(explorer, /data-explorer-mark/);
    assert.match(explorer, />Raw</);
    assert.match(explorer, /Copy install/);
    assert.match(explorer, /data-explorer-sort="referenced"/);
    assert.match(explorer, /data-explorer-view="list"/);
    assert.match(explorer, /name="source"/);
    assert.doesNotMatch(explorer, /data-explorer-detail/);
    assert.match(explorer, /public package · mixed/);
    assert.match(explorer, /\\u003c/);
    assert.equal(fs.existsSync(path.join(siteDir, "assets", explorerAsset)), true);
    assert.equal(fs.existsSync(path.join(siteDir, "assets", cssAsset)), true);
    const explorerCss = fs.readFileSync(path.join(siteDir, "assets", cssAsset), "utf-8");
    assert.match(explorerCss, /\.explorer-card-footer\s*\{[^}]*border:\s*0;[^}]*padding:\s*0;/);
    assert.equal(fs.existsSync(path.join(siteDir, "assets", "catalog-explorer.js")), false);
    assert.equal(fs.existsSync(path.join(siteDir, "assets", "site.css")), false);
    const linkedStory = fs.readFileSync(path.join(siteDir, "skills", "autovault-brand-system", "index.html"), "utf8");
    assert.match(linkedStory, /class="sd-page"/);
    assert.doesNotMatch(linkedStory, /\.\.\/html-asset-renderer\/story\.md/);
    const browserHandPage = fs.readFileSync(path.join(siteDir, "skills", "browser-hand", "index.html"), "utf8");
    assert.match(browserHandPage, /class="sd-page"/);
    assert.match(browserHandPage, /class="sd-head"/);
    assert.match(browserHandPage, /class="sd-install"/);
    assert.match(browserHandPage, /class="sd-stats"/);
    assert.match(browserHandPage, /class="sd-tabs"/);
    assert.match(browserHandPage, new RegExp(`class="raw" href="https://raw.githubusercontent.com/${metadata.repo}/${packageSourcePin}/skills/browser-hand/SKILL\\.md" rel="noopener">view raw →`));
    assert.equal((browserHandPage.match(/class="sd-install-row"/g) || []).length, 2);
    assert.match(browserHandPage, /<div class="lbl">Bundle files<\/div><div class="val">7<\/div>/);
    assert.match(browserHandPage, /<div class="lbl">Resources<\/div><div class="val">6<\/div>/);
    const babysitPage = fs.readFileSync(path.join(siteDir, "skills", "babysit", "index.html"), "utf8");
    assert.match(babysitPage, /class="sd-md"/);
    assert.match(babysitPage, /data-package-detail/);
    assert.match(babysitPage, /data-package-tab="bundle"/);
    assert.match(babysitPage, /data-package-file="references\/pr-labels\.md"/);
    assert.match(babysitPage, /class="sd-bundle-head"/);
    assert.match(babysitPage, /class="sd-bundle-grid"/);
    assert.match(babysitPage, /class="sd-resource-tree"/);
    assert.match(babysitPage, /class="sd-resource-preview"/);
    assert.match(babysitPage, /class="sd-rail"/);
    assert.match(babysitPage, /data-package-preview/);
    assert.match(babysitPage, /data-package-preview-raw href="\/bundles\/babysit\/SKILL\.md\.txt"/);
    assert.match(babysitPage, /id="bundle"/);
    assert.match(babysitPage, /id="permissions"/);
    assert.match(babysitPage, /id="provenance"/);
    assert.match(babysitPage, /id="source"/);
    assert.match(babysitPage, /class="sd-versions-table"/);
    assert.doesNotMatch(babysitPage, /class="package-source"/);
    assert.match(babysitPage, /references\/pr-labels\.md/);
    const babysitOverview = babysitPage.match(/<section id="overview"[\s\S]*?<\/section>/)?.[0] || "";
    assert.match(babysitOverview, /Create or take over a GitHub PR and keep working until it is merge-ready/);
    assert.doesNotMatch(babysitOverview, /PR review loops were eating whole sessions/);
    assert.match(babysitOverview, /href="\/bundles\/babysit\/references\/preflight-and-pr-creation\.md\.txt">references\/preflight-and-pr-creation\.md<\/a>/);
    const babysitStory = babysitPage.match(/<section id="story"[\s\S]*?<\/section>/)?.[0] || "";
    assert.match(babysitPage, /data-package-tab="story"[^>]*>Story/);
    assert.match(babysitStory, /story\.md/);
    assert.match(babysitStory, /PR review loops were eating whole sessions/);
    assert.match(babysitPage, /<h3 data-package-preview-title>SKILL\.md<\/h3>/);
    const automemPage = fs.readFileSync(path.join(siteDir, "skills", "automem", "index.html"), "utf8");
    assert.match(
      automemPage,
      /<div class="sd-perm-row"><span class="ico no">×<\/span><span>network<\/span><span class="scope">false<\/span><\/div>/,
      "disabled capabilities render as unavailable rather than as a success",
    );
    const detailAsset = babysitPage.match(/src="\/assets\/(skill-detail\.[a-f0-9]{12}\.js)"/)?.[1];
    assert.ok(detailAsset, "Package pages reference a content-fingerprinted detail viewer");
    assert.equal(fs.existsSync(path.join(siteDir, "assets", detailAsset)), true);
    assert.match(fs.readFileSync(path.join(siteDir, "assets", detailAsset), "utf8"), /data-package-preview-title/);
    assert.equal(
      fs.readFileSync(path.join(siteDir, "bundles", "babysit", "references", "pr-labels.md.txt"), "utf8"),
      fs.readFileSync(path.join(root, "skills", "babysit", "references", "pr-labels.md"), "utf8"),
    );
    assert.equal(
      fs.existsSync(path.join(siteDir, "bundles", "cloudflare-lead-capture", "templates", "project", "snippets", "lead-form.html")),
      false,
      "active HTML is never served as a same-origin raw bundle file",
    );
    assert.equal(
      fs.readFileSync(path.join(siteDir, "bundles", "cloudflare-lead-capture", "templates", "project", "snippets", "lead-form.html.txt"), "utf8"),
      fs.readFileSync(path.join(root, "skills", "cloudflare-lead-capture", "templates", "project", "snippets", "lead-form.html"), "utf8"),
      "raw bundle sources are served as inert text",
    );
    const brandPage = fs.readFileSync(path.join(siteDir, "skills", "autovault-brand-system", "index.html"), "utf8");
    assert.match(brandPage, /assets\/brand-mark\.svg\.txt/);
    assert.match(brandPage, /<span class="kind">svg<\/span>/);
    const babysit = metadata.skills.find((skill) => skill.name === "babysit");
    const publishedBabysitBytes = publicBundleFiles(path.join(root, "skills", "babysit"))
      .filter((file) => file.path !== "story.md")
      .reduce((total, file) => total + fs.statSync(file.absolute).size, 0);
    assert.equal(babysit.bundleSize, publishedBabysitBytes, "bundle size excludes the site-only narrative");
    const deployment = metadata.skills.find((skill) => skill.name === "cloudflare-commerce-deploy");
    const design = metadata.skills.find((skill) => skill.name === "brand-bible-author");
    assert.equal(deployment.category, "deployment");
    assert.equal(deployment.group, "cloudflare");
    assert.equal(design.category, "design");
    assert.equal(design.group, "writing");
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
