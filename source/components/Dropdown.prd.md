# PRD: Server-Side Experiment Search via Pavlovia API

**Status:** needs-triage
**Component:** Dropdown (experiment picker)

---

## Problem Statement

When a researcher opens the "Select an Experiment" modal, the "Search experiments..." input only filters experiments that are already loaded in the browser. Pavlovia projects are fetched 100 at a time; any researcher with more than 100 experiments cannot find experiments beyond the first page by searching. They are forced to scroll repeatedly to load more results, hoping the target experiment eventually appears.

---

## Solution

Connect the "Search experiments..." input to Pavlovia's GitLab API search endpoint so that typing a term searches across **all** of the researcher's experiments — not just those already loaded in the client. Results arrive automatically as the researcher types (debounced), with a spinner shown during the fetch. When the field is cleared, the locally cached list is restored and infinite scroll resumes normally.

---

## User Stories

1. As a researcher with many experiments, I want the search field to query the Pavlovia API, so that I can find experiments beyond the first 100 loaded results.
2. As a researcher, I want search results to appear automatically as I type, so that I do not need to press Enter or click a button to trigger a search.
3. As a researcher, I want the search to wait briefly after I stop typing before firing, so that I am not spammed with partial results for every character I type.
4. As a researcher, I want to see a spinner while the search is in progress, so that I know the system is working and have not been left with stale results.
5. As a researcher, I want the system repo "EasyEyesResources" excluded from search results, so that only my actual experiments are shown.
6. As a researcher, I want to clear the search field and immediately see my full cached experiment list again, so that I can browse all loaded experiments without re-fetching.
7. As a researcher, I want infinite scroll to work normally when the search field is empty, so that I can still load additional pages by scrolling.
8. As a researcher, I want infinite scroll to be suspended while a search term is active, so that partial scroll loads do not interfere with search results.
9. As a researcher, I want infinite scroll to resume automatically after I clear the search field, so that I do not need to close and reopen the modal.
10. As a researcher, I want search results delivered using the same authenticated API channel as all other Pavlovia requests, so that token refresh, retries, and error handling are consistent.
11. As a researcher, I want to click the Refresh button and have it reset the search state, so that I can start a fresh session after a list update.
12. As a researcher, I want to select an experiment from search results just as I would from the normal list, so that the rest of the workflow is unchanged.

---

## Implementation Decisions

### Modules modified

- **Experiment picker modal (`openModal`)** — accepts a `user` parameter so it can call the Pavlovia search API directly from inside `didOpen`. Currently `user` is only available in the `Dropdown` component; it will be threaded down to `openModal`.

- **Search logic inside `didOpen`** — replaces the current client-side `input` event handler (hide/show rows) with a debounced handler that:
  1. If the term is non-empty: disables infinite scroll, shows a spinner row, calls the Pavlovia search API, applies the `isExperiment` filter, and renders the results.
  2. If the term is empty: clears API results, restores the in-memory cached list, re-enables infinite scroll.

- **Pavlovia search function (`gitlabSearch`)** — the existing `searchProjectsByName(user, term)` function is reused as-is. It calls `/users/${id}/projects?search=…&per_page=100` via `gitlabOAuthClient.apiRequest`, which owns retry and auth-refresh policy.

### Key interfaces

- `openModal` gains a `user` parameter (typed as `User | undefined`). When `user` is absent (e.g. in tests that don't supply it), the search input falls back to client-side filtering only.
- Debounce delay: **300 ms**.
- Infinite scroll guard: a boolean flag `isSearchActive` is set `true` while a non-empty term is present. The scroll handler checks this flag before firing a page load.
- On Refresh: `isSearchActive` is reset to `false` and the search input is cleared alongside the list reset, so pagination resumes from page 2.

### Error handling

All errors from `searchProjectsByName` propagate through `gitlabOAuthClient.apiRequest`'s existing policy (token refresh, retry). No additional error UI is added inside the modal; if the request ultimately fails the spinner is removed and an empty result set is rendered (matching "No experiments found." style).

---

## Testing Decisions

**What makes a good test:** test only observable DOM behavior and external API calls — not internal flags or implementation details. Mock `searchProjectsByName` and assert on what the table body contains.

**Prior art:** `Dropdown.test.js` already mocks `sweetalert2`, captures `didOpen`, injects the modal HTML into `document.body`, and simulates scroll events. New tests should follow the same pattern (mock Swal, call `didOpen`, then simulate `input` events on `#experiment-search`).

**Modules to test:**

- **Dropdown search behavior** (in `Dropdown.test.js`):
  - Typing a term fires `searchProjectsByName` after the debounce delay.
  - A spinner row appears while the API call is in flight and disappears when resolved.
  - Results are rendered and EasyEyesResources is absent from them.
  - Clearing the field restores the cached list and does not call `searchProjectsByName`.
  - Scrolling near the bottom while a search term is active does NOT trigger a page load.
  - Scrolling near the bottom after clearing the search DOES trigger a page load.
  - Clicking Refresh clears the search input and resets pagination state.

---

## Out of Scope

- Paginating through server-side search results (scroll-to-load-more matches). The API returns up to 100 matching results per call, which is considered sufficient.
- Searching by date, experiment type, or any field other than project name.
- Debounce delay configurability.
- Offline / cache-first search fallback when the API is unreachable.
- Changes to the Refresh button's fetch behavior (it continues to call `user.initProjectList`).

---

## Further Notes

- Pavlovia's GitLab API `?search=` parameter performs substring matching on project name. This matches user expectation (typing "crowd" finds "crowding_experiment").
- The `isExperiment` guard (`project.name !== "EasyEyesResources"`) must be applied to both the cached list and API search results for consistency.
- The 300 ms debounce is standard for search inputs; it can be tightened if the API proves fast enough that the spinner feels jarring.
