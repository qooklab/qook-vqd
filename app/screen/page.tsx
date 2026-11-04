import {Header,Footer} from "../site-chrome";
import MarketScreen from "../market-screen";
export const metadata={title:"전 종목 선별 | Qook VQD",description:"코스피·코스닥 상장종목에 같은 조건을 적용하는 1차 가치·수익성 스크리너"};
export default function ScreenPage(){return <div className="site-shell"><Header/><main id="main-content" className="dashboard screen-dashboard"><section className="workspace-heading"><div><div className="workspace-kicker">전체 시장 / Screen</div><h1>같은 기준으로,<br/>넓게 살펴보다<span className="title-period">.</span></h1><p>코스피·코스닥 전 종목 → 공통 조건 선별 → 후보 최대 30개 → DART 상세 평가</p></div></section><MarketScreen/><Footer/></main></div>;}
