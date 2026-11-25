#!/usr/bin/env bash
# RFC 3161 time-stamps over transparency-log/log.txt, written beside it as
# tsa/<UTC date>.<authority>.tsr. The token binds the SHA-256 of the whole
# log file (every line to date), so one token dates the full history.
# Neither authority can block the git record: a missing token is flagged as a
# workflow warning and the day is committed without it.
set -euo pipefail
cd "$(dirname "$0")"
day="$(date -u +%F)"
mkdir -p tsa
digest="$(sha256sum log.txt | cut -d' ' -f1)"

stamp() { # name url required
  local name="$1" url="$2" required="$3" out="tsa/${day}.$1.tsr"
  openssl ts -query -data log.txt -sha256 -cert -out "tsa/${day}.$name.tsq"
  if curl -sSf --retry 2 --max-time 30 -H "Content-Type: application/timestamp-query" \
       --data-binary @"tsa/${day}.$name.tsq" "$url" -o "$out"; then
    local text; text="$(openssl ts -reply -in "$out" -text 2>/dev/null || true)"
    echo "$text" | grep -q "Status: Granted" || { echo "$name: not granted"; rm -f "$out"; }
    if [ -f "$out" ]; then
      # The token must carry this exact SHA-256 (the message imprint).
      od -An -v -tx1 "$out" | tr -d ' \n' | grep -q "$digest" || { echo "$name: imprint mismatch"; rm -f "$out"; }
    fi
  fi
  rm -f "tsa/${day}.$name.tsq"
  if [ ! -f "$out" ]; then
    # Never block the git record itself; flag the missing witness instead.
    if [ "$required" = "primary" ]; then echo "::warning::$name time-stamp missing for $day"; else echo "$name unavailable today"; fi
    return 0
  fi
  echo "$name: $(openssl ts -reply -in "$out" -text 2>/dev/null | grep 'Time stamp:' || true) sha256=$digest"
}

stamp digicert http://timestamp.digicert.com primary
stamp freetsa https://freetsa.org/tsr second
