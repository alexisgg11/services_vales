import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/feedback";
import { SelectorLocalidadOrigen } from "@/components/mapas/SelectorLocalidadOrigen";
import type { Cuenta } from "@/lib/types";
import { origenValido, type OrigenTrabajo } from "@/lib/geografia/coordenadas";
import { origenLocalidad } from "@/lib/geografia/origenes";

const MapaGrifos = lazy(() =>
  import("@/components/mapas/MapaRecorrido").then((m) => ({
    default: m.MapaGrifos,
  })),
);

export function OrigenTrabajoSelector({
  cuenta,
  origen,
  onUsar,
  onCancelar,
}: {
  cuenta: Cuenta;
  origen?: OrigenTrabajo;
  onUsar: (punto: OrigenTrabajo) => void;
  onCancelar: () => void;
}) {
  const [localidad, setLocalidad] = useState(
      origen?.fuente === "localidad"
        ? origen.localidad!
        : origen
          ? ""
          : cuenta.trabajador.localidad,
    ),
    [punto, setPunto] = useState(origen),
    [ubicacionActual, setUbicacionActual] = useState(
      origen?.fuente === "actual" ? origen : undefined,
    ),
    [mapaVisible, setMapaVisible] = useState(
      !!origen && origen.fuente !== "localidad",
    ),
    [localizando, setLocalizando] = useState(false),
    [error, setError] = useState<unknown>();
  const activo = useRef(true);
  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
    };
  }, []);
  function localizar() {
    setError(undefined);
    if (!navigator.geolocation) {
      setError(
        new Error(
          "No se pudo obtener la ubicación. Elige una localidad o un punto del mapa.",
        ),
      );
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!activo.current) return;
        setLocalizando(false);
        const nuevo: OrigenTrabajo = {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          fuente: "actual",
        };
        if (!origenValido(nuevo)) {
          setError(new Error("No se obtuvo una ubicación válida."));
          return;
        }
        setUbicacionActual(nuevo);
        setPunto(nuevo);
        setLocalidad("");
        setMapaVisible(true);
      },
      () => {
        if (!activo.current) return;
        setLocalizando(false);
        setError(
          new Error(
            "No se pudo obtener la ubicación. Elige una localidad o un punto del mapa.",
          ),
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  return (
    <section
      className="comparison-origin-editor"
      aria-label="Cambiar origen del trabajo"
    >
      <SelectorLocalidadOrigen
        cuenta={cuenta}
        label="Localidad o zona"
        localidad={localidad}
        onChange={(codigo) => {
          setLocalidad(codigo);
          setError(undefined);
          setPunto(origenLocalidad(cuenta, codigo));
        }}
      />
      {mapaVisible && (
        <Suspense fallback={<p role="status">Cargando mapa</p>}>
          <MapaGrifos
            origen={punto}
            ubicacionActual={ubicacionActual}
            editarOrigen
            onOrigenChange={(p) => {
              setPunto({ ...p, fuente: "mapa" });
              setLocalidad("");
            }}
            onUbicacion={localizar}
            localizando={localizando}
          />
        </Suspense>
      )}
      {!mapaVisible && (
        <div className="comparison-origin-tools">
          <Button
            type="button"
            variant="outline"
            onClick={localizar}
            disabled={localizando}
          >
            {localizando ? <LoaderCircle className="spin" /> : <Navigation />}{" "}
            Usar ubicación
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMapaVisible(true)}
          >
            <MapPin /> Marcar en el mapa
          </Button>
        </div>
      )}
      <ErrorText error={error} />
      <div className="comparison-origin-actions">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!punto || localizando}
          onClick={() => punto && onUsar(punto)}
        >
          Usar origen
        </Button>
      </div>
    </section>
  );
}
