import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { type EntryContext } from "react-router";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import { startWorker } from "./lib/worker.server";
import { env, isProd } from "./lib/env.server";
import db from "./db.server";

// Background jobs run in the same process as the web server.
if (env.runWorker) startWorker();

// Once at start-up: open a database connection before the first visitor needs it, and log how long one round trip
// to the database takes from this server (pages make a few of these, so it's the number that sets their speed).
if (isProd) {
  setTimeout(async () => {
    const times: number[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const t = Date.now();
        await db.$queryRaw`SELECT 1`;
        times.push(Date.now() - t);
      }
      console.log(`[db] round trips from here: ${times.join(", ")} ms`);
    } catch (err) {
      console.error(`[db] start-up check failed: ${(err as Error).message}`);
    }
  }, 3000);
}

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      }
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}
