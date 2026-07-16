# Compiler freshness production smoke check

Use this check after the compiler freshness changes have passed review and an
authorized operator is ready to publish them. The check is complete only when
every result below is recorded from the same production rollout. Do not infer a
pass from local builds or unit tests.

## Before deployment

Record the following values:

- Website commit: `<commit>`
- Threshold Scientist commit: `<commit>`
- Operator: `<name>`
- Check started at (UTC): `<timestamp>`
- Canonical compiler URL: `https://easyeyes.app/compiler/`
- Preview or branch deploy URL: `<url>`

From the website repository, confirm that the expected Threshold Scientist
commit is checked out and that neither repository contains uncommitted output:

```sh
git status --short
git submodule status docs/experiment
git -C docs/experiment status --short
```

Run the release checks immediately before deploying:

```sh
cd docs/experiment
npm test -- --runInBand
DEPLOY_ID=predeploy-verification npm run build
cd ../..
npm run test:compiler-cache
DEPLOY_ID=predeploy-verification npm run netlify
```

`predeploy-verification` is a synthetic ID used only to exercise the production
build path locally. Record these results, and use the successful Netlify build
with its real `DEPLOY_ID` as the authoritative production-build check. Do not
commit generated `dist/` files or lockfile changes from these commands.

Open the canonical compiler before publishing and leave it open. Record the
deployment ID from the `easyeyes-deployment-id` meta element as the old ID:

```js
document.querySelector('meta[name="easyeyes-deployment-id"]')?.content;
```

Also open the compiler in a second tab, record the same old ID, and move that
tab to the background before publishing.

## Publish and identity checks

Run the repository's authorized production workflow. From the successful
Netlify deploy details, record without reformatting:

- New production deployment ID: `<new-id>`
- Netlify `publishedAt`: `<exact-ISO-8601-timestamp>`
- Production deploy URL: `<url>`

In the Firebase console, inspect
`deployments/compiler/production`. Record the observed value:

```json
{
  "deploymentId": "<new-id>",
  "publishedAt": "<exact-ISO-8601-timestamp>"
}
```

The Firebase deployment ID must equal the Netlify deployment ID, and
`publishedAt` must match the Netlify event exactly. A timestamp that was
reformatted, regenerated, or rounded is a failure.

Fetch the canonical artifacts into a new temporary directory:

```sh
ORIGIN=https://easyeyes.app
EVIDENCE_DIR="$(mktemp -d)"

curl --fail --silent --show-error \
  --dump-header "$EVIDENCE_DIR/index.headers" \
  --output "$EVIDENCE_DIR/index.html" \
  "$ORIGIN/compiler/"
curl --fail --silent --show-error \
  --dump-header "$EVIDENCE_DIR/manifest.headers" \
  --output "$EVIDENCE_DIR/deployment.json" \
  "$ORIGIN/compiler/deployment.json"

BUNDLE_PATH="$(sed -nE \
  's#.*<script src="(/compiler/dist/main\.[A-Za-z0-9_-]+\.js)"></script>.*#\1#p' \
  "$EVIDENCE_DIR/index.html" | head -n 1)"
test -n "$BUNDLE_PATH"

curl --fail --silent --show-error \
  --dump-header "$EVIDENCE_DIR/bundle.headers" \
  --output "$EVIDENCE_DIR/bundle.js" \
  "$ORIGIN$BUNDLE_PATH"
```

Record the artifact values and compare them with the production deploy:

```sh
sed -nE \
  's#.*<meta name="easyeyes-deployment-id" content="([^"]+)">.*#HTML deployment ID: \1#p' \
  "$EVIDENCE_DIR/index.html"
printf 'Manifest: '
tr -d '\n' < "$EVIDENCE_DIR/deployment.json"
printf '\nBundle path: %s\n' "$BUNDLE_PATH"
grep --fixed-strings --quiet -- "<new-id>" "$EVIDENCE_DIR/bundle.js"
printf 'Bundle contains deployment ID: %s\n' "$?"
```

Replace `<new-id>` before running the bundle check. An exit status of `0`
means the bundle contains the ID. HTML, manifest, bundle, and Firebase must all
contain the new production deployment ID.

