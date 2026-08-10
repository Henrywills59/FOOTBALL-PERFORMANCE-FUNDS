# Football Performance Fund Deployment Package - Superseded

This historical deployment note is superseded by the production hardening work
that protects diagnostics and bootstrap operations.

Current posture:

- Public health remains available at `GET /health` and `GET /api/health`.
- Database health remains isolated at `GET /health/db` and `GET /api/health/db`.
- Safe configuration status is available only to authenticated administrators at
  `GET /api/debug/config`.
- Production login-stage diagnostics are no longer publicly available.
- Default administrator bootstrap is token-gated, allowlist-gated, and closes
  automatically after an active administrator exists.
- Money operations are governed by persisted season launch controls, not by
  ad-hoc deployment instructions.

Operational credentials and production secrets must never be written into
documentation, terminal transcripts, deployment reports, or frontend bundles.
