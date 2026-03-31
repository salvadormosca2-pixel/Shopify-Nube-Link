import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCart } from "@/context/CartContext";
import { useGetProvinces, useGetShippingCost, useCreateOrder, useCreatePaymentPreference, getGetShippingCostQueryKey } from "@workspace/api-client-react";
import { formatArs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const checkoutSchema = z.object({
  firstName: z.string().min(2, "El nombre es requerido"),
  lastName: z.string().min(2, "El apellido es requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(8, "Teléfono inválido"),
  address: z.string().min(5, "Dirección requerida"),
  city: z.string().min(2, "Ciudad requerida"),
  province: z.string().min(2, "Provincia requerida"),
  postalCode: z.string().min(4, "Código postal requerido"),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const { toast } = useToast();
  
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: provincesData } = useGetProvinces();
  
  const { data: shippingData, isLoading: isLoadingShipping } = useGetShippingCost(
    { province: selectedProvince },
    { query: { enabled: !!selectedProvince, queryKey: getGetShippingCostQueryKey({ province: selectedProvince }) } }
  );

  const createOrderMutation = useCreateOrder();
  const createPaymentMutation = useCreatePaymentPreference();

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
    },
  });

  // Watch province change to trigger shipping cost calc
  const formProvince = form.watch("province");
  useEffect(() => {
    if (formProvince) {
      setSelectedProvince(formProvince);
    }
  }, [formProvince]);

  const shippingCost = shippingData?.cost || 0;
  const total = subtotal + shippingCost;

  if (items.length === 0) {
    setLocation("/carrito");
    return null;
  }

  const onSubmit = async (data: CheckoutFormValues) => {
    if (!shippingData) {
      toast({
        title: "Error",
        description: "Por favor seleccione una provincia para calcular el envío",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create Order
      const orderItems = items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        price: i.price
      }));

      const order = await createOrderMutation.mutateAsync({
        data: {
          customer: data,
          items: orderItems,
          shippingCost,
          total
        }
      });

      // 2. Create MP Preference
      const mpItems = items.map(i => ({
        title: `${i.productName} - ${i.color} (${i.size})`,
        quantity: i.quantity,
        unit_price: i.price
      }));

      // Add shipping as an item
      if (shippingCost > 0) {
        mpItems.push({
          title: "Costo de Envío",
          quantity: 1,
          unit_price: shippingCost
        });
      }

      const preference = await createPaymentMutation.mutateAsync({
        data: {
          orderId: order.id,
          items: mpItems,
          payer: {
            name: data.firstName,
            surname: data.lastName,
            email: data.email
          },
          total
        }
      });

      // Clear cart before redirecting
      clearCart();

      // Redirect to MP
      window.location.href = preference.initPoint;

    } catch (error) {
      console.error(error);
      toast({
        title: "Error al procesar el pago",
        description: "Hubo un problema al generar la orden. Por favor intentá nuevamente.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight mb-10">Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" id="checkout-form">
              
              <div className="border border-border p-6 bg-card">
                <h2 className="text-xl font-display font-bold uppercase mb-6 pb-4 border-b border-border">
                  Datos de Contacto
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan" className="rounded-none border-border" {...field} data-testid="input-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Pérez" className="rounded-none border-border" {...field} data-testid="input-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="juan@ejemplo.com" type="email" className="rounded-none border-border" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="+54 9 11 1234-5678" className="rounded-none border-border" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border border-border p-6 bg-card">
                <h2 className="text-xl font-display font-bold uppercase mb-6 pb-4 border-b border-border">
                  Dirección de Envío
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Dirección (Calle, número, piso/depto)</FormLabel>
                        <FormControl>
                          <Input placeholder="Av. Corrientes 1234" className="rounded-none border-border" {...field} data-testid="input-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provincia</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-none border-border" data-testid="select-province">
                              <SelectValue placeholder="Seleccionar provincia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {provincesData?.provinces.map((prov) => (
                              <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ciudad Autónoma de Buenos Aires" className="rounded-none border-border" {...field} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Postal</FormLabel>
                        <FormControl>
                          <Input placeholder="1043" className="rounded-none border-border" {...field} data-testid="input-postalcode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

            </form>
          </Form>
        </div>

        <div className="lg:col-span-5">
          <div className="border border-border p-6 bg-card sticky top-24">
            <h2 className="text-xl font-display font-bold uppercase mb-6 pb-4 border-b border-border">
              Resumen de Compra
            </h2>
            
            <div className="space-y-4 mb-6">
              {items.map((item) => (
                <div key={`${item.productId}-${item.size}-${item.color}`} className="flex gap-4">
                  <div className="w-16 h-20 bg-muted flex-shrink-0">
                    <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center text-sm">
                    <span className="font-bold line-clamp-1">{item.productName}</span>
                    <span className="text-muted-foreground uppercase">{item.color} | Talle {item.size}</span>
                    <span className="text-muted-foreground mt-1">Cant: {item.quantity} x {formatArs(item.price)}</span>
                  </div>
                  <div className="font-bold pt-2">
                    {formatArs(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm border-t border-border pt-6 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatArs(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Envío</span>
                {isLoadingShipping ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <span className="font-medium">
                    {selectedProvince ? (shippingCost > 0 ? formatArs(shippingCost) : "Gratis") : "Seleccioná provincia"}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-8 border-t border-border pt-6">
              <span className="font-bold uppercase tracking-wider text-lg">Total</span>
              <span className="text-2xl font-bold">{formatArs(total)}</span>
            </div>
            
            <Button 
              type="submit" 
              form="checkout-form"
              className="w-full h-14 rounded-none uppercase font-bold tracking-wider" 
              disabled={isProcessing || !selectedProvince || isLoadingShipping}
              data-testid="button-pay-mercadopago"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Pagar con MercadoPago"
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Serás redirigido a MercadoPago para completar la transacción de forma segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
