import type { Coordenadas } from "@/lib/types";

export interface OrigenTrabajo extends Coordenadas {
  fuente: "actual" | "mapa" | "localidad";
  nombre?: string;
  localidad?: string;
}

const formatoKm = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 2,
});

export function origenValido(origen: Coordenadas) {
  return (
    Number.isFinite(origen.latitud) &&
    Number.isFinite(origen.longitud) &&
    Math.abs(origen.latitud) <= 90 &&
    Math.abs(origen.longitud) <= 180
  );
}

export function mostrarDistancia(km: number | null) {
  if (km == null) return "Sin distancia";
  return km < 1 ? Math.round(km * 1000) + " m" : formatoKm.format(km) + " km";
}
