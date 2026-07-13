import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, ImageOff, Upload, Loader2, Star, Send, X } from "lucide-react";
import { EnviarComunidadModal } from "../components/EnviarComunidadModal";
import { api, apiError } from "../api/client";
import { useApi } from "../lib/useApi";
import { PageHeader } from "../components/ui/PageHeader";
import { Table, Row, Cell } from "../components/ui/Table";
import { FilterBar } from "../components/ui/Filters";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, TextInput, TextArea, Select, MultiSelect } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ErrorState, EmptyState } from "../components/ui/DataState";
import { formatARS, pct } from "../lib/format";

interface Variante {
  talle: string;
  color: string | null;
  stock: number;
}

interface Producto {
  id: string | number;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  marca?: string;
  genero?: string;
  estilo?: string;
  precio_contado: number;
  precio_tarjeta: number;
  talles?: string[];
  colores?: string[];
  imagen?: string;
  imagenes?: string[];
  sku?: string;
  activo: boolean;
  destacado?: boolean;
  es_complemento?: boolean;
  variantes?: Variante[];
}

interface Categoria {
  id: string | number;
  nombre: string;
}

const GENEROS = ["mujer", "hombre", "unisex"];
const TALLES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44", "46"];
const COLORES = ["Negro", "Blanco", "Gris", "Azul", "Rojo", "Verde", "Beige", "Marrón"];

// Estilos sugeridos según la categoría (el campo acepta cualquier texto igual).
const ESTILOS_POR_CATEGORIA: Record<string, string[]> = {
  remera: ["oversize", "slim", "basica", "estampada"],
  remeras: ["oversize", "slim", "basica", "estampada"],
  pantalon: ["mom", "chupin", "recto", "cargo", "wide leg"],
  pantalones: ["mom", "chupin", "recto", "cargo", "wide leg"],
  jean: ["mom", "chupin", "recto", "cargo", "wide leg"],
  jeans: ["mom", "chupin", "recto", "cargo", "wide leg"],
  buzo: ["oversize", "canguro", "clasico"],
  buzos: ["oversize", "canguro", "clasico"],
  campera: ["puffer", "jean", "cuero", "rompeviento"],
  camperas: ["puffer", "jean", "cuero", "rompeviento"],
  camisa: ["oversize", "slim", "clasica"],
  camisas: ["oversize", "slim", "clasica"],
};

const empty = (): Producto => ({
  id: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  marca: "",
  genero: "unisex",
  estilo: "",
  precio_contado: 0,
  precio_tarjeta: 0,
  talles: [],
  colores: [],
  imagen: "",
  imagenes: [],
  sku: "",
  activo: true,
  destacado: false,
  es_complemento: false,
  variantes: [],
});

