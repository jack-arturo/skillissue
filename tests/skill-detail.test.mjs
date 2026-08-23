import assert from "node:assert/strict";
import test from "node:test";

import { groupBundleFiles, resourceKind } from "../scripts/skill-detail.js";

test("bundle viewer groups files like the hosted package explorer", () => {
  const files = [
    { path: "SKILL.md" },
    { path: "references/pr-labels.md" },
    { path: "scripts/review.mjs" },
    { path: "assets/mark.svg" },
  ];
  assert.deepEqual(
    groupBundleFiles(files).map((group) => [group.id, group.files.map((file) => file.path)]),
    [
      ["root", ["SKILL.md"]],
      ["references", ["references/pr-labels.md"]],
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
