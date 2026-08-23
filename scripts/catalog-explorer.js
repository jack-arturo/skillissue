const RESOURCE_VALUES = new Set(["yes", "none"]);
const SORT_VALUES = new Set(["referenced", "recent", "name"]);
const VIEW_VALUES = new Set(["grid", "list"]);

export function parseExplorerState(input = "") {
  const params = input instanceof URLSearchParams
    ? input
    : new URLSearchParams(String(input).replace(/^.*\?/, ""));
  const featured = params.get("featured");
  const resources = params.get("resources") || "";
  const sort = params.get("sort") || "referenced";
  const view = params.get("view") || "grid";
  return {
    q: (params.get("q") || "").trim(),
    category: (params.get("category") || "").trim(),
    agent: (params.get("agent") || "").trim(),
    featured: featured === "1" || featured === "true" || featured === "on",
    resources: RESOURCE_VALUES.has(resources) ? resources : "",
    source: (params.get("source") || "").trim(),
    sort: SORT_VALUES.has(sort) ? sort : "referenced",
    view: VIEW_VALUES.has(view) ? view : "grid",
  };
}

export function serializeExplorerState(state = {}, input = "") {
  const params = input instanceof URLSearchParams
    ? new URLSearchParams(input)
    : new URLSearchParams(String(input).replace(/^.*\?/, ""));
  ["q", "category", "agent", "featured", "resources", "source", "sort", "view", "skill"].forEach((key) => params.delete(key));
  if (state.q?.trim()) params.set("q", state.q.trim());
  if (state.category) params.set("category", state.category);
  if (state.agent) params.set("agent", state.agent);
  if (state.source) params.set("source", state.source);
  if (state.sort && state.sort !== "referenced") params.set("sort", state.sort);
  if (state.view && state.view !== "grid") params.set("view", state.view);
  if (state.featured) params.set("featured", "1");
  if (RESOURCE_VALUES.has(state.resources)) params.set("resources", state.resources);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function filterSkills(skills, state = {}) {
  const query = String(state.q || "").trim().toLocaleLowerCase();
  return skills.filter((skill) => {
    const searchable = [
      skill.name,
      skill.summary,
      skill.description,
      ...(skill.tags || []),
    ].join(" ").toLocaleLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (state.category && skill.category !== state.category) return false;
    if (state.agent && !(skill.agents || []).includes(state.agent)) return false;
    if (state.featured && !skill.featured) return false;
    if (state.resources === "yes" && !(skill.resourceCount > 0)) return false;
    if (state.resources === "none" && skill.resourceCount !== 0) return false;
    if (state.source && (skill.source || skill.provenance || "") !== state.source) return false;
    return true;
  });
}

export function sortSkills(skills, sort = "referenced") {
  const sorted = [...skills];
  const compareName = (a, b) => String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""), undefined, { sensitivity: "base" });
  if (sort === "name") return sorted.sort(compareName);
  if (sort === "recent") {
    return sorted.sort((a, b) => String(b.firstUsed || "").localeCompare(String(a.firstUsed || "")) || compareName(a, b));
  }
  return sorted.sort((a, b) => (b.references || 0) - (a.references || 0) || compareName(a, b));
}

export function normalizeExplorerState(skills, state = {}) {
  const categories = new Set(skills.map((skill) => skill.category).filter(Boolean));
  const agents = new Set(skills.flatMap((skill) => skill.agents || []).filter(Boolean));
  const sources = new Set(skills.map((skill) => skill.source || skill.provenance).filter(Boolean));
  const normalized = { ...state };
  if (Object.hasOwn(state, "category")) normalized.category = categories.has(state.category) ? state.category : "";
  if (Object.hasOwn(state, "agent")) normalized.agent = agents.has(state.agent) ? state.agent : "";
  if (Object.hasOwn(state, "source")) normalized.source = sources.has(state.source) ? state.source : "";
  if (Object.hasOwn(state, "sort")) normalized.sort = SORT_VALUES.has(state.sort) ? state.sort : "referenced";
  if (Object.hasOwn(state, "view")) normalized.view = VIEW_VALUES.has(state.view) ? state.view : "grid";
  return normalized;
}

function option(select, value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  select.append(node);
}

function copyButton(label, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-ghost explorer-copy";
  button.dataset.copy = value;
  button.textContent = label;
  return button;
}

