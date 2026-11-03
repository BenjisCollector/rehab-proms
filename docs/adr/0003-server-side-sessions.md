# 3. Server-side sessions instead of a framework auth library or JWTs

Date: 2026-11-03. Status: Accepted for the demo.

## Context
The app needs two roles, seeded demo users and object-level authorisation. NHS deployments would use NHS login for patients and NHS CIS2 for staff, both OpenID Connect.

## Decision
Use opaque random session IDs in an `HttpOnly` cookie, with sessions stored in the database, scrypt password hashes and per-account lockout. Keep the authorisation rule (`canAccessPatient`) in one function used by every route.

## Consequences
- Sessions can be revoked instantly (sign-out deletes the row), unlike stateless JWTs.
- Small enough to read and test completely (`tests/repo-auth.test.ts`).
- Password login is a stand-in. Replacing it with an OIDC provider changes `login` and `startSession`, not the authorisation model.
