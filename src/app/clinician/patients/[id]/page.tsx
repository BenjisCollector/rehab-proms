import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrendChart } from "@/components/trend-chart";
import { audit } from "@/lib/audit";
import { INSTRUMENTS } from "@/lib/fhir/questionnaires";
import { PHQ9_ITEM9_LINK_ID } from "@/lib/fhir/scoring";
import type { QuestionnaireResponse } from "@/lib/fhir/types";
import { alertsFor, getPatient, markAlertReviewed, responsesFor } from "@/lib/repo";
import { currentUser, requireRole } from "@/lib/session";

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

async function reviewAlert(patientId: string, formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user || user.role !== "clinician") redirect("/login");
  const alertId = Number(formData.get("alertId"));
  const ok = Number.isInteger(alertId) && markAlertReviewed(alertId, patientId, user.id);
  audit({ id: user.id, role: user.role }, "update", "Flag", String(alertId), ok ? "success" : "failure");
  redirect(`/clinician/patients/${patientId}`);
}

function item9(r: { resource_json: string }): string {
  const qr = JSON.parse(r.resource_json) as QuestionnaireResponse;
  return qr.item.find((i) => i.linkId === PHQ9_ITEM9_LINK_ID)?.answer?.[0]?.valueCoding?.display ?? "-";
}

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("clinician");
  const { id } = await params;
  const patient = getPatient(id);
  if (!patient) {
    audit({ id: user.id, role: user.role }, "read", "Patient", id, "failure");
    notFound();
  }
  audit({ id: user.id, role: user.role }, "read", "Patient", id);

  const responses = responsesFor(id);
  const alerts = alertsFor(id);
  const open = alerts.filter((a) => !a.reviewed_at);
  const review = reviewAlert.bind(null, id);

  return (
    <>
      <p>
        <Link href="/clinician" className="back-link">
          Back to caseload
        </Link>
      </p>
      <h1>
        {patient.given} {patient.family} <span className="muted h-sub">{patient.demo_id}</span>
      </h1>

      <section aria-labelledby="alerts-heading">
        <h2 id="alerts-heading">Alerts to review ({open.length})</h2>
        {open.length === 0 ? (
          <p>No unreviewed alerts.</p>
        ) : (
          <ul className="alerts">
            {open.map((a) => (
              <li key={a.id} className={`alert alert-${a.severity}`}>
                <p>
                  <span className={`tag tag-${a.severity}`}>{a.severity}</span> {a.message}
                </p>
                <p className="small">Raised {dateFmt.format(new Date(a.created_at))}</p>
                <form action={review}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <button type="submit" className="button button-secondary">
                    Mark as reviewed
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="trends-heading">
        <h2 id="trends-heading">Score trends</h2>
        <div className="charts">
          {Object.values(INSTRUMENTS).map((inst) => (
            <TrendChart
              key={inst.id}
              instrument={inst}
              points={responses.filter((r) => r.instrument === inst.id).map((r) => ({ date: r.authored, total: r.total }))}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">All answers</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Questionnaire</th>
                <th scope="col" className="num">Total</th>
                <th scope="col">Severity band</th>
                <th scope="col">PHQ-9 item 9</th>
              </tr>
            </thead>
            <tbody>
              {[...responses].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{dateFmt.format(new Date(r.authored))}</td>
                  <td>{INSTRUMENTS[r.instrument].shortName}</td>
                  <td className="num">{r.total}</td>
                  <td>{r.band}</td>
                  <td>{r.instrument === "phq-9" ? item9(r) : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Interoperability</h2>
        <p>
          <a href={`/api/fhir/Patient/${id}/$everything`}>Download FHIR R4 Bundle (Patient/$everything)</a>
        </p>
      </section>
    </>
  );
}
