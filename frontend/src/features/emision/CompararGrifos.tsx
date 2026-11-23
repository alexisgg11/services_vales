import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  MapPin,
  Search,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InfoPopover } from "@/components/ui/info-popover";
import { ErrorText } from "@/components/ui/feedback";
import { Field } from "@/components/formularios/campos";
import { api, money } from "@/lib/api";
import type { Cuenta, Recomendacion, RutaTrabajo } from "@/lib/types";
import type { Modalidad } from "./condiciones";
import { mostrarDistancia } from "@/lib/geografia/coordenadas";
import { nombreOrigen } from "@/lib/geografia/origenes";
import { OrigenTrabajoSelector } from "./OrigenTrabajoSelector";
import type { useRutaEmision } from "./use-ruta-emision";
import "./comparador.css";

const MapaGrifos = lazy(() =>
  import("@/components/mapas/MapaRecorrido").then((m) => ({
    default: m.MapaGrifos,
  })),
);

const pantallas = {
  comparar: {
    titulo: "Comparar grifos",
    descripcion: "Elige tu ruta de trabajo y revisa el punto de partida.",
  },
  origen: {
    titulo: "Origen del trabajo",
    descripcion: "Usa una localidad, tu ubicación o un punto del mapa.",
  },
  resultado: {
    titulo: "Grifo recomendado",
    descripcion:
      "Consulta el mapa y confirma el grifo que se aplicará al vale.",
  },
};

interface Props {
  cuenta: Cuenta;
  fecha: string;
  modalidad: Modalidad;
  suministro: string;
  cantidad: number;
  seleccionRuta: ReturnType<typeof useRutaEmision>;
  onElegir: (proveedor: string) => void;
}

interface ResultadoRuta {
  ruta: RutaTrabajo;
  opciones: Recomendacion[];
}

export function CompararGrifos({
  cuenta,
  fecha,
  modalidad,
  suministro,
  cantidad,
  seleccionRuta,
  onElegir,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<keyof typeof pantallas>("comparar");
  const { disponibles, ruta, origen, vinculo } = seleccionRuta;
  const emisionLista =
    !!fecha && !!suministro && Number.isFinite(cantidad) && cantidad > 0;
  const listo = emisionLista && !!vinculo?.origenRuta;
  const solicitud = {
    ruta: vinculo?.rutaId,
    version: vinculo?.rutaVersion,
    origen: vinculo?.origenRuta,
    condiciones: { fecha, modalidad, suministro, galones: cantidad },
  };
  const calculo = useQuery({
    queryKey: ["recomendacion-ruta", cuenta.actor, solicitud],
    enabled: abierto && vista === "resultado" && listo,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api<ResultadoRuta>("/api/v1/emision/recomendaciones/ruta", solicitud),
  });
  const resultado =
    listo && calculo.isSuccess && !calculo.isFetching
      ? calculo.data
      : undefined;
  const recomendado = resultado?.opciones[0];
  const { titulo, descripcion } = pantallas[vista];

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (siguiente) setVista("comparar");
        setAbierto(siguiente);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="comparison-trigger"
          aria-label="Comparar grifos"
          title="Comparar grifos"
        >
          <WandSparkles aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          vista === "resultado"
            ? "comparison-picker comparison-result"
            : "comparison-picker"
        }
      >
        <DialogHeader className="comparison-picker-header">
          <div className="comparison-heading">
            {vista === "resultado" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="comparison-back"
                aria-label="Volver a comparar grifos"
                onClick={() => setVista("comparar")}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            )}
            <DialogTitle>{titulo}</DialogTitle>
            {vista === "comparar" && (
              <InfoPopover title="Cómo se comparan los grifos">
                <p>
                  La recomendación suma el combustible solicitado y el desvío
                  por calles, estimado a S/ 0.50 por km. El vale solo incluye el
                  combustible.
                </p>
              </InfoPopover>
            )}
          </div>
          <DialogDescription className="sr-only">
            {descripcion}
          </DialogDescription>
        </DialogHeader>
        <div className="comparison-picker-body">
          {vista === "comparar" && (
            <>
              <Field label="Ruta de trabajo">
                <select
                  value={ruta?.id ?? ""}
                  onChange={(e) => seleccionRuta.elegirRuta(e.target.value)}
                >
                  <option value="" disabled={disponibles?.length === 1}>
                    {!fecha
                      ? "Elige la fecha de emisión"
                      : seleccionRuta.cargando
                        ? "Cargando rutas"
                        : disponibles?.length === 0
                          ? "Sin rutas asignadas"
                          : "Seleccionar ruta"}
                  </option>
                  {disponibles?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <ErrorText error={seleccionRuta.error} />
              {ruta && (
                <div className="comparison-origin">
                  <MapPin aria-hidden="true" />
                  <div>
                    <small>Origen del trabajo</small>
                    <strong>{nombreOrigen(origen)}</strong>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVista("origen")}
                  >
                    Cambiar
                  </Button>
                </div>
              )}
              {!emisionLista && (
                <p className="comparison-hint">
                  Completa la fecha, el suministro y la cantidad de galones en
                  Datos de emisión.
                </p>
              )}
              <Button
                type="button"
                className="comparison-generate"
                disabled={!listo}
                onClick={() => setVista("resultado")}
              >
                <Search /> Generar mejor opción
              </Button>
            </>
          )}
          {vista === "origen" && (
            <OrigenTrabajoSelector
              cuenta={cuenta}
              origen={origen}
              onUsar={(punto) => {
                seleccionRuta.ajustarOrigen(punto);
                setVista("comparar");
              }}
              onCancelar={() => setVista("comparar")}
            />
          )}
          {vista === "resultado" && (
            <>
              {calculo.isFetching && (
                <p className="map-loading" role="status">
                  <LoaderCircle className="spin" size={16} /> Calculando
                  recorrido
                </p>
              )}
              {calculo.isError && !calculo.isFetching && (
                <>
                  <ErrorText error={calculo.error} />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void calculo.refetch()}
                    >
                      Reintentar
                    </Button>
                  </div>
                </>
              )}
              {resultado && recomendado ? (
                <Suspense fallback={<p role="status">Cargando mapa</p>}>
                  <MapaGrifos
                    origen={origen}
                    paradas={resultado.ruta.paradas}
                    opciones={resultado.opciones}
                    recomendado={recomendado.proveedor}
                    trazado={recomendado.trazado}
                  />
                </Suspense>
              ) : (
                resultado && <p>No hay grifos disponibles para esta ruta.</p>
              )}
            </>
          )}
        </div>
        {vista === "resultado" && recomendado && (
          <footer className="comparison-picker-footer">
            <div className="comparison-selection">
              <strong>{recomendado.nombre}</strong>
              <span>
                <span>
                  {mostrarDistancia(recomendado.distanciaKm)} de desvío
                </span>
                <span>{money(recomendado.estimado)} estimados</span>
              </span>
            </div>
            <Button
              type="button"
              onClick={() => {
                onElegir(recomendado.proveedor);
                setAbierto(false);
              }}
            >
              <Check /> Elegir grifo
            </Button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
