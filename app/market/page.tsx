import {Header,Footer} from "../site-chrome";
import MarketExplorer from "../market-explorer";
export const metadata={title:"전체 종목 데이터 | Qook VQD",description:"코스피·코스닥 전체 종목의 선별 결과, 제외 사유와 저장된 평가 데이터를 조회합니다."};
export default function MarketPage(){return <div className="site-shell"><Header/><main id="main-content" className="dashboard screen-dashboard"><section className="workspace-heading"><div><div className="workspace-kicker">전체 시장 / Data explorer</div><h1>선정된 종목 너머,<br/>모든 결과를 살펴보다<span className="title-period">.</span></h1><p>전체 종목의 선별 결과와 저장된 평가 내역을 한곳에서 확인합니다.</p></div></section><MarketExplorer/><Footer/></main></div>;}
