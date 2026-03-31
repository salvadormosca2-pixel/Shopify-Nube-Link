import React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MessageCircle } from "lucide-react";

const WHATSAPP_MSG = encodeURIComponent("Hola! Quisiera consultar sobre los productos de Alfis Jeans.");
const WHATSAPP_URL = `https://wa.me/5493834000000?text=${WHATSAPP_MSG}`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />

      {/* WhatsApp floating button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Consultanos por WhatsApp"
        data-testid="whatsapp-button"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#1ebe5d] transition-colors"
        style={{ boxShadow: "0 4px 20px rgba(37,211,102,0.4)" }}
      >
        <MessageCircle className="h-7 w-7 fill-white" />
      </a>
    </div>
  );
}
