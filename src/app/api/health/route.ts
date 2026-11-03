import { getDb } from "@/lib/db";

/** Liveness and database readiness for load balancers. Reveals nothing about the data. */
export function GET() {
  try {
    getDb().prepare("SELECT 1 FROM users LIMIT 1").get();
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
