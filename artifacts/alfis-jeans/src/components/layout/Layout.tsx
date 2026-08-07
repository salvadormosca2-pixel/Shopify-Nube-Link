import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MessageCircle } from "lucide-react";

const WHATSAPP_MSG = encodeURIComponent("Hola! Quisiera consultar sobre los productos de Alfis Jeans.");
const WHATSAPP_URL = `https://wa.me/5493834330385?text=${WHATSAPP_MSG}`;

// Mensajes fijos de la barra superior. A estos se les suma, adelante, la promo
// comercial que el dueño carga en Admin → Promociones ("3x2 en remeras"), que
// hasta ahora sólo veía el bot de WhatsApp y nunca aparecía en la web.
const PROMOS_FIJAS = [
  "Envíos a todo el país · Retiro sin cargo en nuestro local de Catamarca",
];

function AnnouncementBar() {
  const [idx, setIdx] = useState(0);
  const [promoPanel, setPromoPanel] = useState<string | null>(null);
  const [cuotas, setCuotas] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/promo-activa")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.activa || !d.titulo) return;
        setPromoPanel(d.descripcion ? `${d.titulo} · ${d.descripcion}` : d.titulo);
      })
      .catch(() => {});
    // Financiación: la carga el dueño en Admin → Cuotas y tarjetas.
    fetch("/api/financiacion/resumen")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d?.texto) setCuotas(d.texto);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const mensajes = [
    ...(promoPanel ? [promoPanel] : []),
    ...(cuotas ? [cuotas] : []),
    ...PROMOS_FIJAS,
  ];

  useEffect(() => {
    if (mensajes.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % mensajes.length), 4000);
    return () => clearInterval(t);
  }, [mensajes.length]);

  return (
    <div className="bg-[hsl(0,0%,96%)] py-2.5 px-4 text-center overflow-hidden border-b border-[hsl(var(--border))]">
      <p
        className="text-[11px] font-medium tracking-[0.15em] uppercase text-foreground/70"
        key={idx}
      >
        {mensajes[idx % mensajes.length]}
      </p>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans">
      {!isAdmin && <AnnouncementBar />}
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Consultanos por WhatsApp"
        data-testid="whatsapp-button"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_4px_24px_rgba(37,211,102,0.3)] hover:scale-110 hover:shadow-[0_6px_32px_rgba(37,211,102,0.4)] active:scale-95 transition-all duration-300"
      >
        <MessageCircle className="h-6 w-6 fill-current" />
      </a>
    </div>
  );
}
