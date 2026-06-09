# mitmproxy fault-injection scripts (experiment / Compiler UI)

End-to-end failure scenario testing for the **Compiler login/session UI**
(`source/Login.js`). Chrome traffic already routes through mitmproxy; load one
script at a time to inject a specific failure mode against `gitlab.pavlovia.org`
and watch how the Compiler page behaves.

These complement the scripts in `threshold/tests/mitmproxy/`, which target the
lower-level `GitLabOAuthClient.apiRequest` retry logic. The scripts here target the
**presentation layer** — what the user sees while auth/session calls are in flight.

## Prerequisites

```bash
pip install mitmproxy   # if not already installed
```

Chrome must be routing through mitmproxy and the mitmproxy CA cert must be trusted
(run `mitmproxy` once and visit `mitm.it` in Chrome to install it).

## How to run a scenario

```bash
cd tests/mitmproxy

# Interactive TUI (lets you see/edit each flow live):
mitmproxy -s <script>.py

# Headless (log output only — easier to read counts):
mitmdump -s <script>.py
```

---

## Scenarios

### Stored-session probe outage + recovery (issue #124, Bug A)

| Script | What it injects | Expected outcome |
|--------|----------------|-----------------|
| `stored_session_outage_recovery.py` | CORS-masked 503 (no `Access-Control-Allow-Origin`) on the first `FAIL_FIRST` (=8) `GET /api/v4/user` probes, then passes through to the real endpoint | **Without the fix:** page sits silently on "Checking stored session validity…", console shows the CORS / `ERR_FAILED` pair (fast at first, then ~2 lines/min). **With the fix:** a "Loading …" SweetAlert appears after 1s, swaps to "Still loading — Pavlovia may be slow or temporarily unreachable…" after 12s, then auto-closes into the Compiler table once the injected outage ends. |

**Setup:** sign in to Pavlovia once so a session is stored in `localStorage`, close
the tab, load the script, then open the Compiler in a **fresh tab**.

`FAIL_FIRST` is tuned so the simulated outage spans both the 1s and 12s UI
thresholds before recovering — bump it for a longer outage, drop it to see fast
recovery.

---

## What to verify

### In the mitmdump log
- `[stored_session_outage_recovery]` lines show each `/user` probe. The counter rises
  while the outage is injected, then prints `passing through to real … (outage ended)`
  and stops once it exceeds `FAIL_FIRST`.

### In the EasyEyes Compiler UI
- No silent freeze: the "Loading …" dialog appears within ~1s.
- After ~12s the dialog text changes to the outage message.
- Once the outage ends, the dialog **closes by itself** and the table renders — no
  manual refresh, no forced re-login.

### In Chrome DevTools → Console
- The CORS / `ERR_FAILED` pair logs during the injected outage (this fix is
  presentation-layer only and deliberately does **not** silence the console flood;
  see issue #124).

---

## Resetting between runs

The script tracks a module-level hit counter. Because mitmproxy keeps the addon
loaded across requests, **restart mitmproxy** between runs to reset it (or reload
the addon with `r` in the interactive TUI).
