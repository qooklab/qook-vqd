import { Header, Footer } from "./site-chrome";
export default function Loading() {
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content" className="dashboard">
        <section className="loading-view" aria-labelledby="loading-title">
          <div role="status">
            <span className="workspace-kicker">Qook VQD</span>
            <h1 id="loading-title">리서치 데이터를 불러오는 중</h1>
            <p>시세와 평가 내역을 준비하고 있습니다.</p>
          </div>
          <div className="loading-placeholder" aria-hidden="true">
            <div className="loading-stats">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <span />
                  <b />
                </div>
              ))}
            </div>
            <div className="loading-rows">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          </div>
        </section>
        <Footer />
      </main>
    </div>
  );
}
