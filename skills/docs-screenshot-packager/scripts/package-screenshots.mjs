#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Module from 'node:module';
import { createRequire } from 'node:module';

const ALLOWED_MODES = new Set(['github-readme', 'marketing-site', 'release-pack']);
const ALLOWED_FORMATS = new Set(['png']);
const ALLOWED_OPTIMIZE = new Set(['none', 'palette']);

function usage() {
  return `Usage: package-screenshots.mjs --manifest <file> [--report <file>]\n\nPackages docs screenshots from raw/proof sources into optimized docs variants.`;
}

function parseArgs(argv) {
  const args = { manifest: null, report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--report') args.report = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.manifest) throw new Error('Missing required --manifest <file>');
  return args;
}

function loadSharp() {
  const fallback = '<HOME>';
  const paths = [process.env.NODE_PATH, fs.existsSync(fallback) ? fallback : null].filter(Boolean);
  process.env.NODE_PATH = [...new Set(paths.join(':').split(':').filter(Boolean))].join(':');
  Module._initPaths();
  try {
    return createRequire(import.meta.url)('sharp');
  } catch (error) {
    throw new Error(`Sharp is required to package screenshots. Install sharp or run in the Codex workspace runtime. ${error.message}`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveFrom(baseDir, value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required ${fieldName}`);
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function validateManifest(manifest) {
  const failures = [];
  const mode = manifest.mode || 'github-readme';
  if (!ALLOWED_MODES.has(mode)) failures.push(`mode must be one of ${[...ALLOWED_MODES].join(', ')}`);
  if (!manifest.sourceDir) failures.push('sourceDir is required');
  if (!manifest.outputDir) failures.push('outputDir is required');
  if (!Number.isInteger(manifest.defaultWidth) || manifest.defaultWidth <= 0) failures.push('defaultWidth must be a positive integer');
  if (manifest.format && !ALLOWED_FORMATS.has(manifest.format)) failures.push('format must be png');
  if (manifest.optimize && !ALLOWED_OPTIMIZE.has(manifest.optimize)) failures.push('optimize must be none or palette');
  if (!Array.isArray(manifest.screenshots) || manifest.screenshots.length === 0) failures.push('screenshots must be a non-empty array');
  for (const [index, screenshot] of (manifest.screenshots || []).entries()) {
    const prefix = `screenshots[${index}]`;
    if (!screenshot.id) failures.push(`${prefix}.id is required`);
    if (!screenshot.source) failures.push(`${prefix}.source is required`);
    if (!screenshot.output) failures.push(`${prefix}.output is required`);
    if (screenshot.maxBytes != null && (!Number.isInteger(screenshot.maxBytes) || screenshot.maxBytes <= 0)) {
      failures.push(`${prefix}.maxBytes must be a positive integer`);
    }
  }
  if (failures.length) throw new Error(failures.join('; '));
  return { mode };
}

function svgBuffer(svg) {
  return Buffer.from(svg);
}

async function addDocsFrame(sharp, inputBuffer, options = {}) {
  const meta = await sharp(inputBuffer).metadata();
  const radius = Number.isFinite(options.radius) ? options.radius : 8;
  const x = 34;
  const y = 37;
  const width = meta.width + x * 2;
  const height = meta.height + y * 2;
  const mask = svgBuffer(`<svg width="${meta.width}" height="${meta.height}" viewBox="0 0 ${meta.width} ${meta.height}"><rect width="${meta.width}" height="${meta.height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
  const rounded = await sharp(inputBuffer).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const composites = [];
  if (options.shadow !== false && options.shadow !== 'none') {
    composites.push({
      input: svgBuffer(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.16"/></filter></defs><rect x="${x}" y="${y}" width="${meta.width}" height="${meta.height}" rx="${radius}" ry="${radius}" fill="#fff" filter="url(#s)"/></svg>`),
      left: 0,
      top: 0,
    });
  }
  composites.push({ input: rounded, left: x, top: y });
  if (options.border !== false) {
    composites.push({
      input: svgBuffer(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${x + 0.5}" y="${y + 0.5}" width="${meta.width - 1}" height="${meta.height - 1}" rx="${radius}" ry="${radius}" fill="none" stroke="#d8dee8" stroke-width="1"/></svg>`),
      left: 0,
      top: 0,
    });
  }
  return sharp({ create: { width, height, channels: 4, background: '#f8fafc' } })
    .composite(composites)
    .png()
    .toBuffer();
}

async function imageStats(sharp, file) {
  const meta = await sharp(file).metadata();
  const stats = await sharp(file).stats();
  return {
    width: meta.width,
    height: meta.height,
    size: fs.statSync(file).size,
    entropy: Number((stats.entropy || 0).toFixed(4)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sharp = loadSharp();
  const manifestPath = path.resolve(args.manifest);
  const manifestDir = path.dirname(manifestPath);
  const manifest = readJson(manifestPath);
  const { mode } = validateManifest(manifest);
  const sourceDir = resolveFrom(manifestDir, manifest.sourceDir, 'sourceDir');
  const outputDir = resolveFrom(manifestDir, manifest.outputDir, 'outputDir');
  const format = manifest.format || 'png';
  const optimize = manifest.optimize || 'palette';
  const failures = [];
  const outputs = [];

  fs.mkdirSync(outputDir, { recursive: true });

  for (const screenshot of manifest.screenshots) {
    const sourcePath = resolveFrom(sourceDir, screenshot.source, `${screenshot.id}.source`);
    const outputPath = resolveFrom(outputDir, screenshot.output, `${screenshot.id}.output`);
    if (!fs.existsSync(sourcePath)) {
      failures.push(`${screenshot.id}: source missing: ${sourcePath}`);
      continue;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    let buffer = await sharp(sourcePath).png().toBuffer();
    if (manifest.frame?.enabled) {
      buffer = await addDocsFrame(sharp, buffer, manifest.frame);
    }
    let pipeline = sharp(buffer).resize({ width: screenshot.width || manifest.defaultWidth });
    if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9, palette: optimize === 'palette', quality: 90 });
    }
    await pipeline.toFile(outputPath);
    const stats = await imageStats(sharp, outputPath);
    if (screenshot.maxBytes && stats.size > screenshot.maxBytes) {
      failures.push(`${screenshot.id}: ${stats.size} bytes exceeds maxBytes ${screenshot.maxBytes}`);
    }
    outputs.push({
      id: screenshot.id,
      source: sourcePath,
      output: outputPath,
      alt: screenshot.alt || '',
      maxBytes: screenshot.maxBytes || null,
      ...stats,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    manifest: manifestPath,
    mode,
    sourceDir,
    outputDir,
    defaultWidth: manifest.defaultWidth,
    format,
    optimize,
    frame: manifest.frame || { enabled: false },
    pass: failures.length === 0,
    failures,
    outputs,
    totalBytes: outputs.reduce((sum, item) => sum + item.size, 0),
  };

  if (args.report) {
    fs.writeFileSync(path.resolve(args.report), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
