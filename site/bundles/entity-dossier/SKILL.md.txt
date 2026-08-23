---
name: entity-dossier
description: Research a person, business, or concept with primary sources and persist a durable AutoMem dossier through AutoHub's context-module write path (scripts/build-context-module.js). Use when asked to "build a dossier on X", "research X and remember them", or for pre-meeting/collab background that should survive the conversation. The stored dossier is the deliverable — verify it with a recall before reporting done.
license: MIT
tags: [research, memory, automem, dossier, context-module, people-research]
agents: [claude-code, autojack]
category: research
metadata:
  version: "0.1.0"
capabilities:
  network: true
  filesystem: readonly
  tools: [Bash, Read]
requires-secrets:
  - name: AUTOMEM_API_KEY
    description: Bearer token for the AutoMem service at AUTOMEM_ENDPOINT (falls back to AUTOMEM_API_TOKEN).
    required: true
---

# Entity Dossier

Turn web research on a person, business, or concept into durable AutoMem
memories that AutoHub's context-module recall side (resolver, memory context
service, voice memory) can activate later. The AutoMem write is the
deliverable, not the chat reply.

## When to use / when not

- **Use:** "build a dossier on X", "research X and remember them", background
  on a person/company/concept that future conversations should recall.
- **Don't use:** throwaway lookups ("what's X's website"), anything requiring
  non-public data about private individuals, or research the requester
  explicitly wants kept out of memory.

## Ritual

1. **Scope.** Pin the entity type (person / organization / concept), why it
   matters (meeting, collab, mailing list, curiosity), and how deep to go.
2. **Research.** Primary sources first — their own site, talks, repos,
   published writing, filings. Record dates on claims, keep explicit
   uncertainty ("unverified", "as of <date>"), collect 3–6 topics and the
   source URLs you actually used.
3. **Compose the payload** as JSON:

   ```json
   {
     "module": { "id": "steven-cotler", "name": "Steven Cotler dossier" },
     "people": [
       {
         "canonicalName": "Steven Cotler",
         "role": "Author",
         "company": "…",
         "publicSummary": "2-4 sentences, dated, uncertainty explicit.",
         "topics": ["flow research", "…"],
         "sources": ["https://…", "https://…"]
       }
     ]
   }
   ```

   `module.id` is the stable slug recall will key on. Multiple people in one
   module are fine (rosters); one person is the common case.
4. **Store** — from the AutoHub workspace:

   ```bash
   node --env-file-if-exists=.env scripts/build-context-module.js --input /absolute/path/entity.json
   ```

   The `--env-file-if-exists=.env` flag is load-bearing: it pulls
   `AUTOMEM_ENDPOINT` + `AUTOMEM_API_KEY`/`AUTOMEM_API_TOKEN` from the
   workspace `.env` (the repo convention for env-dependent scripts). Without
   it the store fails with a missing-credentials error unless those vars are
   already exported in your shell.

   Add `--expires-days N` only for event-scoped modules (conference rosters);
   omit it for durable profiles. `--emit-module <path>` (writing a
   `config/context-modules/<id>.json` activation descriptor) is opt-in and
   needs an explicit request — never write it by default.
5. **Verify.** Recall with tags `["context-module:dossier", "entity:people:<slug>"]`
   and confirm the stored dossier comes back. No recall, not done.
6. **Report.** One paragraph of findings, the stored memory ids from the
   script's JSON output, and a recommendation only if one was asked for.

## Never

- Store secrets, credentials, or non-public personal data.
- Fabricate or pad sources/topics — fewer, real ones win.
- Skip the verification recall or report "done" on the script exit code alone.
