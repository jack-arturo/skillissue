# README Writing Examples

Real examples from Jack's AutoHub README showing key patterns.

## Opening Pattern

**Structure:** Emoji + Version + Promise

```markdown
# 🚀 AutoHub · v1.0.0

> **Your personal AI command center** — Write what you want in plain English, and watch Claude make it happen. No code, no YAML hell, just natural language that turns into powerful automations.
```

**Why it works:**
- Emoji establishes vibe immediately
- Version number sets expectations
- Blockquote Promise is scannable
- Em dash separates benefit
- "No YAML hell" — dismissive of complexity
- "That's it!" — emphatic

## What Makes This Special Section

**Pattern:** Emoji bullets + Bold feature + Benefit

```markdown
## ✨ What Makes This Special

🎯 **Zero-to-Hero Workflows**: Start with "Check my calendar and summarize my day" and grow into sophisticated multi-tool orchestrations — all in plain Markdown.

🔥 **Hot-Reload Everything**: Change a workflow, add a tool, tweak your prompt — the hub picks it up instantly. No restarts, no rebuilds, just pure iteration speed.

🧠 **Memory That Actually Works**: Every workflow run gets intelligently summarized and stored. Ask "What did my morning routine find yesterday?" and get instant recall.

⚡ **Parallel Tool Execution**: Claude doesn't wait around — it runs multiple tools simultaneously, making complex workflows blazingly fast.
```

**Techniques:**
- Single emoji per feature (visual hierarchy)
- Bold feature name (scannable)
- Colon after name (structure)
- Benefit description with personality
- Em dashes for emphasis
- Action verbs ("grows", "picks up", "stored")
- "Actually Works" — honest about common pain points
- "Claude doesn't wait around" — anthropomorphization

## Quick Start Pattern

**Structure:** Time promise + Numbered steps + "That's it!"

```markdown
## 🏃 Quick Start — 5 Minutes to Magic

### Prerequisites
```bash
# You'll need Node.js 18+ and npm
node --version  # Should be 18+
```

### 1️⃣ Install & Launch
```bash
# Clone and set up
git clone https://github.com/verygoodplugins/autohub.git
cd autohub
npm install

# Start the MCP server with hot-reload
npm run mcp-server
```

### 2️⃣ Connect to Claude Desktop
Add to your Claude Desktop MCP servers:
```json
{
  "autohub": {
    "command": "node",
    "args": ["./server.js"],
    "cwd": "/path/to/autohub"
  }
}
```

### 3️⃣ Write Your First Workflow
Create `workflows/daily/morning-routine.md`:
```markdown
Check my calendar, emails, and Slack messages.
Summarize what needs my attention today.
Tell me the three most important things to focus on.
```

### 4️⃣ Run It!
In Claude Desktop: 
> "Run my morning routine workflow"

That's it! Claude will execute your workflow using all your connected MCP tools. 🎉
```

**Techniques:**
- Runner emoji (🏃) + time promise ("5 Minutes to Magic")
- Numbered emoji steps (1️⃣ 2️⃣ 3️⃣)
- Comments in code blocks ("# Clone and set up")
- Inline comments ("# Should be 18+")
- Actual paths (`workflows/daily/morning-routine.md`)
- Real commands that work
- "That's it!" — emphatic closing
- Party emoji at end (🎉)
- Blockquote for user input (> "Run my...")

## Command Center Section

**Pattern:** Organized by use case, not alphabetically

```markdown
### 🎮 Command Center

```bash
# Development with hot-reload everything
npm run dev            # Start all services (MCP, Slack, Scheduler)

# Individual services
npm run mcp-server     # Just the MCP server
npm run slack:dev      # Slack bot with watching
npm run scheduler:dev  # Scheduler with watching

# Production
npm start              # All services, no watchers

# Workflow tools
npm run lint:workflows # Validate your workflows
npm run workflow       # CLI for testing workflows
```
```

**Techniques:**
- Game controller emoji (🎮)
- Grouped by purpose (Development, Individual, Production)
- Inline comments explain what each does
- "just", "with watching" — conversational
- No period at end of comments
- Two spaces for alignment

## Architecture Section

**Pattern:** Components > Technical details

```markdown
## 🏗️ Architecture That Scales

### Core Components

#### 🎯 **Dynamic Tool System**
Tools are hot-reloaded JavaScript modules that Claude can discover and use:
```javascript
// tools/my-tool.js
export default {
  name: 'my_custom_tool',
  description: 'Does something awesome',
  inputSchema: { /* JSON Schema */ },
  handler: async (args) => { /* Your logic */ }
}
```
Drop it in `tools/` and it's instantly available — no restart needed!
```

