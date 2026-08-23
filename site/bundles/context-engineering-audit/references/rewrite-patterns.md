# Rewriting coercion as product-context facts

The move is the same every time: say what the system does, and let the model
draw the conclusion. Keep the constraint, drop the threat.

## Before / after

**Mandate → delivery mechanics**

> CRITICAL: These tools are NOT optional. Your work will not be delivered without them!

> The user sees your `present_result` payload — the summary is condensed for chat and voice, the content is attached as a file, and a blocked or failed outcome recorded there is what lets the orchestrator route a retry. Exit without it and the harness falls back to condensing your raw final message.

**Prohibition list → one factual paragraph**

> 1. NEVER claim to have performed an action without calling the tool
> 2. NEVER fabricate task IDs
> 3. NEVER cite rate limits unless the tool output contains them
> (plus a 9-item BANNED CLAIMS list)

> An action happened only if its tool_result is in this conversation — that covers sends, saves, dispatches, and any live value. Report a failure with the tool's own error text; an invented cause is worse than a plain "that failed." Task ids exist only in the return value of the dispatch tool.

**Filesystem confusion → what the user can see**

> ## CRITICAL: The User Cannot See Files
> ❌ BAD: "I've created the file." ✅ GOOD: (400 chars of example)

> The user sees your text and whatever you explicitly deliver — never your filesystem. Put the actual work product in the response.

**Prose semantics → schema**

Mode and option semantics belong on the enum, not in the system prompt:

```json
"mode": {
  "enum": ["auto", "investigate", "implement"],
  "description": "Pass implement for nearly all work, including 'why is X broken?' — the user usually wants it fixed. investigate is read-only. Omitting this is not the same as implement: it routes as auto."
}
```

Check what the code actually defaults to before documenting a default. A schema
that claims the wrong default is worse than one that claims none.

## What not to rewrite

- **Persona and voice.** How an assistant sounds is a product decision, not a token one. Leave it unless asked.
- **Genuine gotchas.** "Tags filter before scoring" is short, non-obvious, and expensive to rediscover. Keep it upfront.
- **Constraints that survived the coupling check.** Change the register, keep the substance.

## Register check

After rewriting, count imperatives again. If `NEVER`/`MUST`/`CRITICAL` survive,
ask whether each is carrying meaning or volume. A rule that reads as a fact
usually needs none of them.
