import type {
  ContextoRutas,
  Coordenadas,
  Cuenta,
  PuntoPartidaRuta,
  RutaTrabajo,
} from "@/lib/types";
import { origenValido } from "@/lib/geografia/coordenadas";
import { origenDeRuta, origenLocalidad } from "@/lib/geografia/origenes";

export const MAX_PARADAS_RUTA = 15;

export type SeccionRuta = "datos" | "operativos" | "paradas";
export type CentroRuta = ContextoRutas["centros"][number];
export type ModoPunto = "centro" | "libre";

export interface ParadaBorrador {
  clave: number;
  nombre: string;
  centro: string | null;
  punto?: Coordenadas;
}

export type BorradorRuta = Omit<RutaTrabajo, "id" | "paradas"> & {
  paradas: ParadaBorrador[];
};

export function datosParaGuardarRuta(
  borrador: BorradorRuta,
  origen?: PuntoPartidaRuta,
) {
  return {
    ...borrador,
    nombre: borrador.nombre.trim(),
    trabajadores: [...borrador.trabajadores].sort((a, b) => a - b),
    origen: origen && {
      latitud: origen.latitud,
      longitud: origen.longitud,
      localidad: origen.localidad,
    },
    paradas: borrador.paradas.map(({ centro, nombre, punto }) => ({
      centro,
      nombre: nombre.trim(),
      latitud: punto?.latitud,
      longitud: punto?.longitud,
    })),
  };
}

interface IncidenciaRuta {
  seccion: SeccionRuta;
  mensaje: string;
  parada?: number;
}

export function seleccionarCentro(
  parada: ParadaBorrador,
  codigo: string | null,
  centros: CentroRuta[],
): ParadaBorrador {
  if (parada.centro === codigo) return parada;
  const anterior = centros.find((centro) => centro.codigo === parada.centro);
  const nuevo = centros.find((centro) => centro.codigo === codigo);
  const nombreActual = parada.nombre.trim();
  const nombrePersonalizado =
    nombreActual && nombreActual !== anterior?.nombre.trim();
  return {
    ...parada,
    centro: codigo,
    nombre: nombrePersonalizado ? parada.nombre : (nuevo?.nombre ?? ""),
    punto: nuevo?.punto ?? undefined,
  };
}

export function confirmarPunto(
  parada: ParadaBorrador,
  punto: Coordenadas,
  modo: ModoPunto,
  centros: CentroRuta[],
): ParadaBorrador {
  const lugar =
    modo === "libre" ? seleccionarCentro(parada, null, centros) : parada;
  return { ...lugar, punto };
}

export function partidaDelBorrador(
  cuenta: Pick<Cuenta, "localidades" | "zonales">,
  ruta: Pick<BorradorRuta, "cod_zonal" | "origen" | "trabajadores">,
  operativos: ContextoRutas["trabajadores"],
) {
  const guardada = origenDeRuta(cuenta, ruta.origen);
  if (guardada) return guardada;
  const primero = operativos.find(
    (op) => op.id === ruta.trabajadores[0] && op.zonal === ruta.cod_zonal,
  );
  return primero?.localidad
    ? origenLocalidad(cuenta, primero.localidad)
    : undefined;
}

export function validarRuta(
  ruta: BorradorRuta,
  operativos: ContextoRutas["trabajadores"],
  requierePartida = false,
): IncidenciaRuta | undefined {
  if (!ruta.nombre.trim()) {
    return { seccion: "datos", mensaje: "Escribe el nombre del trabajo." };
  }
  if (!ruta.cod_zonal) {
    return { seccion: "datos", mensaje: "Selecciona la zonal responsable." };
  }
  if (!ruta.desde || !ruta.hasta || ruta.hasta < ruta.desde) {
    return {
      seccion: "datos",
      mensaje: "Indica un período válido para la ruta.",
    };
  }
  if (!ruta.trabajadores.length) {
    return {
      seccion: "operativos",
      mensaje: "Selecciona al menos un operativo.",
    };
  }
  const disponibles = new Set(operativos.map((operativo) => operativo.id));
  if (ruta.trabajadores.some((id) => !disponibles.has(id))) {
    return {
      seccion: "operativos",
      mensaje: "Quita los operativos que ya no están disponibles.",
    };
  }
  if (
    (requierePartida || ruta.origen) &&
    (!ruta.origen || !origenValido(ruta.origen))
  ) {
    return {
      seccion: "paradas",
      mensaje: "Indica el punto de partida de la ruta.",
    };
  }
  if (!ruta.paradas.length) {
    return { seccion: "paradas", mensaje: "Añade una parada a la ruta." };
  }
  if (ruta.paradas.length > MAX_PARADAS_RUTA) {
    return {
      seccion: "paradas",
      mensaje: `La ruta admite hasta ${MAX_PARADAS_RUTA} paradas.`,
    };
  }
  for (const [i, parada] of ruta.paradas.entries()) {
    const campo = { seccion: "paradas" as const, parada: parada.clave };
    if (!parada.punto || !origenValido(parada.punto)) {
      return {
        ...campo,
        mensaje: `Ubica la parada ${i + 1} en el mapa.`,
      };
    }
    if (!parada.nombre.trim()) {
      return {
        ...campo,
        mensaje: `Escribe un nombre para la parada ${i + 1}.`,
      };
    }
  }
}
