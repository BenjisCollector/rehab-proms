import Link from "next/link";
import { audit } from "@/lib/audit";
import { INSTRUMENTS, answerableItems, getInstrument } from "@/lib/fhir/questionnaires";
import { alertsFor, responsesFor } from "@/lib/repo";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Your questionnaires" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });

export default async function PatientHome({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const user = await requireRole("patient");
  const patientId = user.patient_id!;
  const responses = responsesFor(patientId).reverse();
  audit({ id: user.id, role: user.role }, "read", "Patient", patientId);

  const submitted = getInstrument((await searchParams).submitted ?? "");
  // Signposting is driven by stored data, not the URL, so it cannot be skipped or spoofed (H-01).
  const latest = responses[0];
  const urgent = submitted && latest && alertsFor(patientId).some((a) => a.response_id === latest.id && a.severity === "urgent");

  return (
    <div className="narrow">
      {submitted && (
        <div className="confirmation" role="status">
          <h2>Thank you, your {submitted.shortName} answers have been sent</h2>
          <p>Your care team will look at your answers. They are not checked straight away.</p>
        </div>
      )}
      {urgent && (
        <div className="urgent-help" role="alert">
          <h2>If you need help now</h2>
          <p>Some of your answers suggest you may be having thoughts of hurting yourself. Please do not wait for us to contact you.</p>
          <ul>
            <li>If your life is at risk right now, call <strong>999</strong> or go to A&amp;E.</li>
            <li>For urgent help, call <strong>NHS 111</strong> and choose the mental health option.</li>
            <li>To talk to someone any time, call Samaritans free on <strong>116 123</strong>.</li>
          </ul>
        </div>
      )}

      <h1>Your questionnaires</h1>
      <p>Your care team has asked you to fill these in every two weeks. Each one takes about 3 minutes.</p>
      <ul className="cards">
        {Object.values(INSTRUMENTS).map((inst) => (
          <li key={inst.id} className="card">
            <h2>{inst.shortName}</h2>
            <p>{inst.topic}, {answerableItems(inst.questionnaire).length} questions</p>
            <Link className="button" href={`/patient/${inst.id}`}>
              Start {inst.shortName}
            </Link>
          </li>
        ))}
      </ul>

      <h2>What you have sent</h2>
      {responses.length === 0 ? (
        <p>You have not sent any answers yet.</p>
      ) : (
        <table>
          <caption className="visually-hidden">Questionnaires you have sent, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Questionnaire</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id}>
                <td>{dateFmt.format(new Date(r.authored))}</td>
                <td>{INSTRUMENTS[r.instrument].shortName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
