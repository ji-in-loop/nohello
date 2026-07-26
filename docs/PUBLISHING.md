# Publishing

Two workflows in [`.github/workflows`](../.github/workflows) automate CI and npm releases. Both
are free to run: this is a public repo, so GitHub Actions minutes are unmetered on standard
hosted runners, and publishing public npm packages costs nothing.

## CI (`ci.yml`)

Runs on every push/PR to `main`: install, typecheck, build, and test every workspace across
Node 18/20/22. No secrets required — it works immediately with no setup.

## Publish (`publish.yml`)

Publishes `@nohello/core`, `@nohello/slack`, and `@nohello/teams` to the public npm registry.
Triggers:
- Publishing a **GitHub Release** (recommended — gives you a changelog and a tagged version).
- Manually via **Actions → Publish to npm → Run workflow** (optionally choosing an npm dist-tag,
  e.g. `next` for a prerelease).

### One-time setup — npm Trusted Publishing (OIDC), no stored token

Publishing uses npm Trusted Publishing: the workflow authenticates via a short-lived OIDC token
GitHub Actions generates for the run, not a stored secret. There is no `NPM_TOKEN` anymore —
`npm publish` picks up the OIDC token automatically once the package trusts this workflow.

Trusted Publishing can only be configured for a package that already exists on npm (all three
`@nohello/*` packages do, so this applies directly — a brand-new, never-published package would
need one manual `npm publish` from a maintainer's machine first). For each of the three packages,
on npmjs.com:

1. Go to the package's page → **Settings** → **Trusted Publisher**.
2. Add a GitHub Actions trusted publisher:
   - **Organization or user**: `ji-in-loop`
   - **Repository**: `nohello`
   - **Workflow filename**: `publish.yml` (filename only, not the full path)
   - **Environment**: leave blank unless a GitHub Environment is set up for this
3. Save. npm doesn't validate these fields when you save them — a typo only surfaces the next
   time you try to publish, so double-check the owner/repo/filename match exactly.

Requires npm CLI ≥11.5.1 and Node ≥22.14.0 — the workflow force-upgrades npm before publishing
rather than relying on whatever `actions/setup-node` bundled.

If you still have an `NPM_TOKEN` secret and a classic automation token from before this
migration, delete both now — neither is used by `publish.yml` anymore.

### Cutting a release

1. Bump `version` in the package(s) you're releasing (`packages/core/package.json`, etc.) —
   they can version independently.
2. Commit, push, and create a GitHub Release (tag it e.g. `core-v0.2.0`); publishing the release
   triggers the workflow.
3. Each package publishes with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
   attached, so consumers can verify the published artifact was built by this exact GitHub
   Actions run from this exact commit.

If a package's version already exists on npm, that publish step fails loudly rather than
silently no-op'ing — bump the version before releasing again.
