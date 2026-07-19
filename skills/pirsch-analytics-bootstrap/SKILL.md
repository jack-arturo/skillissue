---
name: pirsch-analytics-bootstrap
description: Add Pirsch Analytics to a website, create or inspect the domain with explicit authorization, install and verify the tracking snippet, configure optional DNS verification and custom events, and wire a scoped MCP client without exposing credentials.
license: MIT
tags: [analytics, pirsch, vitepress, nextjs, cloudflare-pages, autovault]
agents: [claude-code, codex, autojack]
category: analytics
metadata:
  version: "1.1.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: PIRSCH_CLIENT_ID
    description: OAuth client ID from a Pirsch API client. Optional — only needed for API-driven verification or for wiring mcp-pirsch.
    required: false
  - name: PIRSCH_CLIENT_SECRET
    description: OAuth client secret paired with PIRSCH_CLIENT_ID.
    required: false
---

# Pirsch Analytics Bootstrap

Wire a website to Pirsch Analytics: install the JS snippet, confirm it
fires, and (optionally) connect the domain to a Pirsch API client so
mcp-pirsch can query it.

Pirsch domain creation is gated behind the dashboard UI for most API
clients. Drive that UI only when the user has explicitly authorized account
writes in their signed-in browser; otherwise prepare the exact values and hand
the dashboard step back to them.

## When to use

- "Add Pirsch to this site."
- "Set up analytics on autovault-website / new-project / etc."
- "Hook this domain into mcp-pirsch."
- A new project just deployed and the user wants traffic data.

Skip when the user has chosen Cloudflare Web Analytics, Plausible,
PostHog, etc. as the only analytics tool.

## Prerequisites

- The site repo is present and you can identify its head-tag insertion
  point (VitePress `.vitepress/config.{ts,js}` `head[]`, Next.js
  `_document.tsx`, Astro `<Head>`, plain HTML `<head>`, etc.).
- The user has a Pirsch account at <https://dashboard.pirsch.io/>.
- The dashboard is reachable in a logged-in browser. Use the current
  `dev-browser` workflow only when explicitly authorized — see step 2.

## Workflow

### 1. Look for existing Pirsch credentials

If an mcp-pirsch checkout is already configured, check for the two variable
names without printing their values. Point `PIRSCH_MCP_DIR` at that checkout:

```bash
env_file="${PIRSCH_MCP_DIR:?set PIRSCH_MCP_DIR}/.env"
for key in PIRSCH_CLIENT_ID PIRSCH_CLIENT_SECRET; do
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    printf '%s=<present>\n' "$key"
  else
    printf '%s=<missing>\n' "$key"
  fi
done
```

A Pirsch API client is **scoped to one or more domains** chosen at
creation time. The credentials in `mcp-pirsch/.env` may belong to a
different domain than the one you're adding — that's fine for this
skill, because creation happens in the dashboard, not via API.

If creds are missing entirely, skip to step 2 — the user can still
create the domain via the dashboard without them.

### 2. Create the domain in Pirsch

The domain-create endpoint (`POST /api/v1/domain`) requires
organization-level API permissions that domain-scoped API clients do
not have. Expect a 403 if you try.

**The right path is the dashboard.** If account writes are explicitly
authorized, use `dev-browser` against the already signed-in tab and verify each
saved value. Use target IDs when multiple Pirsch tabs are open. Otherwise ask
the user to:

1. Open <https://dashboard.pirsch.io/>.
2. Click **Add Website, Funnel, or Team** → **Add Website**.
3. Enter the hostname (e.g., `autovault.dev`), pick a subdomain and
   timezone, save.
4. Copy the **identification code** from the snippet Pirsch displays.
   It looks like: `data-code="ooKBAPbmvXCA4hyKwoBDBx66yNyNswJL"`.
5. Paste the snippet — or just the `data-code` value — back into the
   chat.

**Do not** drive the dashboard via `dev-browser` unless the user
explicitly authorizes UI clicks under their logged-in session. The
auto-mode classifier blocks browser-driven account writes by default;
attempting them produces a denial that interrupts the workflow.

If Pirsch requests DNS ownership verification and the domain is on
Cloudflare, a Cloudflare API token with the required zone permission can add
the exact TXT record shown by Pirsch. Never reuse a value from an earlier site:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  --data '{"type":"TXT","name":"<record-name>","content":"<exact-pirsch-verification-value>","ttl":300}'
dig +short TXT '<record-name>'
```

Discover the zone through the authenticated Cloudflare tooling available to
the project. If the token or permission is absent, return the exact record for
the operator to create rather than weakening access controls.

### 3. Install the snippet

The Pirsch tracking snippet:

```html
<script defer src="https://api.pirsch.io/pa.js"
  id="pianjs"
  data-code="<IDENTIFICATION_CODE>"></script>
```

Insert it in the framework's HTML head. Common cases:

**VitePress** (`.vitepress/config.ts`, inside `head: []`):

```ts
[
  "script",
  {
    defer: "",
    src: "https://api.pirsch.io/pa.js",
    id: "pianjs",
    "data-code": "<IDENTIFICATION_CODE>"
  }
]
```

**Next.js App Router** (`app/layout.tsx`):

```tsx
import Script from "next/script";

