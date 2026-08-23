---
name: elevenlabs-automem-memory
description: Connect an ElevenLabs conversational agent to a protected AutoMem-compatible MCP service and verify that durable memory calls work in real conversations.
license: MIT
tags: [elevenlabs, automem, mcp, voice, deployment]
agents: [claude-code, codex, autojack]
category: voice
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: ELEVENLABS_API_KEY
    description: API key for configuring the conversational agent.
    required: true
  - name: AUTOMEM_API_TOKEN
    description: Token used by the memory service and MCP bridge.
    required: true
resources:
  - path: story.md
    type: file
---

# ElevenLabs + AutoMem Memory

Connect a conversational agent to an AutoMem-compatible service through an MCP
bridge. Treat memory as a production integration: isolate stores by persona,
keep credentials in the deployment platform's secret manager, and confirm the
real tool path before calling it done.

## Preconditions

- A supported memory API and MCP bridge are deployed and reachable.
- The memory service has persistent storage appropriate for the provider.
- The bridge requires an authorization header from clients; it must not fall
  back to an embedded upstream credential for anonymous requests.
- `ELEVENLABS_API_KEY` and `AUTOMEM_API_TOKEN` are configured outside the
  repository. Never put either in a command, example file, or chat transcript.

## Deploy the memory service

Use the provider's normal deployment controls. Configure public, non-secret
settings as environment variables and send secrets through its secret manager
or stdin-safe command. Names vary by implementation, but a typical boundary is:

```text
MEMORY_API_URL=https://memory.example.com
MCP_BRIDGE_URL=https://memory-bridge.example.com/mcp
AUTOMEM_API_TOKEN=<managed secret>
EMBEDDING_API_KEY=<managed secret, if required>
```

Provision persistent database/vector storage according to the service's
documentation. Give each agent or persona a separate store and token unless a
shared-memory product decision explicitly says otherwise. Validate the API and
bridge health endpoints before configuring ElevenLabs.

## Register the MCP server

Create an ElevenLabs conversational MCP server through the API or dashboard.
Use the bridge URL and send the token as an HTTP authorization header:

```json
{
  "config": {
    "url": "https://memory-bridge.example.com/mcp",
    "name": "Agent Memory",
    "transport": "STREAMABLE_HTTP",
    "approval_policy": "require_approval_per_tool",
    "request_headers": {
      "Authorization": "Bearer ${AUTOMEM_API_TOKEN}"
    }
  }
}
```

Choose `auto_approve_all` only when the agent is intentionally autonomous and
the available tools have been reviewed. Otherwise, use per-tool approval and
permit only the calls the conversation needs. Do not put tokens in query
parameters: URLs are commonly logged by proxies and analytics systems.

Attach the returned MCP-server identifier to the agent's existing prompt
configuration. Fetch the configuration first and update it as a whole so a
partial patch cannot discard unrelated model, safety, or tool settings. Add a
short memory directive: recall relevant context when useful, store only durable
facts, and never expose stored memory as hidden system context.

## Verify with a real conversation

Simulation endpoints can mock external tools, so they are useful for persona
checks but cannot prove a bridge call happened. Instead:

1. Hold a real test conversation that should trigger a recall or store.
2. Inspect that conversation's transcript or tool-call record in ElevenLabs.
3. Confirm the expected MCP tool name and a successful result.
4. Inspect the memory service's safe operational logs for a corresponding,
   redacted request.

If no tool call appears, verify the MCP server is attached to the active agent,
the agent is eligible for MCP use under its privacy/retention settings, the
authorization header reaches the bridge, and the bridge rejects missing tokens.

## Security rules

- Keep browser-accessible agent configuration free of API tokens.
- Require a client token at the bridge; a health check is not evidence that
  authorization is enforced.
- Use headers rather than query parameters for authentication.
- Do not reuse one persona's memory token for another persona's store.
- Rotate tokens through the secret manager and reconnect the bridge after a
  suspected exposure.
