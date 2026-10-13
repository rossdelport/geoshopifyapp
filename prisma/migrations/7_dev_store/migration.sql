-- A Shopify development (test) store: it only ever gets test charges, so it uses the app free (App Store reviewers
-- test on these). geo schema only.
ALTER TABLE "Shop" ADD COLUMN "devStore" BOOLEAN NOT NULL DEFAULT false;
