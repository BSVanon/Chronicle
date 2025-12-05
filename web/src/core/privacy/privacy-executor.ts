import type {
  PrivacyShieldBatch,
  PrivacyShieldPlan,
} from "./privacy-shield";

export type ShieldedExecutorHttpClient = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type ShieldedExecutorOptions = {
  /**
   * Optional timeout for each HTTP request in milliseconds.
   * If omitted or non-positive, no explicit timeout is applied.
   */
  requestTimeoutMs?: number;
};

export type ShieldedQueryResult = {
  id: string;
  kind: string;
  target: string;
  isChaff: boolean;
  ok: boolean;
  status?: number;
  error?: string;
  body?: unknown;
};

export type ShieldedBatchResult = {
  sendAtMs: number;
  endpoint: string;
  results: ShieldedQueryResult[];
};

export type ShieldedExecutionResult = {
  plan: PrivacyShieldPlan;
  batches: ShieldedBatchResult[];
};

async function sleepUntil(targetMs: number): Promise<void> {
  const now = Date.now();
  const delay = targetMs - now;
  if (delay <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchWithOptionalTimeout(
  http: ShieldedExecutorHttpClient,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number | undefined,
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return http.fetch(input, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await http.fetch(input, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

export async function executePrivacyShieldPlan(
  plan: PrivacyShieldPlan,
  http: ShieldedExecutorHttpClient,
  options?: ShieldedExecutorOptions,
): Promise<ShieldedExecutionResult> {
  const batches: ShieldedBatchResult[] = [];
  const timeoutMs = options?.requestTimeoutMs;

  for (const batch of plan.batches) {
    await sleepUntil(batch.sendAtMs);

    const url = batch.endpoint;

    const queryResults: ShieldedQueryResult[] = [];

    for (const query of batch.queries) {
      const body = JSON.stringify({
        kind: query.kind,
        target: query.target,
        meta: query.meta ?? {},
      });

      try {
        const response = await fetchWithOptionalTimeout(http, url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        }, timeoutMs);

        let parsed: unknown = null;
        try {
          parsed = await response.json();
        } catch {
          parsed = null;
        }

        queryResults.push({
          id: query.id,
          kind: query.kind,
          target: query.target,
          isChaff: query.isChaff,
          ok: response.ok,
          status: response.status,
          body: parsed,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        queryResults.push({
          id: query.id,
          kind: query.kind,
          target: query.target,
          isChaff: query.isChaff,
          ok: false,
          error: message,
        });
      }
    }

    batches.push({
      sendAtMs: batch.sendAtMs,
      endpoint: batch.endpoint,
      results: queryResults,
    });
  }

  return { plan, batches };
}
