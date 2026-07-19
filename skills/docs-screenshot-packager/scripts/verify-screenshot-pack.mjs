#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Module from 'node:module';
import { createRequire } from 'node:module';

function usage() {
  return `Usage: verify-screenshot-pack.mjs --manifest <file> [--markdown <file>...] [--token <value>] [--report <file>]\n\nVerifies docs screenshot outputs, byte limits, local Markdown image references, unsafe text patterns, and token byte hits.`;
}

function parseArgs(argv) {
  const args = { manifest: null, markdown: [], tokens: [], report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--markdown') args.markdown.push(argv[++i]);
    else if (arg === '--token') args.tokens.push(argv[++i]);
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
    throw new Error(`Sharp is required to verify screenshots. Install sharp or run in the Codex workspace runtime. ${error.message}`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveFrom(baseDir, value) {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
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

function isLocalReference(ref) {
  return Boolean(ref) &&
    !/^(https?:|mailto:|data:|#)/i.test(ref) &&
    !ref.startsWith('//');
}

function markdownImageRefs(text) {
  const refs = [];
  for (const match of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    refs.push(match[1].split(/\s+/)[0].replace(/^<|>$/g, ''));
  }
  for (const match of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    refs.push(match[1]);
  }
  return refs.filter(isLocalReference);
}

function unsafeTextMatches(label, text) {
  const patterns = [
    ['auth_header', /Bearer\s+[A-Za-z0-9._-]+/i],
    ['automem_token_name', /AUTOMEM_API_TOKEN/i],
    ['openai_key', /sk-[A-Za-z0-9_-]{20,}/],
    ['jwt_like', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
    ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ];
  return patterns.filter(([, re]) => re.test(text)).map(([name]) => ({ label, pattern: name }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sharp = loadSharp();
  const manifestPath = path.resolve(args.manifest);
  const manifestDir = path.dirname(manifestPath);
  const manifest = readJson(manifestPath);
  const outputDir = resolveFrom(manifestDir, manifest.outputDir || '.');
  const checks = {
    outputs: [],
    missingOutputs: [],
    oversizedOutputs: [],
    lowEntropyOutputs: [],
    dimensionMismatches: [],
    tokenByteHits: [],
    unsafeTextHits: [],
    missingMarkdownReferences: [],
  };

  const manifestText = JSON.stringify(manifest);
  checks.unsafeTextHits.push(...unsafeTextMatches('manifest', manifestText));

  for (const screenshot of manifest.screenshots || []) {
    if (!screenshot.output) {
      checks.missingOutputs.push({ id: screenshot.id || '(missing id)', output: '(missing output)' });
      continue;
    }
    const outputPath = resolveFrom(outputDir, screenshot.output);
    if (!fs.existsSync(outputPath)) {
      checks.missingOutputs.push({ id: screenshot.id, output: outputPath });
      continue;
    }
    const stats = await imageStats(sharp, outputPath);
    const item = { id: screenshot.id, output: outputPath, ...stats };
    checks.outputs.push(item);
    const expectedWidth = screenshot.width || manifest.defaultWidth;
    if (expectedWidth && stats.width !== expectedWidth) {
      checks.dimensionMismatches.push({ id: screenshot.id, output: outputPath, expectedWidth, actualWidth: stats.width });
    }
    if (screenshot.expectedHeight && stats.height !== screenshot.expectedHeight) {
      checks.dimensionMismatches.push({ id: screenshot.id, output: outputPath, expectedHeight: screenshot.expectedHeight, actualHeight: stats.height });
    }
    if (screenshot.maxBytes && stats.size > screenshot.maxBytes) {
      checks.oversizedOutputs.push({ id: screenshot.id, output: outputPath, size: stats.size, maxBytes: screenshot.maxBytes });
    }
    const minEntropy = screenshot.minEntropy ?? manifest.minEntropy ?? 3;
    if (stats.entropy < minEntropy) {
      checks.lowEntropyOutputs.push({ id: screenshot.id, output: outputPath, entropy: stats.entropy, minEntropy });
    }
    if (args.tokens.length) {
      const bytes = fs.readFileSync(outputPath);
      for (const token of args.tokens.filter(Boolean)) {
        if (bytes.includes(Buffer.from(token))) {
          checks.tokenByteHits.push({ id: screenshot.id, output: outputPath });
        }
      }
    }
  }

  for (const markdownFile of args.markdown) {
    const markdownPath = path.resolve(markdownFile);
    const text = fs.readFileSync(markdownPath, 'utf8');
    checks.unsafeTextHits.push(...unsafeTextMatches(markdownPath, text));
    for (const ref of markdownImageRefs(text)) {
      const candidates = ref.startsWith('/')
        ? [
            path.resolve(process.cwd(), ref.slice(1)),
            path.resolve(process.cwd(), 'public', ref.slice(1)),
          ]
        : [path.resolve(path.dirname(markdownPath), ref)];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        checks.missingMarkdownReferences.push({ markdown: markdownPath, ref, resolved: candidates[0], candidates });
      }
    }
  }

  const pass = [
    checks.missingOutputs,
    checks.oversizedOutputs,
    checks.lowEntropyOutputs,
    checks.dimensionMismatches,
    checks.tokenByteHits,
    checks.unsafeTextHits,
    checks.missingMarkdownReferences,
  ].every((items) => items.length === 0);

  const report = {
    generatedAt: new Date().toISOString(),
    manifest: manifestPath,
    pass,
    checks,
    totalBytes: checks.outputs.reduce((sum, item) => sum + item.size, 0),
  };

  if (args.report) {
    fs.writeFileSync(path.resolve(args.report), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
