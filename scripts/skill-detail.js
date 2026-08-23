const GROUP_ORDER = ["root", "references", "assets", "agents", "bin", "scripts", "other"];

export function resourceKind(filePath = "") {
  const extension = String(filePath).split(".").pop()?.toLowerCase();
  if (filePath === "SKILL.md" || ["md", "mdx"].includes(extension)) return "markdown";
  if (extension === "svg") return "svg";
  if (["mjs", "js", "ts", "py", "sh", "bash", "zsh", "rb", "pl"].includes(extension)) return "script";
  if (["json", "yaml", "yml", "toml"].includes(extension)) return "config";
  if (["css", "txt"].includes(extension)) return extension;
  return "file";
}

function resourceGroup(filePath = "") {
  if (filePath === "SKILL.md") return "root";
  const group = String(filePath).split("/")[0];
  return GROUP_ORDER.includes(group) ? group : "other";
}

export function groupBundleFiles(files = []) {
  return GROUP_ORDER
    .map((id) => ({ id, files: files.filter((file) => resourceGroup(file.path) === id) }))
    .filter((group) => group.files.length);
}

function initPackageDetail() {
  const root = document.querySelector("[data-package-detail]");
  const dataNode = document.getElementById("package-data");
  if (!root || !dataNode) return;

  let data;
  try {
    data = JSON.parse(dataNode.textContent);
  } catch {
    return;
  }
  const files = Array.isArray(data.files) ? data.files : [];
  const fileButtons = [...root.querySelectorAll("[data-package-file]")];
  const tabs = [...root.querySelectorAll("[data-package-tab]")];
  const panels = [...root.querySelectorAll("[data-package-panel]")];
  const preview = root.querySelector("[data-package-preview]");
  let selectedPath = files[0]?.path || "";

  const setTab = (id) => {
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.packageTab === id)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.packagePanel !== id; });
  };
  const select = async (path) => {
    const file = files.find((item) => item.path === path);
    if (!file || !preview) return;
    selectedPath = path;
    fileButtons.forEach((button) => button.setAttribute("aria-current", String(button.dataset.packageFile === path)));
    preview.querySelector("[data-package-preview-kind]").textContent = file.kind || resourceKind(file.path);
    preview.querySelector("[data-package-preview-name]").textContent = file.path;
    preview.querySelector("[data-package-preview-summary]").textContent = file.summary || "Bundled package file.";
    const raw = preview.querySelector("[data-package-preview-raw]");
    raw.href = file.url;
    const content = preview.querySelector("[data-package-preview-content]");
    if ((file.kind || resourceKind(file.path)) === "svg") {
      content.replaceChildren();
      const image = document.createElement("img");
      image.src = file.url;
      image.alt = file.title || file.path;
      image.className = "package-preview-image";
      content.append(image);
      return;
    }
    content.textContent = `Loading ${file.path}…`;
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(String(response.status));
      const source = await response.text();
      if (selectedPath === path) content.textContent = source;
    } catch {
      if (selectedPath === path) content.textContent = "Preview unavailable. Use the raw link to inspect this file.";
    }
  };

  root.dataset.tabsReady = "";
  tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.packageTab)));
  fileButtons.forEach((button) => button.addEventListener("click", () => select(button.dataset.packageFile)));
  setTab("overview");
  if (selectedPath) select(selectedPath);
}

if (typeof document !== "undefined") initPackageDetail();
