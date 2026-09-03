#!/usr/bin/env node
// Verify a Veridion daily disclosure export without trusting Veridion.
//
//   node scripts/verify-disclosure-export.mjs disclosures-2026-09-03.ndjson.gz \
//     --sha256 <manifest sha256> [--root <committed merkle root>]
//
// Checks, in order, each with its own denominator:
//   1. sha256 of the gzip bytes equals the manifest's sha256.
//   2. Every row's content_hash recomputes from the row's own served fields
//      using the published basis and field list (veridion-disclosure-content-v1).
//   3. The Merkle root over content hashes, leaves in disclosure_id order,
//      equals the committed root when one is supplied (transparency log,
//      layer 2), and is printed either way so it can be compared by hand.
//
// Exit 0 only when every check passes. Exit 1 lists every failure. The
// script has no network access and reads nothing but the file named.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";

export const CONTENT_HASH_BASIS = "veridion-disclosure-content-v1";
export const CONTENT_HASH_FIELDS = [
  "disclosure_id", "version_id", "member.member_id", "member.full_name",
  "member.chamber", "asset.ticker", "asset.name", "asset.asset_type",
  "asset.source_code", "asset.description", "transaction.type",
  "transaction.date", "filing.type", "filing.filed_date", "amount.range_low",
  "amount.range_high", "amount.verbatim_text", "owner.label",
  "owner.determination", "receipt.document_id", "receipt.url",
  "receipt.source_system", "receipt.page", "provenance.source_line_number",
];

function pathValue(row, path) {
  let current = row;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return null;
    current = current[segment];
  }
  return current === undefined ? null : current;
}

/** @param {Record<string, unknown>} row */
export function contentHash(row) {
  const input = [CONTENT_HASH_BASIS, ...CONTENT_HASH_FIELDS.map((path) => pathValue(row, path))];
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}

// Standard binary Merkle tree over hex leaves: parent = sha256(left || right)
// over the raw 32-byte digests; an odd node is paired with itself. Leaves are
// content hashes in disclosure_id order (byte-wise), so the root is a function
// of the corpus and nothing else. An empty corpus has no root.
/** @param {string[]} hexLeaves */
export function merkleRoot(hexLeaves) {
  if (hexLeaves.length === 0) return null;
  let level = hexLeaves.map((hex) => Buffer.from(hex, "hex"));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(createHash("sha256").update(Buffer.concat([left, right])).digest());
    }
    level = next;
  }
  return level[0].toString("hex");
}

/**
 * @param {Buffer} gzBytes
 * @param {{ expectedSha256?: string | null; expectedRoot?: string | null }} [options]
 */
export function verifyExport(gzBytes, { expectedSha256 = null, expectedRoot = null } = {}) {
  const failures = [];
  const sha256 = createHash("sha256").update(gzBytes).digest("hex");
  if (expectedSha256 && sha256 !== expectedSha256) {
    failures.push(`sha256: file ${sha256}, manifest ${expectedSha256}`);
  }

  const text = gunzipSync(gzBytes).toString("utf8");
  const lines = text.split("\n").filter((line) => line.length > 0);
  const rows = [];
  let unparsable = 0;
  for (const line of lines) {
    try { rows.push(JSON.parse(line)); } catch { unparsable += 1; }
  }
  if (unparsable > 0) failures.push(`rows: ${unparsable} of ${lines.length} lines are not JSON`);

  let hashMismatches = 0;
  let hashMissing = 0;
  for (const row of rows) {
    if (typeof row.content_hash !== "string") { hashMissing += 1; continue; }
    if (contentHash(row) !== row.content_hash) hashMismatches += 1;
  }
  if (hashMissing > 0) failures.push(`content_hash: ${hashMissing} of ${rows.length} rows carry none (export predates 1.3.5?)`);
  if (hashMismatches > 0) failures.push(`content_hash: ${hashMismatches} of ${rows.length} rows do not recompute`);

  const leaves = rows
    .filter((row) => typeof row.content_hash === "string" && typeof row.disclosure_id === "string")
    .sort((a, b) => (a.disclosure_id < b.disclosure_id ? -1 : a.disclosure_id > b.disclosure_id ? 1 : 0))
    .map((row) => row.content_hash);
  const root = merkleRoot(leaves);
  if (expectedRoot && root !== expectedRoot) {
    failures.push(`merkle root: computed ${root}, committed ${expectedRoot}`);
  }

  return { sha256, rows: rows.length, hashed: leaves.length, hashMismatches, root, failures };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      sha256: { type: "string" },
      root: { type: "string" },
    },
  });
  const file = positionals[0];
  if (!file) {
    console.error("usage: verify-disclosure-export.mjs <export.ndjson.gz> [--sha256 <hex>] [--root <hex>]");
    process.exit(2);
  }
  const result = verifyExport(readFileSync(file), {
    expectedSha256: values.sha256 ?? null,
    expectedRoot: values.root ?? null,
  });
  console.log(JSON.stringify({
    file,
    sha256: result.sha256,
    rows: result.rows,
    rows_with_content_hash: result.hashed,
    content_hash_mismatches: result.hashMismatches,
    merkle_root: result.root,
    checks_failed: result.failures,
  }, null, 2));
  process.exit(result.failures.length === 0 ? 0 : 1);
}
