# Data protection note: data flows (DPIA-style)

This is the data-flow and minimisation part of a Data Protection Impact Assessment, written for the demo. A real deployment would need a full DPIA agreed with the controller's Data Protection Officer and Caldicott Guardian.

## Data processed

| Data | Category | Where | Why |
|---|---|---|---|
| Name, date of birth, local identifier (NHS number optional, unused in demo) | Personal data | `patients` | Identify the right patient (hazard H-05) |
| PHQ-9 and GAD-7 answers, totals, severity band | Special category: health (UK GDPR Art. 9) | `responses` (FHIR JSON) | Direct care: monitoring between appointments |
| Alerts and who reviewed them | Health data plus staff identity | `alerts` | Clinical follow-up and accountability |
| Email, password hash, role | Personal data | `users` | Authentication |
| Session ID and expiry | Personal data (pseudonymous) | `sessions` | Keep users signed in |
| Who accessed which record, when, outcome | Personal data | `audit_log` | Accountability, breach investigation |

Likely lawful bases for an NHS direct-care deployment: Art. 6(1)(e) public task and Art. 9(2)(h) health or social care, with the common law duty of confidentiality met by implied consent for direct care. This must be confirmed by the controller.

## Flows

1. Patient browser to server over HTTPS: answer codes only (no free text).
2. Server to database: validated FHIR `QuestionnaireResponse`, derived total and alerts, written in one transaction.
3. Clinician browser from server: caseload and patient pages, each read audited.
4. Export: authenticated `GET /api/fhir/Patient/{id}/$everything` returns a FHIR Bundle to a clinician or to the patient themselves; audited as `export`.
5. Optional onward flow via proms-fhir-bridge to another FHIR server (separate project, separate assessment needed).

## Minimisation and safeguards

- No free-text fields anywhere, which removes a common source of unexpected sensitive data.
- Audit log never stores clinical content; logs and error messages do not include answers.
- Patients see only their own submissions, and not their scores (hazard H-07).
- Synthetic data only in this repository; exported patients are tagged `HTEST`.

## Not yet addressed (would be required)

Retention and deletion schedule (for example in line with the NHS Records Management Code of Practice), subject access and rectification workflow, consent and privacy notice screens, UK-hosted infrastructure with encryption at rest, backups, DSPT submission, data processing agreements with any third-party developer or host, and breach notification procedure.
