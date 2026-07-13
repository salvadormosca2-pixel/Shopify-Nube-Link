import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-fondo p-6 text-center">
          <AlertTriangle className="text-pale-rojo-txt" size={40} />
          <h1 className="font-display text-xl font-bold text-tinta">Algo salió mal</h1>
          <p className="max-w-md text-sm text-gris">{this.state.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
