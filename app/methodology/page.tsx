import Link from "next/link";
import { Header, Footer } from "../site-chrome";
import { criteria } from "@/lib/stocks";
export const metadata = {
  title: "분석 철학과 평가 기준 | Qook VQD",
  description:
    "Qook VQD의 저평가·기업의 질·주주환원을 살펴보는 10가지 평가 기준과 점수 해석 안내",
};
const groups = [
  {
    name: "VALUE",
    ko: "저평가",
    desc: "좋은 기업이라도 너무 비싸게 사지 않는 것을 중시합니다. PER·PBR과 안전마진으로 가격의 합리성을 확인합니다.",
    indexes: [0, 1, 2],
  },
  {
    name: "DIVIDEND",
    ko: "배당·주주환원",
    desc: "현재 배당수익률뿐 아니라 배당의 지속성과 자사주 소각 등 주주환원 정책도 함께 살펴봅니다.",
    indexes: [3, 4, 5],
  },
  {
    name: "QUALITY",
    ko: "우량 기업",
    desc: "이익의 안정성, 재무 건전성, 성장성, 경쟁력을 통해 장기 보유할 수 있는 사업인지 검토합니다.",
    indexes: [6, 7, 8, 9],
  },
];
const explanations = [
  "주가수익비율(PER)이 낮을수록 유리하게 평가하되, 적자 기업은 별도로 검토합니다.",
  "주가순자산비율(PBR)을 확인합니다. 업종별 자산 구조 차이를 함께 고려해야 합니다.",
  "자체 모형 추정가=min(주가/PER×12, 주가/PBR). 할인율=(1−주가/추정가)×100. 30% 이상 15점, 20% 이상 12점, 10% 이상 9점, 0% 이상 6점, −10% 이상 3점, 미만 0점. 모형 매수기준=추정가×80%. 확정 내재가치나 매수 권유가 아닙니다.",
  "최근 완료 사업연도 주당 현금배당금÷최근 수집가×100. 5% 이상 10점, 4% 이상 8점, 3% 이상 6점, 2% 이상 4점, 양수 2점, 명시적 0원 0점. 예상 배당률이 아닙니다.",
  "5년 모두 배당 확인 및 주당금액 비감소 10점, 5년 지급하되 감소 이력 8점, 4년 지급 6점, 3년 4점, 1~2년 2점, 0년 0점. 5년 중 자료가 하나라도 없으면 미평가. 주식분할·특별배당의 영향은 별도 검토가 필요합니다.",
  "최근 완료 사업연도 자기주식 취득·처분 현황의 주식 종류별 소각 총계를 확인합니다. 소각량/(기말 발행주식+소각량)이 3% 이상 10점, 2% 이상 8점, 1% 이상 6점, 양수 4점, 명시적 0주 0점. 소각 결정·주식수 감소·누적 이익소각을 실제 연간 소각으로 대신하지 않습니다.",
  "최근 3년 영업이익이 모두 확인될 때, 흑자 연수 0/1/2/3년에 0/3/6/10점을 부여합니다. 변동성 자체를 측정하는 지표는 아닙니다.",
  "비금융기업의 최근 완료 사업연도 부채/자본이 0.5배 이하 10점, 1배 이하 8점, 1.5배 이하 6점, 2배 이하 4점, 3배 이하 2점, 초과 0점. 금융업 BIS/CET1·K-ICS 등 별도 지표는 아직 연결되지 않아 미평가합니다.",
  "3년 영업이익 자료로 2년 CAGR을 계산합니다. 15% 이상 10점, 10% 이상 8점, 5% 이상 6점, 0% 이상 4점, 음수 2점. 최근 이익이 0 이하이면 0점, 기초 적자에서 흑자전환은 CAGR 비교가 어려워 미평가합니다.",
  "자동 점수는 경쟁력의 수익성 대리지표입니다. 동일 연결/별도 기준의 3년 ROE=당기순이익/기초·기말 평균 총자본. 3년 최저 ROE가 15% 이상 5점, 10% 이상 4점, 5% 이상 3점, 양수 1점, 0 이하 0점. 3년 자료가 부족하면 미평가. 시장지위·브랜드·전환비용 등 정성적 경쟁우위는 별도 검토해야 합니다.",
];
export default function Methodology() {
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard methodology-page">
        <Link href="/" className="back-link">
          ← 대시보드로 돌아가기
        </Link>
        <section className="method-intro">
          <span className="section-overline">Qook VQD의 투자 관점</span>
          <h1>
            저평가된 좋은 기업을 찾고,
            <br />
            <span>배당과 주주환원으로 기다린다.</span>
          </h1>
          <p>
            Qook VQD는 가격·기업의 질·주주환원을 함께 살펴보는 개인 투자 분석 도구입니다.
          </p>
          <div className="method-note">
            Qook VQD는 10가지 평가 항목을 합산해 100점 만점으로 평가합니다.
          </div>
        </section>
        <section className="method-section">
          <div className="section-heading">
            <div>
              <span className="section-overline">투자 원칙</span>
              <h2>투자 판단의 세 가지 축</h2>
            </div>
          </div>
          <div className="method-grid">
            {groups.map((g, i) => (
              <article className="method-card" key={g.name}>
                <span className="method-index">{g.name}</span>
                <h3>{g.ko}</h3>
                <p>{g.desc}</p>
                <div className="method-total">
                  {g.indexes.reduce(
                    (sum, index) => sum + criteria[index][1],
                    0,
                  )}
                  <small> / 100점</small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="method-section">
          <div className="section-heading">
            <div>
              <span className="section-overline">평가 체계</span>
              <h2>10가지 평가 항목</h2>
            </div>
            <span className="section-meta">합계 100점</span>
          </div>
          <div className="method-criteria">
            {criteria.map(([label, max], i) => (
              <article className="method-criterion" key={label}>
                <div className="method-criterion-head">
                  <span className="method-criterion-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <strong>{label}</strong>
                  <span className="method-criterion-points">{max}점</span>
                </div>
                <p>{explanations[i]}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="method-section">
          <div className="section-heading">
            <div>
              <span className="section-overline">점수 가이드</span>
              <h2>점수를 해석하는 방법</h2>
            </div>
          </div>
          <div className="method-guidance">
            <p>
              <strong>20 / 100점</strong>은 100점 만점 기준 현재 확인된
              점수입니다. 예를 들어 PER과 PBR만 수집되어 20점 배점이 평가된
              경우, <strong>평가 가능 20점 / 전체 100점</strong>으로 별도
              표시합니다.
            </p>
            <p>
              데이터가 없는 항목은 0점으로 단정하지 않고 <strong>미평가</strong>
              로 둡니다. 따라서 일부 항목만 수집된 종목의 점수를 전체 평가 완료
              종목과 직접 비교하면 안 됩니다.
            </p>
            <p>
              PER·PBR·모형 안전마진은 수집 시세로 계산하고, 배당·소각·재무·수익성은
              DART 완료 사업연도 자료로 계산합니다. 공시 근거와 기준일은 종목 상세에서
              확인할 수 있습니다. 우선주는 해당 종류의 자료만 사용합니다. 금융업
              건전성은 일반기업 부채비율로 대체하지 않습니다. 공시 미제공·주식 종류
              불명확·원천 데이터 오류는 0점으로 채우지 않고 사유를 표시합니다.
            </p>
          </div>
        </section>
        <div className="method-footer-action">
          <Link href="/">종목 분석 보러 가기 →</Link>
        </div>
        <Footer />
      </main>
    </div>
  );
}

