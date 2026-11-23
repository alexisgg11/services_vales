import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ContextoRutas, Cuenta, VinculoRuta } from "@/lib/types";
import type { OrigenTrabajo } from "@/lib/geografia/coordenadas";
import { origenDeRuta, origenLocalidad } from "@/lib/geografia/origenes";

export function useRutaEmision(cuenta: Cuenta, fecha: string) {
  const [rutaId, elegirRuta] = useState("");
  const [ajusteOrigen, setAjusteOrigen] = useState<{
    rutaId: string;
    punto: OrigenTrabajo;
  }>();
  const rutas = useQuery({
    queryKey: ["rutas-emision", cuenta.actor, fecha],
    queryFn: () =>
      api<ContextoRutas>(
        "/api/v1/emision/rutas?fecha=" + encodeURIComponent(fecha),
      ),
    enabled: !!fecha,
  });
  const disponibles = rutas.data?.rutas;
  const ruta = disponibles?.find((r) => r.id === rutaId);
  const origen = useMemo(
    () =>
      (ajusteOrigen?.rutaId === rutaId ? ajusteOrigen.punto : undefined) ??
      origenDeRuta(cuenta, ruta?.origen) ??
      origenLocalidad(cuenta, cuenta.trabajador.localidad),
    [ajusteOrigen, rutaId, ruta?.origen, cuenta],
  );
  const vinculo: VinculoRuta | undefined = ruta && {
    rutaId: ruta.id,
    rutaVersion: ruta.version,
    origenRuta: origen
      ? { latitud: origen.latitud, longitud: origen.longitud }
      : undefined,
  };
  useEffect(() => {
    if (disponibles && !disponibles.some((r) => r.id === rutaId))
      elegirRuta(disponibles.length === 1 ? disponibles[0].id : "");
  }, [disponibles, rutaId]);
  useEffect(() => {
    setAjusteOrigen(undefined);
  }, [cuenta.actor, cuenta.trabajador.localidad]);

  return {
    disponibles,
    ruta,
    origen,
    vinculo,
    elegirRuta,
    cargando: rutas.isPending,
    error: rutas.error,
    ajustarOrigen(punto: OrigenTrabajo) {
      if (ruta) setAjusteOrigen({ rutaId: ruta.id, punto });
    },
    reiniciar() {
      elegirRuta("");
      setAjusteOrigen(undefined);
    },
  };
}
