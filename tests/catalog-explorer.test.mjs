import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSkills,
  isModifiedActivation,
  normalizeExplorerState,
  parseExplorerState,
  serializeExplorerState,
  selectionChanged,
  shouldRevealDetail,
} from "../scripts/catalog-explorer.js";

const skills = [
  {
    name: "browser-hand",
    summary: "Drive an already signed-in browser.",
    description: "Use Chrome tabs and authenticated forms.",
    category: "browser",
    tags: ["chrome", "forms"],
    agents: ["codex", "claude-code"],
    featured: true,
    resourceCount: 2,
  },
  {
    name: "commit-message",
    summary: "Draft a conventional commit.",
    description: "Read staged Git changes.",
    category: "git",
    tags: ["git"],
    agents: ["codex"],
    featured: false,
    resourceCount: 0,
  },
];

test("filterSkills searches catalog text and combines Explorer facets", () => {
  assert.deepEqual(
    filterSkills(skills, {
      q: "authenticated forms",
      category: "browser",
      agent: "claude-code",
      featured: true,
      resources: "yes",
    }).map((skill) => skill.name),
    ["browser-hand"],
  );
  assert.deepEqual(
    filterSkills(skills, { q: "git", resources: "none" }).map((skill) => skill.name),
    ["commit-message"],
  );
});

test("Explorer query state parses and serializes only meaningful filters", () => {
  const state = parseExplorerState(
    "?q=Chrome+forms&category=browser&agent=codex&featured=1&resources=yes&skill=browser-hand",
  );
  assert.deepEqual(state, {
    q: "Chrome forms",
    category: "browser",
    agent: "codex",
    featured: true,
    resources: "yes",
    skill: "browser-hand",
  });
  assert.equal(
    serializeExplorerState(state),
    "?q=Chrome+forms&category=browser&agent=codex&featured=1&resources=yes&skill=browser-hand",
  );
  assert.equal(serializeExplorerState(parseExplorerState("?featured=no&resources=nope")), "");
  assert.equal(parseExplorerState("?featured=on").featured, true);
});

test("Explorer state clears or selects a result before it reaches the URL", () => {
  const initial = { category: "git", skill: "browser-hand" };
  const normalized = normalizeExplorerState(skills, initial);
  assert.deepEqual(
    normalized,
    { category: "git", skill: "commit-message" },
  );
  assert.equal(selectionChanged(initial, normalized), true);
  assert.deepEqual(
    normalizeExplorerState(skills, { q: "does-not-exist", skill: "browser-hand" }),
    { q: "does-not-exist", skill: "" },
  );
});

test("Explorer state removes unknown option values before serializing visible controls", () => {
  const normalized = normalizeExplorerState(skills, {
    category: "unknown-category",
    agent: "unknown-agent",
    skill: "browser-hand",
  });
  assert.deepEqual(normalized, {
    category: "",
    agent: "",
    skill: "browser-hand",
  });
  assert.equal(serializeExplorerState(normalized), "?skill=browser-hand");
});

test("only narrow interactive selections reveal the detail pane", () => {
  assert.equal(shouldRevealDetail(640), true);
  assert.equal(shouldRevealDetail(641), false);
  assert.equal(shouldRevealDetail(undefined), false);
});

test("modifier-clicks pass through to canonical result navigation", () => {
  assert.equal(isModifiedActivation({ metaKey: true }), true);
  assert.equal(isModifiedActivation({ ctrlKey: true }), true);
  assert.equal(isModifiedActivation({ shiftKey: true }), true);
  assert.equal(isModifiedActivation({ altKey: true }), true);
  assert.equal(isModifiedActivation({}), false);
});
