import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Confirmation() {
  const { trackingNumber } = useParams<{ trackingNumber: string }>();

  return (
    <div className="container mx-auto px-4 py-20 min-h-[70vh] flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
      >
        <CheckCircle2 className="h-24 w-24 text-primary mb-8" />
      </motion.div>
      
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-4"
      >
        ¡Pago Exitoso!
      </motion.h1>
      
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xl text-muted-foreground mb-12 max-w-lg"
      >
        Tu orden ha sido confirmada y ya estamos preparándola para el envío.
      </motion.p>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="border border-border bg-card p-8 w-full max-w-md mb-12"
      >
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Código de Seguimiento</p>
        <p className="text-3xl font-display font-bold tracking-widest">{trackingNumber}</p>
        <p className="text-xs text-muted-foreground mt-4">
          Guardá este código. Te lo hemos enviado por email también.
        </p>
      </motion.div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <Button asChild size="lg" variant="outline" className="h-14 px-8 rounded-none font-bold uppercase" data-testid="button-track-order">
          <Link href="/seguimiento" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Rastrear Pedido
          </Link>
        </Button>
        <Button asChild size="lg" className="h-14 px-8 rounded-none font-bold uppercase group" data-testid="button-continue-shopping">
          <Link href="/" className="flex items-center gap-2">
            Seguir Comprando
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
