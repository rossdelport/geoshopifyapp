// Runs before every test file. Tests must never reach the live database: Prisma falls back to the DATABASE_URL in
// .env when none is set, and .env holds the real one. So point it at nowhere unless a test file sets its own local
// test database (TEST_DATABASE_URL), and stop the run outright if a real (non-local) address slips through.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://none@127.0.0.1:1/none?schema=none";
if (!process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;
for (const key of ["DATABASE_URL", "DIRECT_URL", "TEST_DATABASE_URL"]) {
  const v = process.env[key];
  if (v && !/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(v)) throw new Error(`${key} must point at a local database in tests`);
}
