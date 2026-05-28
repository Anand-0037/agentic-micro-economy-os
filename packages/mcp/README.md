# @ameo/mcp

Stdio MCP server exposing AMEO agent registration, decision submission, verification, policies, and skills.

## Install

```bash
npm install @ameo/mcp @ameo/sdk
```

## Claude Desktop

```json
{
  "mcpServers": {
    "ameo": {
      "command": "npx",
      "args": ["-y", "@ameo/mcp"],
      "env": {
        "AMEO_BASE_URL": "https://agentic-micro-economy-os.onrender.com"
      }
    }
  }
}
```

## Tools

- `register_agent`
- `submit_decision`
- `verify_decision`
- `list_policies`
- `list_skills`

See [docs/mcp](https://docs.ameo.agiwithai.com/mcp).
