import { audit } from "@/lib/audit";
import { canAccessPatient } from "@/lib/auth-core";
import { everythingBundle } from "@/lib/fhir/export";
import { getPatient, responsesFor } from "@/lib/repo";
import { currentUser } from "@/lib/session";

const FHIR_JSON = "application/fhir+json; charset=utf-8";

function outcome(status: number, code: string, diagnostics: string) {
  return Response.json(
    { resourceType: "OperationOutcome", issue: [{ severity: "error", code, diagnostics }] },
    { status, headers: { "content-type": FHIR_JSON, "cache-control": "no-store" } },
  );
}

/** GET /api/fhir/Patient/{id}/$everything: the patient's record as a FHIR R4 searchset Bundle. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return outcome(401, "login", "Authentication required");

  const actor = { id: user.id, role: user.role };
  // Same response for "not yours" and "does not exist" so IDs cannot be probed (T-I2).
  if (!canAccessPatient(user, id)) {
    audit(actor, "export", "Patient", id, "denied");
    return outcome(404, "not-found", `Patient/${id} not found`);
  }
  const patient = getPatient(id);
  if (!patient) {
    audit(actor, "export", "Patient", id, "failure");
    return outcome(404, "not-found", `Patient/${id} not found`);
  }

  audit(actor, "export", "Patient", id);
  const base = new URL("/api/fhir", request.url).toString();
  return Response.json(everythingBundle(patient, responsesFor(id), base), {
    headers: { "content-type": FHIR_JSON, "cache-control": "no-store" },
  });
}
