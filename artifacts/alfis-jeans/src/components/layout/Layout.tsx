import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MessageCircle } from "lucide-react";

const WHATSAPP_MSG = encodeURIComponent("Hola! Quisiera consultar sobre los productos de Alfis Jeans.");
const WHATSAPP_URL = `https://wa.me/5493834330385?text=${WHATSAPP_MSG}`;

const PROMOS = [
  "Envío gratis a todo el país",
  "Hasta 3 cuotas sin interés",
  "Cambios y devoluciones gratis",
];

function AnnouncementBar() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % PROMOS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-[hsl(0,0%,96%)] py-2.5 px-4 text-center overflow-hidden border-b border-[hsl(var(--border))]">
      <p
        className="text-[11px] font-medium tracking-[0.15em] uppercase text-foreground/70"
        key={idx}
      >
        {PROMOS[idx]}
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
