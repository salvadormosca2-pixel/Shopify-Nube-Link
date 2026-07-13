import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { CartProvider } from "@/context/CartContext";
import { Layout } from "@/components/layout/Layout";

const Home = lazy(() => import("@/pages/Home"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Confirmation = lazy(() => import("@/pages/Confirmation"));
const Tracking = lazy(() => import("@/pages/Tracking"));
const Contact = lazy(() => import("@/pages/Contact"));
const Priority = lazy(() => import("@/pages/Priority"));
const Buscar = lazy(() => import("@/pages/Buscar"));
const Admin = lazy(() => import("@/pages/Admin"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <Switch>
        <Route path="/admin" component={Admin} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/productos/:id" component={ProductDetail} />
              <Route path="/carrito" component={Cart} />
              <Route path="/checkout" component={Checkout} />
              <Route path="/confirmacion/:trackingNumber" component={Confirmation} />
              <Route path="/seguimiento" component={Tracking} />
              <Route path="/contacto" component={Contact} />
              <Route path="/priority" component={Priority} />
              <Route path="/buscar" component={Buscar} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
