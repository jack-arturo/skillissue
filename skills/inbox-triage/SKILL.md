---
name: inbox-triage
description: >-
  Triage Jack's Gmail unread inbox into action buckets (!Action / !AI Handle /
  !Waiting On / archive) using the google_workspace MCP, then post one digest.
  Use this whenever Jack asks to triage, clear, sort, process, or "do" his email
  or inbox — "inbox triage", "clear the unread pile", "go through my gmail",
  "sort my inbox", "process my email", "deal with my unread" — even if he never
  says the word "skill". It enumerates all unread, runs a small parallel
  read-only classifier fan-out, shows the buckets for approval, then applies
  Gmail labels SEQUENTIALLY and posts a "Worth your attention" + "Security
  roundup" digest. It mutates the live inbox, so it always gets approval before
  writing.
agents: [claude-code]
metadata:
  version: "1.1.0"
  author: Jack Arturo
resources:
  - path: references/subagent-prompts.md
    type: file
---

# Inbox Triage

Clear Jack's Gmail unread pile: classify every unread message into four buckets,
apply Gmail labels, and hand back one tight digest. Validated end-to-end on a
179-message run (June 2026).

The *shape* of the work drives the design. Classification is embarrassingly
parallel, but every Gmail read and write funnels through **one shared MCP bridge**
(`workspace.verygoodplugins.com`). So subagents buy **context hygiene** (hundreds
of email bodies never bloat the orchestrator) and some **latency overlap** — they
do NOT multiply I/O throughput, and over-eager fan-out makes the tunnel choke.
Keep the read fan-out small (~4) and do **all writes strictly sequentially**. This
is the single most important operational fact; see Constraints.

## Account context (so nothing gets mis-flagged)

Jack's legal name is **Daniel Bryce Corkins** (a.k.a. "Bryce"). Several inboxes
land here and are all his:
`johngarturo@gmail.com`, `dbcorkins@gmail.com`, `info@verygoodplugins.com`,
`jack@echodash.com`, `billing@echodash.com`, `marketing@verygoodplugins.com`.
Mail to any of these — including to "Bryce Corkins" or "Daniel Corkins" — is
legitimately his. Do **not** treat `dbcorkins@gmail.com` mail as misdirected,
forwarded, or leaked.

## Prerequisite — google_workspace MCP

The Gmail tools (`search_gmail_messages`, `get_gmail_messages_content_batch`,
`get_gmail_thread_content`, `modify_gmail_message_labels`) come from the
`google_workspace` MCP.

### Cursor (preferred, 2026-07+)

Local `uvx` stdio server is rendered into `~/.cursor/mcp.json` from System
Configuration (`modules/cursor/mcp.json.template`). Tokens live in
`GOOGLE_MCP_CREDENTIALS_DIR` (default
`~/.autohub/google-workspace/credentials/`, account file
`johngarturo@gmail.com.json`). After template changes:

```bash
./scripts/install.sh cursor   # from ~/Projects/System Configuration
```

Then fully restart Cursor (Cmd-Q). If the MCP is missing mid-session, use the
OAuth JSON via `uv run --with google-api-python-client --with google-auth`
rather than asking Jack to “enable Gmail”.

### Claude Code / Autohub

Hub-owned config matches Autohub `config/mcp-servers.json`. One-time auth:

```bash
cd ~/Projects/OpenAI/autohub && npm run auth:google-workspace
```

Legacy remote bridge (only if local uvx is unavailable):

```
claude mcp add google_workspace --scope user -- npx -y mcp-remote https://workspace.verygoodplugins.com/mcp/
```

## Label map (real IDs — do not re-derive)

| Bucket | Label | ID |
|---|---|---|
| Action needed | `!Action` | `Label_3` |
| Delegate to AI | `!AI Handle` | `Label_6156087589916774435` |
| You're awaiting their reply | `!Waiting On` | `Label_4` |
| Archived marker | `AutoJack: Archived` | `Label_2184821604945598668` |

**Archive = one atomic call:** `remove_label_ids:["INBOX"]` +
`add_label_ids:["Label_2184821604945598668"]`. Action buckets only *add* their
label and stay in the inbox. The tool is `modify_gmail_message_labels` with
`add_label_ids` / `remove_label_ids` — never `add_labels` (a recurring
hallucination).

## The classifier — apply IN PRIORITY ORDER, first match wins

This block is canonical. When you build classifier-worker prompts, paste it
verbatim so every worker classifies identically (see the prompt templates).

1. **Security / account alerts** — never silent-archive. Login notices,
   new-device, password change, payment failure, 2FA codes, "new user added."
   Always emit a one-line `security_fragment`. If clearly *unexpected/suspicious*
   → `!Action`; otherwise `ARCHIVE` (it's still captured in the security
   roundup).
2. **Real person, 1:1, expecting a reply from Jack** → `!Action`. Addressed to
   Jack personally, not bulk (no `List-Unsubscribe`, no `Precedence: bulk/list`),
   reads like a human wrote it to him. **If Jack is the one waiting on *their*
   reply** (his own sent follow-up) → `!Waiting On` instead. Decide ball-in-court
   with `get_gmail_thread_content(thread_id, include_analysis=true)` and read the
   ownership verdict (who sent last / who owes the reply) — per-message metadata
   cannot tell you this.
3. **GitHub repo activity** (`notifications@github.com`): review-requested OR
   @mention of Jack → `!Action`; repo invite from a known collaborator →
   `!Action` (carve-out — invites expire); everything else (PR comments, CI bot
   chatter, subscriptions) → `ARCHIVE`.
