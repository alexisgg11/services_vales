import { useQuery } from "@tanstack/react-query";
import { Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Busy, ErrorText } from "@/components/ui/feedback";
import { api, date, states } from "@/lib/api";

export default function ConsultaPublica() {
  const id = location.pathname.split("/")[3],
    q = useQuery({
      queryKey: ["publico", id],
      queryFn: () =>
        api<{
          codigo: string;
          grifo: string;
          fechaEmision: string;
          estado: number;
        }>("/api/publico/vales/" + id),
      retry: false,
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
        {q.isPending ? (
          <Busy />
        ) : q.error ? (
          <ErrorText error={q.error} />
        ) : (
          <dl className="facts">
            <div>
              <dt>Código</dt>
              <dd>{q.data?.codigo}</dd>
            </div>
            <div>
              <dt>Grifo</dt>
              <dd>{q.data?.grifo}</dd>
            </div>
            <div>
              <dt>Fecha de emisión</dt>
              <dd>{date(q.data?.fechaEmision)}</dd>
            </div>
            <div>
              <dt>Estado actual</dt>
              <dd>{states[q.data!.estado]}</dd>
            </div>
          </dl>
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
