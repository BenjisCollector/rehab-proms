import { audit, recentAudit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const user = await requireRole("clinician");
  audit({ id: user.id, role: user.role }, "read", "AuditEvent", null);
  const rows = recentAudit();
  return (
    <>
      <h1>Audit log</h1>
      <p>The last 200 access events, newest first. The database rejects edits and deletes to this table.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Time (UTC)</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Resource</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.at.replace("T", " ").slice(0, 19)}</td>
                <td>{r.actor_id ? `${r.actor_id} (${r.actor_role})` : "anonymous"}</td>
                <td>{r.action}</td>
                <td>
                  {r.resource_type}
                  {r.resource_id ? `/${r.resource_id}` : ""}
                </td>
                <td>{r.outcome === "success" ? r.outcome : <strong>{r.outcome}</strong>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
