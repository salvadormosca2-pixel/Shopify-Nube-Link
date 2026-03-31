import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-muted py-12 mt-20 border-t border-border">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-display font-bold text-xl mb-4">ALFIS.</h3>
          <p className="text-muted-foreground text-sm">
            Denim premium para el hombre argentino. Calidad y actitud desde Catamarca para todo el país.
          </p>
        </div>
        
        <div>
          <h4 className="font-bold mb-4">Categorías</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/">Jeans</Link></li>
            <li><Link href="/">Remeras</Link></li>
            <li><Link href="/">Camperas</Link></li>
            <li><Link href="/">Accesorios</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-bold mb-4">Ayuda</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/seguimiento">Seguimiento de pedidos</Link></li>
            <li><Link href="/">Cambios y devoluciones</Link></li>
            <li><Link href="/">Guía de talles</Link></li>
            <li><Link href="/">Preguntas frecuentes</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-bold mb-4">Contacto</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>hola@alfisjeans.com.ar</li>
            <li>+54 9 383 4123456</li>
            <li>San Martín 123, K5000</li>
            <li>Catamarca, Argentina</li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Alfis Jeans. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
