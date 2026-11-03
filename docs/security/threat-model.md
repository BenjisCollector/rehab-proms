# Threat model (STRIDE)

Scope: the Next.js app, its SQLite database and the FHIR export route, as in the architecture diagram in the README. Assets: patient identity and PROM answers (UK GDPR special category health data), user credentials, the audit trail.

Trust boundaries: browser to server (untrusted input), server to database file, server to any FHIR client.

| ID | Category | Threat | Mitigation | Status |
|---|---|---|---|---|
| T-S1 | Spoofing | Password guessing | scrypt hashes with per-user salt; lockout after 5 failures for 15 minutes; same error for unknown user and wrong password with equal hashing work | Mitigated |
| T-S2 | Spoofing | Session theft or fixation | 256-bit random session IDs stored server-side; `HttpOnly`, `SameSite=Lax`, `Secure` in production; new session on every login; sign-out deletes the server record | Mitigated |
| T-S3 | Spoofing | Account takeover without MFA | None in demo | Accepted for demo; NHS deployment would use NHS login (patients) and CIS2 (staff) |
| T-T1 | Tampering | Patient submits a crafted response (fake total, invalid codes) | Server rebuilds the resource from submitted codes only, recomputes the total, validates against the Questionnaire before storing | Mitigated |
| T-T2 | Tampering | Cross-site request forgery on Server Actions | Next.js Server Actions check the `Origin` header against the host; `SameSite=Lax` cookie | Mitigated |
| T-T3 | Tampering | SQL injection | Only parameterised statements; no string-built SQL with user input | Mitigated |
| T-R1 | Repudiation | User denies viewing or changing a record | Every list, read, create, update, export, login and logout is audited with actor, time and outcome; `audit_log` has database triggers rejecting UPDATE and DELETE | Mitigated (a database administrator could still drop the triggers: ship logs to write-once storage in production) |
| T-I1 | Information disclosure | Patient reads another patient's data by changing an ID | Object-level check `canAccessPatient` on every patient-scoped route | Mitigated, tested end to end |
| T-I2 | Information disclosure | ID enumeration via 403 vs 404 | Same 404 `OperationOutcome` for "not yours" and "does not exist" | Mitigated |
| T-I3 | Information disclosure | Clinical content leaking into logs | Audit rows hold IDs and actions only; no request bodies are logged | Mitigated |
| T-I4 | Information disclosure | Stored XSS through names | React escapes output; no `dangerouslySetInnerHTML`; no free-text patient input | Mitigated; CSP not yet configured (open) |
| T-I5 | Information disclosure | Database file copied from disk | Not encrypted at rest in the demo | Open: use encrypted volumes or a managed database with encryption in production |
| T-D1 | Denial of service | Login flooding | Per-account lockout only | Open: add IP rate limiting at the edge |
| T-E1 | Elevation of privilege | Patient calls a clinician Server Action directly | Every Server Action re-checks role server-side, not only the page that renders it | Mitigated |
| T-E2 | Elevation of privilege | Inconsistent role data | Schema `CHECK` that patients, and only patients, are linked to a patient record | Mitigated |

Security headers set in `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. `npm audit` and Dependabot cover dependency risk.
