import { cents } from "@/lib/api";
import type { Cuenta, Vale } from "@/lib/types";

export const periodos = [
  ["mes-actual", "Este mes"],
  ["mes-anterior", "Mes anterior"],
  ["meses-3", "Últimos 3 meses"],
  ["meses-12", "Últimos 12 meses"],
  ["anio-actual", "Este año"],
  ["personalizado", "Personalizado"],
] as const;

export type Periodo = (typeof periodos)[number][0];
export type Agrupacion = "semana" | "mes" | "anio";
export type Metrica = "importe" | "galones";
export type Rango = { desde: string; hasta: string };

export const agrupacionesGastos = [
  { id: "semana", etiqueta: "Semana" },
  { id: "mes", etiqueta: "Mes" },
  { id: "anio", etiqueta: "Año" },
] as const;

export interface FiltrosGastos extends Rango {
  periodo: Periodo;
  zonal: string;
  suministro: string;
  modalidad: string;
  grifo: string;
  centro: string;
}

type OpcionFiltro = readonly [valor: string, etiqueta: string];

export interface CampoFiltroGastos {
  dimension: "zonal" | "suministro" | "modalidad" | "grifo" | "centro";
  etiqueta: string;
  todas: string;
  opciones: readonly OpcionFiltro[];
}

export function camposFiltrosGastos(
  cuenta: Cuenta,
  centros: readonly OpcionFiltro[],
): CampoFiltroGastos[] {
  return [
    {
      dimension: "zonal",
      etiqueta: "Zonal",
      todas: "Todas",
      opciones: cuenta.zonales.map((zona) => [zona.id_zona, zona.nom_zona]),
    },
    {
      dimension: "suministro",
      etiqueta: "Combustible",
      todas: "Todos",
      opciones: cuenta.suministros.map((suministro) => [
        suministro.id_suministro,
        suministro.descripcion,
      ]),
    },
    {
      dimension: "modalidad",
      etiqueta: "Modalidad",
      todas: "Todas",
      opciones: [
        ["Con contrato", "Con contrato"],
        ["Sin contrato", "Sin contrato"],
      ],
    },
    {
      dimension: "grifo",
      etiqueta: "Grifo",
      todas: "Todos",
      opciones: cuenta.proveedores.map((proveedor) => [
        proveedor.cod_proveedor,
        proveedor.razon_social,
      ]),
    },
    {
      dimension: "centro",
      etiqueta: "Centro de costo",
      todas: "Todos",
      opciones: centros,
    },
  ];
}

export type ConsumoFacturado = Vale & {
  fecha_consumo: string;
  cantidad_consumida: number;
  importe: number;
  ticket: string;
  factura_numero: string;
};

const aFecha = (dia: string) => new Date(dia + "T00:00:00Z");
const aDia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const diaMes = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const diaMesAnio = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const mesAnio = new Intl.DateTimeFormat("es-PE", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function desplazarDias(dia: string, dias: number) {
  const fecha = aFecha(dia);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aDia(fecha);
}

function desplazarMeses(primerDia: string, meses: number) {
  const fecha = aFecha(primerDia);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);
  return aDia(fecha);
}

export function rangoPeriodo(
  periodo: Exclude<Periodo, "personalizado">,
  hoy: string,
): Rango {
  const mes = hoy.slice(0, 7) + "-01";
  if (periodo === "mes-anterior") {
    return { desde: desplazarMeses(mes, -1), hasta: desplazarDias(mes, -1) };
  }
  if (periodo === "meses-3" || periodo === "meses-12") {
    return {
      desde: desplazarMeses(mes, periodo === "meses-3" ? -2 : -11),
      hasta: hoy,
    };
  }
  if (periodo === "anio-actual") {
    return { desde: hoy.slice(0, 4) + "-01-01", hasta: hoy };
  }
  return { desde: mes, hasta: desplazarDias(desplazarMeses(mes, 1), -1) };
}

export function etiquetaRango({ desde, hasta }: Rango) {
  return diaMesAnio.formatRange(aFecha(desde), aFecha(hasta));
}

function inicioPeriodo(dia: string, agrupacion: Agrupacion) {
  if (agrupacion === "anio") return dia.slice(0, 4) + "-01-01";
  if (agrupacion === "mes") return dia.slice(0, 7) + "-01";
  const diaSemana = aFecha(dia).getUTCDay();
  return desplazarDias(dia, -((diaSemana + 6) % 7));
}

function etiquetasPeriodo(inicio: string, agrupacion: Agrupacion) {
  const anio = inicio.slice(0, 4);
  if (agrupacion === "anio") return { corto: anio, completo: anio };
  if (agrupacion === "mes") {
    const mes = mesAnio.format(aFecha(inicio));
    return { corto: mes, completo: mes };
  }
  const fin = desplazarDias(inicio, 6);
  return {
    corto: diaMes.formatRange(aFecha(inicio), aFecha(fin)),
    completo: etiquetaRango({ desde: inicio, hasta: fin }),
  };
}

