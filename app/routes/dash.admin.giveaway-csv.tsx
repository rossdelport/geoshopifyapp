import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";

// GET /dash/admin/giveaway-csv: every giveaway entry as a spreadsheet file, for Ross to follow up (Admin > Giveaway).

const cell = (v: string | null) => {
  const s = v ?? "";
  // Quoted, and a leading = + - @ made harmless, so a spreadsheet never runs an entry as a formula.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const rows = await db.giveawayEntry.findMany({
    orderBy: { createdAt: "asc" },
  });
  const lines = [
    ["#", "Store", "Name", "Email", "Phone", "Sells a month", "UTM source", "UTM campaign", "UTM content", "Came from", "Entered (UTC)", "Drawn (UTC)"]
      .map(cell)
      .join(","),
    ...rows.map((r, i) =>
      [
        String(i + 1),
        r.store,
        r.name,
        r.email,
        r.phone,
        r.sales,
        r.utmSource,
        r.utmCampaign,
        r.utmContent,
        r.referrer,
        r.createdAt.toISOString(),
        r.drawnAt?.toISOString() ?? null,
      ]
        .map(cell)
        .join(","),
    ),
  ];
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="geo-giveaway-entries.csv"',
      "Cache-Control": "no-store",
    },
  });
};
