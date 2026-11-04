import "./style.css";
import type { ReactNode } from "react";
import SiteExperience from "./site-experience";
export const metadata = {
  title: "Qook VQD | 가치에 집중하는 투자 리서치",
  description:
    "가격·기업의 질·주주환원으로 살펴보는 국내 우량 배당주 리서치 대시보드",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <SiteExperience>{children}</SiteExperience>
      </body>
    </html>
  );
}

