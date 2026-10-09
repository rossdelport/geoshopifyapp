import db from "../db.server";

// Railway health check: the server is up and the database answers.
export const loader = async () => {
  try {
    await db.$queryRaw`SELECT 1`;
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("database unavailable", { status: 503 });
  }
};