function skillMark(name = "") {
  return String(name).split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function resourceLabel(skill) {
  const count = skill.resourceCount || 0;
  return `${count} resource${count === 1 ? "" : "s"}`;
}

function explorerMark(name) {
  const mark = document.createElement("span");
  mark.className = "explorer-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = skillMark(name);
  return mark;
}

function agentPills(agents = []) {
  const row = document.createElement("div");
  row.className = "explorer-agent-row";
  row.setAttribute("aria-label", "Agent targets");
  (agents.length ? agents : ["general"]).slice(0, 3).forEach((agent) => {
    const pill = document.createElement("span");
    pill.className = "explorer-agent";
    pill.textContent = agent;
    row.append(pill);
  });
  return row;
}

function renderCard(skill) {
  const card = document.createElement("article");
  card.className = "explorer-card";
  card.dataset.explorerCard = "";
  card.dataset.skill = skill.name;

  const head = document.createElement("header");
  head.className = "explorer-card-head";
  head.append(explorerMark(skill.name));
  const heading = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "explorer-kicker";
  kicker.textContent = `public package · ${skill.provenance || "house"} · ${skill.category || "skill"}`;
  const name = document.createElement("h2");
  const canonical = document.createElement("a");
  canonical.href = skill.storyUrl;
  canonical.textContent = skill.title || skill.name;
  name.append(canonical);
  heading.append(kicker, name);
  head.append(heading);

  const summary = document.createElement("p");
  summary.className = "explorer-card-summary";
  summary.textContent = skill.summary || skill.description || "";

  const footer = document.createElement("footer");
  footer.className = "explorer-card-footer";
  const bundle = document.createElement("span");
  bundle.textContent = `v${skill.version || "1.0.0"} · ${resourceLabel(skill)}${skill.runnable ? " · runnable" : ""}`;
  const actions = document.createElement("div");
  const source = document.createElement("a");
  source.href = skill.rawSourceUrl;
  source.rel = "noopener";
  source.textContent = "Raw";
  actions.append(source, copyButton("Copy install", skill.cliInstall));
  footer.append(bundle, actions);
  card.append(head, summary, agentPills(skill.agents || []), footer);
  return card;
}

function initExplorer() {
  const root = document.querySelector("[data-catalog-explorer]");
  const dataNode = document.getElementById("explorer-data");
  if (!root || !dataNode) return;

  let data;
  try {
    data = JSON.parse(dataNode.textContent);
  } catch {
    return;
  }
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const controls = {
    q: root.querySelector("[name=q]"),
    category: root.querySelector("[name=category]"),
    agent: root.querySelector("[name=agent]"),
    featured: root.querySelector("[name=featured]"),
    resources: root.querySelector("[name=resources]"),
    source: root.querySelector("[name=source]"),
  };
  const sortButtons = [...root.querySelectorAll("[data-explorer-sort]")];
  const viewButtons = [...root.querySelectorAll("[data-explorer-view]")];
  const form = root.querySelector("form");
  const count = root.querySelector("[data-explorer-count]");
  const results = root.querySelector("[data-explorer-results]");
  const categories = [...new Set(skills.map((skill) => skill.category).filter(Boolean))].sort();
  const agents = [...new Set(skills.flatMap((skill) => skill.agents || []).filter(Boolean))].sort();
  const sources = [...new Set(skills.map((skill) => skill.source || skill.provenance).filter(Boolean))].sort();
  categories.forEach((value) => option(controls.category, value, value));
  agents.forEach((value) => option(controls.agent, value, value));
  sources.forEach((value) => option(controls.source, value, value));

  const initialState = parseExplorerState(window.location.search);
  let state = initialState;
  function readControls() {
    return {
      q: controls.q.value,
      category: controls.category.value,
      agent: controls.agent.value,
      featured: controls.featured.checked,
      resources: controls.resources.value,
      source: controls.source.value,
      sort: state.sort,
      view: state.view,
    };
  }
  function applyControls() {
    controls.q.value = state.q;
    controls.category.value = state.category;
    controls.agent.value = state.agent;
    controls.featured.checked = state.featured;
    controls.resources.value = state.resources;
    controls.source.value = state.source;
    sortButtons.forEach((button) => {
      const selected = button.dataset.explorerSort === state.sort;
      button.setAttribute("aria-pressed", String(selected));
    });
    viewButtons.forEach((button) => {
      const selected = button.dataset.explorerView === state.view;
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function updateUrl() {
    state = normalizeExplorerState(skills, state);
    const query = serializeExplorerState(state, window.location.search);
    history.replaceState(null, "", `${window.location.pathname}${query}`);
  }
  function render() {
    const visible = sortSkills(filterSkills(skills, state), state.sort);
    state = normalizeExplorerState(skills, state);
    count.textContent = `Showing ${visible.length} of ${skills.length} skills`;
    results.dataset.view = state.view;
    results.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty show";
      empty.textContent = "No skills match those filters.";
      results.append(empty);
    }
    visible.forEach((skill) => results.append(renderCard(skill)));
  }
  function change() {
    state = readControls();
    updateUrl();
    render();
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    change();
  });
  Object.values(controls).forEach((control) => control.addEventListener(control === controls.q ? "input" : "change", change));
  sortButtons.forEach((button) => button.addEventListener("click", () => {
    state = { ...readControls(), sort: button.dataset.explorerSort, view: state.view };
    updateUrl();
    applyControls();
    render();
  }));
  viewButtons.forEach((button) => button.addEventListener("click", () => {
    state = { ...readControls(), sort: state.sort, view: button.dataset.explorerView };
    updateUrl();
    applyControls();
    render();
  }));
  state = normalizeExplorerState(skills, state);
  applyControls();
  render();
  if (window.location.search !== serializeExplorerState(state, window.location.search)) updateUrl();
}

if (typeof document !== "undefined") initExplorer();
