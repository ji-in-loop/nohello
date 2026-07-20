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

### One-time setup

1. Create an npm **automation token** with publish rights for the `@nohello` scope: on
   npmjs.com, Account → Access Tokens → Generate New Token → Automation.
2. Add it as a repository secret without ever pasting it into chat or shell history where it'd
   be logged — run this yourself and paste the token at the interactive prompt:
   ```
   gh secret set NPM_TOKEN --repo ji-in-loop/nohello
   ```

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
