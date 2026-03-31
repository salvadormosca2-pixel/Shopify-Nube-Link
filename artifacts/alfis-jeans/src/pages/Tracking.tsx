import { useState } from "react";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Package, Clock, Truck, CheckCircle2 } from "lucide-react";
import { formatArs } from "@/lib/utils";
import { motion } from "framer-motion";

export default function Tracking() {
  const [trackingInput, setTrackingInput] = useState("");
  const [activeTracking, setActiveTracking] = useState("");

  const { data: order, isLoading, isError, error } = useGetOrder(activeTracking, {
    query: {
      enabled: !!activeTracking,
      queryKey: getGetOrderQueryKey(activeTracking),
      retry: false
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingInput.trim()) {
      setActiveTracking(trackingInput.trim());
    }
  };

  const steps = [
    { id: "pending", label: "Recibido", icon: Clock },
    { id: "preparing", label: "En preparación", icon: Package },
    { id: "shipped", label: "Despachado", icon: Truck },
    { id: "delivered", label: "Entregado", icon: CheckCircle2 }
  ];

  const getStepIndex = (status: string) => {
    if (status === "confirmed") return 0; // mapped to received
    const index = steps.findIndex(s => s.id === status);
    return index >= 0 ? index : 0;
  };

  const currentStep = order ? getStepIndex(order.status) : -1;

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl min-h-[70vh]">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-tight mb-4">
          Seguimiento de Envío
        </h1>
        <p className="text-muted-foreground text-lg">
          Ingresá tu código de seguimiento para conocer el estado de tu pedido.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto mb-16">
        <Input
          placeholder="Ej: TRK-12345678"
          value={trackingInput}
          onChange={(e) => setTrackingInput(e.target.value)}
          className="h-14 rounded-none border-border text-lg px-6"
          data-testid="input-tracking"
        />
        <Button type="submit" className="h-14 px-8 rounded-none font-bold uppercase" data-testid="button-track">
          Buscar
        </Button>
      </form>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {isError && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-6 text-center">
          <p className="font-bold">No se encontró el pedido.</p>
          <p className="text-sm mt-2">Verificá que el código sea correcto e intentá nuevamente.</p>
        </div>
      )}

      {order && !isLoading && !isError && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-border p-6 md:p-10 bg-card"
        >
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-12 pb-8 border-b border-border">
            <div>
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Pedido</p>
              <h2 className="text-2xl font-display font-bold">{order.trackingNumber}</h2>
            </div>
            <div className="md:text-right">
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Fecha</p>
              <p className="font-medium">{new Date(order.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative mb-16 px-4 md:px-12">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 z-0 hidden md:block"></div>
            <div 
              className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 hidden md:block transition-all duration-1000"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            ></div>
            
            <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-0 relative z-10">
              {steps.map((step, index) => {
                const isActive = index <= currentStep;
                const isCurrent = index === currentStep;
                const Icon = step.icon;
                
                return (
                  <div key={step.id} className="flex md:flex-col items-center gap-4 md:gap-3 text-center">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-500
                      ${isActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}
                      ${isCurrent ? 'ring-4 ring-primary/20' : ''}
                    `}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-bold uppercase tracking-wider text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <h3 className="font-display font-bold text-lg uppercase mb-4">Dirección de Envío</h3>
              <div className="space-y-1 text-muted-foreground">
                <p className="text-foreground font-medium">{order.customer.firstName} {order.customer.lastName}</p>
                <p>{order.customer.address}</p>
                <p>{order.customer.city}, {order.customer.province}</p>
                <p>CP: {order.customer.postalCode}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-display font-bold text-lg uppercase mb-4">Resumen</h3>
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.productName} ({item.color}, {item.size})
                    </span>
                    <span className="font-medium">{formatArs(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatArs(order.total - order.shippingCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Envío</span>
                    <span>{formatArs(order.shippingCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatArs(order.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
