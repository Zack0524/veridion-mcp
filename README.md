# Veridion Disclosure MCP

Connect any AI assistant to US government financial disclosure data where
**every row carries the government's own document**.

```
https://www.veridionmarkets.com/api/mcp
```

No key. No signup. Paste a config below and ask your assistant who filed what.

## What your assistant gets

64,000+ receipt-linked disclosure rows across three branches of the US
government: House and Senate STOCK Act periodic transaction reports, and
executive-branch filings from the Office of Government Ethics, including the
President's. Counts are measured live from the serving view; call
`get_coverage` for the current numbers rather than trusting this README.

Five tools:

| Tool | What it answers |
|---|---|
| `search_disclosures` | Who traded what, when, filtered by ticker, filer, chamber, dates, or `within_statutory_window=false` for every filing made outside its own statutory window (`min_delay_days` for a caller-chosen threshold) |
| `get_disclosure_history` | Every observed version of one filing, oldest first. Amendments never erase their predecessors here; the before and after of a restated filing are both returned |
| `list_members` | Filer identity with official Bioguide IDs (never invented; executive filers return null with an explanation). Resolve a person with `name=pelosi`, or look up the exact `member_id` a disclosure row carries |
| `get_coverage` | Live row counts by source and chamber, counted at read time |
| `get_status` | Source freshness and snapshot health; the endpoint downgrades itself when its own arithmetic says stale, and names every cause in `degraded_reasons` |

## Why this exists

AI assistants hallucinate financial facts. This server is built so they don't
have to: every row includes `receipt.url`, the House Clerk PDF, Senate eFD
record, or OGE document the row was parsed from, down to the page. The server's
own instructions tell your assistant to surface that URL with every claim, so
you can check it yourself.

The discipline underneath, in one line: **no receipt, no row.** Records that
cannot be tied to their source document are dropped and the drops are counted
in the API response, never silently omitted.

Three properties serious users check first:

- **Point-in-time**: `as_of` returns only rows observed by that instant, no
  look-ahead. Below the retained floor the API returns a typed error instead
  of a guess.
- **Append-only history**: restatements supersede, never overwrite.
  `get_disclosure_history` shows the full sequence.
- **Stated limits**: disclosed amounts are bounded ranges. Midpoints are
  provided but are explicitly not transaction totals, and the schema says so
  where your assistant reads.

## Quick start

### Claude Desktop / Claude Code

`claude_desktop_config.json` (Desktop) or `.mcp.json` (Code):

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

Then ask: *"Which congressional filings this year came in more than 45 days
late? Cite the receipts."*

More clients in [`clients/`](clients/): Cursor, LangChain, OpenAI Agents SDK,
and a plain `curl` walkthrough.

## Free tier limits

25 rows per request, 60 requests per hour per IP, every capability enabled:
filters, point-in-time, cursors, history. Volume is what a license adds
(1,000-row pages, bulk snapshot with sha256), not capability:
[veridionmarkets.com/data-api](https://www.veridionmarkets.com/data-api).

## Verify this repo's claims

Nothing here asks for trust. The server is the authority:

```bash
curl -s -X POST https://www.veridionmarkets.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Machine-readable descriptor:
[`/.well-known/mcp.json`](https://www.veridionmarkets.com/.well-known/mcp.json)
· OpenAPI: [`/api/v1/openapi.json`](https://www.veridionmarkets.com/api/v1/openapi.json)

Scope boundary, stated rather than implied: SEC EDGAR data is not published in
v1. `get_status` reports it as `no_data`, a declared boundary, not a failure.

## License

The source records are US Government public domain. Veridion licenses its
collection, parsing, and receipt-linking; see
[terms](https://www.veridionmarkets.com/terms). Config files in this repo are
MIT; copy them anywhere.

