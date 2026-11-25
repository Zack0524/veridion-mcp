# Independent time-stamps

Each day a line is appended to `log.txt`, the whole file is time-stamped by
RFC 3161 time-stamp authorities that Veridion does not control:

- `tsa/<date>.digicert.tsr`: DigiCert's public time-stamp service (primary)
- `tsa/<date>.freetsa.tsr`: FreeTSA (a second, independent witness)

A token binds the SHA-256 of `log.txt` as it was in that day's commit, so it
proves every line up to that date existed no later than the authority's time.

Verify a day (example: 2026-11-26), with OpenSSL:

```sh
c=$(git log --format=%H -1 -- transparency-log/tsa/2026-11-26.digicert.tsr)
git show "$c":transparency-log/log.txt > log-at-date.txt
openssl ts -reply -in transparency-log/tsa/2026-11-26.digicert.tsr -text   # time and imprint
openssl ts -verify -data log-at-date.txt \
  -in transparency-log/tsa/2026-11-26.digicert.tsr \
  -CAfile <DigiCert time-stamping root and intermediate, from cacerts.digicert.com>
```

`sha256sum log-at-date.txt` must equal the message imprint printed by the
first command. A day with no token is flagged as a workflow warning and is dated by public
git history alone, as are all days before the first token.
