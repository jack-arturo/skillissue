#!/usr/bin/env node
/**
 * generate-charts.mjs — Phase 1 essay charts for skillissue
 *
 * Reads content/data/tool-timeline.json and writes self-contained SVGs to
 * content/assets/charts/. Regenerable; numbers must match the JSON.
 *
 * Usage: node scripts/generate-charts.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "content/data/tool-timeline.json");
const OUT = join(ROOT, "content/assets/charts");

const C = {
  bg: "#0f1419",
  text: "#e8eaed",
  mint: "#5ad6c0",
  blue: "#7aa2ff",
  warn: "#f0b429",
  muted: "#8b949e",
  grid: "#1c2430",
  border: "#2a3441",
  coral: "#f07178",
  purple: "#c792ea",
};

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const data = JSON.parse(readFileSync(DATA, "utf8"));
const timeline = data.timeline;
const current = data.current;
const genDate = data.generatedAt?.slice(0, 10) ?? "2026-07-20";

mkdirSync(OUT, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgOpen(w, h, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(title)}</title>
  <desc id="desc">${esc(title)} — skillissue chart from AutoHub git harvest</desc>
  <defs>
    <style type="text/css"><![CDATA[
      text { font-family: ${FONT}; }
    ]]></style>
  </defs>
  <rect width="${w}" height="${h}" fill="${C.bg}" rx="8"/>
`;
}

function svgClose() {
  return `</svg>\n`;
}

function header(title, subtitle, y0 = 28) {
  return `  <text x="32" y="${y0}" fill="${C.text}" font-size="18" font-weight="600">${esc(title)}</text>
  <text x="32" y="${y0 + 22}" fill="${C.muted}" font-size="12">${esc(subtitle)}</text>
`;
}

function footer(source, w, h) {
  return `  <text x="32" y="${h - 16}" fill="${C.muted}" font-size="10">${esc(source)}</text>
  <text x="${w - 32}" y="${h - 16}" fill="${C.muted}" font-size="10" text-anchor="end">skillissue · ${genDate}</text>
`;
}

function niceTicks(max, count = 5) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  step *= mag;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.ceil(max / step) * step);
  return ticks;
}

function dateToMs(d) {
  return Date.parse(d + "T00:00:00Z");
}

function shortDate(d) {
  const [y, m] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} '${y.slice(2)}`;
}

function linePath(pts) {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function areaPath(pts, baselineY) {
  if (!pts.length) return "";
  const line = linePath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L${last.x.toFixed(1)},${baselineY} L${first.x.toFixed(1)},${baselineY} Z`;
}

// ── C1: Registered tools over time ───────────────────────────────────

function chartC1() {
  const W = 860;
  const H = 440;
  const pad = { l: 64, r: 40, t: 80, b: 72 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const t0 = dateToMs(timeline[0].date);
  const t1 = dateToMs(timeline[timeline.length - 1].date);
  const xOf = (d) => pad.l + ((dateToMs(d) - t0) / (t1 - t0)) * plotW;

  // Dual scale: mcpTools 0–900 left; groups/rules 0–70 right-ish — use single left scale
  // with mcpTools as primary (0-900) and groups/rules on secondary visual via scale factor.
  // Spec: multi-series — mcpTools when available, groups, contextRules. Dual Y is cleaner.
  const maxTools = 900;
  const maxFilter = 70;
  const yTools = (v) => pad.t + plotH - (v / maxTools) * plotH;
  const yFilter = (v) => pad.t + plotH - (v / maxFilter) * plotH;

  const groupsPts = timeline.map((r) => ({ x: xOf(r.date), y: yFilter(r.tf_groups), v: r.tf_groups }));
  const rulesPts = timeline.map((r) => ({ x: xOf(r.date), y: yFilter(r.tf_contextRules), v: r.tf_contextRules }));
  const toolsPts = timeline
    .filter((r) => r.mcpTools != null)
    .map((r) => ({ x: xOf(r.date), y: yTools(r.mcpTools), v: r.mcpTools, d: r.date }));

  let out = svgOpen(W, H, "Registered MCP tools vs filter surface over time");
  out += header(
    "Registered tools grew faster than the filter floor",
    "AutoHub config harvest · mcpTools (when present), groups, contextRules"
  );

  // Grid — left axis (tools)
  for (const t of niceTicks(maxTools, 5)) {
    const y = yTools(t);
    out += `  <line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>\n`;
    out += `  <text x="${pad.l - 10}" y="${(y + 4).toFixed(1)}" fill="${C.muted}" font-size="11" text-anchor="end">${t}</text>\n`;
  }

  // Right axis labels (filter counts)
  for (const t of niceTicks(maxFilter, 5)) {
    const y = yFilter(t);
    out += `  <text x="${W - pad.r + 8}" y="${(y + 4).toFixed(1)}" fill="${C.muted}" font-size="10">${t}</text>\n`;
  }

  // Axes
  out += `  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;
  out += `  <line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;
  out += `  <line x1="${W - pad.r}" y1="${pad.t}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1" stroke-dasharray="3 3"/>\n`;

  // X ticks — every ~2 months + ends
  const xLabels = timeline.filter((_, i) => i === 0 || i === timeline.length - 1 || i % 3 === 0);
  for (const r of xLabels) {
    const x = xOf(r.date);
    out += `  <line x1="${x.toFixed(1)}" y1="${pad.t + plotH}" x2="${x.toFixed(1)}" y2="${pad.t + plotH + 5}" stroke="${C.muted}" stroke-width="1"/>\n`;
    out += `  <text x="${x.toFixed(1)}" y="${pad.t + plotH + 20}" fill="${C.muted}" font-size="10" text-anchor="middle">${shortDate(r.date)}</text>\n`;
  }

  // Area under mcpTools
  if (toolsPts.length) {
    out += `  <path d="${areaPath(toolsPts, pad.t + plotH)}" fill="${C.mint}" fill-opacity="0.12"/>\n`;
    out += `  <path d="${linePath(toolsPts)}" fill="none" stroke="${C.mint}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>\n`;
    for (const p of toolsPts) {
      out += `  <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${C.bg}" stroke="${C.mint}" stroke-width="1.5"/>\n`;
    }
    // Annotate peak-ish and cleanup drop and HEAD
    const head = toolsPts[toolsPts.length - 1];
    const feb = toolsPts.find((p) => p.d === "2026-02-15");
    const mar = toolsPts.find((p) => p.d === "2026-03-01");
    if (feb) {
      out += `  <text x="${feb.x.toFixed(1)}" y="${(feb.y - 12).toFixed(1)}" fill="${C.mint}" font-size="10" text-anchor="middle">${feb.v}</text>\n`;
    }
    if (mar) {
      out += `  <text x="${(mar.x + 8).toFixed(1)}" y="${(mar.y + 4).toFixed(1)}" fill="${C.warn}" font-size="10">cleanup → ${mar.v}</text>\n`;
    }
    out += `  <text x="${head.x.toFixed(1)}" y="${(head.y - 12).toFixed(1)}" fill="${C.mint}" font-size="11" font-weight="600" text-anchor="end">${head.v}</text>\n`;
  }

  // Groups line
  out += `  <path d="${linePath(groupsPts)}" fill="none" stroke="${C.blue}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>\n`;
  // Rules line
  out += `  <path d="${linePath(rulesPts)}" fill="none" stroke="${C.warn}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 3"/>\n`;

  // Axis titles
  out += `  <text x="18" y="${pad.t + plotH / 2}" fill="${C.muted}" font-size="10" transform="rotate(-90 18 ${pad.t + plotH / 2})" text-anchor="middle">mcpTools (left)</text>\n`;
  out += `  <text x="${W - 14}" y="${pad.t + plotH / 2}" fill="${C.muted}" font-size="10" transform="rotate(90 ${W - 14} ${pad.t + plotH / 2})" text-anchor="middle">groups / rules (right)</text>\n`;

  // Legend
  const lx = pad.l;
  const ly = H - 48;
  out += legendItem(lx, ly, C.mint, "mcpTools", "solid");
  out += legendItem(lx + 110, ly, C.blue, "groups", "solid");
  out += legendItem(lx + 200, ly, C.warn, "contextRules", "dash");

  out += footer(
    "Source: git-sampled config/mcp-tools.json + tool-filters.json",
    W,
    H
  );
  out += svgClose();
  return out;
}

function legendItem(x, y, color, label, style) {
  const dash = style === "dash" ? ' stroke-dasharray="5 3"' : "";
  return `  <line x1="${x}" y1="${y}" x2="${x + 22}" y2="${y}" stroke="${color}" stroke-width="2.5"${dash}/>
  <text x="${x + 28}" y="${y + 4}" fill="${C.text}" font-size="11">${esc(label)}</text>
`;
}

// ── C2: Filter surface ───────────────────────────────────────────────

function chartC2() {
  const W = 860;
  const H = 420;
  const pad = { l: 56, r: 32, t: 80, b: 72 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const t0 = dateToMs(timeline[0].date);
  const t1 = dateToMs(timeline[timeline.length - 1].date);
  const xOf = (d) => pad.l + ((dateToMs(d) - t0) / (t1 - t0)) * plotW;
  const maxY = 70;
  const yOf = (v) => pad.t + plotH - (v / maxY) * plotH;

  const series = [
    { key: "tf_groups", color: C.mint, label: "groups", w: 2.5 },
    { key: "tf_contextRules", color: C.blue, label: "contextRules", w: 2 },
    { key: "tf_profiles", color: C.warn, label: "profiles", w: 2 },
  ];

  let out = svgOpen(W, H, "Tool-filter surface growth");
  out += header(
    "Filter surface: groups, profiles, context rules",
    "tool-filters.json over 10 months of AutoHub evolution"
  );

  for (const t of niceTicks(maxY, 5)) {
    const y = yOf(t);
    out += `  <line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>\n`;
    out += `  <text x="${pad.l - 10}" y="${(y + 4).toFixed(1)}" fill="${C.muted}" font-size="11" text-anchor="end">${t}</text>\n`;
  }

  out += `  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;
  out += `  <line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;

  const xLabels = timeline.filter((_, i) => i === 0 || i === timeline.length - 1 || i % 3 === 0);
  for (const r of xLabels) {
    const x = xOf(r.date);
    out += `  <text x="${x.toFixed(1)}" y="${pad.t + plotH + 20}" fill="${C.muted}" font-size="10" text-anchor="middle">${shortDate(r.date)}</text>\n`;
  }

  for (const s of series) {
    const pts = timeline.map((r) => ({ x: xOf(r.date), y: yOf(r[s.key]) }));
    out += `  <path d="${linePath(pts)}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-linejoin="round" stroke-linecap="round"/>\n`;
    // end label
    const last = pts[pts.length - 1];
    const lastV = timeline[timeline.length - 1][s.key];
    out += `  <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5" fill="${s.color}"/>\n`;
    out += `  <text x="${(last.x - 8).toFixed(1)}" y="${(last.y - 8).toFixed(1)}" fill="${s.color}" font-size="11" font-weight="600" text-anchor="end">${lastV}</text>\n`;
  }

  // Start annotations
  out += `  <text x="${xOf("2025-09-15").toFixed(1)}" y="${(yOf(12) - 10).toFixed(1)}" fill="${C.muted}" font-size="9" text-anchor="middle">12 groups</text>\n`;

  let lx = pad.l;
  for (const s of series) {
    out += legendItem(lx, H - 48, s.color, s.label, "solid");
    lx += 130;
  }

  out += footer(
    "Source: git-sampled config/tool-filters.json · verygoodplugins/autohub",
    W,
    H
  );
  out += svgClose();
  return out;
}

// ── C3: Floor vs registry ────────────────────────────────────────────

function chartC3() {
  const W = 720;
  const H = 400;
  const registered = current.mcpTools; // 813
  const essential = current.tf_essentialTools; // 23
  const pad = { l: 80, r: 48, t: 90, b: 80 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const maxY = 900;
  const yOf = (v) => pad.t + plotH - (v / maxY) * plotH;

  const bars = [
    { label: "Registered\nmcpTools", value: registered, color: C.coral, x: 0 },
    { label: "Essential\nalways-on", value: essential, color: C.mint, x: 1 },
  ];
  const barW = 120;
  const gap = 100;
  const totalBarsW = bars.length * barW + (bars.length - 1) * gap;
  const startX = pad.l + (plotW - totalBarsW) / 2;

  let out = svgOpen(W, H, "Registered tools vs essential always-on floor");
  out += header(
    "Owner baseline ≠ full registry",
    `July 2026 HEAD · ${registered} registered tools, ${essential} essential always-on`
  );

  for (const t of niceTicks(maxY, 5)) {
    const y = yOf(t);
    out += `  <line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>\n`;
    out += `  <text x="${pad.l - 10}" y="${(y + 4).toFixed(1)}" fill="${C.muted}" font-size="11" text-anchor="end">${t}</text>\n`;
  }
  out += `  <line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;

  bars.forEach((b, i) => {
    const x = startX + i * (barW + gap);
    const y = yOf(b.value);
    const h = pad.t + plotH - y;
    // For essential, min visual height so it's visible but accurate
    const drawH = Math.max(h, 4);
    const drawY = pad.t + plotH - drawH;
    out += `  <rect x="${x}" y="${drawY.toFixed(1)}" width="${barW}" height="${drawH.toFixed(1)}" fill="${b.color}" rx="4"/>\n`;
    out += `  <text x="${x + barW / 2}" y="${(drawY - 12).toFixed(1)}" fill="${C.text}" font-size="22" font-weight="700" text-anchor="middle">${b.value}</text>\n`;
    const lines = b.label.split("\n");
    lines.forEach((line, li) => {
      out += `  <text x="${x + barW / 2}" y="${pad.t + plotH + 22 + li * 16}" fill="${C.muted}" font-size="12" text-anchor="middle">${esc(line)}</text>\n`;
    });
  });

  // Ratio callout
  const ratio = (registered / essential).toFixed(1);
  const callX = startX + barW + gap / 2;
  const callY = pad.t + 40;
  out += `  <rect x="${callX - 70}" y="${callY - 28}" width="140" height="56" fill="${C.grid}" stroke="${C.border}" rx="6"/>\n`;
  out += `  <text x="${callX}" y="${callY - 4}" fill="${C.warn}" font-size="20" font-weight="700" text-anchor="middle">${ratio}×</text>\n`;
  out += `  <text x="${callX}" y="${callY + 16}" fill="${C.muted}" font-size="11" text-anchor="middle">registry / floor</text>\n`;

  // Annotation
  out += `  <text x="${W / 2}" y="${H - 28}" fill="${C.warn}" font-size="12" text-anchor="middle" font-style="italic">owner baseline ≠ full registry</text>\n`;

  out += footer(
    `Source: current HEAD ${current.fullSha.slice(0, 12)} · tool-filters.json + mcp-tools.json`,
    W,
    H
  );
  out += svgClose();
  return out;
}

// ── C4: Offline tool eval ────────────────────────────────────────────

function chartC4() {
  const W = 800;
  const H = 440;
  const models = data.offlineBenchmarks.spike_2026_06_16.models;
  // short display names
  const rows = models.map((m) => {
    let short = m.name;
    if (short.includes("hermes")) short = "hermes3:8b";
    else if (short.includes("abliterated") || short.includes("qwen3.6")) short = "qwen3.6-ablit.";
    else if (short.includes("coder")) short = "qwen3-coder:30b";
    return {
      short,
      full: m.name,
      correctTool: m.correctTool != null ? Math.round(m.correctTool * 100) : null,
      loopCompletion: m.loopCompletion != null ? Math.round(m.loopCompletion * 100) : null,
      verdict: m.verdict,
    };
  });

  const pad = { l: 72, r: 40, t: 96, b: 88 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const maxY = 100;
  const yOf = (v) => pad.t + plotH - (v / maxY) * plotH;

  const groupW = plotW / rows.length;
  const barW = 36;
  const pairGap = 8;

  let out = svgOpen(W, H, "Offline local tool-calling eval");
  out += header(
    "Local tool-calling: correct tool vs loop completion",
    "13-prompt eval · curated ~10-tool catalog · M5 Max · 2026-06-16 spike"
  );

  for (const t of [0, 25, 50, 75, 100]) {
    const y = yOf(t);
    out += `  <line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>\n`;
    out += `  <text x="${pad.l - 10}" y="${(y + 4).toFixed(1)}" fill="${C.muted}" font-size="11" text-anchor="end">${t}%</text>\n`;
  }
  out += `  <line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;

  rows.forEach((r, i) => {
    const cx = Math.round(pad.l + groupW * i + groupW / 2);
    const x1 = cx - barW - pairGap / 2;
    const x2 = cx + pairGap / 2;

    // correctTool
    if (r.correctTool != null) {
      const y = yOf(r.correctTool);
      const h = pad.t + plotH - y;
      out += `  <rect x="${x1}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${C.mint}" rx="3"/>\n`;
      out += `  <text x="${x1 + barW / 2}" y="${(y - 8).toFixed(1)}" fill="${C.mint}" font-size="13" font-weight="600" text-anchor="middle">${r.correctTool}%</text>\n`;
    }

    // loopCompletion
    if (r.loopCompletion != null) {
      const y = yOf(r.loopCompletion);
      const h = pad.t + plotH - y;
      out += `  <rect x="${x2}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${C.blue}" rx="3"/>\n`;
      out += `  <text x="${x2 + barW / 2}" y="${(y - 8).toFixed(1)}" fill="${C.blue}" font-size="13" font-weight="600" text-anchor="middle">${r.loopCompletion}%</text>\n`;
    } else {
      // null — show dash
      out += `  <text x="${x2 + barW / 2}" y="${(pad.t + plotH - 16).toFixed(1)}" fill="${C.muted}" font-size="12" text-anchor="middle">n/a</text>\n`;
    }

    out += `  <text x="${cx}" y="${pad.t + plotH + 24}" fill="${C.text}" font-size="12" text-anchor="middle">${esc(r.short)}</text>\n`;

    // verdict badge
    const isGo = r.verdict.startsWith("GO");
    const badgeColor = isGo ? C.mint : C.coral;
    const badgeLabel = isGo ? "GO" : "NO";
    out += `  <rect x="${cx - 18}" y="${pad.t + plotH + 34}" width="36" height="18" fill="${badgeColor}" fill-opacity="0.2" stroke="${badgeColor}" rx="4"/>\n`;
    out += `  <text x="${cx}" y="${pad.t + plotH + 47}" fill="${badgeColor}" font-size="11" font-weight="700" text-anchor="middle">${badgeLabel}</text>\n`;
  });

  // Legend
  out += legendItem(pad.l, H - 52, C.mint, "correctTool", "solid");
  out += legendItem(pad.l + 130, H - 52, C.blue, "loopCompletion", "solid");

  // Note about qwen3.6 loop failure
  out += `  <text x="${W - pad.r}" y="${pad.t + 14}" fill="${C.muted}" font-size="10" text-anchor="end">qwen3.6: 100% tool pick, 22% loop close → NO</text>\n`;

  out += footer(
    "Source: offlineBenchmarks.spike_2026_06_16 · AutoMem + AutoHub local FC notes",
    W,
    H
  );
  out += svgClose();
  return out;
}

// ── C5: Architecture flow ────────────────────────────────────────────

function chartC5() {
  const W = 880;
  const H = 360;

  const boxes = [
    { id: "reg", label: "Registry", sub: "mcp-tools.json\n813 tools · 32 servers", x: 40, y: 120, w: 140, h: 88, color: C.coral },
    { id: "prof", label: "Profile baseline", sub: "16 profiles\n23 essential always-on", x: 230, y: 120, w: 150, h: 88, color: C.mint },
    { id: "rules", label: "Intent rules", sub: "60 contextRules\nmatch → expose groups", x: 430, y: 120, w: 150, h: 88, color: C.blue },
    { id: "esc", label: "request_tool_group", sub: "escape hatch\nmid-loop merge", x: 630, y: 70, w: 160, h: 80, color: C.warn },
    { id: "lazy", label: "Lazy startServers", sub: "spin up only what\nthe turn needs", x: 630, y: 190, w: 160, h: 80, color: C.purple },
  ];

  let out = svgOpen(W, H, "AutoHub tool exposure architecture");
  out += header(
    "How tools reach the model",
    "Registry → profile floor → intent rules → escape hatch → lazy server start"
  );

  // Arrow helper
  function arrow(x1, y1, x2, y2, color = C.muted) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const ah = 8;
    const tipX = x2;
    const tipY = y2;
    const bx = tipX - ux * ah;
    const by = tipY - uy * ah;
    const px = -uy;
    const py = ux;
    const p = (a, b) => `${a.toFixed(1)},${b.toFixed(1)}`;
    return `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.8"/>
  <polygon points="${p(tipX, tipY)} ${p(bx + px * 4, by + py * 4)} ${p(bx - px * 4, by - py * 4)}" fill="${color}"/>
`;
  }

  // Draw arrows first (under boxes)
  // reg → prof
  out += arrow(180, 164, 230, 164, C.muted);
  // prof → rules
  out += arrow(380, 164, 430, 164, C.muted);
  // rules → escape
  out += arrow(580, 140, 630, 110, C.warn);
  // rules → lazy
  out += arrow(580, 180, 630, 230, C.purple);

  for (const b of boxes) {
    out += `  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${C.grid}" stroke="${b.color}" stroke-width="2" rx="8"/>\n`;
    out += `  <text x="${b.x + b.w / 2}" y="${b.y + 28}" fill="${b.color}" font-size="13" font-weight="700" text-anchor="middle">${esc(b.label)}</text>\n`;
    const subLines = b.sub.split("\n");
    subLines.forEach((line, i) => {
      out += `  <text x="${b.x + b.w / 2}" y="${b.y + 50 + i * 16}" fill="${C.muted}" font-size="11" text-anchor="middle">${esc(line)}</text>\n`;
    });
  }

  // Bottom caption strip
  out += `  <text x="40" y="${H - 40}" fill="${C.text}" font-size="12">Floor is intentional. Full registry is available on demand — not dumped into every turn.</text>\n`;
  out += footer(
    "Architecture diagram · counts from HEAD 2026-07-20 · conceptual flow (not a runtime trace)",
    W,
    H
  );
  out += svgClose();
  return out;
}

// ── C6: Skills non-monotonic (conceptual) ────────────────────────────

function chartC6() {
  const W = 800;
  const H = 400;
  const pad = { l: 64, r: 48, t: 90, b: 80 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // Conceptual inverted-U: peak at skill count ≈ 2.5 on x in [0, 10]
  // y = benefit 0–1
  const samples = 80;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const xSkills = (i / samples) * 10; // 0..10 skills
    // Peak around 2.5: gaussian-like then slow decline
    const peak = 2.5;
    const left = Math.exp(-Math.pow((xSkills - peak) / 1.4, 2));
    const right = xSkills > peak ? Math.exp(-Math.pow((xSkills - peak) / 3.2, 2)) * 0.95 : left;
    const y = xSkills <= peak ? 0.15 + 0.85 * (1 - Math.exp(-xSkills * 1.1)) * (left / (left || 1)) * Math.min(1, xSkills / peak + 0.1) : right;
    // cleaner formula:
    // rising limb + falling limb
    let benefit;
    if (xSkills <= peak) {
      benefit = 0.12 + 0.88 * Math.pow(xSkills / peak, 0.85);
    } else {
      benefit = 1.0 * Math.exp(-0.18 * (xSkills - peak));
      benefit = Math.max(0.18, benefit);
    }
    pts.push({
      x: pad.l + (xSkills / 10) * plotW,
      y: pad.t + plotH - benefit * plotH,
      skill: xSkills,
      benefit,
    });
  }

  let out = svgOpen(W, H, "Skills non-monotonic returns (conceptual)");
  out += header(
    "More skills is not more benefit",
    "Conceptual curve · SkillsBench-inspired · NOT AutoHub measured data"
  );

  // Grid
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const y = pad.t + plotH - t * plotH;
    out += `  <line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>\n`;
  }
  out += `  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;
  out += `  <line x1="${pad.l}" y1="${pad.t + plotH}" x2="${W - pad.r}" y2="${pad.t + plotH}" stroke="${C.border}" stroke-width="1.5"/>\n`;

  // X labels
  for (let s = 0; s <= 10; s += 2) {
    const x = pad.l + (s / 10) * plotW;
    out += `  <text x="${x.toFixed(1)}" y="${pad.t + plotH + 20}" fill="${C.muted}" font-size="11" text-anchor="middle">${s}</text>\n`;
  }
  out += `  <text x="${pad.l + plotW / 2}" y="${pad.t + plotH + 42}" fill="${C.muted}" font-size="12" text-anchor="middle">skill count (conceptual)</text>\n`;
  out += `  <text x="18" y="${pad.t + plotH / 2}" fill="${C.muted}" font-size="11" transform="rotate(-90 18 ${pad.t + plotH / 2})" text-anchor="middle">benefit</text>\n`;

  // Peak zone band
  const peakX = pad.l + (2.5 / 10) * plotW;
  out += `  <rect x="${(peakX - 28).toFixed(1)}" y="${pad.t}" width="56" height="${plotH}" fill="${C.mint}" fill-opacity="0.08"/>\n`;

  // Curve
  out += `  <path d="${linePath(pts)}" fill="none" stroke="${C.mint}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>\n`;
  out += `  <path d="${areaPath(pts, pad.t + plotH)}" fill="${C.mint}" fill-opacity="0.1"/>\n`;

  // Peak marker
  const peakPt = pts.reduce((a, b) => (b.benefit > a.benefit ? b : a));
  out += `  <circle cx="${peakPt.x.toFixed(1)}" cy="${peakPt.y.toFixed(1)}" r="5" fill="${C.mint}"/>\n`;
  out += `  <text x="${peakPt.x.toFixed(1)}" y="${(peakPt.y - 14).toFixed(1)}" fill="${C.mint}" font-size="12" font-weight="600" text-anchor="middle">peak ~2–3</text>\n`;

  // Decline annotation
  out += `  <text x="${(pad.l + 0.75 * plotW).toFixed(1)}" y="${(pad.t + plotH * 0.45).toFixed(1)}" fill="${C.warn}" font-size="12" text-anchor="middle">diminishing / negative returns</text>\n`;

  // Honesty banner
  out += `  <rect x="32" y="${H - 52}" width="${W - 64}" height="24" fill="${C.warn}" fill-opacity="0.12" rx="4"/>\n`;
  out += `  <text x="${W / 2}" y="${H - 36}" fill="${C.warn}" font-size="11" text-anchor="middle">CONCEPTUAL — SkillsBench-inspired shape · not measured from our registry</text>\n`;

  out += footer(
    "Cite: SkillsBench arXiv:2602.12670 · agent skills survey arXiv:2602.12430 · not autohub data",
    W,
    H
  );
  out += svgClose();
  return out;
}

// ── README ───────────────────────────────────────────────────────────

function writeReadme() {
  const sha = current.fullSha;
  const md = `# Phase 1 charts — skills-are-the-new-mcp-bloat

Self-contained SVG charts for the skillissue essay. Dark-friendly palette
(\`#0f1419\` bg, mint \`#5ad6c0\`, blue \`#7aa2ff\`, warn \`#f0b429\`).

## Generation

\`\`\`bash
node scripts/generate-charts.mjs
\`\`\`

Authoritative data: [\`content/data/tool-timeline.json\`](../../data/tool-timeline.json)

| Field | Value |
|-------|-------|
| Generated | ${genDate} |
| Data \`generatedAt\` | ${data.generatedAt} |
| HEAD date | ${current.date} |
| HEAD fullSha | \`${sha}\` |
| Repo harvested | \`${data.repo}\` |
| Method | ${data.method} |

## Charts

| File | What | Data source |
|------|------|-------------|
| \`c1-registered-tools.svg\` | Multi-series: mcpTools (when present), groups, contextRules over time | \`timeline[]\` git samples of mcp-tools.json + tool-filters.json |
| \`c2-filter-surface.svg\` | groups / profiles / contextRules line chart | \`timeline[]\` tool-filters.json only |
| \`c3-floor-vs-registry.svg\` | Bar: ${current.mcpTools} registered vs ${current.tf_essentialTools} essential | \`current.mcpTools\`, \`current.tf_essentialTools\` |
| \`c4-offline-tool-eval.svg\` | Grouped bars: correctTool + loopCompletion for 3 models | \`offlineBenchmarks.spike_2026_06_16.models\` |
| \`c5-architecture.svg\` | Flow: Registry → Profile → Intent rules → escape hatch → lazy start | Conceptual architecture; counts from HEAD |
| \`c6-skills-nonmonotonic.svg\` | Conceptual inverted-U (peak ~2–3 skills) | **Not measured** — SkillsBench-inspired shape |

## Spot-check values (must match JSON)

- Registered tools (HEAD): **${current.mcpTools}**
- Essential always-on: **${current.tf_essentialTools}**
- Groups / profiles / rules: **${current.tf_groups}** / **${current.tf_profiles}** / **${current.tf_contextRules}**
- Servers: **${current.mcpServers}**
- hermes3:8b correctTool: **89%**, loopCompletion: **100%** → GO
- qwen3.6-abliterated correctTool: **100%**, loopCompletion: **22%** → NO
- qwen3-coder:30b correctTool: **78%**, loopCompletion: n/a → NO
- Voice core LOCAL_NATIVE_CORE_TOOLS: **${data.offlineBenchmarks.voice_core_2026_06_26.LOCAL_NATIVE_CORE_TOOLS}**

## Timeline highlights baked into C1/C2

| Date | mcpTools | groups | essential | notes |
|------|----------|--------|-----------|-------|
| 2025-09-15 | — | 12 | 5 | pre-registry |
| 2025-10-15 | — | 18 | 14 | |
| 2025-12-15 | 494 | 22 | 16 | first mcp-tools.json |
| 2026-02-15 | 779 | 26 | 18 | mid peak |
| 2026-03-01 | 552 | 33 | 19 | registry cleanup |
| 2026-06-26 | 723 | 57 | 23 | essential → 23 |
| 2026-07-20 | 813 | 60 | 23 | HEAD |

## Design notes

- ViewBox ~720–880 × 360–440; system font stack; no external CSS/fonts
- Transparent-safe dark strokes; solid charcoal background for blog embeds
- C1 dual-axis: mcpTools left (0–900), groups/rules right (0–70)
- C6 explicitly labeled conceptual — do not treat as measured AutoHub data
- C4 omits loopCompletion bar when JSON has \`null\` (qwen3-coder)

## External citations (C6)

- SkillsBench: ${data.skillsBenchExternal.skillsBench}
- Agent skills survey: ${data.skillsBenchExternal.agentSkillsSurvey}
`;
  return md;
}

// ── main ─────────────────────────────────────────────────────────────

const files = {
  "c1-registered-tools.svg": chartC1(),
  "c2-filter-surface.svg": chartC2(),
  "c3-floor-vs-registry.svg": chartC3(),
  "c4-offline-tool-eval.svg": chartC4(),
  "c5-architecture.svg": chartC5(),
  "c6-skills-nonmonotonic.svg": chartC6(),
  "README.md": writeReadme(),
};

for (const [name, content] of Object.entries(files)) {
  const path = join(OUT, name);
  writeFileSync(path, content, "utf8");
  console.log("wrote", path, `(${content.length} bytes)`);
}

// Spot-check assertions
const asserts = [
  [current.mcpTools === 813, "mcpTools === 813"],
  [current.tf_essentialTools === 23, "essential === 23"],
  [data.offlineBenchmarks.spike_2026_06_16.models[0].correctTool === 0.89, "hermes 89%"],
  [data.offlineBenchmarks.spike_2026_06_16.models[1].loopCompletion === 0.22, "qwen loop 22%"],
  [files["c1-registered-tools.svg"].includes("813"), "C1 contains 813"],
  [files["c3-floor-vs-registry.svg"].includes("813"), "C3 contains 813"],
  [files["c3-floor-vs-registry.svg"].includes(">23<"), "C3 contains 23"],
  [files["c4-offline-tool-eval.svg"].includes("89%"), "C4 hermes 89%"],
  [files["c4-offline-tool-eval.svg"].includes("22%"), "C4 loop 22%"],
  [files["c6-skills-nonmonotonic.svg"].includes("CONCEPTUAL"), "C6 conceptual label"],
];

let failed = 0;
for (const [ok, msg] of asserts) {
  if (!ok) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

if (failed) {
  process.exitCode = 1;
  console.error(`\n${failed} assertion(s) failed`);
} else {
  console.log("\nAll spot-checks passed.");
}
