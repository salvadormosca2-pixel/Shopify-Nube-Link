import { useState, useEffect, useCallback, useRef } from "react";
import { formatArs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Package, Tag, ShoppingBag, LogOut, Save,
  Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
  TrendingUp, AlertCircle, CheckCircle2, ChevronDown,
  X, ImagePlus, Pencil, BarChart2, MapPin, Award, ShoppingCart
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type Product = {
  id: number; name: string; category: string; description: string;
  section: string;
  price: string; stock: number; featured: boolean; salePrice?: string | null;
  images: string[]; colors: string[]; sizes: string[];
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
      await adminFetch("/admin/verify", password, { method: "POST" });
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

// ─── Product Edit Modal ───────────────────────────────────────────────────────
type EditForm = {
  name: string; category: string; description: string; section: string;
  price: string; stock: string; salePrice: string; featured: boolean;
  images: string[]; colors: string[]; sizes: string[];
};

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38", "40", "42"];

function ProductEditModal({
  product, adminKey, categories, onSave, onCreate, onClose,
}: {
  product: Product | null; adminKey: string; categories: string[];
  onSave?: (updated: Product) => void;
  onCreate?: (created: Product) => void;
  onClose: () => void;
}) {
  const isCreate = product === null;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newColor, setNewColor] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EditForm>({
    name: product?.name ?? "",
    category: product?.category ?? "",
    section: product?.section ?? "hombre",
    description: product?.description ?? "",
    price: product ? String(parseFloat(product.price)) : "",
    stock: product ? String(product.stock) : "0",
    salePrice: product?.salePrice != null ? String(parseFloat(String(product.salePrice))) : "",
    featured: product?.featured ?? false,
    images: product ? [...product.images] : [],
    colors: product ? [...(product.colors || [])] : [],
    sizes: product ? [...(product.sizes || [])] : [],
  });

  const set = (key: keyof EditForm, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    set("images", [...form.images, url]);
    setNewImageUrl("");
    imageInputRef.current?.focus();
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const metaRes = await adminFetch("/storage/uploads/request-url", adminKey, {
        method: "POST",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = metaRes;

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const servingUrl = `${API}/storage${objectPath}`;
      set("images", [...form.images, servingUrl]);
      toast({ title: "Imagen subida correctamente" });
    } catch {
      toast({ title: "Error al subir la imagen", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) =>
    set("images", form.images.filter((_, i) => i !== idx));

  const moveImage = (idx: number, dir: -1 | 1) => {
    const arr = [...form.images];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    set("images", arr);
  };

  const addColor = () => {
    const c = newColor.trim();
    if (!c || form.colors.includes(c)) return;
    set("colors", [...form.colors, c]);
    setNewColor("");
  };

  const toggleSize = (size: string) => {
    if (form.sizes.includes(size)) {
      set("sizes", form.sizes.filter(s => s !== size));
    } else {
      set("sizes", [...form.sizes, size]);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "El nombre no puede estar vacío", variant: "destructive" });
      return;
    }
    const categoryToSave = customCategory.trim() || form.category;
    if (!categoryToSave) {
      toast({ title: "La categoría no puede estar vacía", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: categoryToSave,
        section: form.section,
        description: form.description,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        featured: form.featured,
        images: form.images,
        colors: form.colors,
        sizes: form.sizes,
        salePrice: form.salePrice.trim() !== "" ? parseFloat(form.salePrice) : null,
      };
      if (isCreate) {
        const created = await adminFetch("/admin/products", adminKey, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onCreate?.(created);
        toast({ title: "Producto creado" });
      } else {
        const updated = await adminFetch(`/admin/products/${product!.id}`, adminKey, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSave?.(updated);
        toast({ title: "Producto guardado" });
      }
      onClose();
    } catch (e: unknown) {
      toast({ title: isCreate ? "Error al crear" : "Error al guardar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "rounded-none border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-400";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl h-full overflow-y-auto bg-[#111] border-l border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="font-bold uppercase tracking-wider text-sm">{isCreate ? "Nuevo Producto" : "Editar Producto"}</h2>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-xs">{isCreate ? "Completá los datos del nuevo producto" : product!.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 px-6 py-6 space-y-6">

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Nombre del producto</label>
            <Input value={form.name} onChange={e => set("name", e.target.value)}
              className={inputCls} data-testid="input-edit-name" />
          </div>

          {/* Sección */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Sección</label>
            <div className="flex gap-2">
              {(["hombre", "priority"] as const).map(sec => (
                <button key={sec} type="button"
                  onClick={() => set("section", sec)}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                    form.section === sec
                      ? sec === "priority"
                        ? "border-[#d4b896] bg-[#d4b896]/10 text-[#d4b896]"
                        : "border-white bg-white text-black"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}>
                  {sec === "hombre" ? "Hombre" : "Priority — Mujer"}
                </button>
              ))}
            </div>
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Categoría</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {categories.map(cat => (
                <button key={cat} type="button"
                  onClick={() => { set("category", cat); setCustomCategory(""); }}
                  className={`px-3 py-1 text-xs font-bold uppercase border transition-colors ${
                    form.category === cat && !customCategory
                      ? "border-white bg-white text-black"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
            <Input value={customCategory}
              onChange={e => { setCustomCategory(e.target.value); if (e.target.value) set("category", e.target.value); }}
              placeholder="O escribí una categoría nueva..."
              className={inputCls + " text-sm"} data-testid="input-edit-category" />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              className="w-full rounded-none border border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 resize-none"
              placeholder="Descripción del producto..."
              data-testid="input-edit-description"
            />
          </div>

          {/* Precio + Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Precio ($)</label>
              <Input type="number" min="0" value={form.price}
                onChange={e => set("price", e.target.value)}
                className={inputCls} data-testid="input-edit-price" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Stock</label>
              <Input type="number" min="0" value={form.stock}
                onChange={e => set("stock", e.target.value)}
                className={inputCls} data-testid="input-edit-stock" />
            </div>
          </div>

          {/* Descuento / Precio de oferta */}
          <div className="border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-red-400 uppercase tracking-wider">Precio de Oferta</p>
                <p className="text-xs text-zinc-500">Dejá vacío para quitar el descuento</p>
              </div>
              {form.salePrice && !isNaN(parseFloat(form.salePrice)) && parseFloat(form.price) > 0 && (
                <span className="text-xs font-bold bg-red-500 text-white px-2 py-1">
                  -{Math.round((1 - parseFloat(form.salePrice) / parseFloat(form.price)) * 100)}% OFF
                </span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="0"
                placeholder="Precio con descuento..."
                value={form.salePrice}
                onChange={e => set("salePrice", e.target.value)}
                className={inputCls + " flex-1"}
                data-testid="input-edit-sale-price"
              />
              {form.salePrice && (
                <button type="button" onClick={() => set("salePrice", "")}
                  className="px-3 py-2 text-zinc-500 hover:text-red-400 border border-zinc-700 text-xs transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {form.salePrice && parseFloat(form.salePrice) >= parseFloat(form.price) && (
              <p className="text-xs text-amber-400">El precio de oferta debe ser menor al precio original.</p>
            )}
          </div>

          {/* Destacado */}
          <div className="flex items-center justify-between border border-zinc-800 px-4 py-3">
            <div>
              <p className="text-sm font-bold">Producto destacado</p>
              <p className="text-xs text-zinc-500">Aparece en la sección de destacados en el inicio</p>
            </div>
            <button type="button" onClick={() => set("featured", !form.featured)}>
              {form.featured
                ? <ToggleRight className="h-7 w-7 text-green-400" />
                : <ToggleLeft className="h-7 w-7 text-zinc-600" />
              }
            </button>
          </div>

          {/* Imágenes */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-2">
              <ImagePlus className="h-3.5 w-3.5" /> Imágenes ({form.images.length})
            </label>

            {/* Current images */}
            {form.images.length > 0 && (
              <div className="space-y-2">
                {form.images.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-2">
                    <img src={url} alt="" className="w-10 h-12 object-cover flex-shrink-0 opacity-90"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
                    <p className="flex-1 text-xs text-zinc-400 truncate min-w-0">{url}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0}
                        className="px-1.5 py-1 text-zinc-500 hover:text-white disabled:opacity-20 text-xs">▲</button>
                      <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === form.images.length - 1}
                        className="px-1.5 py-1 text-zinc-500 hover:text-white disabled:opacity-20 text-xs">▼</button>
                      <button type="button" onClick={() => removeImage(idx)}
                        className="px-1.5 py-1 text-zinc-600 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* File upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                data-testid="input-edit-image-file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-zinc-600 hover:border-zinc-400 text-zinc-400 hover:text-white text-sm transition-colors disabled:opacity-50"
                data-testid="button-upload-image"
              >
                {isUploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                  : <><ImagePlus className="h-4 w-4" /> Subir desde archivo</>
                }
              </button>
            </div>

            {/* Add new image URL */}
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-600 flex-shrink-0">o URL:</span>
              <Input
                ref={imageInputRef}
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
                placeholder="https://..."
                className={inputCls + " text-sm flex-1"}
                data-testid="input-edit-image-url"
              />
              <button type="button" onClick={addImage}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold transition-colors flex-shrink-0">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Talles */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Talles disponibles</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SIZES.map(size => (
                <button key={size} type="button" onClick={() => toggleSize(size)}
                  className={`px-3 py-1.5 text-xs font-bold border transition-colors ${
                    form.sizes.includes(size)
                      ? "border-white bg-white text-black"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}>
                  {size}
                </button>
              ))}
            </div>
            {form.sizes.length > 0 && (
              <p className="text-xs text-zinc-500">Seleccionados: {form.sizes.join(", ")}</p>
            )}
          </div>

          {/* Colores */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Colores</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 text-xs">
                  {c}
                  <button type="button" onClick={() => set("colors", form.colors.filter((_, j) => j !== i))}
                    className="text-zinc-500 hover:text-red-400 ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newColor} onChange={e => setNewColor(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }}
                placeholder="Ej: Negro, Azul..."
                className={inputCls + " text-sm flex-1"} />
              <button type="button" onClick={addColor}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#111] border-t border-zinc-800 px-6 py-4 flex gap-3">
          <Button onClick={handleSave} disabled={isSaving}
            className="flex-1 rounded-none uppercase font-bold tracking-wider bg-white text-black hover:bg-zinc-200 h-11"
            data-testid="button-save-product">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isCreate ? "Crear Producto" : "Guardar cambios"}
          </Button>
          <Button variant="outline" onClick={onClose}
            className="rounded-none border-zinc-700 text-zinc-400 hover:text-white h-11 px-6">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab({ adminKey }: { adminKey: string }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<"todos" | "hombre" | "priority">("todos");
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

  const deleteProduct = async (p: Product) => {
    if (!window.confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(p.id);
    try {
      await adminFetch(`/admin/products/${p.id}`, adminKey, { method: "DELETE" });
      setProducts(prev => prev.filter(x => x.id !== p.id));
      toast({ title: "Producto eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const allCategories = Array.from(new Set(products.map(p => p.category))).sort();
  const categoryOptions = ["todos", ...allCategories];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchSection = sectionFilter === "todos" || (p.section || "hombre") === sectionFilter;
    const matchCategory = categoryFilter === "todos" || p.category === categoryFilter;
    return matchSearch && matchSection && matchCategory;
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
      {/* Edit modal */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          adminKey={adminKey}
          categories={allCategories}
          onSave={updated => setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <ProductEditModal
          product={null}
          adminKey={adminKey}
          categories={allCategories}
          onCreate={created => setProducts(prev => [created, ...prev])}
          onClose={() => setShowCreateModal(false)}
        />
      )}

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

      {/* Section tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: "todos", label: "Todos" },
          { key: "hombre", label: "Hombre" },
          { key: "priority", label: "Priority — Mujer" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setSectionFilter(key); setCategoryFilter("todos"); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
              sectionFilter === key
                ? key === "priority"
                  ? "border-[#d4b896] bg-[#d4b896]/10 text-[#d4b896]"
                  : "border-white bg-white text-black"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}>
            {label}
            <span className="ml-2 opacity-60">
              {key === "todos" ? products.length : products.filter(p => (p.section || "hombre") === key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters + New button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-none border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-600 sm:w-64"
        />
        <div className="flex flex-wrap gap-2 flex-1">
          {categoryOptions.map(cat => (
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors whitespace-nowrap"
          data-testid="button-new-product"
        >
          <Plus className="h-4 w-4" /> Nuevo Producto
        </button>
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
                <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Dest.</th>
                <th className="text-center px-4 py-3 text-zinc-500 font-bold uppercase text-xs tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-zinc-900/50 transition-colors">
                  {/* Name + image */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images[0] && (
                        <img src={product.images[0]} alt={product.name} className="w-9 h-11 object-cover flex-shrink-0 opacity-80" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm leading-tight">{product.name}</p>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border ${
                            (product.section || "hombre") === "priority"
                              ? "border-[#d4b896]/40 text-[#d4b896]"
                              : "border-zinc-700 text-zinc-500"
                          }`}>
                            {(product.section || "hombre") === "priority" ? "Priority" : "Hombre"}
                          </span>
                        </div>
                        {product.stock === 0 && (
                          <span className="text-xs text-red-400 font-bold">SIN STOCK</span>
                        )}
                        {product.stock > 0 && product.stock <= 5 && (
                          <span className="text-xs text-amber-400 font-bold">STOCK BAJO</span>
                        )}
                        {(product.sizes?.length > 0) && (
                          <p className="text-xs text-zinc-600 mt-0.5">{product.sizes.join(" · ")}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-zinc-400 text-xs uppercase">{product.category}</td>

                  <td className="px-4 py-3 text-right font-medium">
                    {formatArs(parseFloat(product.price))}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold tabular-nums ${product.stock === 0 ? "text-red-400" : product.stock <= 5 ? "text-amber-400" : "text-green-400"}`}>
                      {product.stock}
                    </span>
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

                  {/* Actions: Edit + Delete */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-400 hover:text-white transition-colors"
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      <button
                        onClick={() => deleteProduct(product)}
                        disabled={deletingId === product.id}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs border border-zinc-800 text-zinc-600 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-40"
                        data-testid={`button-delete-${product.id}`}
                        title="Eliminar producto"
                      >
                        {deletingId === product.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Trash2 className="h-3 w-3" />
                        }
                      </button>
                    </div>
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

// ─── Sales Tab ────────────────────────────────────────────────────────────────
type StatsData = {
  kpis: { totalRevenue: number; totalOrders: number; paidOrders: number; avgTicket: number; totalOrdersAllTime: number };
  byStatus: Record<string, number>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ id: number; name: string; units: number; revenue: number }>;
  revenueByProvince: Array<{ province: string; revenue: number }>;
};

const SALES_STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pendiente",  color: "bg-amber-500" },
  paid:      { label: "Pagado",     color: "bg-blue-500" },
  shipped:   { label: "Enviado",    color: "bg-violet-500" },
  delivered: { label: "Entregado",  color: "bg-green-500" },
  cancelled: { label: "Cancelado",  color: "bg-red-600" },
};

function MiniBar({ value, max, color = "bg-white" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2;
  return (
    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SalesTab({ adminKey }: { adminKey: string }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartMode, setChartMode] = useState<"revenue" | "orders">("revenue");

  useEffect(() => {
    setIsLoading(true);
    adminFetch("/admin/stats", adminKey)
      .then(data => setStats(data))
      .catch(() => toast({ title: "Error al cargar estadísticas", variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, [adminKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!stats) return null;

  const { kpis, byStatus, revenueByDay, topProducts, revenueByProvince } = stats;

  const chartData = revenueByDay;
  const chartValues = chartData.map(d => chartMode === "revenue" ? d.revenue : d.orders);
  const chartMax = Math.max(...chartValues, 1);
  const totalRevenue30 = revenueByDay.reduce((s, d) => s + d.revenue, 0);
  const totalOrders30 = revenueByDay.reduce((s, d) => s + d.orders, 0);
  const maxProvRevenue = Math.max(...revenueByProvince.map(p => p.revenue), 1);
  const maxProductUnits = Math.max(...topProducts.map(p => p.units), 1);
  const totalStatusOrders = Object.values(byStatus).reduce((s, v) => s + v, 0);

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="space-y-8">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Facturado (90 días)", value: formatArs(kpis.totalRevenue), icon: <TrendingUp className="h-4 w-4" />, accent: "text-green-400" },
          { label: "Pedidos (90 días)", value: kpis.totalOrders, icon: <ShoppingCart className="h-4 w-4" />, accent: "text-blue-400" },
          { label: "Ticket promedio", value: formatArs(kpis.avgTicket), icon: <Award className="h-4 w-4" />, accent: "text-violet-400" },
          { label: "Pedidos pagados", value: kpis.paidOrders, icon: <CheckCircle2 className="h-4 w-4" />, accent: "text-amber-400" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 p-5">
            <div className={`flex items-center gap-2 mb-2 ${kpi.accent}`}>
              {kpi.icon}
              <span className="text-xs font-bold uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-2xl font-black tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart (last 30 days) */}
      <div className="bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold uppercase tracking-wider text-sm">Últimos 30 días</h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              {chartMode === "revenue"
                ? `Total facturado: ${formatArs(totalRevenue30)}`
                : `Total pedidos: ${totalOrders30}`
              }
            </p>
          </div>
          <div className="flex border border-zinc-700 overflow-hidden">
            <button
              onClick={() => setChartMode("revenue")}
              className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${chartMode === "revenue" ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}
            >$ Facturado</button>
            <button
              onClick={() => setChartMode("orders")}
              className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${chartMode === "orders" ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}
            >Pedidos</button>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-px h-32">
          {chartData.map((d, i) => {
            const val = chartMode === "revenue" ? d.revenue : d.orders;
            const pct = chartMax > 0 ? (val / chartMax) * 100 : 0;
            const isToday = i === chartData.length - 1;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  {formatDay(d.date)}: {chartMode === "revenue" ? formatArs(val) : `${val} pedidos`}
                </div>
                <div className="w-full flex items-end h-28">
                  <div
                    className={`w-full rounded-sm transition-all ${isToday ? "bg-white" : "bg-zinc-600 group-hover:bg-zinc-400"}`}
                    style={{ height: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                  />
                </div>
                {(i % 5 === 0 || isToday) && (
                  <span className={`text-[9px] ${isToday ? "text-white font-bold" : "text-zinc-600"}`}>
                    {formatDay(d.date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns: status breakdown + top provinces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Orders by status */}
        <div className="bg-zinc-900 border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-4 w-4 text-zinc-500" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Estado de Pedidos</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const cfg = SALES_STATUS_CFG[status] || { label: status, color: "bg-zinc-500" };
              const pct = totalStatusOrders > 0 ? ((count / totalStatusOrders) * 100).toFixed(0) : "0";
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.color}`} />
                  <span className="text-xs text-zinc-400 w-24 flex-shrink-0">{cfg.label}</span>
                  <div className="flex-1 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${cfg.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-8 text-right">{count}</span>
                  <span className="text-xs text-zinc-600 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
            {Object.keys(byStatus).length === 0 && (
              <p className="text-zinc-600 text-sm">Sin pedidos en los últimos 90 días.</p>
            )}
          </div>
        </div>

        {/* Revenue by province */}
        <div className="bg-zinc-900 border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-zinc-500" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Facturado por Provincia</h3>
          </div>
          <div className="space-y-3">
            {revenueByProvince.map(({ province, revenue }) => (
              <div key={province} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-32 flex-shrink-0 truncate">{province}</span>
                <div className="flex-1">
                  <MiniBar value={revenue} max={maxProvRevenue} color="bg-violet-500" />
                </div>
                <span className="text-xs font-bold tabular-nums text-right flex-shrink-0">{formatArs(revenue)}</span>
              </div>
            ))}
            {revenueByProvince.length === 0 && (
              <p className="text-zinc-600 text-sm">Sin ventas registradas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-zinc-500" />
          <h3 className="font-bold uppercase tracking-wider text-sm">Productos más vendidos (90 días)</h3>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-zinc-600 text-sm">Sin ventas registradas.</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4">
                <span className="text-xs text-zinc-600 font-bold tabular-nums w-5 text-right flex-shrink-0">#{i + 1}</span>
                <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                <div className="w-32 flex-shrink-0">
                  <MiniBar value={p.units} max={maxProductUnits} color="bg-amber-400" />
                </div>
                <span className="text-xs text-zinc-400 w-16 text-right flex-shrink-0 tabular-nums">{p.units} und.</span>
                <span className="text-xs font-bold tabular-nums w-28 text-right flex-shrink-0">{formatArs(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
type Tab = "products" | "coupons" | "orders" | "sales";

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
      adminFetch("/admin/verify", stored, { method: "POST" })
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
    { id: "sales", label: "Ventas", icon: <BarChart2 className="h-4 w-4" /> },
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
        {tab === "sales" && <SalesTab adminKey={adminKey} />}
      </div>
    </div>
  );
}
