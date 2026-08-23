#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MAX_LOG_BYTES = 16 * 1024 * 1024;
const DEFAULT_PORTS = [8765, 8767, 8768, 8769, 8770, 8776];
const SECRET_KEY = 'HOMEASSISTANT_TOKEN';

function parseArgs(argv) {
  const options = {
    repo: process.cwd(),
    probeWriteLock: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      options.repo = argv[index + 1];
      index += 1;
    } else if (arg === '--log') {
      options.log = argv[index + 1];
      index += 1;
    } else if (arg === '--db') {
      options.db = argv[index + 1];
      index += 1;
    } else if (arg === '--probe-write-lock') {
      options.probeWriteLock = true;
    } else if (arg === '--help') {
      options.help = true;
    } else {
      throw new Error('unsupported_argument');
    }
  }

  return options;
}

function command(file, args, options = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(file, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout ?? 5000,
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      code:
        typeof error?.code === 'string'
          ? error.code
          : Number.isInteger(error?.status)
            ? `exit_${error.status}`
            : 'command_failed',
    };
  }
}

function canonicalRoot(repoRoot) {
  const dotGit = path.join(repoRoot, '.git');
  if (!fs.existsSync(dotGit) || fs.statSync(dotGit).isDirectory()) {
    return { root: repoRoot, isWorktree: false };
  }

  const pointer = fs.readFileSync(dotGit, 'utf8').trim();
  const match = /^gitdir:\s*(.+)$/i.exec(pointer);
  if (!match) {
    return { root: repoRoot, isWorktree: false };
  }

  const gitDir = path.resolve(repoRoot, match[1]);
  const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
  const markerIndex = gitDir.lastIndexOf(marker);
  if (markerIndex === -1) {
    return { root: repoRoot, isWorktree: true };
  }

  return {
    root: gitDir.slice(0, markerIndex),
    isWorktree: true,
  };
}

function readTail(filePath) {
  if (!fs.existsSync(filePath)) {
    return { lines: [], present: false, bytesRead: 0 };
  }

  const size = fs.statSync(filePath).size;
  const start = Math.max(0, size - MAX_LOG_BYTES);
  const length = size - start;
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(filePath, 'r');

  try {
    fs.readSync(descriptor, buffer, 0, length, start);
  } finally {
    fs.closeSync(descriptor);
  }

  let text = buffer.toString('utf8');
  if (start > 0) {
    const firstNewline = text.indexOf('\n');
    text = firstNewline === -1 ? '' : text.slice(firstNewline + 1);
  }

  return {
    lines: text.split(/\r?\n/),
    present: true,
    bytesRead: length,
  };
}

function timestampOf(line) {
  const iso = line.match(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/
  );
  if (iso) {
    return iso[0];
  }

  const local = line.match(
    /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\b/
  );
  return local?.[0] ?? null;
}

const RESTART_PATTERNS = [
  /Starting automation-hub MCP server/i,
  /Starting all AutoHub services/i,
  /chat server.*listening/i,
];

const CLUSTERS = {
  transaction_timeout: /Operation has timed out|transaction.*timed out/i,
  forced_transaction_rollback:
    /forced rollback|transaction watchdog.*rollback/i,
  telegram_empty_ignored: /empty_message|empty Telegram update.*ignored/i,
  telegram_chat_write_forbidden: /CHAT_WRITE_FORBIDDEN/i,
  telegram_stale_reply:
    /message to be replied not found|REPLY_MESSAGE_NOT_FOUND/i,
  assistant_prefill: /assistant.{0,30}prefill|pre-fill.*assistant/i,
  home_assistant_invalid_token:
    /home.?assistant.{0,80}(invalid token|401|unauthorized)/i,
  evernote_fallback: /evernote.{0,80}(fallback|fallback search)/i,
  metal_epipe: /MTLCompilerService|Metal.{0,40}(EPIPE|Broken Pipe)/i,
  sqlite_corruption:
    /database disk image is malformed|sqlite_master.{0,80}duplicate|SQLITE_CORRUPT/i,
  telemetry_flush_success:
    /telemetry.{0,80}(flush|batch).{0,40}(complete|success|persisted)/i,
  database_write_success:
    /(database|prisma|sqlite).{0,80}write.{0,40}(complete|success)/i,
};