## Canonical cache headers

Capture the complete header files above with the smoke evidence. Inspect the
effective `cache-control` headers:

```sh
grep -iE '^(HTTP/|cache-control:|netlify-cdn-cache-control:|age:|etag:)' \
  "$EVIDENCE_DIR/index.headers"
grep -iE '^(HTTP/|cache-control:|netlify-cdn-cache-control:|age:|etag:)' \
  "$EVIDENCE_DIR/manifest.headers"
grep -iE '^(HTTP/|cache-control:|netlify-cdn-cache-control:|age:|etag:)' \
  "$EVIDENCE_DIR/bundle.headers"
```

Pass only when the canonical responses show:

- `/compiler/`: `public, max-age=0, must-revalidate`
- `/compiler/deployment.json`: `public, max-age=0, must-revalidate`
- The hashed bundle: `public, max-age=31536000, immutable`

Header names and directive whitespace are case-insensitive. Record both
browser-facing and CDN-specific headers when both are present.

## Preview or branch notification filter

Record the production Firebase value, trigger an authorized preview or branch
deploy, and wait for its deploy event to finish. Record:

- Preview or branch deployment ID: `<preview-id>`
- Deploy context: `<deploy-preview-or-branch-deploy>`
- Event completed at (UTC): `<timestamp>`
- Firebase value before: `<production-record>`
- Firebase value after: `<production-record>`

Pass only when the record is byte-for-byte unchanged and still identifies the
production deployment. Do not treat an absent event or failed preview build as
proof that filtering works.

## Already-open tab

In the first old tab:

1. Keep the tab visible after the production deploy completes.
2. Observe the stale warning and record its text and publication time.
3. Record whether refresh was manual or automatic and the attempt number.
4. Confirm replacement navigation preserves the existing query parameters and
   adds `compilerDeploymentId=<new-id>`.
5. After navigation, read the meta element again and record the loaded ID.
6. Confirm the loaded ID equals the manifest and production deployment ID.

Record:

- Running ID before notification: `<old-id>`
- Warning observed at (UTC): `<timestamp>`
- Warning text/publication time: `<text>`
- Refresh mode and attempt: `<manual-or-automatic>`
- URL after replacement, with sensitive query values redacted: `<url>`
- Running ID after replacement: `<new-id>`
- Result: `<pass-or-fail>`

## Backgrounded old tab

In the second old tab:

1. Keep it backgrounded until the production deploy and notification finish.
2. Return to the tab and record the time it becomes visible.
3. Observe the stale warning caused by the visibility-triggered manifest check.
4. Complete or observe refresh, then read the meta deployment ID again.
5. Confirm the loaded ID equals the manifest and production deployment ID.

Record:

- Running ID before returning: `<old-id>`
- Returned to visible at (UTC): `<timestamp>`
- Warning observed: `<yes-or-no>`
- Refresh mode and attempt: `<manual-or-automatic>`
- Running ID after replacement: `<new-id>`
- Result: `<pass-or-fail>`

## Result record

Attach or link the raw header files and relevant redacted screenshots. Do not
include Firebase credentials, signed URLs, participant data, study data, or
sensitive query values.

- Production identity agreement: `<pass-or-fail>`
- Exact `publishedAt` retained: `<pass-or-fail>`
- HTML and manifest revalidate: `<pass-or-fail>`
- Hashed bundle caches immutably: `<pass-or-fail>`
- Preview or branch notification filtered: `<pass-or-fail>`
- Already-open tab recovered: `<pass-or-fail>`
- Backgrounded tab recovered: `<pass-or-fail>`
- Check completed at (UTC): `<timestamp>`
- Overall result: `<pass-or-fail>`

Any failed item fails the smoke check. Preserve the evidence, open a follow-up
issue, and do not mark the freshness task complete.

## Rollback

If refresh behavior is unsafe, restore the last known-good website production
deployment (including its Threshold Scientist submodule pointer). Disable or
remove the compiler deployment-notification event function before another
production deploy if notifications themselves are causing unsafe refreshes.
After rollback, repeat the identity and canonical-header checks and confirm the
Firebase production record describes the intended live deployment before
re-enabling notifications.
