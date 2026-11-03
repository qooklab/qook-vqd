export const isRateLimit = (status: number, error: string) =>
  status === 429 ||
  error.includes("EGW00201") ||
  error.includes("초당 거래건수");

export function isRefreshTimeout(status: number, error: string, code?: string) {
  return (
    code === "UPSTREAM_TIMEOUT" ||
    status === 408 ||
    status === 504 ||
    status === 524 ||
    /aborted due to timeout|operation timed out|시간 초과|TimeoutError/i.test(
      error,
    )
  );
}

export function shouldRetryRefresh(
  status: number,
  error: string,
  code?: string,
  retryable?: boolean,
) {
  // A permanent validation/authentication error must not be retried, regardless of its text.
  if ([400, 401, 403, 422].includes(status)) return false;
  return (
    isRateLimit(status, error) ||
    isRefreshTimeout(status, error, code) ||
    retryable === true
  );
}
