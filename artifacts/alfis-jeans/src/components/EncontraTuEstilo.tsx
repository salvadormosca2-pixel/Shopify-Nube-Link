import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import type { Estilo } from "@/lib/estilos";

/* ──────────────────────────────────────────────
   ENCONTRÁ TU ESTILO — Coverflow 3D (blanco/gris) · Alfis Jeans
   Fondo blanco, palabra gigante gris detrás, cards en coverflow 3D
   (la del centro nítida, las de los costados apagadas en gris y rotadas).
   `items` = categorías reales de la sección (se pasan desde la página).
   ────────────────────────────────────────────── */

export default function EncontraTuEstilo({ items = [] }: { items?: Estilo[] }) {
  const ESTILOS = items;
  const [loc, navigate] = useLocation();
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(2);
  const [dragging, setDragging] = useState(false);
  const [stageW, setStageW] = useState(900);
  const [reduce, setReduce] = useState(false);
  const drag = useRef({ startX: 0, startActive: 0, lastX: 0, lastT: 0, v: 0 });

  const n = ESTILOS.length;
  const snapped = Math.max(0, Math.min(n - 1, Math.round(active)));

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageW(e.contentRect.width));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduce(m.matches);
    fn();
    m.addEventListener?.("change", fn);
    return () => m.removeEventListener?.("change", fn);
  }, []);

  // En móvil (stage angosto) la card ocupa una fracción mayor del ancho para que
  // se vea grande; en desktop escala hasta un tope. Los vecinos siempre asoman.
  const isMobile = stageW < 640;
  const frac = isMobile ? 0.62 : 0.42;
  const cardW = Math.max(150, Math.min(stageW * frac, 380));
  const cardH = cardW * 1.36;
  const gap = cardW * (isMobile ? 0.66 : 0.72);
  const depth = cardW * 0.85;

  const clampActive = (v: number) => Math.max(0, Math.min(n - 1, v));
  const go = useCallback((t: number) => setActive(clampActive(t)), [n]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const x = e.clientX;
    drag.current = { startX: x, startActive: active, lastX: x, lastT: performance.now(), v: 0 };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const x = e.clientX, d = drag.current, now = performance.now(), dt = now - d.lastT;
    if (dt > 0) d.v = (d.lastX - x) / dt;
    d.lastX = x; d.lastT = now;
    setActive(clampActive(d.startActive + (d.startX - x) / gap));
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const flick = drag.current.v * 4;
    setActive((a) => clampActive(Math.round(a + flick)));
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 4) return;
    e.preventDefault();
    go(snapped + (d > 0 ? 1 : -1));
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(snapped + 1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); go(snapped - 1); }
  };

  const handleVer = () => {
    const est = ESTILOS[snapped];
    // Integración Alfis (wouter): filtra el catálogo por la categoría real.
    navigate(`${loc}?categoria=${encodeURIComponent(est.id)}`);
    document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
  };

  const cardStyle = (i: number): React.CSSProperties => {
    const off = i - active, abs = Math.abs(off);
    const rotY = -off * 45;
    const tz = -abs * depth;
    const scale = 1 - Math.min(abs, 3) * 0.09;
    const opacity = abs > 3.4 ? 0 : 1;
    return {
      width: cardW, height: cardH,
      marginLeft: -cardW / 2, marginTop: -cardH / 2,
      transform: `translateX(${off * gap}px) translateZ(${tz}px) rotateY(${rotY}deg) scale(${scale})`,
      opacity, zIndex: 1000 - Math.round(abs * 10),
      transition: dragging || reduce ? "none" : "transform .6s cubic-bezier(.22,.61,.36,1), opacity .4s ease",
      pointerEvents: opacity ? "auto" : "none",
      cursor: "pointer",
    };
  };

  const shadeOpacity = (i: number) => Math.min(Math.abs(i - active), 1.6) / 1.6 * 0.5;
  const wordOpacity = 1 - Math.min(Math.abs(active - snapped) * 2, 1) * 0.7;

  if (!ESTILOS.length) return null;

  return (
    <div className="ete-root">
      <style>{`
        .ete-root{
          --bg:#FBFBFA; --ink:#141414; --word:#EAEAE7;
          --muted:#8A8A85; --line:#E4E4E0; --veil:#9A9A95;
          background:var(--bg); color:var(--ink);
          font-family:'Inter',system-ui,-apple-system,sans-serif;
          padding:56px 0 66px; position:relative; overflow:hidden;
        }
        .ete-top{ text-align:center; padding:0 16px; margin-bottom:8px; position:relative; z-index:2; }
        .ete-eyebrow{ letter-spacing:.34em; font-size:11px; font-weight:600;
          color:var(--muted); text-transform:uppercase; }
        .ete-stage{
          position:relative; width:100%; max-width:1360px; margin:0 auto;
          perspective:1800px; touch-action:pan-y; outline:none; user-select:none;
        }
        .ete-stage:focus-visible .ete-track{ box-shadow:0 0 0 2px var(--ink) inset; border-radius:20px; }
        .ete-word{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          z-index:1; pointer-events:none; }
        .ete-word span{
          font-family:'Archivo Black','Arial Black','Inter',sans-serif;
          font-weight:900; text-transform:uppercase;
          color:var(--word);
          font-size:clamp(64px,16vw,220px); line-height:1; letter-spacing:-.02em;
          white-space:nowrap; transition:opacity .35s ease;
        }
        .ete-track{ position:absolute; inset:0; width:100%; transform-style:preserve-3d; z-index:2; }
        .ete-card{
          position:absolute; left:50%; top:50%; border-radius:22px; overflow:hidden;
          border:1px solid var(--line); will-change:transform,opacity;
          box-shadow:0 26px 55px rgba(20,20,20,.14), 0 6px 14px rgba(20,20,20,.08);
        }
        .ete-fx{ position:absolute; inset:0; filter:blur(4px); transform:scale(1.06); }
        .ete-fx-base{ position:absolute; inset:0;
          background:linear-gradient(180deg,#FCFCFB 0%,#F1F1EF 100%); }
        .ete-card img{ width:100%; height:100%; object-fit:cover; display:block;
          position:absolute; inset:0; -webkit-user-drag:none;
          filter:grayscale(1) contrast(1.04); }
        .ete-veil{ position:absolute; inset:0; background:var(--veil); }
        .ete-num{ position:absolute; top:12px; left:14px; z-index:2;
          font-size:11px; letter-spacing:.22em; font-weight:700; color:#9C9C97; }
        .ete-meta{ text-align:center; margin-top:26px; position:relative; z-index:3; }
        .ete-label{ font-family:'Archivo Black','Arial Black',sans-serif; font-size:15px;
          letter-spacing:.02em; color:var(--ink); text-transform:uppercase; }
        .ete-desc{ margin-top:6px; font-size:12px; letter-spacing:.32em; color:var(--muted); text-transform:uppercase; }
        .ete-ver{
          margin-top:14px; cursor:pointer; border:1px solid var(--ink); background:var(--ink);
          color:#fff; font-weight:600; font-size:13px; letter-spacing:.03em;
          padding:11px 26px; border-radius:999px; transition:background .2s,color .2s,transform .1s;
        }
        .ete-ver:hover{ background:transparent; color:var(--ink); }
        .ete-ver:active{ transform:scale(.97); }
        .ete-ctl{ display:flex; justify-content:center; gap:16px; margin-top:22px; position:relative; z-index:3; }
        .ete-arrow{
          width:44px; height:44px; border-radius:999px; cursor:pointer;
          background:#fff; border:1px solid var(--line); color:var(--ink); font-size:18px;
          display:grid; place-items:center; transition:border-color .2s, transform .1s;
        }
        .ete-arrow:hover{ border-color:var(--ink); }
        .ete-arrow:active{ transform:scale(.92); }
        .ete-dots{ display:flex; gap:8px; justify-content:center; margin-top:22px; position:relative; z-index:3; }
        .ete-dot{ width:7px; height:7px; border-radius:999px; cursor:pointer; border:none;
          background:#D6D6D1; transition:all .3s; padding:0; }
        .ete-dot.on{ width:24px; background:var(--ink); }

        @media (max-width:640px){
          .ete-root{ padding:36px 0 44px; }
          .ete-top{ margin-bottom:2px; }
          .ete-word span{ font-size:clamp(52px,19vw,116px); }
          .ete-meta{ margin-top:16px; }
          .ete-label{ font-size:14px; }
          .ete-desc{ font-size:11px; letter-spacing:.24em; }
          .ete-ver{ margin-top:12px; padding:10px 22px; }
          .ete-ctl{ margin-top:16px; gap:14px; }
          .ete-arrow{ width:40px; height:40px; }
          .ete-dots{ margin-top:16px; }
        }
      `}</style>

      <div className="ete-top">
        <span className="ete-eyebrow">encontrá tu estilo</span>
      </div>

      <div
        ref={stageRef}
        className="ete-stage"
        tabIndex={0}
        role="listbox"
        aria-label="Estilos de jean"
        onKeyDown={onKey}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        style={{ height: cardH + 60 }}
      >
        <div className="ete-word" style={{ height: cardH + 60 }}>
          <span key={snapped} style={{ opacity: wordOpacity }}>{ESTILOS[snapped].nombre}</span>
        </div>

        <div className="ete-track" style={{ height: cardH + 60 }}>
          {ESTILOS.map((e, i) => (
            <div
              key={e.id}
              className="ete-card"
              style={cardStyle(i)}
              role="option"
              aria-selected={i === snapped}
              onClick={() => { if (i !== snapped) go(i); }}
            >
              <div className="ete-fx-base" />
              <div className="ete-fx" style={{ background: e.grad }} />
              {e.img && (
                <img src={e.img} alt={e.nombre} loading="lazy" decoding="async" draggable={false} />
              )}
              <div className="ete-veil" style={{ opacity: shadeOpacity(i) }} />
              <span className="ete-num">{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ete-meta">
        <div className="ete-label">{String(snapped + 1).padStart(2, "0")} · {ESTILOS[snapped].nombre}</div>
        <div className="ete-desc">{ESTILOS[snapped].desc}</div>
        <button className="ete-ver" onClick={handleVer}>Ver estilo</button>
      </div>

      <div className="ete-ctl">
        <button className="ete-arrow" aria-label="Anterior" onClick={() => go(snapped - 1)}>‹</button>
        <button className="ete-arrow" aria-label="Siguiente" onClick={() => go(snapped + 1)}>›</button>
      </div>

      <div className="ete-dots">
        {ESTILOS.map((e, i) => (
          <button key={e.id} className={`ete-dot ${i === snapped ? "on" : ""}`}
            aria-label={`Ir a ${e.nombre}`} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  );
}
