import { useState } from "react";
import { useSendContactMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, MapPin, Phone, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Contact() {
  const { toast } = useToast();
  const sendMessage = useSendContactMessage();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: "Completá todos los campos", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await sendMessage.mutateAsync({ data: form });
      setSent(true);
    } catch {
      toast({ title: "Error al enviar el mensaje", description: "Intentá nuevamente más tarde.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="mb-12">
        <p className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground mb-2">Estamos acá</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight mb-4">Contacto</h1>
        <div className="h-[3px] w-16 bg-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Info */}
        <div className="space-y-10">
          <p className="text-muted-foreground text-lg leading-relaxed">
            ¿Tenés alguna consulta sobre tus pedidos, talles o nuestra colección? 
            Estamos disponibles para ayudarte.
          </p>

          <div className="space-y-6">
            {[
              {
                icon: <MapPin className="h-5 w-5" />,
                title: "Ubicación",
                lines: ["San Martín 123, K5000", "San Fernando del Valle de Catamarca", "Catamarca, Argentina"]
              },
              {
                icon: <Phone className="h-5 w-5" />,
                title: "WhatsApp",
                lines: ["+54 9 383 400-0000"]
              },
              {
                icon: <Mail className="h-5 w-5" />,
                title: "Email",
                lines: ["hola@alfisjeans.com.ar"]
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex gap-4 items-start"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <div className="w-10 h-10 border border-border flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="font-bold uppercase text-xs tracking-wider mb-1">{item.title}</p>
                  {item.lines.map((line, j) => (
                    <p key={j} className="text-muted-foreground text-sm">{line}</p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="border border-border p-6 bg-card">
            <p className="text-xs font-bold uppercase tracking-wider mb-2">Horario de atención</p>
            <p className="text-muted-foreground text-sm">Lunes a Viernes: 9:00 – 18:00 hs</p>
            <p className="text-muted-foreground text-sm">Sábados: 9:00 – 13:00 hs</p>
          </div>
        </div>

        {/* Form */}
        <div>
          {sent ? (
            <motion.div
              className="border border-border p-10 text-center bg-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              data-testid="contact-success"
            >
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <h2 className="font-display font-bold uppercase text-2xl mb-3">Mensaje enviado</h2>
              <p className="text-muted-foreground mb-6">
                Gracias por contactarnos. Te responderemos a la brevedad.
              </p>
              <Button
                variant="outline"
                className="rounded-none uppercase text-xs font-bold"
                onClick={() => { setSent(false); setForm({ name: "", email: "", message: "" }); }}
                data-testid="button-send-another"
              >
                Enviar otro mensaje
              </Button>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              className="border border-border p-6 md:p-8 bg-card space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="font-display font-bold uppercase text-xl tracking-tight">Envianos tu consulta</h2>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Nombre completo</label>
                <Input
                  placeholder="Juan Pérez"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="rounded-none border-border"
                  data-testid="input-contact-name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Email</label>
                <Input
                  type="email"
                  placeholder="juan@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="rounded-none border-border"
                  data-testid="input-contact-email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Mensaje</label>
                <Textarea
                  placeholder="Contanos en qué te podemos ayudar..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="rounded-none border-border resize-none"
                  rows={6}
                  data-testid="input-contact-message"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-none uppercase font-bold tracking-wider"
                disabled={isSubmitting}
                data-testid="button-contact-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : "Enviar mensaje"}
              </Button>
            </motion.form>
          )}
        </div>
      </div>
    </div>
  );
}
