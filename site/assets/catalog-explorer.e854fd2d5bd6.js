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

export function keyboardFocusTarget(viewportWidth) {
  return shouldRevealDetail(viewportWidth) ? "detail" : "result";
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
  const main = root.querySelector(".explorer-main");
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
    const head = document.createElement("div");
    head.className = "explorer-detail-head";
    head.append(explorerMark(selected.name));
    const heading = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "explorer-kicker";
    kicker.textContent = `selected package · ${selected.provenance || "house"} · ${selected.category || "skill"}`;
    const title = document.createElement("h2");
    title.textContent = selected.title || selected.name;
    heading.append(kicker, title);
    head.append(heading);
    const description = document.createElement("p");
    description.textContent = selected.description || selected.summary || "";
    const facts = document.createElement("dl");
    facts.className = "explorer-facts";
    const addFact = (label, value) => {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const definition = document.createElement("dd");
      definition.textContent = value;
      item.append(term, definition);
      facts.append(item);
    };
    addFact("Targets", (selected.agents?.length ? selected.agents : ["general"]).join(", "));
    addFact("Bundle", `${resourceLabel(selected)}${selected.runnable ? " · runnable" : ""}`);
    addFact("Provenance", selected.provenance || "house");
    const install = document.createElement("div");
    install.className = "explorer-install";
    const installLabel = document.createElement("span");
    installLabel.textContent = "Pinned AutoVault install";
    const command = document.createElement("code");
    command.textContent = selected.cliInstall;
    install.append(installLabel, command, copyButton("Copy install", selected.cliInstall));
    const actions = document.createElement("div");
    actions.className = "cta-row";
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
    actions.append(story, source);
    detail.append(head, description, facts, install, actions);
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
    main.append(detail);
    results.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty show";
      empty.textContent = "No skills match those filters.";
      results.append(empty);
    }
    visible.forEach((skill) => {
      const card = document.createElement("article");
      card.className = "explorer-card";
      card.dataset.explorerCard = "";
      card.dataset.skill = skill.name;
      card.setAttribute("aria-current", skill.name === state.skill ? "true" : "false");
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
      const summary = document.createElement("span");
      summary.className = "explorer-card-summary";
      summary.textContent = skill.summary || skill.description || "";
      const footer = document.createElement("footer");
      footer.className = "explorer-card-footer";
      const bundle = document.createElement("span");
      bundle.textContent = `${resourceLabel(skill)}${skill.runnable ? " · runnable" : ""}`;
      const inspect = document.createElement("button");
      inspect.type = "button";
      inspect.className = "explorer-inspect";
      inspect.dataset.explorerInspect = skill.name;
      inspect.textContent = skill.name === state.skill ? "Inspecting" : "Inspect";
      footer.append(bundle, inspect);
      card.append(head, summary, agentPills(skill.agents || []), footer);
      inspect.addEventListener("click", () => {
        state.skill = skill.name;
        updateUrl();
        render();
        revealDetailOnNarrowViewport();
      });
      inspect.addEventListener("keydown", (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = visible.findIndex((candidate) => candidate.name === skill.name);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        state.skill = visible[next].name;
        updateUrl();
        render();
        if (keyboardFocusTarget(window.innerWidth) === "detail") {
          revealDetailOnNarrowViewport();
        } else {
          [...results.querySelectorAll("[data-explorer-inspect]")]
            .find((button) => button.dataset.explorerInspect === state.skill)
            ?.focus();
        }
      });
      results.append(card);
    });
    renderDetail(selected);
    if (selected && shouldRevealDetail(window.innerWidth)) {
      [...results.querySelectorAll("[data-skill]")]
        .find((card) => card.dataset.skill === selected.name)
        ?.append(detail);
    }
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
  window.addEventListener("resize", render);
  if (serializeExplorerState(initialState) !== serializeExplorerState(state)) updateUrl();
}

if (typeof document !== "undefined") initExplorer();