**Techniques:**
- Building blocks emoji (🏗️)
- "Architecture That Scales" — promise not description
- Emoji per component type
- Bold component names
- Code example before explanation
- Real file path (`tools/my-tool.js`)
- "Drop it in" — imperative
- Em dash + benefit
- Exclamation for emphasis

## Configuration Section

**Pattern:** Essential > Optional > Details link

```markdown
## ⚙️ Configuration

### Essential Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# The Big Three
ANTHROPIC_API_KEY=sk-ant-...          # For agent mode & Slack bot
SLACK_BOT_TOKEN=xoxb-...              # Slack integration
SLACK_MCP_XOXP_TOKEN=xoxp-...         # Slack MCP operations

# Workflow Control
SCHEDULER_TIMEZONE=America/New_York    # Your timezone
WORKFLOWS_DIR=workflows                 # Where workflows live

# Memory Settings
MEMORY_PREFETCH_ENABLE=true           # Smart context loading
# Note: Memory storage is now agent-driven via store_memory tool (no auto-save)

# Optional Goodies
NTFY_TOPIC=my-automations             # Mobile push notifications
DEFAULT_CITY="San Francisco, CA"       # Weather context
```

### 🔌 Connect Your MCP Servers

Configure MCP servers in `config/mcp-servers.json`:
```bash
# Copy example config and add your API keys
cp config/mcp-servers.example.json config/mcp-servers.json

# Scan tools from configured servers
npm run mcp:scan
```

See **[MCP Setup Guide](docs/MCP-SETUP.md)** for full configuration details.
```

**Techniques:**
- Gear emoji (⚙️)
- "Essential" not "Required" (less robotic)
- "The Big Three" — nickname for top items
- Inline comments explain each var
- "# Note:" for important asides
- "Optional Goodies" — playful
- Real paths and commands
- Link to detailed docs at end
- Bold + brackets for doc links

## Contributing Section

**Pattern:** Brief + Welcoming

```markdown
## 🤝 Contributing

We love contributions! Whether it's:
- 🐛 Bug reports
- 💡 Feature ideas  
- 📝 Workflow templates
- 🔧 Tool additions

Check out our [contribution guidelines](CONTRIBUTING.md) (coming soon) or just open an issue!
```

**Techniques:**
- Handshake emoji (🤝)
- "We love" — enthusiastic
- Emoji bullets for types
- "(coming soon)" — honest about status
- "or just open an issue!" — lowering barrier
- Exclamation for enthusiasm

## License Section

**Pattern:** Ultra brief

```markdown
## 📄 License

MIT - Go wild! See [LICENSE](LICENSE) for details.
```

**Techniques:**
- Document emoji
- "Go wild!" — permissive encouragement
- Exclamation
- One line is enough

## Footer Pattern

```markdown
---

<p align="center">
  <strong>Ready to automate everything?</strong><br>
  <a href="https://github.com/verygoodplugins/autohub">Star us on GitHub</a> · 
  <a href="https://github.com/verygoodplugins/autohub/issues">Report an Issue</a> · 
  <a href="docs/WORKFLOWS.md">Read the Docs</a> · 
  <a href="CHANGELOG.md">Changelog</a>
</p>
```

**Techniques:**
- Horizontal rule separation
- Centered HTML
- Rhetorical question ("Ready to...")
- "Star us" — direct call to action
- Middle dots for separation
- Multiple CTAs (star, report, read, changelog)

---

## Common Mistakes to Avoid

### ❌ Too Corporate

```markdown
<!-- BAD -->
AutoHub is a comprehensive automation solution designed to empower users 
to create sophisticated workflows through an intuitive natural language 
interface, leveraging best-in-class AI technology.
```

```markdown
<!-- GOOD -->
Your personal AI command center — Write what you want in plain English, 
and watch Claude make it happen. No code, no YAML hell.
```

### ❌ Too Technical Too Soon

```markdown
<!-- BAD -->
## Architecture

AutoHub implements a Model Context Protocol (MCP) server that utilizes 
dynamic module loading with cache-busting to enable hot-reload capabilities 
across distributed tool registries.
```

```markdown
<!-- GOOD -->
## Architecture That Scales

Tools are hot-reloaded JavaScript modules that Claude can discover and use.
Drop it in `tools/` and it's instantly available — no restart needed!
```

### ❌ No Personality

```markdown
<!-- BAD -->
To execute a workflow, use the following command:
```bash
npm run workflow
```
```

```markdown
<!-- GOOD -->
### 4️⃣ Run It!
In Claude Desktop: 
> "Run my morning routine workflow"

That's it! 🎉
```

---

**Key Takeaway:** READMEs should feel like a conversation with an enthusiastic friend who actually uses the product, not a technical manual written by a committee.

