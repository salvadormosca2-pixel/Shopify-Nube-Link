import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { CartProvider } from "@/context/CartContext";
import { Layout } from "@/components/layout/Layout";

import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Confirmation from "@/pages/Confirmation";
import Tracking from "@/pages/Tracking";
import Contact from "@/pages/Contact";
import Priority from "@/pages/Priority";
import Admin from "@/pages/Admin";
import Priority from "@/pages/Priority";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={Admin} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/mujer/priority" component={Priority} />
            <Route path="/productos/:id" component={ProductDetail} />
            <Route path="/carrito" component={Cart} />
            <Route path="/checkout" component={Checkout} />
            <Route path="/confirmacion/:trackingNumber" component={Confirmation} />
            <Route path="/seguimiento" component={Tracking} />
            <Route path="/contacto" component={Contact} />
            <Route path="/priority" component={Priority} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
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
