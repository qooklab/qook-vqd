"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { InteractionSound } from "@/lib/interaction-sound";

const routes = [
  {href: "/", title: "Research", ko: "종목 리서치", caption: "30 companies. Three lenses.", no: "01"},
  {href: "/methodology", title: "Method", ko: "평가 기준", caption: "The thinking behind the numbers.", no: "02"},
  {href: "/manage", title: "Data", ko: "데이터 관리", caption: "Keep your research up to date.", no: "03"},
];
type Experience = {sound: boolean; audioReady: boolean; toggleSound: () => void; xray: boolean; toggleXray: () => void; menu: boolean; toggleMenu: () => void};
const ExperienceContext = createContext<Experience | null>(null);
export function ExperienceControls() {
  const experience = useContext(ExperienceContext);
  if (!experience) return null;
  return <div className="experience-controls">
    <button type="button" className={`sound-control ${experience.sound ? "is-on" : ""}`} aria-label={experience.sound ? "효과음 끄기" : "효과음 켜기"} aria-pressed={experience.sound} onClick={experience.toggleSound} title={experience.sound ? "효과음 켜짐 · 클릭하여 끄기" : "효과음 꺼짐 · 클릭하여 켜기"}>
      <span className="sound-bars" aria-hidden="true"><i /><i /><i /><i /></span><span className="control-word">Sound</span>
    </button>
    <button type="button" className="xray-control" aria-pressed={experience.xray} onClick={experience.toggleXray} title="X-ray 보기 전환"><span aria-hidden="true">⌕</span><span>X-ray</span></button>
    <button type="button" className={`menu-control ${experience.menu ? "is-open" : ""}`} aria-label={experience.menu ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={experience.menu} aria-controls="studio-menu" onClick={experience.toggleMenu} data-magnetic>
      <span aria-hidden="true"><i /><i /></span>
    </button>
  </div>;
}

export default function SiteExperience({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const [sound, setSound] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [xray, setXray] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeMenu, setActiveMenu] = useState(0);
  const audio = useRef<InteractionSound | null>(null);
  const soundRef = useRef(true);
  const cursor = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const originFocus = useRef<HTMLElement | null>(null);
  const moving = useRef(false);
  const cue = useCallback((kind: "hover" | "press" | "navigate" | "toggle") => {
    if (soundRef.current) audio.current?.play(kind);
  }, []);
  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next; setSound(next);
    try { localStorage.setItem("qook-sound", next ? "on" : "off"); } catch {}
    if (next) void audio.current?.unlock().then(ready => {setAudioReady(ready); if (ready) audio.current?.play("toggle");});
    else audio.current?.suspend();
  }, []);
  const toggleMenu = useCallback(() => {cue("toggle"); setMenu(value => !value);}, [cue]);
  const toggleXray = useCallback(() => {cue("toggle"); setXray(value => !value);}, [cue]);

  useEffect(() => {
    audio.current = new InteractionSound();
    try { const enabled = localStorage.getItem("qook-sound") !== "off"; soundRef.current = enabled; setSound(enabled); } catch {}
    const unlock = () => {
      if (soundRef.current) void audio.current?.unlock().then(setAudioReady);
    };
    const pointerDown = (event: PointerEvent) => {if (event.isTrusted) unlock();};
    const keyDown = (event: KeyboardEvent) => {if (event.isTrusted && (event.key === "Enter" || event.key === " ")) unlock();};
    const hide = () => {if (document.hidden) {audio.current?.suspend(); setAudioReady(false);}};
    document.addEventListener("pointerdown", pointerDown, {passive: true});
    document.addEventListener("keydown", keyDown);
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("pointerdown", pointerDown); document.removeEventListener("keydown", keyDown); document.removeEventListener("visibilitychange", hide);
      audio.current?.close();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("xray-mode", xray);
    return () => document.documentElement.classList.remove("xray-mode");
  }, [xray]);

  useEffect(() => {
    moving.current = false; setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    originFocus.current = document.activeElement as HTMLElement;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = menuRef.current?.querySelector<HTMLElement>("button, a");
    first?.focus({preventScroll: true});
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {setMenu(false); return;}
      if (event.key !== "Tab") return;
      const targets = [...(menuRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') || [])];
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trap);
      // Restore focus only while staying on the same screen.
      if (originFocus.current?.isConnected) originFocus.current.focus({preventScroll: true});
      if (!moving.current) window.scrollTo({top: scrollY, behavior: "instant"});
    };
  }, [menu]);

  useEffect(() => {
    const interactive = "a[href], button, summary, label:has(input[type=radio]), input[type=checkbox]";
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(interactive)) cue("press");
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) {
        // Leave navigation to Next Link; no interception, overlay or artificial delay.
        moving.current = true; setMenu(false); cue("navigate");
      }
    };
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target instanceof Element ? event.target.closest(interactive) : null;
      const previous = event.relatedTarget instanceof Element ? event.relatedTarget.closest(interactive) : null;
      if (target && target !== previous) cue("hover");
    };
    document.addEventListener("click", click, true);
    document.addEventListener("pointerover", hover, {passive: true});
    return () => {document.removeEventListener("click", click, true); document.removeEventListener("pointerover", hover);};
  }, [cue]);

  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, scrollFrame = 0;
    let magnetic: HTMLElement | null = null;
    let instrument: HTMLElement | null = null;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !fine.matches || reduced.matches) return;
      const target = event.target instanceof Element ? event.target : null;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (cursor.current) {
          cursor.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
          cursor.current.dataset.visible = "true";
          cursor.current.dataset.interactive = String(!!target?.closest("a,button,summary,input,select,label"));
          cursor.current.dataset.inspect = String(xray);
        }
        const next = target?.closest<HTMLElement>("[data-magnetic], .hero-cta") || null;
        if (magnetic && magnetic !== next) {magnetic.style.removeProperty("--magnetic-x"); magnetic.style.removeProperty("--magnetic-y");}
        magnetic = next;
        if (next) {const rect = next.getBoundingClientRect(); next.style.setProperty("--magnetic-x", `${(event.clientX - rect.left - rect.width / 2) * .12}px`); next.style.setProperty("--magnetic-y", `${(event.clientY - rect.top - rect.height / 2) * .15}px`);}
        const dial = target?.closest<HTMLElement>(".value-instrument") || null;
        if (instrument && instrument !== dial) {instrument.style.removeProperty("--tilt-x"); instrument.style.removeProperty("--tilt-y"); instrument.style.removeProperty("--needle-angle");}
        instrument = dial;
        if (dial) {
          const r = dial.getBoundingClientRect(), dx = (event.clientX-r.left-r.width/2)/(r.width/2), dy = (event.clientY-r.top-r.height/2)/(r.height/2);
          dial.style.setProperty("--tilt-x", `${-dy * 7}deg`); dial.style.setProperty("--tilt-y", `${dx * 7}deg`); dial.style.setProperty("--needle-angle", `${Math.atan2(dy,dx)*180/Math.PI + 45}deg`);
        }
      });
    };
    const leave = () => {if (cursor.current) cursor.current.dataset.visible = "false";};
    const scroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        setScrollProgress(max > 0 ? Math.min(100, window.scrollY / max * 100) : 0);
      });
    };
    document.addEventListener("pointermove", move, {passive: true}); document.documentElement.addEventListener("pointerleave", leave); window.addEventListener("scroll", scroll, {passive: true}); window.addEventListener("resize", scroll); scroll();
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame);
      document.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll);
      if(magnetic){magnetic.style.removeProperty("--magnetic-x"); magnetic.style.removeProperty("--magnetic-y");}
      if(instrument){instrument.style.removeProperty("--tilt-x"); instrument.style.removeProperty("--tilt-y"); instrument.style.removeProperty("--needle-angle");}
    };
  }, [pathname, xray]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {entry.target.setAttribute("data-revealed", "true"); observer.unobserve(entry.target);}
    }), {threshold: .08});
    const seen = new WeakSet<Element>();
    let frame = 0;
    const scan = () => {
      document.querySelectorAll("main > section, .stat-card, .method-card, .coverage-panel, .stock-table tbody tr, .mobile-stock-card, .evidence-grid details").forEach((node, index) => {
        if (seen.has(node)) return; seen.add(node);
        const rect = node.getBoundingClientRect();
        if (rect.top < innerHeight * .98) return;
        (node as HTMLElement).style.setProperty("--reveal-delay", `${Math.min(index % 4 * 35, 105)}ms`);
        node.setAttribute("data-reveal", ""); observer.observe(node);
      });
    };
    scan();
    const mutations = new MutationObserver(() => {cancelAnimationFrame(frame); frame = requestAnimationFrame(scan);});
    const surface = document.querySelector(".experience-page"); if (surface) mutations.observe(surface, {subtree: true, childList: true});
    return () => {cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect();};
  }, [pathname]);

  return <ExperienceContext.Provider value={{sound, audioReady, toggleSound, xray, toggleXray, menu, toggleMenu}}>
    <div className="experience-page" inert={menu || undefined} data-audio-state={sound ? audioReady ? "ready" : "awaiting-gesture" : "muted"}>{children}</div>
    <div className="reading-progress" aria-hidden="true"><span style={{transform: `scaleX(${scrollProgress / 100})`}} /></div>
    <div className="precision-cursor" ref={cursor} aria-hidden="true"><span /><i /><b>LOOK CLOSER</b></div>
    {xray && <div className="inspection-label" role="status"><span /> X-RAY ON · 레이아웃 살펴보기</div>}
    {menu && <div id="studio-menu" className="studio-menu" role="dialog" aria-modal="true" aria-label="전체 메뉴" ref={menuRef}>
      <div className="studio-menu-top"><span className="menu-wordmark">qook<span>.</span></span><span>THE RESEARCH DESK</span><button className="menu-dismiss" aria-label="전체 메뉴 닫기" onClick={() => setMenu(false)}>✕</button></div>
      <div className="studio-menu-body"><nav aria-label="전체 메뉴 탐색">{routes.map((route, i) => <Link href={route.href} key={route.href} className={activeMenu === i ? "is-highlighted" : ""} onClick={() => {if (pathname === route.href) setMenu(false);}} onMouseEnter={() => setActiveMenu(i)} onFocus={() => setActiveMenu(i)} aria-current={pathname === route.href ? "page" : undefined}><small>{route.no}</small><span>{route.title}</span><em>{route.ko}</em><b aria-hidden="true">↗</b></Link>)}</nav>
        <div className="menu-preview" aria-hidden="true"><div className="menu-preview-orbit"><i /><i /><span>{routes[activeMenu].no}</span><b /></div><span>{routes[activeMenu].caption}</span><small>QOOK VQD / {routes[activeMenu].title.toUpperCase()}</small></div>
      </div>
      <div className="studio-menu-bottom"><p>가격 너머의<br />가치를 보다<span>.</span></p><span>VALUE, QUALITY &amp; DIVIDEND</span><div><button aria-pressed={sound} onClick={toggleSound}>Sound {sound ? "On" : "Off"}</button><button aria-pressed={xray} onClick={toggleXray}>X-ray {xray ? "On" : "Off"}</button></div></div>
    </div>}
  </ExperienceContext.Provider>;
}
