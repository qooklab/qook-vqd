"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export default function ResearchProgress({remaining}: {remaining: number}) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  useEffect(() => {
    if (!remaining || attempts >= 12 || document.visibilityState === "hidden") return;
    const timer = setTimeout(() => {setAttempts(n => n + 1); router.refresh();}, 15000);
    return () => clearTimeout(timer);
  }, [remaining, attempts, router]);
  if (!remaining) return null;
  return <div className="notice" role="status"><strong>추가 평가 수집 중 · {remaining}종목</strong><span>배당·소각·수익성 자료를 순차 확인합니다. {attempts < 12 ? "15초마다 결과를 확인합니다." : "상세 화면에서 개별 결과를 확인하거나 데이터 관리에서 갱신할 수 있습니다."}</span></div>;
}
