"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
export type StockRow = {
  name: string;
  code: string;
  price: number | null;
  per: number | null;
  pbr: number | null;
  assessed: number;
  possible: number;
  complete: boolean;
  buy_price: number | null;
  updated_at: string | null;
};
type Key =
  "name" | "price" | "per" | "pbr" | "assessed" | "buy_price" | "updated_at";
const cols: { key: Key; label: string }[] = [
  { key: "name", label: "종목 / 코드" },
  { key: "price", label: "최근 수집가" },
  { key: "per", label: "PER" },
  { key: "pbr", label: "PBR" },
  { key: "assessed", label: "확인 점수" },
  { key: "buy_price", label: "적정매수가" },
  { key: "updated_at", label: "최근 수집일" },
];
const fmt = (v: number | null) => (v == null ? "—" : v.toLocaleString("ko-KR"));
function Score({ row: r }: { row: StockRow }) {
  return (
    <div className={`score-block ${r.complete ? "complete" : ""}`}>
      <div className="score-number">
        {r.possible > 0 ? (
          <>
            <strong>{r.assessed}</strong>
            <span>/ 100</span>
          </>
        ) : (
          <span className="unrated-label">미평가</span>
        )}
        <span className="evaluation-state">
          {r.complete
            ? "평가 완료"
            : r.possible > 0
              ? "일부 평가"
              : "데이터 대기"}
        </span>
      </div>
      <div className="score-track" aria-hidden="true">
        <span style={{ width: `${r.possible}%` }} />
        <b style={{ width: `${r.assessed}%` }} />
      </div>
      <small>평가 가능 배점 {r.possible} / 100</small>
    </div>
  );
}
export default function StockTable({ rows }: { rows: StockRow[] }) {
  const [sort, setSort] = useState<Key>("assessed");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const ordered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (r.name.toLowerCase().includes(query.trim().toLowerCase()) ||
              r.code.includes(query.trim())) &&
            (filter === "all" ||
              (filter === "complete"
                ? r.complete
                : r.possible > 0 && !r.complete)),
        )
        .sort((a, b) => {
          const av = a[sort],
            bv = b[sort];
          if (av == null && bv == null)
            return a.name.localeCompare(b.name, "ko");
          if (av == null) return 1;
          if (bv == null) return -1;
          const comparison =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv), "ko");
          return (
            (direction === "asc" ? comparison : -comparison) ||
            a.name.localeCompare(b.name, "ko")
          );
        }),
    [rows, sort, direction, query, filter],
  );
  const change = (key: Key) => {
    if (sort === key) setDirection((v) => (v === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection(key === "name" ? "asc" : "desc");
    }
  };
  return (
    <>
      <div className="table-toolbar">
        <div className="filter-group" role="group" aria-label="평가 상태 필터">
          {[
            ["all", "전체 종목"],
            ["complete", "평가 완료"],
            ["partial", "일부 평가"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="리서치 종목 검색"
            placeholder="종목명 또는 코드 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="search-count" aria-live="polite">
            {ordered.length} 종목
          </span>
        </label>
      </div>
      <p className="score-guide">
        <span className="legend-dot" /> 확인 점수 / 100점{" "}
        <span className="guide-divider">·</span> 미평가 항목은 0점이 아닙니다.
        평가 가능한 배점과 함께 확인하세요.
      </p>
      <div className="sort-mobile">
        <label htmlFor="stock-sort">정렬</label>
        <select
          id="stock-sort"
          value={sort}
          onChange={(e) => change(e.target.value as Key)}
        >
          {cols.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDirection((v) => (v === "asc" ? "desc" : "asc"))}
        >
          {direction === "asc" ? "↑ 오름차순" : "↓ 내림차순"}
        </button>
      </div>
      {ordered.length === 0 ? (
        <div className="empty-state" role="status">
          <span>검색 결과 없음</span>
          <h3>조건에 맞는 종목이 없습니다.</h3>
          <p>검색어나 평가 상태를 변경해 보세요.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            전체 종목 보기 ↗
          </button>
        </div>
      ) : (
        <>
          <div className="tablewrap">
            <table className="stock-table">
              <caption className="sr-only">
                종목별 시세, 확인 점수 및 평가 가능 배점. 열 제목을 눌러 정렬할
                수 있습니다.
              </caption>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th
                      scope="col"
                      key={c.key}
                      aria-sort={
                        sort === c.key
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        className="sort-header"
                        onClick={() => change(c.key)}
                      >
                        {c.label}
                        <span aria-hidden="true">
                          {sort === c.key
                            ? direction === "asc"
                              ? " ↑"
                              : " ↓"
                            : " ↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordered.map((r) => (
                  <tr key={r.code}>
                    <th scope="row">
                      <Link className="stock-link" href={`/stocks/${r.code}`}>
                        <span className="stock-icon">{r.name.slice(0, 1)}</span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>KRX · {r.code}</small>
                        </span>
                        <span className="stock-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </Link>
                    </th>
                    <td className="price-cell">
                      {r.price != null ? (
                        <>
                          {fmt(r.price)}
                          <small> 원</small>
                        </>
                      ) : (
                        <span className="empty-label">미수집</span>
                      )}
                    </td>
                    <td>{r.per ?? "—"}</td>
                    <td>{r.pbr ?? "—"}</td>
                    <td>
                      <Score row={r} />
                    </td>
                    <td>
                      {r.buy_price != null ? (
                        fmt(r.buy_price) + " 원"
                      ) : (
                        <span className="empty-label">미산정</span>
                      )}
                    </td>
                    <td className="updated-cell">
                      {r.updated_at
                        ? new Date(r.updated_at).toLocaleDateString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })
                        : "수집 대기"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-stock-list">
            {ordered.map((r) => (
              <Link
                href={`/stocks/${r.code}`}
                className="mobile-stock-card"
                key={r.code}
              >
                <div className="mobile-stock-top">
                  <span className="stock-icon">{r.name.slice(0, 1)}</span>
                  <div className="mobile-stock-name">
                    <strong>{r.name}</strong>
                    <small>KRX · {r.code}</small>
                  </div>
                  <span className="mobile-chevron" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <div className="mobile-card-data">
                  <div className="mobile-stock-price">
                    <small>최근 수집가</small>
                    <strong>
                      {r.price != null ? fmt(r.price) + " 원" : "미수집"}
                    </strong>
                    <span>
                      적정매수가{" "}
                      {r.buy_price != null
                        ? fmt(r.buy_price) + " 원"
                        : "미산정"}
                    </span>
                  </div>
                  <Score row={r} />
                </div>
                <div className="mobile-stock-bottom">
                  <span>
                    PER <b>{r.per ?? "—"}</b>
                  </span>
                  <span>
                    PBR <b>{r.pbr ?? "—"}</b>
                  </span>
                  <small>
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleDateString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })
                      : "수집 대기"}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="table-foot">
        <span>
          {ordered.length} / {rows.length} 종목 표시
        </span>
        <span>KIS 시세 · DART 재무 데이터</span>
      </div>
    </>
  );
}