function collectLogEvidence(lines) {
  let boundaryIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (RESTART_PATTERNS.some(pattern => pattern.test(lines[index]))) {
      boundaryIndex = index;
    }
  }

  const window = boundaryIndex >= 0 ? lines.slice(boundaryIndex) : lines;
  const clusters = {};

  for (const [name, pattern] of Object.entries(CLUSTERS)) {
    let count = 0;
    let firstTimestamp = null;
    let lastTimestamp = null;

    for (const line of window) {
      if (!pattern.test(line)) {
        continue;
      }
      count += 1;
      const timestamp = timestampOf(line);
      firstTimestamp ??= timestamp;
      lastTimestamp = timestamp ?? lastTimestamp;
    }

    clusters[name] = { count, firstTimestamp, lastTimestamp };
  }

  return {
    restartBoundary: {
      found: boundaryIndex >= 0,
      tailLine: boundaryIndex >= 0 ? boundaryIndex + 1 : null,
      timestamp:
        boundaryIndex >= 0 ? timestampOf(lines[boundaryIndex]) : null,
    },
    linesAfterBoundary: window.length,
    clusters,
  };
}

function gitHead(directory) {
  const result = command('git', ['-C', directory, 'rev-parse', 'HEAD']);
  return result.ok && /^[0-9a-f]{40}$/i.test(result.stdout)
    ? result.stdout
    : null;
}

function pidsOnPort(port) {
  const result = command('lsof', ['-ti', `tcp:${port}`]);
  if (!result.ok || !result.stdout) {
    return [];
  }

  return [
    ...new Set(
      result.stdout
        .split(/\s+/)
        .filter(value => /^\d+$/.test(value))
        .map(Number)
    ),
  ].sort((left, right) => left - right);
}

function processCwd(pid) {
  const result = command('lsof', [
    '-a',
    '-p',
    String(pid),
    '-d',
    'cwd',
    '-Fn',
  ]);
  if (!result.ok) {
    return null;
  }

  const line = result.stdout
    .split(/\r?\n/)
    .find(value => value.startsWith('n'));
  return line ? line.slice(1) : null;
}

function cwdClass(cwd, repoRoot, canonical) {
  if (!cwd) {
    return 'unavailable';
  }
  if (cwd === repoRoot) {
    return 'requested_checkout';
  }
  if (cwd === canonical) {
    return 'canonical_checkout';
  }
  return 'other';
}

function collectRuntime(ports, repoRoot, canonical, expectedCommit) {
  return ports.map(port => ({
    port,
    processes: pidsOnPort(port).map(pid => {
      const cwd = processCwd(pid);
      const loadedCommit = cwd ? gitHead(cwd) : null;
      return {
        pid,
        cwdClass: cwdClass(cwd, repoRoot, canonical),
        loadedCommit,
        matchesExpectedCommit:
          Boolean(loadedCommit) && loadedCommit === expectedCommit,
      };
    }),
  }));
}

function sqliteQuickCheck(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return { status: 'missing' };
  }

  const result = command('sqlite3', [
    '-readonly',
    dbPath,
    'PRAGMA quick_check;',
  ]);
  if (!result.ok) {
    return { status: 'unavailable', code: result.code };
  }

  return {
    status: result.stdout.trim().toLowerCase() === 'ok' ? 'ok' : 'failed',
  };
}

function readUint(buffer, offset, littleEndian) {
  return littleEndian
    ? buffer.readUInt32LE(offset)
    : buffer.readUInt32BE(offset);
}

