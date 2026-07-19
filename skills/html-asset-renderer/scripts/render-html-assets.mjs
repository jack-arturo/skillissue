#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const DEFAULT_SELECTOR = ".canvas";
const DEFAULT_VIEWPORT = { width: 2400, height: 2400 };

function usage() {
  process.stderr.write(`Usage:
  render-html-assets.mjs <input-dir> <output-dir> [options]

Options:
  --manifest <file>     JSON manifest with an assets array
  --selector <selector> Default CSS selector to capture (default: .canvas)
  --chrome <path>       Chrome/Chromium executable path
  --dpr <number>        Device scale factor (default: 1)
  --report <file>       Write JSON report
  --timeout <ms>        Per-page timeout (default: 15000)
  --include-index       Include index.html in auto-discovery
`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const options = {
    selector: DEFAULT_SELECTOR,
    dpr: 1,
    timeout: 15000,
    includeIndex: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--manifest") {
      options.manifest = argv[++i];
    } else if (arg === "--selector") {
      options.selector = argv[++i];
    } else if (arg === "--chrome") {
      options.chrome = argv[++i];
    } else if (arg === "--dpr") {
      options.dpr = Number(argv[++i]);
    } else if (arg === "--report") {
      options.report = argv[++i];
    } else if (arg === "--timeout") {
      options.timeout = Number(argv[++i]);
    } else if (arg === "--include-index") {
      options.includeIndex = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 2) usage();
  if (!Number.isFinite(options.dpr) || options.dpr <= 0) {
    throw new Error("--dpr must be a positive number");
  }
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }

  return {
    inputDir: resolve(positional[0]),
    outputDir: resolve(positional[1]),
    options
  };
}

async function readManifest(manifestPath, inputDir, outputDir, defaultSelector) {
  if (!manifestPath) return null;
  const absolute = isAbsolute(manifestPath) ? manifestPath : resolve(manifestPath);
  const parsed = JSON.parse(await readFile(absolute, "utf8"));
  const rawAssets = Array.isArray(parsed) ? parsed : parsed.assets;
  if (!Array.isArray(rawAssets)) {
    throw new Error("Manifest must be an array or an object with an assets array");
  }
  return rawAssets.map((asset, index) => normalizeAsset(asset, index, inputDir, outputDir, defaultSelector));
}

function normalizeAsset(asset, index, inputDir, outputDir, defaultSelector) {
  if (!asset || typeof asset !== "object") {
    throw new Error(`Manifest asset ${index} must be an object`);
  }
  if (typeof asset.source !== "string" || asset.source.length === 0) {
    throw new Error(`Manifest asset ${index} is missing source`);
  }
  const source = isAbsolute(asset.source) ? asset.source : resolve(inputDir, asset.source);
  const outputName = typeof asset.output === "string" && asset.output.length > 0
    ? asset.output
    : `${basename(asset.source, extname(asset.source))}.png`;
  const output = isAbsolute(outputName) ? outputName : resolve(outputDir, outputName);
  return {
    source,
    output,
    selector: typeof asset.selector === "string" && asset.selector.length > 0 ? asset.selector : defaultSelector,
    width: numberOrUndefined(asset.width),
    height: numberOrUndefined(asset.height),
    maxBytes: numberOrUndefined(asset.maxBytes),
    format: asset.format === "jpeg" || asset.format === "jpg" ? "jpeg" : "png"
  };
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Expected positive number, got ${value}`);
  }
  return number;
}

async function discoverAssets(inputDir, outputDir, selector, includeIndex) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const assets = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".html") continue;
    if (!includeIndex && entry.name.toLowerCase() === "index.html") continue;
    const source = resolve(inputDir, entry.name);
    assets.push({
      source,
      output: resolve(outputDir, `${basename(entry.name, ".html")}.png`),
      selector,
      format: "png"
    });
  }
  return assets;
}

async function findChrome(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("Could not find Chrome/Chromium. Pass --chrome or set CHROME_PATH.");
}

async function launchChrome(chromePath) {
  const profileDir = await mkdtemp(join(tmpdir(), "html-asset-renderer-"));
  const args = [
    "--headless=new",
    "--remote-debugging-port=0",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--hide-scrollbars",
    "--no-default-browser-check",
    "--no-first-run",
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ];

  const child = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  const wsUrl = await new Promise((resolveWs, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for Chrome DevTools URL. ${stderr}`)), 10000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolveWs(match[1]);
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      reject(new Error(`Chrome exited before startup completed with code ${code}. ${stderr}`));
    });
  });

  return {
    wsUrl,
    profileDir,
    child,
    async close() {
      child.kill("SIGTERM");
      await new Promise((resolveClose) => child.once("close", resolveClose));
      await rm(profileDir, { recursive: true, force: true });
    }
  };
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolveOpen, reject) => {
      this.ws.addEventListener("open", resolveOpen, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data ?? "")}`));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function createPageSession(browserWsUrl) {
  const endpoint = new URL(browserWsUrl);
  const httpBase = `http://${endpoint.host}`;
  const response = await fetch(`${httpBase}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status} ${response.statusText}`);
  const target = await response.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  return client;
}

