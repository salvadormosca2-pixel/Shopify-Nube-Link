import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, ArrowRight, AlertTriangle, MessageCircle } from "lucide-react";
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
        ¡Gracias por tu compra! Ya recibimos tu pedido.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-md mb-6"
      >
        <div className="border-l-4 border-yellow-500 bg-yellow-500/10 p-4 mb-0 flex items-start gap-3 text-left">
          <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base md:text-lg font-bold uppercase tracking-wider text-yellow-400">
              No pierdas este código
            </p>
            <p className="text-sm text-yellow-50 mt-1">
              Lo vas a necesitar para hacer el seguimiento de tu pedido.
            </p>
          </div>
        </div>
        <div className="border border-t-0 border-border bg-card p-8">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Código de Seguimiento
          </p>
          <p className="text-3xl font-display font-bold tracking-widest break-all" data-testid="text-tracking-code">
            {trackingNumber}
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-md mb-12 border border-green-500/40 bg-green-500/5 p-6 flex items-start gap-4 text-left"
      >
        <MessageCircle className="h-7 w-7 text-green-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-base font-bold uppercase tracking-wider text-green-400 mb-2">
            Te contactamos por WhatsApp
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            En las próximas horas vas a recibir un mensaje en WhatsApp para
            confirmar tu compra. Ahí también te enviaremos el código de
            seguimiento del Correo Argentino para que rastrees tu envío.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
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