export function Productos() {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [genero, setGenero] = useState("");

  const list = useApi<Producto[]>(
    () =>
      api
        .get(`/admin/productos?search=${encodeURIComponent(search)}&categoria=${categoria}&genero=${genero}`)
        .then((r) => r.data),
    [search, categoria, genero],
  );
  const cats = useApi<Categoria[]>(() => api.get(`/categorias`).then((r) => r.data), []);

  const [form, setForm] = useState<Producto | null>(null);
  const [toDelete, setToDelete] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selección múltiple para publicar a un grupo/comunidad de WhatsApp.
  const [seleccion, setSeleccion] = useState<Set<string | number>>(new Set());
  const [enviarOpen, setEnviarOpen] = useState(false);

  const productos = list.data ?? [];
  const categorias = cats.data ?? [];

  const toggleUno = (id: string | number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "Seleccionar todos" opera sobre lo que se ve en pantalla (filtros aplicados).
  const todosVisiblesElegidos =
    productos.length > 0 && productos.every((p) => seleccion.has(p.id));
  const toggleTodos = () => {
    setSeleccion(todosVisiblesElegidos ? new Set() : new Set(productos.map((p) => p.id)));
  };

  const seleccionados = productos.filter((p) => seleccion.has(p.id));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.id) await api.put(`/admin/productos/${form.id}`, form);
      else await api.post(`/admin/productos`, form);
      setForm(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/productos/${toDelete.id}`);
      setToDelete(null);
      list.refetch();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Productos" subtitle="Catálogo de prendas">
        <button className="btn-primary" onClick={() => setForm(empty())}>
          <Plus size={16} /> Nuevo Producto
        </button>
      </PageHeader>

      <FilterBar>
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gris-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="input-field pl-9"
          />
        </div>
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="sm:w-48">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select value={genero} onChange={(e) => setGenero(e.target.value)} className="sm:w-40">
          <option value="">Todos los géneros</option>
          {GENEROS.map((g) => (
            <option key={g} value={g}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </option>
          ))}
        </Select>
      </FilterBar>

      {seleccion.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-acento/30 bg-acento/5 px-4 py-3">
          <p className="text-sm text-tinta">
            {seleccion.size} {seleccion.size === 1 ? "producto seleccionado" : "productos seleccionados"}
          </p>
          <button className="btn-primary ml-auto" onClick={() => setEnviarOpen(true)}>
            <Send size={16} /> Enviar a comunidad
          </button>
          <button
            className="btn-secondary"
            onClick={() => setSeleccion(new Set())}
            title="Limpiar selección"
          >
            <X size={16} /> Limpiar
          </button>
        </div>
      )}

      {list.loading ? (
        <SkeletonTable cols={7} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : productos.length === 0 ? (
        <EmptyState message="Sin productos" />
      ) : (
        <Table
          headers={[
            <input
              key="check-all"
              type="checkbox"
              checked={todosVisiblesElegidos}
              onChange={toggleTodos}
              className="h-4 w-4 accent-acento"
              title="Seleccionar todos"
            />,
            "",
            "Producto",
            "Categoría",
            "Género",
            "Contado",
            "Tarjeta",
            "Talles",
            "Estado",
            "",
          ]}
        >
          {productos.map((p) => {
            const ahorro = p.precio_tarjeta - p.precio_contado;
            return (
              <Row key={p.id}>
                <Cell>
                  <input
                    type="checkbox"
                    checked={seleccion.has(p.id)}
                    onChange={() => toggleUno(p.id)}
                    className="h-4 w-4 accent-acento"
                  />
                </Cell>
                <Cell>
                  {p.imagen ? (
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      className="h-10 w-10 rounded-md border border-borde object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-borde text-gris-2">
                      <ImageOff size={16} />
                    </div>
                  )}
                </Cell>
                <Cell>
                  <p className="font-medium text-tinta">{p.nombre}</p>
                  {p.marca && <p className="text-xs text-gris-2">{p.marca}</p>}
                </Cell>
                <Cell className="text-gris">{p.categoria || "—"}</Cell>
                <Cell className="text-gris capitalize">{p.genero || "—"}</Cell>
                <Cell mono className="text-tinta">
                  {formatARS(p.precio_contado)}
                  {ahorro > 0 && (
                    <span className="mt-1 block">
                      <Badge tone="acento">
                        Ahorrás {formatARS(ahorro)} ({pct(p.precio_contado, p.precio_tarjeta)}%)
                      </Badge>
                    </span>
                  )}
                </Cell>
                <Cell mono className="text-gris">
                  {formatARS(p.precio_tarjeta)}
                </Cell>
                <Cell className="text-gris">{p.talles?.join(", ") || "—"}</Cell>
                <Cell>
                  {p.activo ? (
                    <Badge tone="acento">Activo</Badge>
                  ) : (
                    <Badge tone="gris">Inactivo</Badge>
                  )}
                </Cell>
                <Cell>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setForm({ ...empty(), ...p })}
                      className="rounded-md p-1.5 text-gris transition hover:bg-dark-hover hover:text-acento"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setToDelete(p)}
                      className="rounded-md p-1.5 text-gris transition hover:bg-pale-rojo hover:text-pale-rojo-txt"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </Cell>
              </Row>
            );
          })}
        </Table>
      )}

      {/* Modal alta/edición */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar producto" : "Nuevo producto"}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-pale-rojo-txt/20 bg-pale-rojo px-3 py-2 text-sm text-pale-rojo-txt">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <TextInput
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </Field>
              <Field label="Marca">
                <TextInput
                  value={form.marca ?? ""}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripción">
              <TextArea
                rows={2}
                value={form.descripcion ?? ""}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Categoría">
                <Select
                  value={form.categoria ?? ""}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.nombre}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Género">
                <Select
                  value={form.genero ?? "unisex"}
                  onChange={(e) => setForm({ ...form, genero: e.target.value })}
                >
                  {GENEROS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estilo">
                <TextInput
                  list="estilos-sugeridos"
                  value={form.estilo ?? ""}
                  onChange={(e) => setForm({ ...form, estilo: e.target.value })}
                  placeholder={
                    (ESTILOS_POR_CATEGORIA[(form.categoria ?? "").toLowerCase()] ?? ["oversize", "slim"])
                      .slice(0, 3)
                      .join(", ") + "..."
                  }
                />
                <datalist id="estilos-sugeridos">
                  {[
                    ...new Set([
                      ...(ESTILOS_POR_CATEGORIA[(form.categoria ?? "").toLowerCase()] ?? []),
                      ...productos.map((p) => p.estilo ?? "").filter(Boolean),
                    ]),
                  ].map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="SKU / Código">
                <TextInput
                  value={form.sku ?? ""}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Precio contado">
                <TextInput
                  type="number"
                  value={form.precio_contado}
                  onChange={(e) => setForm({ ...form, precio_contado: Number(e.target.value) })}
                />
              </Field>
              <Field label="Precio tarjeta">
                <TextInput
                  type="number"
                  value={form.precio_tarjeta}
                  onChange={(e) => setForm({ ...form, precio_tarjeta: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Talles disponibles">
              <MultiSelect
                options={TALLES.map((t) => ({ value: t, label: t }))}
                value={form.talles ?? []}
                onChange={(v) => setForm({ ...form, talles: v })}
              />
            </Field>
            <Field label="Colores">
              <MultiSelect
                options={COLORES.map((c) => ({ value: c, label: c }))}
                value={form.colores ?? []}
                onChange={(v) => setForm({ ...form, colores: v })}
              />
            </Field>
            <Field label="Stock por talle (crea/actualiza las variantes)">
              <StockPorTalle
                talles={form.talles ?? []}
                colores={form.colores ?? []}
                value={form.variantes ?? []}
                onChange={(variantes) => setForm({ ...form, variantes })}
              />
            </Field>
            <Field label="Fotos del producto (la primera es la principal)">
              <ImageUploader
                value={form.imagenes ?? (form.imagen ? [form.imagen] : [])}
                onChange={(imgs) => setForm({ ...form, imagenes: imgs, imagen: imgs[0] ?? "" })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gris">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Producto activo
            </label>
            <label className="flex items-center gap-2 text-sm text-gris">
              <input
                type="checkbox"
                checked={form.destacado ?? false}
                onChange={(e) => setForm({ ...form, destacado: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Destacado / más vendido (el bot lo recomienda primero)
            </label>
            <label className="flex items-center gap-2 text-sm text-gris">
              <input
                type="checkbox"
                checked={form.es_complemento ?? false}
                onChange={(e) => setForm({ ...form, es_complemento: e.target.checked })}
                className="h-4 w-4 accent-acento"
              />
              Es complemento (venta cruzada: medias, boxers, gorras, accesorios)
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={saving}
        message={`¿Eliminar "${toDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />

      <EnviarComunidadModal
        open={enviarOpen}
        productos={seleccionados}
        onClose={() => setEnviarOpen(false)}
        onEnviado={() => setSeleccion(new Set())}
      />
    </div>
  );
}

