# Plain HTTP (no MCP client)

The MCP server is JSON-RPC over HTTP; the same data is also a plain REST API.

List the tools:

```bash
curl -s -X POST https://www.veridionmarkets.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Call one (every filing more than 45 days late):

```bash
curl -s -X POST https://www.veridionmarkets.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_disclosures","arguments":{"min_delay_days":46,"limit":5}}}'
```

REST equivalent:

```bash
curl -s 'https://www.veridionmarkets.com/api/v1/disclosures?min_delay_days=46&limit=5'
```

Every row includes `receipt.url`, the government document it was parsed from.
Open it. That is the product.

