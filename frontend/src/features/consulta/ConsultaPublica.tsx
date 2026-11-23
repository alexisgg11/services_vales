import { useQuery } from "@tanstack/react-query";
import { Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Busy, ErrorText } from "@/components/ui/feedback";
import { api, date, states } from "@/lib/api";

type VerificacionVale = {
  codigo: string;
  grifo: string;
  fechaEmision: string;
  estado: number;
};

export default function ConsultaPublica() {
  const id = location.pathname.split("/")[3];
  const {
    data: vale,
    error,
    isPending,
    isPaused,
    isRefetchError,
  } = useQuery({
    queryKey: ["publico", id],
    queryFn: ({ signal }) =>
      api<VerificacionVale>("/api/publico/vales/" + id, undefined, signal),
    retry: false,
    staleTime: 0,
    refetchInterval: ({ state }) => {
      const estado = state.data?.estado;
      return estado === 0 || estado === 1 ? 3_000 : false;
    },
    refetchIntervalInBackground: false,
  });
  return (
    <div className="public-vale">
      <a href="/app/" className="brand">
        <span>
          <Fuel />
        </span>
        <div>
          <strong>Vales</strong>
          <small>Control de combustible</small>
        </div>
      </a>
      <section className="panel stack">
        <h1>Verificación de vale</h1>
        {vale ? (
          <dl className="facts">
            <div>
              <dt>Código</dt>
              <dd>{vale.codigo}</dd>
            </div>
            <div>
              <dt>Grifo</dt>
              <dd>{vale.grifo}</dd>
            </div>
            <div>
              <dt>Fecha de emisión</dt>
              <dd>{date(vale.fechaEmision)}</dd>
            </div>
            <div>
              <dt>Estado actual</dt>
              <dd aria-live="polite">{states[vale.estado]}</dd>
            </div>
          </dl>
        ) : isPending ? (
          <Busy />
        ) : (
          <ErrorText error={error} />
        )}
        {vale && (isPaused || isRefetchError) && (
          <p className="text-sm text-muted-foreground" role="status">
            Último estado consultado. Actualización pendiente.
          </p>
        )}
        <Button asChild>
          <a href={"/vales/q/" + id + "/documento"}>
            Iniciar sesión y consultar el vale
          </a>
        </Button>
      </section>
    </div>
  );
}