function parseWalHeader(buffer, offset, littleEndian) {
  const pageSizeRaw = littleEndian
    ? buffer.readUInt16LE(offset + 14)
    : buffer.readUInt16BE(offset + 14);
  return {
    version: readUint(buffer, offset, littleEndian),
    changeCounter: readUint(buffer, offset + 8, littleEndian),
    initialized: buffer[offset + 12] === 1,
    pageSize: pageSizeRaw === 1 ? 65536 : pageSizeRaw,
    maxFrame: readUint(buffer, offset + 16, littleEndian),
    databasePages: readUint(buffer, offset + 20, littleEndian),
  };
}

function walIndexState(dbPath) {
  const shmPath = `${dbPath}-shm`;
  const walPath = `${dbPath}-wal`;
  const result = {
    walPresent: fs.existsSync(walPath),
    walAllocatedBytes: fs.existsSync(walPath)
      ? fs.statSync(walPath).size
      : 0,
    shmPresent: fs.existsSync(shmPath),
    shmAllocatedBytes: fs.existsSync(shmPath)
      ? fs.statSync(shmPath).size
      : 0,
    headerAvailable: false,
  };

  if (!result.shmPresent || result.shmAllocatedBytes < 120) {
    return result;
  }

  const descriptor = fs.openSync(shmPath, 'r');
  const buffer = Buffer.alloc(136);
  try {
    fs.readSync(descriptor, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  const little = parseWalHeader(buffer, 0, true);
  const big = parseWalHeader(buffer, 0, false);
  const littlePlausible =
    little.version >= 3000000 && little.version <= 4000000;
  const littleEndian = littlePlausible || !(big.version >= 3000000);
  const primary = littleEndian ? little : big;
  const secondary = parseWalHeader(buffer, 48, littleEndian);
  const backfillFrames = readUint(buffer, 96, littleEndian);
  const readMarks = [];

  for (let index = 0; index < 5; index += 1) {
    const mark = readUint(buffer, 100 + index * 4, littleEndian);
    if (mark !== 0xffffffff) {
      readMarks.push(mark);
    }
  }

  return {
    ...result,
    headerAvailable: true,
    byteOrder: littleEndian ? 'little' : 'big',
    initialized: primary.initialized,
    version: primary.version,
    changeCounter: primary.changeCounter,
    pageSize: primary.pageSize,
    maxFrame: primary.maxFrame,
    databasePages: primary.databasePages,
    backfillFrames,
    activeFrames: Math.max(0, primary.maxFrame - backfillFrames),
    activeReadMarks: readMarks.length,
    highestReadMark: readMarks.length ? Math.max(...readMarks) : null,
    headerCopiesAgree:
      primary.changeCounter === secondary.changeCounter &&
      primary.maxFrame === secondary.maxFrame,
  };
}

function writeLockProbe(dbPath, enabled) {
  if (!enabled) {
    return {
      status: 'not_run',
      note: 'Pass --probe-write-lock for BEGIN IMMEDIATE; ROLLBACK.',
    };
  }
  if (!fs.existsSync(dbPath)) {
    return { status: 'missing' };
  }

  const result = command(
    'sqlite3',
    [
      '-cmd',
      '.timeout 1500',
      dbPath,
      "BEGIN IMMEDIATE; ROLLBACK; SELECT 'ok';",
    ],
    { timeout: 4000 }
  );

  return result.ok && result.stdout.trim().endsWith('ok')
    ? { status: 'acquired_and_released' }
    : { status: 'blocked_or_unavailable', code: result.code };
}

function parseEnvSecret(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const values = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?HOMEASSISTANT_TOKEN\s*=\s*(.*)\s*$/.exec(
      line
    );
    if (!match) {
      continue;
    }
    let value = match[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function findJsonSecrets(value, results = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      findJsonSecrets(item, results);
    }
    return results;
  }
  if (!value || typeof value !== 'object') {
    return results;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === SECRET_KEY && typeof child === 'string' && child) {
      results.push(child);
    } else {
      findJsonSecrets(child, results);
    }
  }
  return results;
}

function parseJsonSecrets(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    return findJsonSecrets(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return [];
  }
}

function fingerprint(values) {
  return [
    ...new Set(
      values.map(value =>
        crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)
      )
    ),
  ].sort();
}

