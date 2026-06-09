"""
Scenario: Pavlovia outage during the stored-session validation probe, then recovery
(issue #124, Bug A).

When the Compiler opens with a stored Pavlovia session, it validates it with a
cross-origin `GET /api/v4/user`. During an outage that response comes back without an
`Access-Control-Allow-Origin` header, so the browser blocks it and `fetch` rejects
with an opaque `TypeError` (the "blocked by CORS policy" + "ERR_FAILED" pair).

This script injects that CORS-masked outage on the first `FAIL_FIRST` `/user` probes,
then passes traffic through to the real gitlab.pavlovia.org — simulating Pavlovia
recovering mid-outage so the next retry succeeds.

Shipped fix (source/Login.js): the stored-session probe shows a loading dialog so the
page no longer looks frozen during the outage —
  • after  1s → a "Loading …" SweetAlert spinner (no buttons),
  • after 12s → text swaps to "Still loading — Pavlovia may be slow or temporarily
                unreachable; this will resume automatically when it recovers."
When the probe succeeds (outage ends), the dialog auto-closes and the table appears.
`FAIL_FIRST` is tuned so the outage spans both the 1s and 12s thresholds before
recovery.

Run:
    mitmdump -s stored_session_outage_recovery.py        # headless
    mitmproxy -s stored_session_outage_recovery.py       # interactive TUI

Then in Chrome: sign in to Pavlovia once (so a session is stored), close the tab, load
this script, and open the Compiler in a fresh tab. Restart mitmproxy between runs to
reset the hit counter (or press `r` in the TUI).
"""

from mitmproxy import http

# Scope strictly to the stored-session validation probe.
PROBE_PATH = "/api/v4/user"
TARGET_HOST = "gitlab.pavlovia.org"

# Inject the CORS-masked outage on this many probes, then pass through to the real
# endpoint so the UI recovers. With apiRequest's backoff (0.2s × 1.75^attempt,
# capped at 30s) the first 8 failures span ~23s — long enough to cross the 1s
# "Loading …" and 12s "Still loading…" thresholds before recovery.
FAIL_FIRST = 8
_hits = 0


def request(flow: http.HTTPFlow) -> None:
    if flow.request.host != TARGET_HOST or flow.request.path != PROBE_PATH:
        return

    global _hits
    _hits += 1

    if _hits > FAIL_FIRST:
        # Outage is "over": don't set flow.response, so mitmproxy forwards the
        # probe to the real gitlab.pavlovia.org and the session validates.
        print(
            f"[stored_session_outage_recovery] hit #{_hits} → passing through to real "
            f"{TARGET_HOST} (outage ended)"
        )
        return

    print(
        f"[stored_session_outage_recovery] hit #{_hits}/{FAIL_FIRST} → injecting CORS-masked outage"
    )

    # Outage error page returned WITHOUT Access-Control-Allow-Origin.
    # The missing CORS header is what masks the status as an opaque TypeError;
    # the 503 body is never seen by JavaScript.
    flow.response = http.Response.make(
        503,
        b"<html><body>503 Service Unavailable (injected outage)</body></html>",
        {"content-type": "text/html"},  # deliberately no Access-Control-Allow-Origin
    )
