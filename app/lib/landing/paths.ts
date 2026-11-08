// The service pages' addresses, one per page in LANDING_PAGES (app/lib/landing/pages.ts). app/routes.ts reads this list
// to give each one its own route (all served by app/landing/route.tsx), so it imports nothing.
// A test keeps it in step with LANDING_PAGES.
export const LANDING_SLUGS = ["seo-agency-perth"] as const;
