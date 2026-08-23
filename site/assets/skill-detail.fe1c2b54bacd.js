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

export function packageTabForHash(hash = "", tabs = []) {
  const id = String(hash).replace(/^#/, "");
  return tabs.includes(id) ? id : "overview";
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
  let previewObjectUrl = "";

  const setTab = (id, { updateHash = false } = {}) => {
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.packageTab === id)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.packagePanel !== id; });
    if (updateHash && window.location.hash !== `#${id}`) window.location.hash = id;
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
    content.textContent = `Loading ${file.path}…`;
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(String(response.status));
      const source = await response.text();
      if (selectedPath !== path) return;
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = "";
      if ((file.kind || resourceKind(file.path)) === "svg") {
        content.replaceChildren();
        const image = document.createElement("img");
        previewObjectUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
        image.src = previewObjectUrl;
        image.alt = file.title || file.path;
        image.className = "package-preview-image";
        content.append(image);
      } else {
        content.textContent = source;
      }
    } catch {
      if (selectedPath === path) content.textContent = "Preview unavailable. Use the raw link to inspect this file.";
    }
  };

  root.dataset.tabsReady = "";
  const tabIds = tabs.map((tab) => tab.dataset.packageTab);
  tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.packageTab, { updateHash: true })));
  fileButtons.forEach((button) => button.addEventListener("click", () => select(button.dataset.packageFile)));
  window.addEventListener("hashchange", () => setTab(packageTabForHash(window.location.hash, tabIds)));
  setTab(packageTabForHash(window.location.hash, tabIds));
  if (selectedPath) select(selectedPath);
}

if (typeof document !== "undefined") initPackageDetail();
