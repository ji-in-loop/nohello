# Security Policy

## Supported versions

The latest published minor version of each `@nohello/*` package receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's private
vulnerability reporting on this repository (Security tab → "Report a vulnerability"), or email
balajikumar.murugan@gmail.com with details and reproduction steps.

You can expect an acknowledgment within a few days. Please allow a reasonable window for a fix
to be released before public disclosure.

## Scope notes

- The bundled examples are demos: the generic-webhook example's `/inbound` endpoint is
  intentionally unauthenticated and documented as such — reports about that are expected
  behavior, not vulnerabilities.
- Real deployments must add platform-appropriate request verification (Slack signing secrets,
  Bot Framework auth, HMAC on custom webhooks) as described in each adapter's README.
