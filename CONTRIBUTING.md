# Contributing

This guide is written for anyone contributing code, including external developers and suppliers. It describes how a contribution is assured before it is merged.

## Workflow

1. Open an issue or reference an agreed requirement before starting work.
2. Branch from `main`, keep pull requests small (ideally under 400 changed lines) and focused on one change.
3. Run `npm run lint && npm run typecheck && npm test && npm run e2e` locally.
4. Open a pull request using the template. CI must be green before review.
5. At least one approving review from a maintainer. Changes to clinical logic need a second reviewer and a hazard log update.
6. Squash-merge. `main` is always releasable.

Commit messages: imperative mood, short subject line, explain *why* in the body.

## Code review checklist

Reviewers work through this list; authors should self-review against it first.

**Correctness and clinical safety**
- [ ] Does the change touch `src/lib/fhir/`, `src/questionnaires/`, alert rules or anything a clinician acts on? If so, are the affected hazards in `docs/clinical-safety/hazard-log.md` referenced and updated?
- [ ] Are scoring or threshold changes covered by boundary tests that were written from the instrument documentation, not from the code?
- [ ] Can a partial or invalid input ever produce a result that looks complete?

**Security and data protection**
- [ ] Every new page, Server Action and route checks the role server-side and applies `canAccessPatient` for patient-scoped data.
- [ ] Every new read or write of patient data writes an audit event.
- [ ] No patient data, answers or secrets in logs, errors, URLs or test fixtures. Test data is obviously synthetic.
- [ ] SQL is parameterised. No `dangerouslySetInnerHTML`.
- [ ] New dependencies are justified, maintained, licence-compatible (MIT, Apache-2.0, BSD, ISC) and pinned by the lockfile.

**Interoperability**
- [ ] FHIR resources still validate (`validateQuestionnaireResponse`), use standard code systems, and keep `derivedFrom` links.

**Accessibility**
- [ ] axe checks pass in CI for any new page or state.
- [ ] Manually: keyboard-only journey works, focus is visible and moves sensibly, page works at 320px width and 200% zoom, form errors are announced, nothing relies on colour alone.

**Maintainability**
- [ ] Code is readable without the PR description. Names say what things are.
- [ ] Docs (README, ADRs) updated if behaviour or architecture changed.
- [ ] If AI tools generated a significant part of the change, the author says so in the PR and has read every line.

## Third-party and supplier contributions

- All work happens in repositories owned by the product organisation, so source code, history and documentation are retained by it.
- Suppliers work through pull requests like everyone else; no direct pushes to `main` (protect the branch).
- Acceptance is evidence-based: green CI, completed checklist, and a demo against the agreed acceptance criteria.
- Handover is part of done: an ADR for any architectural decision and a README section for anything an operator needs.
