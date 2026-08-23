const RESOURCE_VALUES = new Set(["yes", "none"]);

export function parseExplorerState(input = "") {
  const params = input instanceof URLSearchParams
    ? input
    : new URLSearchParams(String(input).replace(/^.*\?/, ""));
  const featured = params.get("featured");
  const resources = params.get("resources") || "";
  return {
    q: (params.get("q") || "").trim(),
    category: (params.get("category") || "").trim(),
    agent: (params.get("agent") || "").trim(),
    featured: featured === "1" || featured === "true" || featured === "on",
    resources: RESOURCE_VALUES.has(resources) ? resources : "",
    skill: (params.get("skill") || "").trim(),
  };
}

export function serializeExplorerState(state = {}) {
  const params = new URLSearchParams();
  if (state.q?.trim()) params.set("q", state.q.trim());
  if (state.category) params.set("category", state.category);
  if (state.agent) params.set("agent", state.agent);
  if (state.featured) params.set("featured", "1");
  if (RESOURCE_VALUES.has(state.resources)) params.set("resources", state.resources);
  if (state.skill) params.set("skill", state.skill);
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
    return true;
  });
}

export function normalizeExplorerState(skills, state = {}) {
  const categories = new Set(skills.map((skill) => skill.category).filter(Boolean));
  const agents = new Set(skills.flatMap((skill) => skill.agents || []).filter(Boolean));
  const normalized = { ...state };
  if (Object.hasOwn(state, "category")) normalized.category = categories.has(state.category) ? state.category : "";
  if (Object.hasOwn(state, "agent")) normalized.agent = agents.has(state.agent) ? state.agent : "";
  const visible = filterSkills(skills, normalized);
  return {
    ...normalized,
    skill: visible.some((skill) => skill.name === state.skill)
      ? state.skill
      : (visible[0]?.name || ""),
  };
}

export function selectionChanged(previousState = {}, nextState = {}) {
  return previousState.skill !== nextState.skill;
}

export function shouldRevealDetail(viewportWidth) {
  return Number.isFinite(viewportWidth) && viewportWidth <= 640;
}

export function isModifiedActivation(event = {}) {
  return Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
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
  };
  const form = root.querySelector("form");
  const count = root.querySelector("[data-explorer-count]");
  const results = root.querySelector("[data-explorer-results]");
  const detail = root.querySelector("[data-explorer-detail]");
  results.setAttribute("role", "listbox");
  detail.tabIndex = -1;
  const categories = [...new Set(skills.map((skill) => skill.category).filter(Boolean))].sort();
  const agents = [...new Set(skills.flatMap((skill) => skill.agents || []).filter(Boolean))].sort();
  categories.forEach((value) => option(controls.category, value, value));
  agents.forEach((value) => option(controls.agent, value, value));

  let state = parseExplorerState(window.location.search);
  function readControls() {
    return {
      q: controls.q.value,
      category: controls.category.value,
      agent: controls.agent.value,
      featured: controls.featured.checked,
      resources: controls.resources.value,
      skill: state.skill,
    };
  }
  function applyControls() {
    controls.q.value = state.q;
    controls.category.value = state.category;
    controls.agent.value = state.agent;
    controls.featured.checked = state.featured;
    controls.resources.value = state.resources;
  }
  function updateUrl() {
    state = normalizeExplorerState(skills, state);
    const query = serializeExplorerState(state);
    history.replaceState(null, "", `${window.location.pathname}${query}`);
  }
  function renderDetail(selected) {
    detail.replaceChildren();
    if (!selected) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "Choose a skill to see its package and install command.";
      detail.append(message);
      return;
    }
    const title = document.createElement("h2");
    title.textContent = selected.title || selected.name;
    const description = document.createElement("p");
    description.textContent = selected.description || selected.summary || "";
    const meta = document.createElement("p");
    meta.className = "explorer-detail-meta";
    meta.textContent = `${selected.category || "skill"} · ${selected.resourceCount || 0} resource${selected.resourceCount === 1 ? "" : "s"}${selected.runnable ? " · runnable package" : ""}`;
    const actions = document.createElement("div");
    actions.className = "cta-row";
    actions.append(copyButton("Copy AutoVault install", selected.cliInstall));
    actions.append(copyButton("Copy MCP add_skill", selected.mcpInstall));
    const story = document.createElement("a");
    story.className = "btn btn-primary";
    story.href = selected.storyUrl;
    story.textContent = "Read full story";
    actions.append(story);
    const source = document.createElement("a");
    source.className = "explorer-source";
    source.href = selected.sourceUrl;
    source.rel = "noopener";
    source.textContent = "View package source";
    detail.append(title, description, meta, actions, source);
  }
  function revealDetailOnNarrowViewport() {
    if (!shouldRevealDetail(window.innerWidth)) return;
    detail.focus({ preventScroll: true });
    detail.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function render() {
    const visible = filterSkills(skills, state);
    state = normalizeExplorerState(skills, state);
    const selected = skills.find((skill) => skill.name === state.skill);
    count.textContent = `${visible.length} of ${skills.length} skills`;
    results.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty show";
      empty.textContent = "No skills match those filters.";
      results.append(empty);
    }
    visible.forEach((skill, index) => {
      const row = document.createElement("a");
      row.className = "explorer-result";
      row.href = skill.storyUrl;
      row.dataset.skill = skill.name;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(skill.name === state.skill));
      row.tabIndex = skill.name === state.skill ? 0 : -1;
      const name = document.createElement("strong");
      name.textContent = skill.name;
      const summary = document.createElement("span");
      summary.textContent = skill.summary || skill.description || "";
      const badge = document.createElement("small");
      badge.textContent = `${skill.category} · ${skill.resourceCount || 0} resource${skill.resourceCount === 1 ? "" : "s"}`;
      row.append(name, summary, badge);
      row.addEventListener("click", (event) => {
        if (isModifiedActivation(event)) return;
        event.preventDefault();
        state.skill = skill.name;
        updateUrl();
        render();
        revealDetailOnNarrowViewport();
      });
      row.addEventListener("keydown", (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        state.skill = visible[next].name;
        updateUrl();
        render();
        [...results.querySelectorAll("[data-skill]")]
          .find((row) => row.dataset.skill === state.skill)
          ?.focus();
      });
      results.append(row);
    });
    renderDetail(selected);
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
  const initialState = state;
  state = normalizeExplorerState(skills, state);
  applyControls();
  render();
  if (serializeExplorerState(initialState) !== serializeExplorerState(state)) updateUrl();
}

if (typeof document !== "undefined") initExplorer();
