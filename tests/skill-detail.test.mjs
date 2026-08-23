import assert from "node:assert/strict";
import test from "node:test";

import { groupBundleFiles, initialBundlePath, packageTabForHash, resourceKind } from "../scripts/skill-detail.js";

test("bundle viewer groups files like the hosted package explorer", () => {
  const files = [
    { path: "references/zebra.md" },
    { path: "references/pr-labels.md" },
    { path: "scripts/review.mjs" },
    { path: "assets/mark.svg" },
    { path: "SKILL.md" },
  ];
  assert.deepEqual(
    groupBundleFiles(files).map((group) => [group.id, group.files.map((file) => file.path)]),
    [
      ["root", ["SKILL.md"]],
      ["references", ["references/pr-labels.md", "references/zebra.md"]],
      ["assets", ["assets/mark.svg"]],
      ["scripts", ["scripts/review.mjs"]],
    ],
  );
});

test("bundle viewer labels inspectable resource kinds", () => {
  assert.equal(resourceKind("references/pr-labels.md"), "markdown");
  assert.equal(resourceKind("assets/mark.svg"), "svg");
  assert.equal(resourceKind("scripts/review.mjs"), "script");
});

test("bundle viewer opens a shared section fragment instead of hiding it", () => {
  const tabs = ["overview", "bundle", "permissions", "provenance", "source"];
  assert.equal(packageTabForHash("#bundle", tabs), "bundle");
  assert.equal(packageTabForHash("#permissions", tabs), "permissions");
  assert.equal(packageTabForHash("#missing", tabs), "overview");
});

test("bundle viewer starts on the package instructions", () => {
  assert.equal(
    initialBundlePath([{ path: "assets/mark.svg" }, { path: "SKILL.md" }, { path: "references/usage.md" }]),
    "SKILL.md",
  );
  assert.equal(initialBundlePath([{ path: "assets/mark.svg" }]), "assets/mark.svg");
});
