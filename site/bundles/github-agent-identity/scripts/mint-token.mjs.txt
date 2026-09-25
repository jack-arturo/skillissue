#!/usr/bin/env node
// Mint a GitHub App installation token for one agent identity.
//
// Reads a profile file, not environment variables, so the private key path
// never lands in a variable an agent harness might filter or log:
//
//   ~/.config/github-agent-identity/<profile>.env
//
//   GHAPP_CLIENT_ID=Iv23liExample
//   GHAPP_PEM=~/.config/github-agent-identity/claude-alice.pem
//   GHAPP_INSTALLATION_ID=12345678
//   GHAPP_BOT_LOGIN=claude-alice[bot]
//   # optional, for GitHub Enterprise Server:
//   # GHAPP_API_URL=https://github.example.com/api/v3
//
// The profile name comes from --profile or GH_AGENT_IDENTITY.
//
// Usage:
//   mint-token.mjs                          print a fresh token (1 hour)
//   mint-token.mjs --find-installation o/r  print the installation id for a repo
//   mint-token.mjs --bot-email              print the GIT_AUTHOR_EMAIL to use
//
// stdout carries only the requested value. Everything else goes to stderr.

import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};

function fail(message) {
  process.stderr.write(`mint-token: ${message}\n`);
  process.exit(1);
}

function expandHome(path) {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

function readProfile(name) {
  const dir = process.env.GH_AGENT_IDENTITY_DIR || join(homedir(), ".config", "github-agent-identity");
  const file = join(expandHome(dir), `${name}.env`);
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    fail(`no profile file at ${file}`);
  }
  const values = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

const base64url = (input) => Buffer.from(input).toString("base64url");

function appJwt(clientId, pemPath) {
  let pem;
  try {
    pem = readFileSync(expandHome(pemPath), "utf8");
  } catch {
    fail(`cannot read the private key file ${pemPath}`);
  }
  const now = Math.floor(Date.now() / 1000);
  // GitHub's documented shape: iat 60 s in the past absorbs clock drift, and
  // exp may be at most 10 minutes out. iss is the App's Client ID.
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: clientId }));
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), createPrivateKey(pem));
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

async function github(api, path, { method = "GET", bearer } = {}) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "github-agent-identity",
  };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  let response;
  try {
    response = await fetch(`${api}${path}`, { method, headers });
  } catch (error) {
    fail(`could not reach ${api} (${error.cause?.code || error.message}). Is network access allowed here?`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${method} ${path} returned ${response.status}: ${body.message || "no message"}`);
  return body;
}

const profileName = option("profile") || process.env.GH_AGENT_IDENTITY;
if (!profileName) fail("no profile. Set GH_AGENT_IDENTITY or pass --profile <name>.");
const profile = readProfile(profileName);
const api = (profile.GHAPP_API_URL || "https://api.github.com").replace(/\/+$/, "");

if (flag("bot-email")) {
  const login = profile.GHAPP_BOT_LOGIN;
  if (!login) fail("GHAPP_BOT_LOGIN is missing from the profile");
  // The number in the address is the bot USER id, not the App id.
  const user = await github(api, `/users/${encodeURIComponent(login)}`);
  process.stdout.write(`${user.id}+${login}@users.noreply.github.com\n`);
  process.exit(0);
}

for (const key of ["GHAPP_CLIENT_ID", "GHAPP_PEM"]) {
  if (!profile[key]) fail(`${key} is missing from the profile`);
}
const jwt = appJwt(profile.GHAPP_CLIENT_ID, profile.GHAPP_PEM);

const repo = option("find-installation");
if (repo) {
  const installation = await github(api, `/repos/${repo}/installation`, { bearer: jwt });
  process.stdout.write(`${installation.id}\n`);
  process.exit(0);
}

if (!profile.GHAPP_INSTALLATION_ID) fail("GHAPP_INSTALLATION_ID is missing from the profile");
const minted = await github(api, `/app/installations/${profile.GHAPP_INSTALLATION_ID}/access_tokens`, {
  method: "POST",
  bearer: jwt,
});
if (!minted.token) fail("GitHub returned no token");
process.stdout.write(`${minted.token}\n`);
