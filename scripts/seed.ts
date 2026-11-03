// Recreates the local demo database with synthetic data: npm run seed
import fs from "node:fs";
import path from "node:path";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "rehab-proms.db");
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
process.env.DEMO_AUTO_SEED = "1";

import("../src/lib/db").then(({ getDb }) => {
  const db = getDb();
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  console.log(`Seeded ${file}: ${count("patients")} patients, ${count("responses")} responses, ${count("alerts")} alerts`);
});
