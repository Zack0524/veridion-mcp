# Claude Code

One command:

```bash
claude mcp add --transport http veridion https://www.veridionmarkets.com/api/mcp
```

Or in `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "veridion": {
      "type": "http",
      "url": "https://www.veridionmarkets.com/api/mcp"
    }
  }
}
```

