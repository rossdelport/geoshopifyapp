import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { signOutCookie } from "../lib/web-auth.server";

// POST /logout: sign this browser out of the GEO web app.
export const loader = () => redirect("/dash");
export const action = async ({ request }: ActionFunctionArgs) =>
  redirect("/", { headers: { "Set-Cookie": await signOutCookie(request) } });
