// A plain GET for reading pages strangers paste (the free product check).
// The connection uses the `lookup` we pass, so it can only go to addresses that lookup approved:
// a second DNS answer can't send us somewhere else (DNS rebinding). Unzips gzip, deflate and br.

import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { LookupFunction } from "node:net";
import type { Readable } from "node:stream";

export interface RawResponse {
  status: number;
  location: string | null;
  body: AsyncIterable<Uint8Array>; // already unzipped
  cancel: () => void; // stop reading and close the connection
}

export function httpGet(
  url: URL,
  opts: { headers: Record<string, string>; signal: AbortSignal; lookup: LookupFunction },
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        headers: { ...opts.headers, "accept-encoding": "gzip, deflate, br" },
        lookup: opts.lookup,
        signal: opts.signal,
        agent: false, // a fresh connection every time, never a pooled one
      },
      (res) => {
        const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
        const unzip =
          encoding === "gzip" || encoding === "x-gzip" || encoding === "deflate"
            ? zlib.createUnzip()
            : encoding === "br"
              ? zlib.createBrotliDecompress()
              : null;
        let body: Readable = res;
        if (unzip) {
          res.on("error", (err) => unzip.destroy(err));
          body = res.pipe(unzip);
        }
        const location = res.headers.location;
        resolve({
          status: res.statusCode ?? 0,
          location: typeof location === "string" ? location : null,
          body,
          cancel: () => {
            body.destroy();
            req.destroy();
          },
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}
