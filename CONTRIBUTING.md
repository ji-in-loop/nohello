# Contributing to nohello

Thanks for your interest! Contributions of all kinds are welcome — bug reports, new platform
adapters, tone templates, docs fixes.

## Getting started

```bash
git clone https://github.com/ji-in-loop/nohello.git
cd nohello
npm install
npm run build      # build all workspaces (required before typecheck — adapters resolve
npm run typecheck  # @nohello/core's types from its built dist/)
npm test           # vitest across all packages
npm run lint       # eslint, flat config at the repo root
```

Try your changes live without any chat platform account:

```bash
NOHELLO_WAIT_SECONDS=5 npm run start --workspace nohello-example-terminal-chat
```

## Pull requests

- Branch from `main`; PRs are required (direct pushes are blocked) and need one approving
  review plus green CI (Node 18/20/22).
- Match the existing code style — the linter and `tsconfig.base.json` settings are the source
  of truth, not personal preference.
- Add or update tests for behavior changes. The core engine's detection, timing, and
  race-safety behaviors are all pinned by tests; keep it that way.
- Keep the practical, no-overclaiming tone of the docs — e.g. the scaling section deliberately
  spells out what a shared store does *not* buy you. Honest docs are a feature of this project.

## Adding a platform adapter

The pattern is deliberately small — see [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md):
1. Feed every inbound message to `engine.ingestMessage()`.
2. Implement `onNudge` using the platform's send API (capture whatever context the platform
   needs to send a message outside an active turn — see `@nohello/teams` for that pattern).
3. Respect `nudge.mentionUser` in whatever form the platform supports.
4. Ship a README covering setup and a test suite against a faked platform client (see the
   existing adapters' `test/` directories for the shape).

## Reporting bugs

Open an issue with the message text that was mis-classified (redact anything private), your
config (waitSeconds/tone/etc.), and what you expected vs. got. For anything security-sensitive,
see [SECURITY.md](SECURITY.md) instead.
