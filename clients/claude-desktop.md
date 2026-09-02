# Claude Desktop

Settings → Developer → Edit Config, or edit `claude_desktop_config.json`:

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

Restart Claude Desktop. Ask: "Show me Congress's newest disclosed trades in
NVDA and cite the receipt for each."

Licensed key (optional, raises volume limits):

```json
{
  "mcpServers": {
    "veridion": {
      "type": "http",
      "url": "https://www.veridionmarkets.com/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}
```