async function evaluate(client, expression, options = {}) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: options.awaitPromise ?? false,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function renderAsset(client, asset, options) {
  const targetWidth = asset.width ?? DEFAULT_VIEWPORT.width;
  const targetHeight = asset.height ?? DEFAULT_VIEWPORT.height;
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: Math.ceil(targetWidth),
    height: Math.ceil(targetHeight),
    deviceScaleFactor: options.dpr,
    mobile: false,
    screenWidth: Math.ceil(targetWidth),
    screenHeight: Math.ceil(targetHeight)
  });

  const url = pathToFileURL(asset.source).href;
  await client.send("Page.navigate", { url });
  await waitFor(client, "document.readyState === 'complete'", options.timeout);
  await evaluate(client, "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true", { awaitPromise: true });
  await evaluate(client, `(() => {
    const style = document.createElement("style");
    style.setAttribute("data-html-asset-renderer", "true");
    style.textContent = "*{animation:none!important;transition:none!important;caret-color:transparent!important} html,body{overflow:hidden!important}";
    document.documentElement.appendChild(style);
    return true;
  })()`);

  const rect = await evaluate(client, `(() => {
    const selector = ${JSON.stringify(asset.selector)};
    const el = document.querySelector(selector);
    if (!el) return { found: false, selector };
    const r = el.getBoundingClientRect();
    return {
      found: true,
      selector,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height
    };
  })()`);

  if (!rect?.found) {
    throw new Error(`Selector not found in ${asset.source}: ${asset.selector}`);
  }

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (asset.width && width !== Math.round(asset.width)) {
    throw new Error(`${basename(asset.source)} expected width ${asset.width}, found ${width}`);
  }
  if (asset.height && height !== Math.round(asset.height)) {
    throw new Error(`${basename(asset.source)} expected height ${asset.height}, found ${height}`);
  }

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: Math.max(Math.ceil(rect.x + rect.width), width),
    height: Math.max(Math.ceil(rect.y + rect.height), height),
    deviceScaleFactor: options.dpr,
    mobile: false,
    screenWidth: Math.max(Math.ceil(rect.x + rect.width), width),
    screenHeight: Math.max(Math.ceil(rect.y + rect.height), height)
  });

  const screenshot = await client.send("Page.captureScreenshot", {
    format: asset.format === "jpeg" ? "jpeg" : "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      width: rect.width,
      height: rect.height,
      scale: 1
    }
  });

  const buffer = Buffer.from(screenshot.data, "base64");
  await writeFile(asset.output, buffer);
  const dimensions = asset.format === "png" ? readPngDimensions(buffer) : { width, height };
  if (dimensions.width !== Math.round(width * options.dpr) || dimensions.height !== Math.round(height * options.dpr)) {
    throw new Error(
      `${basename(asset.output)} rendered ${dimensions.width}x${dimensions.height}, expected ${Math.round(width * options.dpr)}x${Math.round(height * options.dpr)}`
    );
  }
  if (asset.maxBytes && buffer.byteLength > asset.maxBytes) {
    throw new Error(`${basename(asset.output)} is ${buffer.byteLength} bytes, above maxBytes ${asset.maxBytes}`);
  }

  return {
    source: asset.source,
    output: asset.output,
    selector: asset.selector,
    width: dimensions.width,
    height: dimensions.height,
    bytes: buffer.byteLength
  };
}

function readPngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("Output is not a PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function main() {
  const { inputDir, outputDir, options } = parseArgs(process.argv.slice(2));
  await stat(inputDir);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, ".html-asset-renderer-write-test"), "");
  await rm(join(outputDir, ".html-asset-renderer-write-test"), { force: true });

  const manifestAssets = await readManifest(options.manifest, inputDir, outputDir, options.selector);
  const assets = manifestAssets ?? await discoverAssets(inputDir, outputDir, options.selector, options.includeIndex);
  if (assets.length === 0) throw new Error("No HTML assets found to render");

  const chromePath = await findChrome(options.chrome);
  const chrome = await launchChrome(chromePath);
  const client = await createPageSession(chrome.wsUrl);
  const results = [];
  const skipped = [];

  try {
    for (const asset of assets) {
      try {
        await stat(asset.source);
        await writeFile(asset.output, "");
        await rm(asset.output, { force: true });
        results.push(await renderAsset(client, asset, options));
        process.stdout.write(`rendered ${basename(asset.output)}\n`);
      } catch (error) {
        skipped.push({ source: asset.source, output: asset.output, error: String(error) });
        if (manifestAssets) throw error;
        process.stderr.write(`skipped ${basename(asset.source)}: ${String(error)}\n`);
      }
    }
  } finally {
    client.close();
    await chrome.close();
  }

  const report = {
    inputDir,
    outputDir,
    chromePath,
    selector: options.selector,
    dpr: options.dpr,
    generated: results,
    skipped
  };

  if (options.report) {
    const reportPath = isAbsolute(options.report) ? options.report : resolve(options.report);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  process.stdout.write("\nHTML asset render report\n");
  process.stdout.write(`source: ${inputDir}\n`);
  process.stdout.write(`output: ${outputDir}\n`);
  for (const result of results) {
    process.stdout.write(`- ${basename(result.output)} ${result.width}x${result.height} ${result.bytes} bytes\n`);
  }
  if (skipped.length > 0) {
    process.stdout.write("skipped:\n");
    for (const item of skipped) {
      process.stdout.write(`- ${basename(item.source)}: ${item.error}\n`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
