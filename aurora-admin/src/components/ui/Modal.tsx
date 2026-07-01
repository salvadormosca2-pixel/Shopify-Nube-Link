import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

// Modal centrado: overlay negro 60%, card #141414 con borde, título display.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={`mt-10 w-full ${width} rounded-xl border border-borde bg-card shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-borde px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 transition hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-borde px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

// Confirmación previa a DELETE.
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "¿Confirmar eliminación?",
  message = "Esta acción no se puede deshacer.",
  confirmText = "Eliminar",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Eliminando..." : confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-300">{message}</p>
    </Modal>
  );
}
