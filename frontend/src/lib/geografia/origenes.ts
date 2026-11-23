import type { Cuenta, PuntoPartidaRuta } from "@/lib/types";
import { origenValido, type OrigenTrabajo } from "./coordenadas";
import geografia from "./localidades-geograficas.json";

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

export function nombreLocalidad(
  cuenta: Pick<Cuenta, "localidades">,
  codigo: string,
) {
  return cuenta.localidades.find((l) => l.id_localidad === codigo)
    ?.nom_localidad;
}

// El catálogo aporta un punto representativo de la localidad, no la posición
// de la persona. Las localidades nuevas sin referencia requieren elegir punto.
export function origenLocalidad(
  cuenta: Pick<Cuenta, "localidades" | "zonales">,
  codigo: string,
): OrigenTrabajo | undefined {
  const localidad = cuenta.localidades.find((l) => l.id_localidad === codigo);
  if (!localidad) return;
  const zonal = cuenta.zonales.find((z) => z.id_zona === localidad.id_zona);
  if (!zonal) return;
  const nombre = normalizar(localidad.nom_localidad);
  const zona = normalizar(zonal.nom_zona);
  const referencia = geografia.referencias.find(
    (r) =>
      normalizar(r.zonal) === zona &&
      normalizar(r.localidad) ===
        (nombre.startsWith("ZONAL ") || nombre === "SEDE CENTRAL"
          ? zona
          : nombre),
  );
  if (!referencia) return;
  return {
    latitud: referencia.latitud,
    longitud: referencia.longitud,
    fuente: "localidad",
    localidad: codigo,
    nombre: localidad.nom_localidad,
  };
}

export function nombreOrigen(origen?: OrigenTrabajo) {
  return (
    origen?.nombre ||
    (origen?.fuente === "actual"
      ? "Mi ubicación"
      : origen
        ? "Punto elegido en mapa"
        : "Elegir punto de partida")
  );
}

export function origenDeRuta(
  cuenta: Pick<Cuenta, "localidades">,
  punto?: PuntoPartidaRuta | null,
): OrigenTrabajo | undefined {
  if (!punto || !origenValido(punto)) return;
  const nombre = punto.localidad
    ? nombreLocalidad(cuenta, punto.localidad)
    : undefined;
  return { ...punto, nombre, fuente: nombre ? "localidad" : "mapa" };
}
