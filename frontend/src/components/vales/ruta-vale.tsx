import { Route } from "lucide-react";
import type { RutaTrabajo } from "@/lib/types";

export function RutaDelVale({
  ruta,
  error,
}: {
  ruta?: RutaTrabajo | null;
  error: unknown;
}) {
  if (error)
    return (
      <p className="error" role="alert">
        No se pudo consultar la ruta del vale.
      </p>
    );
  if (!ruta) return null;
  return (
    <section className="vale-detail-section">
      <h3>
        <Route size={18} /> Ruta de trabajo
      </h3>
      <p>{ruta.nombre}</p>
      <ol className="vale-route-stops">
        {ruta.paradas.map((p, i) => (
          <li key={i}>{p.nombre}</li>
        ))}
      </ol>
    </section>
  );
}
