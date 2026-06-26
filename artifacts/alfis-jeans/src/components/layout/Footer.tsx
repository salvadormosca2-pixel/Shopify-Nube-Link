import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-background text-foreground border-t border-[hsl(var(--border))]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 pt-20 md:pt-28 pb-16 md:pb-20">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-12 mb-16 md:mb-24">
          <div>
            <h3 className="font-display text-[clamp(3rem,8vw,5.5rem)] tracking-[0.06em] text-foreground leading-none mb-4">
              ALFIS JEANS
            </h3>
            <p className="text-[15px] font-light leading-relaxed text-[hsl(var(--muted-foreground))] max-w-sm">
              Denim premium desde Catamarca. Calidad y actitud para el hombre argentino.
            </p>
          </div>

          <div className="lg:text-right">
            <p className="font-display text-sm tracking-wide text-foreground mb-4">
              Seguinos
            </p>
            <a
              href="https://www.instagram.com/alfisjeans"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-light text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
            >
              @alfisjeans <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div>
            <h4 className="font-display text-sm tracking-wide text-foreground mb-4">Colecciones</h4>
            <ul className="space-y-3 text-sm font-light text-[hsl(var(--muted-foreground))]">
              <li><Link href="/" className="link-underline hover:text-foreground transition-colors duration-300">Hombre</Link></li>
              <li><Link href="/priority" className="link-underline hover:text-foreground transition-colors duration-300">Priority</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-sm tracking-wide text-foreground mb-4">Categorías</h4>
            <ul className="space-y-3 text-sm font-light text-[hsl(var(--muted-foreground))]">
              <li><Link href="/?categoria=pantalon" className="link-underline hover:text-foreground transition-colors duration-300">Jeans</Link></li>
              <li><Link href="/?categoria=remeras" className="link-underline hover:text-foreground transition-colors duration-300">Remeras</Link></li>
              <li><Link href="/?categoria=BUZOS" className="link-underline hover:text-foreground transition-colors duration-300">Abrigos</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-sm tracking-wide text-foreground mb-4">Ayuda</h4>
            <ul className="space-y-3 text-sm font-light text-[hsl(var(--muted-foreground))]">
              <li><Link href="/seguimiento" className="link-underline hover:text-foreground transition-colors duration-300">Seguimiento</Link></li>
              <li><Link href="/contacto" className="link-underline hover:text-foreground transition-colors duration-300">Contacto</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-sm tracking-wide text-foreground mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm font-light text-[hsl(var(--muted-foreground))]">
              <li>+54 9 3834 33-0385</li>
              <li>Rivadavia 817, Catamarca</li>
              <li>Argentina</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--border))]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-light text-[hsl(var(--muted-foreground))]">
            &copy; {new Date().getFullYear()} Alfis Jeans. Todos los derechos reservados.
          </p>
          <a
            href="https://wa.me/5493834330385"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-light text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors duration-300"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
