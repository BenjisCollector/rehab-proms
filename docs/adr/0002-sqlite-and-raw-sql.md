# 2. SQLite with parameterised SQL, no ORM

Date: 2026-11-03. Status: Accepted for the demo.

## Context
The demo has to run with three commands and no Docker. The data model is five small tables.

## Decision
Use SQLite through `better-sqlite3` with hand-written, parameterised SQL. Put integrity rules in the schema: `CHECK` constraints for roles and instruments, foreign keys, and triggers that make `audit_log` append-only.

## Consequences
- Zero setup and fast tests (each integration test gets an in-memory database).
- Constraints hold even if application code has a bug.
- Not suitable for multiple app instances. Moving to PostgreSQL is a contained change because all SQL lives in `src/lib/repo.ts`, `src/lib/audit.ts` and `src/lib/auth-core.ts`; this would be the first step before any real deployment.
- `better-sqlite3` is pinned to 12.x: 13.0.3 crashed natively on Node 22.11 in testing.