4. **Jack's own CI/build notifications** → `ARCHIVE` (routine): Xcode Cloud
   (`noreply@apple.com`), TestFlight (`testflight_no_reply@email.apple.com`),
   GitHub Actions.
5. **Delegatable-to-AI** → `!AI Handle`: research, lookups, a draft an agent
   could take a first pass at — work that doesn't need Jack's own hands.
6. **Newsletters / product updates / marketing / promos** → `ARCHIVE`
   (`List-Unsubscribe` present, or `Precedence: bulk`, or known bulk sender). If
   work-relevant (WordPress ecosystem, AI/dev tooling Jack uses, competitive or
   partnership intel) → also emit a one-line `digest_fragment` before archiving.
7. **Vendor "relationship"/sales nurture from services Jack actually uses** →
   `ARCHIVE` (treat as marketing even when the sender is a real person with an
   unsubscribe link). Exception: a genuine account/transaction matter → `!Action`.
8. **Receipts / transactional / automated noreply** → `ARCHIVE`.

**Default when ambiguous:** deep-read the body, then decide. Still 50/50 →
`!Action` — surfacing is cheaper than burying, and the approval gate catches
over-surfacing.

## Procedure

### Phase 1 — Enumerate + shard (orchestrator, sequential)
Paginate **all** of `is:unread in:inbox -label:"AutoJack: Archived"` via
`search_gmail_messages` + `page_token` to the very end (use `page_size: 100`;
don't stop at the first page). Report the true count. Collect the message IDs and
split into ~4 shards. Pagination is inherently sequential, so it stays here.

### Phase 2 — Map (parallel READ-ONLY classifier subagents, cap ~4)
Dispatch ~4 `general-purpose` subagents in one message (no worktree isolation —
this is pure API work). Each gets the §classifier block **verbatim**, the account
context, and its shard. Each fetches metadata in batches of **≤10**, deep-reads
only ambiguous bodies, resolves rule-2 with thread analysis, and returns a
structured JSON array `[{id, from, subject, bucket, digest_fragment?,
security_fragment?, reason}]`. **Workers never write labels.** Use the template in
`references/subagent-prompts.md`. The `digest_fragment` / `security_fragment`
values are reduce-state: if a worker drops them, the digest loses that signal.

### Phase 3 — Reduce + approval gate (orchestrator)
Merge worker outputs. Dedup senders for the digest. Assemble the single digest
(Worth your attention + Security roundup). **Stop and show Jack** the per-bucket
counts, the full `!Action` list (with any borderline calls flagged), and offer
the archive list — apply nothing yet. Wait for his go-ahead. It's his live inbox.

### Phase 4 — Apply labels (only after approval)
Apply `!Action`/`!AI Handle`/`!Waiting On` labels **first** (most important;
survives a mid-run hiccup), then archives. **Strictly sequential**, one
`modify_gmail_message_labels` call at a time — never concurrent. Partition across
a few sequential writer subagents so no single worker hits a tool-call ceiling
(see the writer template). Per-message retry on error. Leave read/unread state
alone unless Jack asks otherwise.

### Phase 5 — Verify + record
Verify by **inbox removal, not label search** (see Constraints):
`is:unread in:inbox` should drop to just the action-labeled items + any genuinely
new arrivals; archived messages reappear under `is:unread -in:inbox`. Post the
digest. Store one AutoMem `Decision` with the per-bucket counts (tags
`email-triage`, `milestone`).

## Constraints (learned the hard way — ignore at your peril)

- **Batch reads at ≤10.** `get_gmail_messages_content_batch` nominally allows 25,
  but 25 IDs time out (~4 min) on this tunnel; 10 is the reliable ceiling. Use
  `format:"metadata"` for the classify pass; `format:"full"` only for ambiguous
  bodies.
- **Concurrency breaks the OAuth refresh.** Several parallel workers hammering
  the batch endpoint trigger `"credentials do not contain the necessary fields to
  refresh the access token"` mid-run. It's a refresh *race*, not real expiry — a
  single sequential call recovers instantly. So cap the read fan-out (~4) and make
  **all writes sequential**.
- **`label:`-name search is non-functional on this bridge.** `label:"!Action"`,
  `label:"AutoJack: Archived"`, even a control `label:marketing` all return 0. Do
  NOT verify the run by searching for a label. Verify by INBOX membership instead.
- **Idempotency/resume comes from INBOX removal, not the label filter.** Archived
  messages have `INBOX` removed, so `is:unread in:inbox` already excludes them — a
  re-run naturally skips them. The `-label:"AutoJack: Archived"` clause is
  belt-and-suspenders (and doesn't actually match, per above), so a crash mid-run
  is recoverable simply by re-running Phase 1.
- **`modify_gmail_message_labels` is atomic.** If you observe `INBOX` removed, the
  same call's `add_label_ids` also applied — you can trust the archive label
  landed even though you can't search for it.

## Digest format

One message, two sections, tight — bury nothing, pad nothing:

- **Worth your attention** — signal pulled from archived newsletters/updates:
  WP-ecosystem moves, AI/dev tooling Jack uses, competitive/partnership intel,
  SEO/analytics deltas, real opportunities with deadlines. Dedup senders.
- **Security roundup** — every rule-1 alert, one line each, flagged if anything
  looks unexpected (new-device logins, unusual payments, suspected phishing).

## Subagent prompt templates

The exact classifier-worker and label-writer prompts live in
`references/subagent-prompts.md`. Read it before dispatching — consistent worker
prompts (especially the verbatim classifier) are what keep classification stable
across shards.