function credentialProvenance(canonical) {
  const sources = [
    {
      source: 'canonical_env',
      fingerprints: fingerprint(
        parseEnvSecret(path.join(canonical, '.env'))
      ),
    },
    {
      source: 'cursor_host_config',
      fingerprints: fingerprint(
        parseJsonSecrets(path.join(os.homedir(), '.cursor', 'mcp.json'))
      ),
    },
    {
      source: 'claude_host_config',
      fingerprints: fingerprint(
        parseJsonSecrets(path.join(os.homedir(), '.claude.json'))
      ),
    },
  ].map(entry => ({
    source: entry.source,
    configured: entry.fingerprints.length > 0,
    fingerprints: entry.fingerprints,
  }));

  const configured = sources.filter(source => source.configured);
  return {
    sources,
    configuredSourcesAgree:
      configured.length > 0 &&
      new Set(configured.flatMap(source => source.fingerprints)).size === 1,
    authenticatedOperationChecked: false,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: collect-incident-evidence.js --repo <path> [--log <path>] [--db <path>] [--probe-write-lock]\n'
    );
    return;
  }

  const repoRoot = fs.realpathSync(path.resolve(options.repo));
  const canonical = canonicalRoot(repoRoot);
  const logPath = path.resolve(
    options.log ?? path.join(canonical.root, 'logs', 'dev-all.log')
  );
  const dbPath = path.resolve(
    options.db ?? path.join(canonical.root, 'data', 'hub-unified.db')
  );
  const expectedCommit = gitHead(canonical.root);
  const logTail = readTail(logPath);
  const logEvidence = collectLogEvidence(logTail.lines);
  const quickCheck = sqliteQuickCheck(dbPath);
  const walIndex = walIndexState(dbPath);
  const lockProbe = writeLockProbe(dbPath, options.probeWriteLock);
  const runtime = collectRuntime(
    DEFAULT_PORTS,
    repoRoot,
    canonical.root,
    expectedCommit
  );

  const report = {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    repository: {
      requestedRoot: repoRoot,
      canonicalRoot: canonical.root,
      isWorktree: canonical.isWorktree,
      expectedCommit,
    },
    runtime,
    log: {
      present: logTail.present,
      bytesRead: logTail.bytesRead,
      ...logEvidence,
    },
    database: {
      quickCheck,
      walIndex,
      contentionProbe: lockProbe,
      retainedWalAllocationObserved:
        walIndex.walPresent && walIndex.walAllocatedBytes > 0,
      retainedWalDoesNotBlockWrites:
        walIndex.walPresent &&
        walIndex.walAllocatedBytes > 0 &&
        lockProbe.status === 'acquired_and_released',
      globalWriteContentionLikely:
        walIndex.headerAvailable &&
        walIndex.activeFrames > 0 &&
        lockProbe.status === 'blocked_or_unavailable',
      crossProcessWriteHealth: {
        externalWriteLockAcquired:
          lockProbe.status === 'acquired_and_released',
        successfulWriteSignals:
          logEvidence.clusters.telemetry_flush_success.count +
          logEvidence.clusters.database_write_success.count,
      },
    },
    credentialProvenance: credentialProvenance(canonical.root),
    redaction: {
      rawLogLinesIncluded: false,
      messageBodiesIncluded: false,
      processCommandsIncluded: false,
      environmentValuesIncluded: false,
      urlsIncluded: false,
      fullTelegramHistoryIncluded: false,
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const code =
    error?.message === 'unsupported_argument'
      ? 'unsupported_argument'
      : 'collection_failed';
  process.stdout.write(
    `${JSON.stringify({ schemaVersion: 1, status: 'error', code })}\n`
  );
  process.exitCode = 1;
}
