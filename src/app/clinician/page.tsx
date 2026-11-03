import Link from "next/link";
import { audit } from "@/lib/audit";
import { caseload } from "@/lib/repo";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Caseload" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function Caseload() {
  const user = await requireRole("clinician");
  const rows = caseload();
  audit({ id: user.id, role: user.role }, "list", "Patient", null);

  return (
    <>
      <h1>Caseload</h1>
      <p>Patients with unreviewed alerts are listed first.</p>
      <div className="table-wrap">
        <table>
          <caption className="visually-hidden">Patients, ordered by unreviewed alerts</caption>
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Demo ID</th>
              <th scope="col">Alerts to review</th>
              <th scope="col" className="num">Latest PHQ-9</th>
              <th scope="col" className="num">Latest GAD-7</th>
              <th scope="col">Last answered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <th scope="row">
                  <Link href={`/clinician/patients/${p.id}`}>
                    {p.family}, {p.given}
                  </Link>
                </th>
                <td>{p.demo_id}</td>
                <td>
                  {p.open_urgent > 0 && <span className="tag tag-urgent">{p.open_urgent} urgent</span>}{" "}
                  {p.open_high > 0 && <span className="tag tag-high">{p.open_high} high</span>}
                  {p.open_urgent + p.open_high === 0 && <span className="muted">None</span>}
                </td>
                <td className="num">{p.last_phq9 ?? "-"}</td>
                <td className="num">{p.last_gad7 ?? "-"}</td>
                <td>{p.last_authored ? dateFmt.format(new Date(p.last_authored)) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
