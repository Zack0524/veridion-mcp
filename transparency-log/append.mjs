#!/usr/bin/env node
// Append today's commitment to the transparency log.
//
// Reads Veridion's public status endpoint, takes the daily export's
// commitment (snapshot day, generation, row count, file sha256, Merkle root
// over every row's content_hash, hash basis, generation time), and appends
// exactly one line to log.txt for that snapshot day. The workflow that runs
// this commits the line to this repository's history.
//
// Rules, each of which makes the run fail rather than write something wrong:
//   - bulk_export.state must be "ready"; a stale or unavailable export is
//     not committed.
//   - merkle_root must be 64 hex characters and content_hash_basis must be
//     the published basis. A manifest without a root (generated before API
//     1.3.6) is "not yet", not a commitment.
//   - A day already in the log with the same line is a no-op. A day already
//     in the log with a different line is a conflict: the run fails and the
//     log is not touched. Lines are never rewritten.
//
// Usage: node transparency-log/append.mjs [--status-url <url>] [--log <path>]
// Exit 0 when a line was appended or already present; 1 on any failure.
// Prints one JSON object describing what happened.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const CONTENT_HASH_BASIS = "veridion-disclosure-content-v1";
const HEX_64 = /^[0-9a-f]{64}$/;
const LINE_FIELDS = ["generation", "rows", "sha256", "root", "basis", "generated_at"];

export function formatLine(c) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.snapshot_day)) throw new Error("bad_snapshot_day");
  if (!Number.isSafeInteger(c.snapshot_generation) || c.snapshot_generation < 1) throw new Error("bad_generation");
  if (!Number.isSafeInteger(c.row_count) || c.row_count < 1) throw new Error("bad_row_count");
  if (!HEX_64.test(c.sha256) || !HEX_64.test(c.merkle_root)) throw new Error("bad_digest");
  if (c.content_hash_basis !== CONTENT_HASH_BASIS) throw new Error("bad_basis");
  if (Number.isNaN(Date.parse(c.generated_at)) || /\s/.test(c.generated_at)) throw new Error("bad_generated_at");
  return [
    c.snapshot_day,
    `generation=${c.snapshot_generation}`,
    `rows=${c.row_count}`,
    `sha256=${c.sha256}`,
    `root=${c.merkle_root}`,
    `basis=${c.content_hash_basis}`,
    `generated_at=${c.generated_at}`,
  ].join(" ");
}

export function parseLine(line) {
  const parts = line.trim().split(" ");
  if (parts.length !== 1 + LINE_FIELDS.length) return null;
  const [snapshot_day, ...pairs] = parts;
  const values = {};
  for (const [index, pair] of pairs.entries()) {
    const key = LINE_FIELDS[index];
    if (!pair.startsWith(`${key}=`)) return null;
    values[key] = pair.slice(key.length + 1);
  }
  const c = {
    snapshot_day,
    snapshot_generation: Number(values.generation),
    row_count: Number(values.rows),
    sha256: values.sha256,
    merkle_root: values.root,
    content_hash_basis: values.basis,
    generated_at: values.generated_at,
  };
  try {
    return formatLine(c) === line.trim() ? c : null;
  } catch {
    return null;
  }
}

export function commitmentFromStatus(status) {
  const b = status && typeof status === "object" ? status.bulk_export : null;
  if (!b || typeof b !== "object") throw new Error("status_has_no_bulk_export");
  if (b.state !== "ready") throw new Error(`bulk_export_not_ready:${String(b.state)}`);
  if (typeof b.merkle_root !== "string" || !HEX_64.test(b.merkle_root)) {
    throw new Error("bulk_export_has_no_merkle_root (snapshot predates API 1.3.6, or the root was not published)");
  }
  return {
    snapshot_day: String(b.latest_snapshot_day),
    snapshot_generation: Number(b.snapshot_generation),
    row_count: Number(b.row_count),
    sha256: String(b.sha256),
    merkle_root: b.merkle_root,
    content_hash_basis: String(b.content_hash_basis),
    generated_at: String(b.generated_at),
  };
}

export function appendCommitment(logText, line) {
  const day = line.slice(0, 10);
  const lines = logText.split("\n").filter((entry) => entry.length > 0 && !entry.startsWith("#"));
  const existing = lines.find((entry) => entry.startsWith(`${day} `));
  if (existing === line) return { action: "already_present", text: logText };
  if (existing) throw new Error(`conflicting_commitment_for_${day}: log has "${existing}", status says "${line}"`);
  for (const entry of lines) {
    if (!parseLine(entry)) throw new Error(`log_line_unparsable: "${entry}"`);
  }
  const text = logText.length === 0 || logText.endsWith("\n") ? `${logText}${line}\n` : `${logText}\n${line}\n`;
  return { action: "appended", text };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const { values } = parseArgs({
    options: {
      "status-url": { type: "string", default: "https://www.veridionmarkets.com/api/v1/status" },
      log: { type: "string", default: "transparency-log/log.txt" },
    },
  });
  try {
    const response = await fetch(values["status-url"], { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`status_http_${response.status}`);
    const status = await response.json();
    const commitment = commitmentFromStatus(status);
    const line = formatLine(commitment);
    const current = existsSync(values.log) ? readFileSync(values.log, "utf8") : "";
    const result = appendCommitment(current, line);
    if (result.action === "appended") writeFileSync(values.log, result.text);
    console.log(JSON.stringify({ ok: true, action: result.action, line, api_version: status.version ?? null }));
    process.exit(0);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: String(error instanceof Error ? error.message : error) }));
    process.exit(1);
  }
}
