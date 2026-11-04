import { NextRequest, NextResponse } from "next/server";
import { stocks } from "@/lib/stocks";
import { db } from "@/lib/db";
import { quote } from "@/lib/kis";
import { financialScores } from "@/lib/financial-score";
import { isTimeoutError } from "@/lib/request-timeout";
import { DartApiError } from "@/lib/dart-errors";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`)
    return NextResponse.json(
      { error: "인증 실패: CRON_SECRET 확인" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const body = await req.json().catch(() => null);
  const code = body?.code;
  const financialOnly = body?.mode === "financial" || body?.mode === "research";
  if (typeof code !== "string" || !/^[0-9A-Z]{6}$/.test(code))
    return NextResponse.json(
      { error: "올바른 6자리 영문·숫자 종목코드를 입력하세요" },
      { status: 400 },
    );
  let found: readonly [string,string] | undefined = stocks.find((x) => x[1] === code);
  if (!found) {
    const {watchlist} = await import("@/lib/market-screen");
    found = (await watchlist()).stocks.find(s => s[1] === code);
  }
  if (!found)
    return NextResponse.json(
      { error: "등록되지 않은 종목입니다" },
      { status: 400 },
    );
  const client = db();
  if (!client)
    return NextResponse.json(
      { error: "Supabase 환경변수 누락" },
      { status: 503 },
    );
  if (
    !financialOnly &&
    (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET)
  )
    return NextResponse.json(
      { error: "KIS API 환경변수 누락" },
      { status: 503 },
    );
  try {
    if (body?.mode === "research") {
      const {updateResearch} = await import("@/lib/research");
      const snapshot = await updateResearch(code, body?.force === true);
      return NextResponse.json({ok: true, code, detail: `${snapshot.year}년 기준 · 배당 5년·실제 소각·3년 수익성 평가 ${snapshot.errors.length ? "· 일부 자료 미확인: " + snapshot.errors.join(" / ") : "완료"}`, checkedAt: snapshot.checkedAt}, {headers: {"Cache-Control": "no-store"}});
    }
    if (financialOnly) {
      const { data: existing, error: readError } = await client
        .from("stock_latest")
        .select("code")
        .eq("code", code)
        .maybeSingle();
      if (readError) throw readError;
      if (!existing)
        return NextResponse.json(
          { error: "시세를 먼저 수집한 종목만 재무평가할 수 있습니다" },
          { status: 422 },
        );

      const scores = await financialScores(code);
      const extra: Record<string, number | null> = {};
      for (const field of [
        "profit_score",
        "balance_score",
        "growth_score",
      ] as const)
        extra[field] =
          typeof scores[field] === "number" ? scores[field]! : null;
      if (!Object.values(extra).some((value) => value !== null))
        return NextResponse.json(
          {
            ok: false,
            error: "재무점수 미산정: " + scores.note,
            detail: scores.note,
          },
          { status: 422 },
        );
      const { error } = await client
        .from("stock_latest")
        .update(extra)
        .eq("code", code);
      if (error) throw error;
      return NextResponse.json(
        {
          ok: true,
          code,
          updatedFields: Object.keys(extra).filter(
            (field) => extra[field] !== null,
          ),
          clearedFields: Object.keys(extra).filter(
            (field) => extra[field] === null,
          ),
          detail: scores.note,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const q = await quote(code);
    if (q.price == null) throw Error("API 응답에 가격이 없습니다");
    const { error } = await client
      .from("stock_latest")
      .upsert(
        { code, name: found[0], ...q, updated_at: new Date().toISOString() },
        { onConflict: "code" },
      );
    if (error) throw error;
    return NextResponse.json(
      { ok: true, code, price: q.price, updated_at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("Manual refresh failed", code, e);
    if (isTimeoutError(e))
      return NextResponse.json(
        {
          error:
            "수집 지연: " +
            (e instanceof Error && e.name === "UpstreamTimeoutError"
              ? e.message
              : "외부 데이터 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."),
          code: "UPSTREAM_TIMEOUT",
          retryable: true,
        },
        { status: 504, headers: { "Cache-Control": "no-store" } },
      );
    if (e instanceof DartApiError)
      return NextResponse.json(
        {
          error: e.message,
          code: "DART_API_ERROR",
          dartStatus: e.status,
          retryable: e.retryable,
          stopBatch: e.stopBatch,
        },
        {
          status:
            e.status === "CONFIG" || e.status.startsWith("CACHE_") ? 503 : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    return NextResponse.json(
      {
        error:
          "수집 실패: " + (e instanceof Error ? e.message : "알 수 없는 오류"),
      },
      { status: 502 },
    );
  }
}

