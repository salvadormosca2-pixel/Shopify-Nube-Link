import { MapPin, Phone, Clock, MessageCircle, Mail } from "lucide-react";
import { motion } from "framer-motion";

const WHATSAPP_MSG = encodeURIComponent("Hola! Quisiera consultar sobre los productos de Alfis Jeans.");
const WHATSAPP_URL = `https://wa.me/5493834330385?text=${WHATSAPP_MSG}`;

const INFO_ITEMS = [
  {
    icon: <MapPin className="h-5 w-5" />,
    title: "Ubicación",
    lines: ["San Martín 123, K5000", "Catamarca, Argentina"],
  },
  {
    icon: <Phone className="h-5 w-5" />,
    title: "Teléfono",
    lines: ["+54 9 383 4123456"],
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: "WhatsApp",
    lines: ["+54 9 3834 33-0385"],
  },
  {
    icon: <Mail className="h-5 w-5" />,
    title: "Email",
    lines: ["hola@alfisjeans.com.ar"],
  },
];

export default function Contact() {
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
            {INFO_ITEMS.map((item, i) => (
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

          {/* Horarios */}
          <motion.div
            className="border border-border p-6 bg-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-bold uppercase tracking-wider">Horario de atención</p>
            </div>
            <p className="text-muted-foreground text-sm">Lunes a sábados</p>
            <p className="font-semibold text-sm mt-1">9:00 – 13:00hs &nbsp;/&nbsp; 17:30 – 21:30hs</p>
          </motion.div>

          {/* Mapa */}
          <div className="border border-border overflow-hidden" data-testid="contact-map">
            <p className="text-xs font-bold uppercase tracking-wider p-3 border-b border-border">Encontranos aquí</p>
            <iframe
              title="Alfis Jeans Catamarca — San Martín 123"
              src="https://maps.google.com/maps?q=San+Mart%C3%ADn+123,+K5000+Catamarca,+Argentina&z=17&output=embed"
              width="100%"
              height="260"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <a
              href="https://www.google.com/maps/dir//Alfis+Jeans,+San+Mart%C3%ADn+123,+K5000+Catamarca,+Argentina"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 border-t border-border text-xs font-bold uppercase tracking-wider hover:bg-muted transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              Cómo llegar — Google Maps
            </a>
          </div>
        </div>

        {/* WhatsApp CTA */}
        <div>
          <motion.div
            className="border border-border p-8 md:p-10 bg-card space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="font-display font-bold uppercase text-xl tracking-tight">Envianos tu consulta</h2>

            <p className="text-muted-foreground text-sm leading-relaxed">
              Escribinos directamente por WhatsApp y te respondemos a la brevedad.
              Estamos disponibles durante el horario de atención para ayudarte con
              talles, productos, pedidos y todo lo que necesites.
            </p>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="whatsapp-contact-button"
              className="flex items-center justify-center gap-3 w-full h-14 bg-foreground text-background border border-foreground font-bold uppercase tracking-[0.15em] text-sm transition-opacity hover:opacity-80"
            >
              <MessageCircle className="h-5 w-5 fill-background" />
              Escribinos por WhatsApp
            </a>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
