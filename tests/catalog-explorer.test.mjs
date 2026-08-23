import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSkills,
  parseExplorerState,
  serializeExplorerState,
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
});
