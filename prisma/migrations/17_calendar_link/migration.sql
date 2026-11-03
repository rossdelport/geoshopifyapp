-- Ross's Google Calendar for the book-a-call page (usegeo.app/book): one row, saved when he connects it in
-- Admin > System. See app/lib/booking.server.ts.
CREATE TABLE "CalendarLink" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarLink_pkey" PRIMARY KEY ("id")
);
