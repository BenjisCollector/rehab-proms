# 1. Store PROM answers as FHIR R4 QuestionnaireResponse

Date: 2026-11-03. Status: Accepted.

## Context
PROM data has to reach other NHS and research systems. Inventing a private schema and mapping later tends to lose detail (answer codes, which version of the instrument was used).

## Decision
Render forms from the official FHIR `Questionnaire` for each instrument and store each submission as a validated FHIR R4 `QuestionnaireResponse` JSON document. Keep a few derived columns (`total`, `band`, `authored`) alongside it for querying. Derive score `Observation`s on export instead of storing them.

## Consequences
- Export is close to free and loses nothing; the stored resource is the record.
- Scoring weights come from `ordinalValue` in the Questionnaire, so there is one source of truth.
- Derived columns could drift from the JSON; they are written in the same transaction from the same scoring call, and tests cover it.
- Adding an instrument means vendoring its Questionnaire and adding a small config entry, not new tables.
