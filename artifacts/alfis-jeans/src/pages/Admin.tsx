import { useState, useEffect, useCallback } from "react";
import { formatArs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Package, Tag, ShoppingBag, LogOut, Save,
  Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
  TrendingUp, AlertCircle, CheckCircle2, ChevronDown
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Product = {
  id: number; name: string; category: string;
  price: string; stock: number; featured: boolean; images: string[];
};
type Coupon = {
  id: number; code: string; discount: number;
  active: boolean; createdAt: string;
};
type Order = {
  id: number; trackingNumber: string; status: string;
  customerFirstName: string; customerLastName: string;
  customerEmail: string; customerProvince: string;
  total: string; createdAt: string; items: unknown[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmado",
  preparing: "Preparando", shipped: "Enviado", delivered: "Entregado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  preparing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  shipped: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  delivered: "bg-green-500/20 text-green-400 border-green-500/30",
};

async function adminFetch(path: string, adminKey: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await adminFetch("/admin/verify", password);
      sessionStorage.setItem("alfis_admin_key", password);
      onLogin(password);
    } catch {
      setError("Contraseña incorrecta");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-1">
            ALFIS<span className="text-zinc-500">.</span>
          </h1>
          <p className="text-zinc-500 text-sm">Panel de Administrador</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="password"
              placeholder="Contraseña de administrador"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              className="pl-10 rounded-none border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-600 h-12 focus-visible:ring-0 focus-visible:border-zinc-400"
              autoFocus
              data-testid="input-admin-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 rounded-none uppercase font-bold tracking-wider bg-white text-black hover:bg-zinc-200"
            disabled={isLoading}
            data-testid="button-admin-login"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab({ adminKey }: { adminKey: string }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ price: string; stock: string }>({ price: "", stock: "" });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todos");

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminFetch("/admin/products", adminKey);
      setProducts(data.products);
    } catch {
      toast({ title: "Error al cargar productos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditValues({ price: String(parseFloat(p.price)), stock: String(p.stock) });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (id: number) => {
    setSavingId(id);
    try {
      const updated = await adminFetch(`/admin/products/${id}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({
          price: parseFloat(editValues.price),
          stock: parseInt(editValues.stock, 10),
        }),
      });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, price: updated.price, stock: updated.stock } : p));
      setEditingId(null);
      toast({ title: "Producto actualizado" });
    } catch (e: unknown) {
      toast({ title: "Error al guardar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const toggleFeatured = async (p: Product) => {
    try {
      const updated = await adminFetch(`/admin/products/${p.id}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ featured: !p.featured }),
      });
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, featured: updated.featured } : x));
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  };

  const categories = ["todos", ...Array.from(new Set(products.map(p => p.category))).sort()];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "todos" || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Productos", value: products.length },
          { label: "Sin Stock", value: products.filter(p => p.stock === 0).length },
          { label: "Destacados", value: products.filter(p => p.featured).length },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 p-4 rounded-none">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-none border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-600 sm:w-64"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs font-bold uppercase border transition-colors ${
                categoryFilter === cat
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product table */}
      <div className="border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Categoría</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Precio</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Stock</th>
                <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Destacado</th>
                <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(product => (
                <tr key={product.id} className={`hover:bg-zinc-900/50 transition-colors ${editingId === product.id ? "bg-zinc-900/80" : ""}`}>
                  {/* Name + image */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images[0] && (
                        <img src={product.images[0]} alt={product.name} className="w-10 h-12 object-cover flex-shrink-0 opacity-80" />
                      )}
                      <div>
                        <p className="font-medium text-sm leading-tight">{product.name}</p>
                        {product.stock === 0 && (
                          <span className="text-xs text-red-400 font-bold">SIN STOCK</span>
                        )}
                        {product.stock > 0 && product.stock <= 5 && (
                          <span className="text-xs text-amber-400 font-bold">STOCK BAJO</span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-zinc-400 text-xs uppercase">{product.category}</td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right">
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editValues.price}
                        onChange={e => setEditValues(v => ({ ...v, price: e.target.value }))}
                        className="w-28 rounded-none border-zinc-600 bg-zinc-800 text-right h-8 text-sm ml-auto"
                        data-testid={`input-price-${product.id}`}
                      />
                    ) : (
                      <span className="font-medium">{formatArs(parseFloat(product.price))}</span>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3 text-right">
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        min="0"
                        value={editValues.stock}
                        onChange={e => setEditValues(v => ({ ...v, stock: e.target.value }))}
                        className="w-20 rounded-none border-zinc-600 bg-zinc-800 text-right h-8 text-sm ml-auto"
                        data-testid={`input-stock-${product.id}`}
                      />
                    ) : (
                      <span className={`font-bold tabular-nums ${product.stock === 0 ? "text-red-400" : product.stock <= 5 ? "text-amber-400" : "text-green-400"}`}>
                        {product.stock}
                      </span>
                    )}
                  </td>

                  {/* Featured toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleFeatured(product)}
                      className="text-zinc-500 hover:text-white transition-colors"
                      title={product.featured ? "Quitar de destacados" : "Marcar como destacado"}
                    >
                      {product.featured
                        ? <ToggleRight className="h-5 w-5 text-green-400" />
                        : <ToggleLeft className="h-5 w-5" />
                      }
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center">
                    {editingId === product.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => saveEdit(product.id)}
                          disabled={savingId === product.id}
                          className="flex items-center gap-1 px-2 py-1 bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors"
                          data-testid={`button-save-${product.id}`}
                        >
                          {savingId === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 text-xs text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(product)}
                        className="px-3 py-1 text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
                        data-testid={`button-edit-${product.id}`}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-zinc-500">No se encontraron productos.</div>
      )}
    </div>
  );
}

// ─── Coupons Tab ──────────────────────────────────────────────────────────────
function CouponsTab({ adminKey }: { adminKey: string }) {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminFetch("/admin/coupons", adminKey);
      setCoupons(data.coupons);
    } catch {
      toast({ title: "Error al cargar cupones", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (c: Coupon) => {
    try {
      const updated = await adminFetch(`/admin/coupons/${c.id}`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ active: !c.active }),
      });
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, active: updated.active } : x));
    } catch {
      toast({ title: "Error al actualizar cupón", variant: "destructive" });
    }
  };

  const deleteCoupon = async (id: number) => {
    if (!confirm("¿Eliminar este cupón?")) return;
    try {
      await adminFetch(`/admin/coupons/${id}`, adminKey, { method: "DELETE" });
      setCoupons(prev => prev.filter(c => c.id !== id));
      toast({ title: "Cupón eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDiscount) return;
    setIsCreating(true);
    try {
      const created = await adminFetch("/admin/coupons", adminKey, {
        method: "POST",
        body: JSON.stringify({ code: newCode, discount: parseInt(newDiscount, 10) }),
      });
      setCoupons(prev => [created, ...prev]);
      setNewCode("");
      setNewDiscount("");
      toast({ title: `Cupón ${created.code} creado` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Create new coupon */}
      <div className="border border-zinc-800 p-5 bg-zinc-900/50">
        <h3 className="font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nuevo Cupón
        </h3>
        <form onSubmit={createCoupon} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Código</label>
            <Input
              placeholder="EJ: VERANO25"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              className="w-40 rounded-none border-zinc-700 bg-zinc-800 uppercase"
              data-testid="input-new-coupon-code"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Descuento %</label>
            <Input
              type="number"
              min="1"
              max="100"
              placeholder="10"
              value={newDiscount}
              onChange={e => setNewDiscount(e.target.value)}
              className="w-24 rounded-none border-zinc-700 bg-zinc-800"
              data-testid="input-new-coupon-discount"
            />
          </div>
          <Button
            type="submit"
            className="rounded-none uppercase text-xs font-bold bg-white text-black hover:bg-zinc-200 h-10"
            disabled={isCreating || !newCode.trim() || !newDiscount}
            data-testid="button-create-coupon"
          >
            {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear"}
          </Button>
        </form>
      </div>

      {/* Coupons list */}
      <div className="border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Código</th>
              <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Descuento</th>
              <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Estado</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Creado</th>
              <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {coupons.map(c => (
              <tr key={c.id} className="hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-sm tracking-wider">{c.code}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-green-400 font-bold">{c.discount}% OFF</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border rounded-none ${
                    c.active ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"
                  }`}>
                    {c.active ? <CheckCircle2 className="h-3 w-3" /> : null}
                    {c.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {new Date(c.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => toggleActive(c)}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors"
                      data-testid={`button-toggle-coupon-${c.id}`}
                    >
                      {c.active
                        ? <><ToggleRight className="h-3 w-3" /> Desactivar</>
                        : <><ToggleLeft className="h-3 w-3" /> Activar</>
                      }
                    </button>
                    <button
                      onClick={() => deleteCoupon(c.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      data-testid={`button-delete-coupon-${c.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && (
          <div className="text-center py-8 text-zinc-500">No hay cupones aún.</div>
        )}
      </div>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab({ adminKey }: { adminKey: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminFetch("/admin/orders", adminKey);
      setOrders(data.orders);
    } catch {
      toast({ title: "Error al cargar pedidos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const updated = await adminFetch(`/admin/orders/${id}/status`, adminKey, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: updated.status } : o));
      toast({ title: `Pedido actualizado: ${STATUS_LABELS[status]}` });
    } catch {
      toast({ title: "Error al actualizar pedido", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
    </div>
  );

  const statuses = ["pending", "confirmed", "preparing", "shipped", "delivered"];
  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statuses.map(s => (
          <div key={s} className={`border p-3 text-center ${STATUS_COLORS[s]}`}>
            <p className="text-xs uppercase tracking-wider opacity-80 mb-1">{STATUS_LABELS[s]}</p>
            <p className="text-xl font-bold">{statusCounts[s]}</p>
          </div>
        ))}
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {orders.length === 0 && (
          <div className="text-center py-10 text-zinc-500">No hay pedidos aún.</div>
        )}
        {orders.map(order => (
          <div key={order.id} className="border border-zinc-800 bg-zinc-900/30">
            {/* Order header */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer hover:bg-zinc-900/60 transition-colors"
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
            >
              <div className="flex items-center gap-3">
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${expandedId === order.id ? "rotate-180" : ""}`} />
                <div>
                  <p className="font-mono font-bold text-sm">{order.trackingNumber}</p>
                  <p className="text-xs text-zinc-500">
                    {order.customerFirstName} {order.customerLastName} — {order.customerProvince}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{formatArs(parseFloat(order.total))}</span>

                <span className={`px-2 py-0.5 text-xs font-bold border ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>

                <p className="text-xs text-zinc-600 hidden sm:block">
                  {new Date(order.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === order.id && (
              <div className="border-t border-zinc-800 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Cliente</p>
                    <p className="font-medium">{order.customerFirstName} {order.customerLastName}</p>
                    <p className="text-zinc-400">{order.customerEmail}</p>
                    <p className="text-zinc-400">{order.customerProvince}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Cambiar estado</p>
                    <div className="flex flex-wrap gap-2">
                      {statuses.map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(order.id, s)}
                          disabled={order.status === s || updatingId === order.id}
                          className={`px-2 py-1 text-xs font-bold border transition-colors ${
                            order.status === s
                              ? `${STATUS_COLORS[s]} cursor-default`
                              : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                          }`}
                          data-testid={`button-status-${order.id}-${s}`}
                        >
                          {updatingId === order.id && order.status !== s ? (
                            <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                          ) : null}
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
type Tab = "products" | "coupons" | "orders";

export default function Admin() {
  const [adminKey, setAdminKey] = useState<string>(() => {
    return sessionStorage.getItem("alfis_admin_key") || "";
  });
  const [tab, setTab] = useState<Tab>("products");
  const [isVerifying, setIsVerifying] = useState(!!sessionStorage.getItem("alfis_admin_key"));

  useEffect(() => {
    const stored = sessionStorage.getItem("alfis_admin_key");
    if (stored) {
      setIsVerifying(true);
      adminFetch("/admin/verify", stored)
        .then(() => setAdminKey(stored))
        .catch(() => {
          sessionStorage.removeItem("alfis_admin_key");
          setAdminKey("");
        })
        .finally(() => setIsVerifying(false));
    }
  }, []);

  const logout = () => {
    sessionStorage.removeItem("alfis_admin_key");
    setAdminKey("");
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!adminKey) {
    return <LoginScreen onLogin={setAdminKey} />;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "products", label: "Productos", icon: <Package className="h-4 w-4" /> },
    { id: "coupons", label: "Cupones", icon: <Tag className="h-4 w-4" /> },
    { id: "orders", label: "Pedidos", icon: <ShoppingBag className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href={`${BASE}/`} className="font-bold text-lg tracking-tighter">
              ALFIS<span className="text-zinc-600">.</span>
            </a>
            <span className="text-zinc-600 text-sm hidden sm:block">Panel de Administrador</span>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zinc-500" />
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors ml-4"
              data-testid="button-admin-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-white text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
                data-testid={`tab-${t.id}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {tab === "products" && <ProductsTab adminKey={adminKey} />}
        {tab === "coupons" && <CouponsTab adminKey={adminKey} />}
        {tab === "orders" && <OrdersTab adminKey={adminKey} />}
      </div>
    </div>
  );
}
