import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { creatorFailureSchema, toCaptureException } from "./error_grouping.js";
import { InfraiError, infrai } from "./infrai_errors.js";

type Capture = typeof infrai.errors.capture;

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function captureCreatorFailure(raw: unknown, capture: Capture = infrai.errors.capture) {
  const failure = creatorFailureSchema.parse(raw);
  const exception = toCaptureException(failure);
  const captured = await capture(exception, `creator-error:${failure.eventId}`);
  return { accepted: true as const, eventId: failure.eventId, group: exception.fingerprint, captured };
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-errors") {
    reply(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const result = await captureCreatorFailure(await readJson(request));
    reply(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      reply(response, 400, { error: "Invalid creator failure payload" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      reply(response, status, { error: error.message, code: error.code });
      return;
    }
    reply(response, 500, { error: "Could not capture creator failure" });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(3000, () => console.log("Creator error route listening on http://localhost:3000"));
}
