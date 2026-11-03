/** Keep upstream deadlines active until the response body has been consumed. */
export class UpstreamTimeoutError extends Error {
  constructor(
    public readonly stage: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `${stage} 응답 시간 초과 (${Math.round(timeoutMs / 1000)}초). 잠시 후 다시 시도해 주세요.`,
    );
    this.name = "UpstreamTimeoutError";
  }
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof UpstreamTimeoutError) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    cause?: unknown;
  };
  return (
    value.name === "TimeoutError" ||
    value.code === "UND_ERR_CONNECT_TIMEOUT" ||
    (typeof value.message === "string" &&
      /aborted due to timeout|operation timed out/i.test(value.message)) ||
    (value.cause !== error &&
      value.cause != null &&
      isTimeoutError(value.cause))
  );
}

export async function withUpstreamTimeout<T>(
  stage: string,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await operation(signal);
  } catch (error) {
    if (signal.aborted || isTimeoutError(error))
      throw new UpstreamTimeoutError(stage, timeoutMs);
    throw error;
  }
}
