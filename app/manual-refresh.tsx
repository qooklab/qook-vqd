"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { stocks } from "@/lib/stocks";
import {
  isRateLimit,
  isRefreshTimeout,
  shouldRetryRefresh,
} from "@/lib/refresh-policy";
type Outcome = {
  code: string;
  name: string;
  ok: boolean;
  error?: string;
  detail?: string;
};
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export default function ManualRefresh({list = stocks}: {list?: readonly (readonly [string,string])[]} = {}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState("");
  const [done, setDone] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [filter, setFilter] = useState("");
  const [activeMode, setActiveMode] = useState<"price" | "financial" | null>(
    null,
  );
  const visible = list.filter(
    ([name, code]) =>
      name.toLowerCase().includes(filter.toLowerCase()) ||
      code.includes(filter),
  );
  async function run(mode: "price" | "financial" = "price") {
    if (!selected.length || !secret || running) return;
    setActiveMode(mode);
    setRunning(true);
    setDone(0);
    setOutcomes([]);
    const results: Outcome[] = [];
    try {
      for (const code of selected) {
        const name = list.find((x) => x[1] === code)?.[0] || code;
        // The KIS gateway enforces a per-second request limit shared across app keys.
        // Space requests out, even when a previous request failed.
        if (results.length > 0 && mode === "price") await sleep(1500);
        let outcome: Outcome = {
          code,
          name,
          ok: false,
          error: "알 수 없는 오류",
        };
        let stop = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            setActivity(
              `${name} ${mode === "financial" ? "재무평가" : "시세 수집"} 중${attempt ? ` · 재시도 ${attempt}` : ""}…`,
            );
            const res = await fetch("/api/refresh", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: "Bearer " + secret,
              },
              body: JSON.stringify({ code, mode: mode === "financial" ? "research" : mode }),
              cache: "no-store",
            });
            const raw = await res.text();
            let json: {
              error?: string;
              ok?: boolean;
              code?: string;
              retryable?: boolean;
              stopBatch?: boolean;
              detail?: string;
            } = {};
            try {
              json = JSON.parse(raw);
            } catch {
              json = {
                error:
                  res.status === 504 || res.status === 524
                    ? "서버 처리 시간 초과 (HTTP " + res.status + ")"
                    : res.status >= 500
                      ? "서버 오류 (HTTP " +
                        res.status +
                        "). Vercel Functions 로그 확인 필요"
                      : "JSON이 아닌 응답 (HTTP " + res.status + ")",
              };
            }
            const error = String(json.error || "요청 실패");
            if (res.ok && json.ok === true) {
              outcome = {
                code,
                name,
                ok: true,
                detail:
                  mode === "financial" && typeof json.detail === "string"
                    ? json.detail
                    : undefined,
              };
              break;
            }
            const timeout = isRefreshTimeout(res.status, error, json.code);
            if (
              shouldRetryRefresh(
                res.status,
                error,
                json.code,
                json.retryable,
              ) &&
              attempt < (timeout ? 2 : 3)
            ) {
              setActivity(
                `${name} · ${timeout ? "응답 지연" : "일시적 호출 제한"}, ${(2500 * Math.pow(2, attempt)) / 1000}초 후 재시도…`,
              );
              await sleep(2500 * Math.pow(2, attempt));
              continue;
            }
            outcome = {
              code,
              name,
              ok: false,
              error: shouldRetryRefresh(
                res.status,
                error,
                json.code,
                json.retryable,
              )
                ? error + " (자동 재시도 후 실패)"
                : error,
            };
            // Stop for invalid credentials or a persistent upstream server failure.
            stop =
              json.stopBatch === true ||
              res.status === 401 ||
              res.status === 503 ||
              error.includes("KIS token HTTP") ||
              (error.includes("KIS quote HTTP 500") &&
                !isRateLimit(res.status, error));
            break;
          } catch (e) {
            outcome = { code, name, ok: false, error: String(e) };
            break;
          }
        }
        results.push(outcome);
        setOutcomes([...results]);
        setDone(results.length);
        if (stop) break;
      }
    } finally {
      setDone(results.length);
      setRunning(false);
      router.refresh();
    }
  }
  const toggle = (code: string) =>
    setSelected((v) =>
      v.includes(code) ? v.filter((x) => x !== code) : [...v, code],
    );
  return (
    <section className="manual-panel">
      <h2>선택 종목 수동 갱신</h2>
      <p>
        국내 전체 시장에서 현재 관찰 목록의 종목을 선택해 최신 시세를 가져옵니다.
        종목은 1.5초 간격으로 조회하고 호출 제한과 일시적인 시간 초과는 간격을
        두고 자동 재시도합니다. 진행률을 표시합니다.
      </p>
      <div className="manual-controls">
        <input
          aria-label="종목 검색"
          placeholder="종목명 또는 코드 검색"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          disabled={running}
        />
        <button
          type="button"
          onClick={() => setSelected(list.map((x) => x[1]))}
          disabled={running}
        >
          {list.length}종목 전체 선택
        </button>
        <button
          type="button"
          onClick={() => setSelected([])}
          disabled={running}
        >
          선택 해제
        </button>
      </div>
      <div className="manual-list">
        {visible.map(([name, code]) => (
          <label key={code}>
            <input
              type="checkbox"
              checked={selected.includes(code)}
              disabled={running}
              onChange={() => toggle(code)}
            />
            {name} <small>{code}</small>
          </label>
        ))}
      </div>
      <div className="manual-controls">
        <input
          aria-label="수동 갱신 인증키"
          type="password"
          autoComplete="off"
          placeholder="CRON_SECRET 입력 (저장되지 않음)"
          value={secret}
          disabled={running}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>
      <p className="collection-selection">
        선택한 종목 <strong>{selected.length}개</strong> · 인증키를 입력한 뒤
        가져올 정보를 선택하세요.
      </p>
      <div className="collection-actions">
        <section
          className="collection-action"
          aria-labelledby="kis-action-title"
        >
          <span className="collection-source">한국투자증권 · KIS</span>
          <h3 id="kis-action-title">시세 정보</h3>
          <p>현재가·PER·PBR·거래량을 가져옵니다.</p>
          <button
            type="button"
            onClick={() => run("price")}
            disabled={running || selected.length === 0 || !secret}
          >
            {running && activeMode === "price"
              ? "한투 시세 가져오는 중…"
              : "한투 시세 가져오기"}
          </button>
        </section>
        <section
          className="collection-action"
          aria-labelledby="dart-action-title"
        >
          <span className="collection-source">금융감독원 · OpenDART</span>
          <h3 id="dart-action-title">배당·소각·재무 통합 평가</h3>
          <p>
            5년 배당 이력, 실제 자사주 소각, 3년 재무·수익성을 확인합니다.
            안전마진·모형 매수기준은 현재 시세와 PER·PBR로 재계산합니다.
            정상 공시 결과는 7일, 일부 조회 실패 결과는 15분간 재사용합니다.
            상세 화면에서도 자동 수집됩니다.
          </p>
          <button
            type="button"
            onClick={() => run("financial")}
            disabled={running || selected.length === 0 || !secret}
          >
            {running && activeMode === "financial"
              ? "DART 재무정보 가져오는 중…"
              : "DART 재무정보 가져오기"}
          </button>
        </section>
      </div>
      {(running || outcomes.length > 0) && (
        <div role="status" aria-live="polite">
          {running && <p>{activity}</p>}
          <progress max={selected.length || 1} value={done} />
          <p>
            {done}/{selected.length} 완료 · 성공{" "}
            {outcomes.filter((x) => x.ok).length} · 실패{" "}
            {outcomes.filter((x) => !x.ok).length}
            {!running && done < selected.length ? " · 오류로 조기 중단" : ""}
          </p>
        </div>
      )}
      {activeMode === "financial" && outcomes.some((x) => x.ok && x.detail) && (
        <details className="manual-results">
          <summary>DART 평가 결과 보기</summary>
          {outcomes
            .filter((x) => x.ok && x.detail)
            .map((x) => (
              <p key={x.code}>
                <strong>{x.name}</strong> · {x.detail}
              </p>
            ))}
        </details>
      )}
      {outcomes.some((x) => !x.ok) && (
        <div className="manual-errors">
          <strong>
            {activeMode === "financial"
              ? "DART 재무정보 오류"
              : "한투 시세 오류"}
          </strong>
          {outcomes
            .filter((x) => !x.ok)
            .map((x) => (
              <p key={x.code}>
                {x.name}: {x.error}
              </p>
            ))}
        </div>
      )}
      <p>
        <small>
          보안: CRON_SECRET은 이 화면에서만 사용하며 브라우저 저장소에 보관하지
          않습니다. 공용 PC에서는 사용하지 마세요. 이 기능은 선택한 종목만
          갱신하며 국내 전체 상장종목 검색은 아직 지원하지 않습니다.
        </small>
      </p>
    </section>
  );
}

