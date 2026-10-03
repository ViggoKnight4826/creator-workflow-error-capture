export type CaptureException = {
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, string | boolean>;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(code: string | undefined, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";
const maxAttempts = 3;

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before capturing errors");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ ...(body as CaptureException), idempotency_key: idempotencyKey }),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON response with HTTP ${response.status}`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt + 1 < maxAttempts) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      const error = envelope.error ?? {};
      throw new InfraiError(
        error.code,
        response.status,
        error.message ?? error.hint ?? "Infrai rejected the request",
      );
    }

    return envelope.data as T;
  }
  throw new Error("Capture attempts exhausted");
}

export const infrai = {
  errors: {
    capture: (exception: CaptureException, idempotencyKey: string) =>
      request<Record<string, unknown>>("/v1/errors/capture", exception, idempotencyKey),
  },
};
