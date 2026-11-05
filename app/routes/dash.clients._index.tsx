import { redirect } from "react-router";

// /dash/clients on its own: the clients are on the hub's front page.
export const loader = () => redirect("/dash");