<Script
  defer
  src="https://api.pirsch.io/pa.js"
  id="pianjs"
  data-code="<IDENTIFICATION_CODE>"
/>
```

**Astro** (`<Head>` in `Layout.astro`):

```html
<script defer src="https://api.pirsch.io/pa.js" id="pianjs"
  data-code="<IDENTIFICATION_CODE>"></script>
```

**Plain HTML / static**: paste verbatim into `<head>`.

The identification code is **public** — it's served on every page
view. Do not treat it as a secret.

### 4. Verify the snippet renders and pa.js loads

Build (or run dev/preview), then:

```bash
# in another terminal
curl -sf http://127.0.0.1:<port>/ | grep -o '<script[^>]*pianjs[^>]*>'
```

For a deeper check, attach to a browser and watch network:

```bash
dev-browser --connect --timeout 20 <<'EOF'
const page = await browser.getPage("verify");
const log = [];
page.on("response", (r) => {
  if (r.url().includes("pirsch")) log.push({ status: r.status(), url: r.url() });
});
await page.goto("http://127.0.0.1:<port>/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
console.log(JSON.stringify(log));
EOF
```

Expected output: `pa.js` returns 200. **No tracking POST will fire on
localhost** — Pirsch's `pa.js` skips local hostnames by design. To
confirm hits in the dashboard, you must check after deploying to the
real domain.

### 5. (Optional) Wire the domain into mcp-pirsch

If the user wants Claude to query analytics conversationally for this
new domain, they need an API client scoped to it:

1. In Pirsch dashboard → **Settings → Integrations → API Clients**.
2. Click **Add Client**, give access to the new domain, save.
3. Copy `client_id` and `client_secret`.

Two installation patterns:

- **Single-credential MCP** — replace the values in
  `mcp-pirsch/.env`. Old domains lose access; new domain gains it.
- **Multi-credential** — current mcp-pirsch only reads one set of
  credentials at a time. To run multi-domain you'd need a separate
  MCP server instance per credential set, or extend mcp-pirsch.
  Recommend the single-credential swap for solo use.

After updating `.env`, restart the MCP server (`/mcp` in Claude Code or
restart the host).

### 6. Add useful events and goals

After the snippet is live, identify a small set of meaningful user actions —
for example sign-in completion, checkout start, provisioning success, or a
primary content view. Emit named Pirsch custom events from the application and
create matching conversion goals or funnels in the dashboard when authorized.

Keep event names stable and business-oriented. Do not send secrets, email
addresses, free-form user text, or other personal data as event metadata.
Verify at least one event on the deployed site before calling the integration
complete.

### 7. Confirm the test traffic and verification

After the user deploys:

1. Visit the live site and exercise one configured event.
2. Open the correct Pirsch property, or ask the user to do so when dashboard
   writes were not authorized.
3. Confirm page traffic, the custom event, and any DNS verification state.

If nothing appears, common causes:

- **AdBlocker / browser extension** — Pirsch is sometimes flagged.
  Test in a clean browser profile.
- **Hostname mismatch** — the hostname registered in Pirsch must match
  the hostname the page is served from (or be a configured alias).
- **Page from cache** — Cloudflare cache may serve a build from before
  the snippet was added. Force-refresh / purge cache.
- **Domain verification pending** — confirm the exact TXT name/value and allow
  for DNS propagation before retrying Pirsch verification.

## Output

- Edited config file with Pirsch snippet in `<head>`.
- Verified build output contains `<script ... id="pianjs" ...>`.
- Local pa.js fetch returns 200.
- DNS verification status when the property requires it.
- Custom event and goal status, including anything left for the operator.
- Brief follow-up note: deploy URL to test, dashboard verification result, and
  optional scoped API-client wiring for mcp-pirsch.

## Anti-patterns

- **Do not commit a `data-code`** as if it were secret. It's public
  per design and ships in every HTML response. Just put it in the
  config file directly.
- **Do not try `POST /api/v1/domain` from a domain-scoped API client.**
  It returns 403. The dashboard is the only viable path for most
  users.
- **Do not driver-click the Pirsch dashboard via `dev-browser` without
  explicit user authorization for UI writes.** The auto-mode
  classifier denies this by default — attempting it stalls the
  workflow.
- **Do not assume localhost test traffic will appear in Pirsch.** It
  won't; pa.js auto-skips local hostnames.
- **Do not copy a DNS verification value between sites.** Use the exact record
  Pirsch displays for the current property.
- **Do not put personal data or secrets in event metadata.** Keep event payloads
  minimal and purpose-specific.
- **Do not store `PIRSCH_CLIENT_*` values in the website repo's
  `.env`.** Tracking only needs the public `data-code`. Server-side
  Pirsch API access lives in mcp-pirsch (or another isolated location).
- **Do not gate the snippet behind `NODE_ENV === "production"` unless
  the user asks.** Pirsch's localhost filter already prevents noise,
  and gating it complicates preview-deployment debugging.
