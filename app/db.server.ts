import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

/** Always encrypt the database connection, except for a local test database. */
export function encryptedUrl(url: string | undefined) {
  if (!url || /[?&]sslmode=/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

const make = () => new PrismaClient({ datasourceUrl: encryptedUrl(process.env.DATABASE_URL) });

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = make();
  }
}

const prisma = global.prismaGlobal ?? make();

export default prisma;
