import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ModalProvider } from "@/components/dialogos/confirmacion";
import { ValePdfProvider } from "@/components/vales/pdf-provider";
import "./styles.css";
const query = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="panel">
        <h1>No se pudo mostrar esta pantalla</h1>
        <p>Recarga la aplicación para volver a consultar los datos.</p>
        <button onClick={() => location.reload()}>Recargar Vales</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={query}>
        <ValePdfProvider>
          <ModalProvider>
            <App />
          </ModalProvider>
        </ValePdfProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + "sw.js", {
      scope: import.meta.env.BASE_URL,
    })
    .catch(() => {});
