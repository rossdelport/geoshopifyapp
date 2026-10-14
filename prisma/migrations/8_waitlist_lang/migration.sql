-- The home page language a person joined the waitlist on (en, de, fr, nl, es, it). geo schema only.
ALTER TABLE "WaitlistSignup" ADD COLUMN "lang" TEXT;