// Mini-tabla talle (× color) → cantidad. Edita el stock físico de las variantes;
// al guardar el producto se crean/actualizan en producto_variantes.
function StockPorTalle({
  talles,
  colores,
  value,
  onChange,
}: {
  talles: string[];
  colores: string[];
  value: Variante[];
  onChange: (v: Variante[]) => void;
}) {
  if (talles.length === 0) {
    return <p className="text-xs text-gris-2">Seleccioná los talles arriba para cargar el stock.</p>;
  }
  const cols = colores.length > 0 ? colores : [null];
  // Filas visibles: talles × colores elegidos + variantes existentes que no entren ahí.
  const keys = new Set<string>();
  const rows: Array<{ talle: string; color: string | null }> = [];
  for (const talle of talles) {
    for (const color of cols) {
      keys.add(`${talle}|${color ?? ""}`);
      rows.push({ talle, color });
    }
  }
  for (const v of value) {
    if (!keys.has(`${v.talle}|${v.color ?? ""}`)) rows.push({ talle: v.talle, color: v.color });
  }

  const stockDe = (talle: string, color: string | null) =>
    value.find((v) => v.talle === talle && (v.color ?? "") === (color ?? ""))?.stock ?? 0;

  const setStock = (talle: string, color: string | null, stock: number) => {
    const rest = value.filter((v) => !(v.talle === talle && (v.color ?? "") === (color ?? "")));
    onChange([...rest, { talle, color, stock: Math.max(0, Math.trunc(stock) || 0) }]);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borde text-left text-xs text-gris-2">
            <th className="px-3 py-2">Talle</th>
            {colores.length > 0 && <th className="px-3 py-2">Color</th>}
            <th className="px-3 py-2">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ talle, color }) => (
            <tr key={`${talle}|${color ?? ""}`} className="border-b border-borde/50 last:border-0">
              <td className="px-3 py-1.5 font-medium text-tinta">{talle}</td>
              {colores.length > 0 && <td className="px-3 py-1.5 text-gris">{color ?? "—"}</td>}
              <td className="px-3 py-1.5">
                <input
                  type="number"
                  min={0}
                  value={stockDe(talle, color)}
                  onChange={(e) => setStock(talle, color, Number(e.target.value))}
                  className="input-field w-24 py-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Uploader de imágenes: sube directo a Cloudinary vía el backend (el usuario
// nunca pega URLs). Galería con "hacer principal", reordenar y borrar.
function ImageUploader({ value, onChange }: { value: string[]; onChange: (imgs: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setErr(null);
    try {
      const nuevas: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("image", file);
        const { data } = await api.post(`/admin/uploads/image`, fd);
        if (data?.url) nuevas.push(data.url as string);
      }
      onChange([...value, ...nuevas]);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hacerPrincipal = (i: number) => {
    const next = [...value];
    const [img] = next.splice(i, 1);
    onChange([img, ...next]);
  };
  const borrar = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url + i} className="group relative h-20 w-20 overflow-hidden rounded-md border border-borde">
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-0 top-0 bg-acento px-1 text-[0.6rem] font-bold text-black">Principal</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition group-hover:opacity-100">
              {i > 0 && (
                <button type="button" onClick={() => hacerPrincipal(i)} title="Hacer principal" className="text-acento">
                  <Star size={16} />
                </button>
              )}
              <button type="button" onClick={() => borrar(i)} title="Borrar" className="text-pale-rojo-txt">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn-secondary text-sm"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir imagen
      </button>
      {err && <p className="mt-1 text-xs text-pale-rojo-txt">{err}</p>}
    </div>
  );
}
