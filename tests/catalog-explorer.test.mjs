import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSkills,
  normalizeExplorerState,
  parseExplorerState,
  serializeExplorerState,
  sortSkills,
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
    source: "jack-arturo",
    firstUsed: "2026-08-20",
    references: 4,
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
    source: "autovault",
    firstUsed: "2026-08-01",
    references: 1,
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
  assert.deepEqual(filterSkills(skills, { source: "jack-arturo" }).map((skill) => skill.name), ["browser-hand"]);
});

test("Explorer sorting follows the documented catalog controls", () => {
  assert.deepEqual(sortSkills(skills, "name").map((skill) => skill.name), ["browser-hand", "commit-message"]);
  assert.deepEqual(sortSkills(skills, "recent").map((skill) => skill.name), ["browser-hand", "commit-message"]);
  assert.deepEqual(sortSkills(skills, "referenced").map((skill) => skill.name), ["browser-hand", "commit-message"]);
});

test("Explorer query state parses and serializes only meaningful filters", () => {
  const state = parseExplorerState(
    "?q=Chrome+forms&category=browser&agent=codex&source=jack-arturo&sort=name&view=list&featured=1&resources=yes&skill=browser-hand",
  );
  assert.deepEqual(state, {
    q: "Chrome forms",
    category: "browser",
    agent: "codex",
    source: "jack-arturo",
    sort: "name",
    view: "list",
    featured: true,
    resources: "yes",
  });
  assert.equal(
    serializeExplorerState(state),
    "?q=Chrome+forms&category=browser&agent=codex&source=jack-arturo&sort=name&view=list&featured=1&resources=yes",
  );
  assert.equal(
    serializeExplorerState(state, "?utm_source=directory&skill=browser-hand"),
    "?utm_source=directory&q=Chrome+forms&category=browser&agent=codex&source=jack-arturo&sort=name&view=list&featured=1&resources=yes",
  );
  assert.equal(serializeExplorerState(parseExplorerState("?featured=no&resources=nope")), "");
  assert.equal(parseExplorerState("?featured=on").featured, true);
});

test("Explorer state clears unavailable filters before it reaches the URL", () => {
  const initial = { category: "git" };
  const normalized = normalizeExplorerState(skills, initial);
  assert.deepEqual(
    normalized,
    { category: "git" },
  );
  assert.deepEqual(
    normalizeExplorerState(skills, { q: "does-not-exist" }),
    { q: "does-not-exist" },
  );
});

test("Explorer state removes unknown option values before serializing visible controls", () => {
  const normalized = normalizeExplorerState(skills, {
    category: "unknown-category",
    agent: "unknown-agent",
  });
  assert.deepEqual(normalized, {
    category: "",
    agent: "",
  });
  assert.equal(serializeExplorerState(normalized), "");
});
