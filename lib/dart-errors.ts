const hints: Record<string, string> = {
  CONFIG: "DART_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해 주세요.",
  "010":
    "등록되지 않은 DART 인증키입니다. 서버의 DART_API_KEY를 확인해 주세요.",
  "011": "사용할 수 없는 DART 인증키입니다. DART 인증키 상태를 확인해 주세요.",
  "012":
    "DART에서 서버 IP 접근을 허용하지 않습니다. 인증키의 IP 제한을 확인해 주세요.",
  "013": "해당 연도·재무제표 구분의 자료가 없습니다.",
  "020": "DART 요청 한도를 초과했습니다. 호출 한도 복구 후 다시 시도해 주세요.",
  "800": "DART 시스템 점검 중입니다. 잠시 후 다시 시도해 주세요.",
  "900": "DART에서 일시적인 오류가 발생했습니다.",
  "901": "DART 인증키를 사용할 수 없습니다. DART 계정 상태를 확인해 주세요.",
  INVALID_RESPONSE: "DART 응답 형식이 올바르지 않습니다.",
  INVALID_ARCHIVE: "DART 기업목록 ZIP/XML을 읽을 수 없습니다.",
  CACHE_SCHEMA:
    "DART 캐시 테이블을 찾지 못했습니다. supabase/dart_cache.sql 적용 여부를 확인해 주세요.",
  CACHE_ERROR:
    "DART 캐시를 읽거나 저장하지 못했습니다. 데이터베이스 연결을 확인해 주세요.",
};
export class DartApiError extends Error {
  readonly retryable: boolean;
  readonly stopBatch: boolean;
  constructor(
    public readonly stage: string,
    public readonly status: string,
  ) {
    super(
      `${stage} [${status}]: ${hints[status] || (status.startsWith("HTTP_") ? "DART 서버 응답 오류입니다." : "DART 조회를 완료하지 못했습니다.")}`,
    );
    this.name = "DartApiError";
    this.retryable =
      ["800", "900"].includes(status) || /^HTTP_5\d\d$/.test(status);
    this.stopBatch = [
      "CONFIG",
      "010",
      "011",
      "012",
      "020",
      "901",
      "800",
      "900",
      "CACHE_SCHEMA",
      "CACHE_ERROR",
    ].includes(status);
  }
}
export function isDartNoData(error: unknown): error is DartApiError {
  return error instanceof DartApiError && error.status === "013";
}
export function dartCacheError(
  stage: string,
  error: { code?: string },
): DartApiError {
  return new DartApiError(
    stage,
    ["42P01", "PGRST205"].includes(error.code || "")
      ? "CACHE_SCHEMA"
      : "CACHE_ERROR",
  );
}
