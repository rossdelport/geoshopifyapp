// The free check's page fetcher (http-get.server.ts) against a real local server: it connects only
// where its lookup says, unzips bodies, hands back redirects, and stops on time.

import { createServer, type Server } from "node:http";
import type { AddressInfo, LookupFunction } from "node:net";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { httpGet, type RawResponse } from "../app/lib/http-get.server";

let server: Server;
let port = 0;
const seen: string[] = [];

// "shop.test" doesn't exist: reaching the server proves the connection used our lookup.
const toLocal: LookupFunction = (_host, opts, cb) =>
  opts.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4);
const refuse: LookupFunction = (_host, _opts, cb) => cb(new Error("private address"), "", 4);

const get = (path: string, lookup = toLocal, signal = AbortSignal.timeout(5000)) =>
  httpGet(new URL(`http://shop.test:${port}${path}`), { headers: { accept: "text/html" }, signal, lookup });

async function text(res: RawResponse) {
  const chunks: Uint8Array[] = [];
  for await (const c of res.body) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push(req.url ?? "");
    if (req.url === "/gzip") {
      res.writeHead(200, { "content-encoding": "gzip" });
      res.end(gzipSync("hello from gzip"));
    } else if (req.url === "/br") {
      res.writeHead(200, { "content-encoding": "br" });
      res.end(brotliCompressSync("hello from brotli"));
    } else if (req.url === "/moved") {
      res.writeHead(301, { location: "/gzip" });
      res.end();
    } else if (req.url === "/hang") {
      res.writeHead(200);
      res.write("partial");
    } else {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<h1>${req.headers.host}</h1>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe("httpGet", () => {
  it("connects to the address its lookup gives, keeping the real host name", async () => {
    const res = await get("/page");
    expect(res.status).toBe(200);
    expect(await text(res)).toBe(`<h1>shop.test:${port}</h1>`);
  });

  it("never connects when the lookup refuses", async () => {
    const before = seen.length;
    await expect(get("/page", refuse)).rejects.toThrow(/private address/);
    expect(seen.length).toBe(before);
  });

  it("unzips gzip and brotli bodies", async () => {
    expect(await text(await get("/gzip"))).toBe("hello from gzip");
    expect(await text(await get("/br"))).toBe("hello from brotli");
  });

  it("hands redirects back instead of following them", async () => {
    const res = await get("/moved");
    expect(res.status).toBe(301);
    expect(res.location).toBe("/gzip");
    res.cancel();
  });

  it("stops a page that never finishes when time runs out", async () => {
    const res = await get("/hang", toLocal, AbortSignal.timeout(300));
    await expect(text(res)).rejects.toThrow();
  });
});
