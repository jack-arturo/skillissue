---
name: long-haul-parallel-repair
description: Use when the user explicitly authorizes subagents, fan-out, delegation, long-running autonomous work, "work for hours", "iterate until satisfied", or solving every <8/10 confidence item through evidence, fixes, and verification. Also use for deep investigation or repair only when paired with explicit autonomy, fan-out, or subagent authorization.
license: MIT
tags: [parallel, subagents, orchestration, investigation, repair, verification, confidence, codex]
agents: [claude-code, codex, autojack]
category: orchestration
metadata:
  version: "1.0.0"
capabilities:
  network: false
  filesystem: readwrite
  tools: [Agent, Read, Edit]
requires-secrets: []
resources:
  - path: agents/openai.yaml
    type: file
---

# Long-Haul Parallel Repair

## Activation Contract

Use this skill only when the user explicitly authorizes subagents,
delegation, fan-out, or long-running autonomous work. Requests for
"thoroughness" or "deep investigation" alone are not enough.

If authorization is ambiguous, ask one concise question before spawning
agents. If the user says "fan out", "dispatch agents", "subagents", "work
for hours", or gives a long-haul time budget, treat that as authorization.

## Operating Model

Act as the orchestrator and integrator. Keep the critical path local, and
delegate independent sidecar work that can run while you continue.

Use the host's available subagent interface: Codex multi-agent tools such as
spawn, wait, and close when exposed, or Claude Code's Agent tool when that is
the available mechanism.

Before spawning agents, write a short decomposition:

1. Independent evidence questions.
2. Independent implementation or test slices.
3. Verification surfaces.
4. The immediate task the orchestrator will do locally.

Spawn agents early when at least two streams are independent and materially
advance the goal. Do not delegate the task that blocks your next local step.

## Fan-Out Rules

Use explorer-style agents for bounded read-only work:

- log and database forensics
- code ownership and blast-radius tracing
- existing issue or PR dedupe
- regression-test discovery
- independent verification of a suspected root cause

Use worker-style agents for bounded changes:

- tests in a disjoint file
- one implementation slice with a clear owner path
- docs or workflow updates
- small scripts or queries

Give every worker an explicit, path-bounded, disjoint write set. Tell workers
they are not alone in the codebase, must not revert unrelated edits, and must
adapt to concurrent changes.

## Confidence Ledger

Maintain a visible ledger during the task:

| Finding | Confidence | Evidence | Owner path | Action | Verification | Risk |
|---|---:|---|---|---|---|---|

Every item below 8/10 confidence must become one of:

- a concrete evidence query
- a failing regression test
- a bounded implementation task
- a delegated explorer task
- a delegated worker task
- an explicit blocker with proof

Do not final while any item below 8/10 remains merely speculative.

## Long-Run Loop

Use long waits only when integration is blocked on a running agent result.
Otherwise continue non-overlapping local work immediately.

After an agent returns:

1. Read the result and changed files.
2. Verify claims with local commands or direct evidence.
3. Integrate or reject the result.
4. Update the confidence ledger.
5. Close the agent when no longer needed.

If the runtime cannot keep working for the requested duration, leave a durable
handoff artifact such as an issue, task, workflow, or todo with evidence and
the next exact command or query to run.

## Completion Gate

Do not send final until:

- all worker agents are complete and closed
- any unfinished agents are read-only and explicitly non-blocking
- all changed code has been linted and tested with fresh commands
- every sub-8/10 finding is fixed, evidence-solved, or blocked with proof
- the final answer names remaining risks honestly
- the final answer reports what was verified, not just what was attempted

## Anti-Patterns

- Reporting a ranked list and stopping while repair was authorized.
- Spawning multiple agents on overlapping write scopes.
- Waiting idly while agents run and local non-overlapping work exists.
- Trusting agent self-report without checking evidence.
- Treating historical telemetry counts as reduced by a code change; only new
  telemetry can prove recurrence reduction.
