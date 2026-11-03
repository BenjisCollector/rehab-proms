# Questionnaire provenance

| File | Instrument | Source | Changes made |
|---|---|---|---|
| `src/questionnaires/phq-9.json` | PHQ-9, LOINC 44249-1 | `https://lforms-fhir.nlm.nih.gov/baseR4/Questionnaire/44249-1` (US National Library of Medicine LHC-Forms FHIR server, generated from LOINC) | Removed server `meta`; set `id` to `phq-9`; set `url` to the canonical `http://loinc.org/q/44249-1` (the source URL was malformed) |
| `src/questionnaires/gad-7.json` | GAD-7, LOINC 69737-5 | `https://lforms-fhir.nlm.nih.gov/baseR4/Questionnaire/69737-5` | Same as above, canonical `http://loinc.org/q/69737-5` |

Item text, answer codes (LOINC answer lists) and `ordinalValue` scoring weights are used unchanged. Both resources have `status: draft` at source and that is kept.

Only freely usable instruments are included. Instruments that need a licence (for example EQ-5D or C19-YRS) are out of scope.
