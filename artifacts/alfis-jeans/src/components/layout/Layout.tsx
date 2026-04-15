import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Lock, Truck, MessageCircle } from "lucide-react";

const WHATSAPP_MSG = encodeURIComponent("Hola! Quisiera consultar sobre los productos de Alfis Jeans.");
const WHATSAPP_URL = `https://wa.me/5493834000000?text=${WHATSAPP_MSG}`;

const TRUST_ITEMS = [
  {
    icon: Lock,
    text: "Pago seguro",
    href: null,
  },
  {
    icon: Truck,
    text: "Envío a todo el país",
    href: null,
  },
  {
    icon: MessageCircle,
    text: "Consultanos por WhatsApp",
    href: WHATSAPP_URL,
  },
];

function TrustBar() {
  const [mobileIdx, setMobileIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMobileIdx((i) => (i + 1) % TRUST_ITEMS.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-black border-b border-zinc-800 py-2 px-4 select-none">
      {/* Desktop: todos en línea */}
      <div className="hidden md:flex items-center justify-center gap-8">
        {TRUST_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="h-3 w-3 text-zinc-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                {item.text}
              </span>
            </>
          );
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-zinc-700 text-xs mr-6">·</span>
              )}
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors group"
                >
                  <Icon className="h-3 w-3 text-zinc-400 group-hover:text-white flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400 group-hover:text-white">
                    {item.text}
                  </span>
                </a>
              ) : (
                content
              )}
            </span>
          );
        })}
      </div>

      {/* Mobile: rota entre los 3 mensajes */}
      <div className="flex md:hidden items-center justify-center">
        {(() => {
          const item = TRUST_ITEMS[mobileIdx];
          const Icon = item.icon;
          const inner = (
            <span className="flex items-center gap-2">
              <Icon className="h-3 w-3 text-zinc-400 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                {item.text}
              </span>
            </span>
          );
          return item.href ? (
            <a href={item.href} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            inner
          );
        })()}
      </div>
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
      {!isAdmin && <TrustBar />}
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />

      {/* WhatsApp floating button — dark premium */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Consultanos por WhatsApp"
        data-testid="whatsapp-button"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-zinc-900 text-white shadow-lg hover:bg-zinc-800 transition-colors"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
      >
        <MessageCircle className="h-7 w-7 fill-white" />
      </a>
    </div>
  );
}