export function esConsumoFacturado(vale: Vale): vale is ConsumoFacturado {
  return (
    vale.estado_vale === 3 &&
    !!vale.codigo_factura &&
    !!vale.factura_numero &&
    !!vale.fecha_consumo &&
    vale.cantidad_consumida != null &&
    vale.importe != null &&
    !!vale.ticket
  );
}

export function filtrarGastos(
  vales: readonly ConsumoFacturado[],
  filtros: FiltrosGastos,
) {
  return vales.filter(
    (vale) =>
      vale.fecha_consumo >= filtros.desde &&
      vale.fecha_consumo <= filtros.hasta &&
      (!filtros.zonal || vale.cod_zonal === filtros.zonal) &&
      (!filtros.suministro || vale.id_suministro === filtros.suministro) &&
      (!filtros.modalidad || modalidadGasto(vale) === filtros.modalidad) &&
      (!filtros.grifo || vale.cod_proveedor === filtros.grifo) &&
      (!filtros.centro || vale.cod_centrocosto === filtros.centro),
  );
}

export const modalidadGasto = (vale: Vale) =>
  vale.nrocontrato ? "Con contrato" : "Sin contrato";

export function resumirGastos(vales: readonly ConsumoFacturado[]) {
  let contrato = 0;
  let sinContrato = 0;
  let galones = 0;
  for (const vale of vales) {
    if (vale.nrocontrato) contrato += cents(vale.importe);
    else sinContrato += cents(vale.importe);
    galones += cents(vale.cantidad_consumida);
  }
  return {
    importe: (contrato + sinContrato) / 100,
    conContrato: contrato / 100,
    sinContrato: sinContrato / 100,
    galones: galones / 100,
  };
}

export interface GastoPorCombustible {
  inicio: string;
  suministro: string;
  nombre: string;
  periodo: string;
  importe: number;
  galones: number;
  vales: ConsumoFacturado[];
}

export function agruparGastos(
  vales: readonly ConsumoFacturado[],
  agrupacion: Agrupacion,
) {
  const grupos = new Map<string, Map<string, ConsumoFacturado[]>>();
  for (const vale of vales) {
    const inicio = inicioPeriodo(vale.fecha_consumo, agrupacion);
    const grupo = grupos.get(inicio) ?? new Map<string, ConsumoFacturado[]>();
    const consumos = grupo.get(vale.id_suministro) ?? [];
    consumos.push(vale);
    grupo.set(vale.id_suministro, consumos);
    grupos.set(inicio, grupo);
  }
  return [...grupos]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicio, grupo]) => {
      const etiquetas = etiquetasPeriodo(inicio, agrupacion);
      const porCombustible = new Map<string, GastoPorCombustible>();
      for (const [suministro, consumos] of grupo) {
        const { galones, importe } = resumirGastos(consumos);
        porCombustible.set(suministro, {
          inicio,
          suministro,
          nombre: consumos[0].suministro,
          periodo: etiquetas.completo,
          importe,
          galones,
          vales: consumos,
        });
      }
      return { inicio, etiqueta: etiquetas.corto, porCombustible };
    });
}

export type GrupoGasto = ReturnType<typeof agruparGastos>[number];

const estilosLinea = [
  { color: "#087f86" },
  { color: "#7468ad", trazo: "7 4" },
  { color: "#ab7130", trazo: "3 3" },
  { color: "#467699", trazo: "9 4" },
  { color: "#527a56", trazo: "8 3 2 3" },
];

export interface SerieGasto {
  id: string;
  nombre: string;
  color: string;
  trazo?: string;
  conVales: boolean;
}

export function seriesDeGastos(
  grupos: readonly GrupoGasto[],
  suministros: Readonly<Cuenta["suministros"]>,
  suministroFiltrado: string,
): SerieGasto[] {
  const registrados = new Map<string, string>();
  for (const grupo of grupos) {
    for (const gasto of grupo.porCombustible.values()) {
      registrados.set(gasto.suministro, gasto.nombre);
    }
  }
  const catalogo = new Map(
    suministros.map(({ id_suministro, descripcion }) => [
      id_suministro,
      descripcion,
    ]),
  );
  for (const [id, nombre] of registrados) {
    if (!catalogo.has(id)) catalogo.set(id, nombre);
  }
  return [...catalogo]
    .map(([id, nombre], indice) => ({
      id,
      nombre,
      ...estilosLinea[indice % estilosLinea.length],
      conVales: registrados.has(id),
    }))
    .filter(({ id }) => !suministroFiltrado || id === suministroFiltrado);
}
