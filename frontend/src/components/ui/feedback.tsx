import type { ReactNode } from "react";
import { LoaderCircle, Ticket } from "lucide-react";

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Ticket aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
export function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <p className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function Busy() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Cargando Vales
    </div>
  );
}
