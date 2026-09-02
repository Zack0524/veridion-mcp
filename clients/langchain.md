# LangChain / OpenAI Agents SDK

Any framework with MCP client support can use the server directly.

LangChain (Python, `langchain-mcp-adapters`):

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "veridion": {
        "transport": "streamable_http",
        "url": "https://www.veridionmarkets.com/api/mcp",
    }
})
tools = await client.get_tools()  # five tools, receipts on every row
```

OpenAI Agents SDK (Python):

```python
from agents.mcp import MCPServerStreamableHttp

veridion = MCPServerStreamableHttp(
    params={"url": "https://www.veridionmarkets.com/api/mcp"}
)
```

No framework? The REST API needs nothing:
`GET https://www.veridionmarkets.com/api/v1/disclosures?limit=5`

