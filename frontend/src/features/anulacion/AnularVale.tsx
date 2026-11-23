import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import {
  ErrorText,
  Field,
  Search,
  ValeCard,
  matches,
  useData,
  useModal,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ValesList } from "@/components/vales-list";
import { api } from "@/lib/api";
import { actualizarContexto, invalidarDetalles } from "@/lib/consultas";
import { puedeAnularVale } from "@/lib/permisos";
import type { Contexto, Vale } from "@/lib/types";
import "./anulacion.css";

export default function AnularVale({
  onOpen,
}: {
  onOpen: (vale: Vale) => void;
}) {
  const consulta = useData();
  const { cuenta, vales } = consulta.data!;
  const cache = useQueryClient();
  const modal = useModal();
  const [busqueda, setBusqueda] = useState("");
  const [motivo, setMotivo] = useState("");
  const [flujo, setFlujo] = useState<{
    id: string;
    etapa: "motivo" | "anulado";
  }>();
  const elegido = vales.find((vale) => vale.id_vale === flujo?.id);

  function seleccionar(vale: Vale) {
    setMotivo("");
    setFlujo({ id: vale.id_vale, etapa: "motivo" });
  }

  function confirmar(vale: Vale) {
    const motivoConfirmado = motivo.trim();
    if (!motivoConfirmado || !puedeAnularVale(cuenta, vale)) return;
    modal({
      title: "Anular vale " + vale.codigo_vale + " (" + vale.zonal + ")",
      body: (
        <div className="stack anulacion-resumen">
          <ValeCard vale={vale} />
          <div className="anulacion-motivo">
            <span>Motivo de anulación</span>
            <p>{motivoConfirmado}</p>
          </div>
        </div>
      ),
      label: "Confirmar anulación",
      destructive: true,
      action: async () => {
        try {
          const actualizado = await api<Contexto>(
            "/api/v1/anulacion/vales/" + vale.id_vale,
            { motivo: motivoConfirmado },
          );
          await actualizarContexto(cache, actualizado);
          setFlujo({ id: vale.id_vale, etapa: "anulado" });
          setMotivo("");
        } catch (error) {
          void consulta.refetch();
          throw error;
        } finally {
          void invalidarDetalles(cache, [vale]);
        }
      },
    });
  }

  if (flujo?.etapa === "anulado") {
    return (
      <section className="panel anulacion-panel stack">
        <h2 role="status">Vale anulado</h2>
        {elegido && <ValeCard vale={elegido} onOpen={onOpen} />}
        <div className="actions">
          <Button variant="outline" onClick={() => setFlujo(undefined)}>
            Volver a los vales
          </Button>
        </div>
      </section>
    );
  }

  if (flujo) {
    const elegible = elegido && puedeAnularVale(cuenta, elegido);
    return (
      <section className="panel anulacion-panel">
        <form
          className="stack"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (elegido && elegible) confirmar(elegido);
          }}
        >
          {elegido && <ValeCard vale={elegido} onOpen={onOpen} />}
          {elegible ? (
            <Field label="Motivo de anulación">
              <Textarea
                autoFocus
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                required
                maxLength={1000}
                rows={3}
              />
            </Field>
          ) : (
            <ErrorText error="Este vale ya no se puede anular." />
          )}
          <div className="actions">
            <Button
              variant="outline"
              type="button"
              onClick={() => setFlujo(undefined)}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={!elegible || !motivo.trim()}
            >
              <Ban />
              Anular vale
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="stack" aria-label="Vales por anular">
      <div className="anulacion-buscador">
        <Search
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por código o trabajador"
        />
      </div>
      <ValesList
        vales={vales.filter(
          (vale) => puedeAnularVale(cuenta, vale) && matches(vale, busqueda),
        )}
        onOpen={onOpen}
        primaryAction={{
          title: "Anular vale",
          icon: <Ban />,
          label: (vale) =>
            "Anular vale " + vale.codigo_vale + " de " + vale.zonal,
          onClick: seleccionar,
        }}
        emptyMessage={
          busqueda.trim()
            ? "No se encontraron vales para esa búsqueda."
            : "No tienes vales emitidos o autorizados pendientes de uso."
        }
      />
    </section>
  );
}
