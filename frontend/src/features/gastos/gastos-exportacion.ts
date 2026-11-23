import { states } from "@/lib/api";
import {
  agrupacionesGastos,
  etiquetaRango,
  modalidadGasto,
  type Agrupacion,
  type CampoFiltroGastos,
  type ConsumoFacturado,
  type FiltrosGastos,
  type GastoPorCombustible,
  type GrupoGasto,
  type Metrica,
  type SerieGasto,
  type resumirGastos,
} from "./gastos-datos";

type Celda = string | number | null | undefined;

type ColumnaVale = readonly [
  titulo: string,
  grupo: "Comprobante" | "Asignación" | "Emisión y consumo" | "Seguimiento",
  leer: (vale: ConsumoFacturado) => Celda,
  formato?: "fecha" | "moneda" | "cantidad",
];

const fechaResponsable = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function formatearFechaResponsable(fecha: string) {
  return fecha ? fechaResponsable.format(new Date(fecha)) : "";
}

const eventosVale: Record<string, string> = {
  EMISION: "Emisión",
  AUTORIZACION: "Autorización",
  ATENCION: "Atención",
  FACTURA: "Asociación de factura",
};

function historialVale(vale: ConsumoFacturado) {
  return (vale.responsables ?? [])
    .map(({ accion, nombre, cargo, fecha }) => {
      const responsable = cargo ? `${nombre} (${cargo})` : nombre;
      const momento = formatearFechaResponsable(fecha);
      return [eventosVale[accion] ?? accion, responsable, momento]
        .filter(Boolean)
        .join(" - ");
    })
    .join("\n");
}

const columnas: readonly ColumnaVale[] = [
  ["Vale", "Comprobante", (v) => v.codigo_vale],
  ["Zonal", "Asignación", (v) => v.zonal],
  ["Fecha de consumo", "Emisión y consumo", (v) => v.fecha_consumo, "fecha"],
  ["Combustible", "Emisión y consumo", (v) => v.suministro],
  ["Modalidad", "Comprobante", modalidadGasto],
  ["Grifo", "Comprobante", (v) => v.grifo],
  ["Centro de costo", "Asignación", (v) => v.centro_costo],
  ["Ticket", "Comprobante", (v) => v.ticket],
  ["Factura", "Comprobante", (v) => v.factura_numero],
  ["Galones", "Emisión y consumo", (v) => v.cantidad_consumida, "cantidad"],
  ["Importe (S/)", "Emisión y consumo", (v) => v.importe, "moneda"],
  ["RUC del grifo", "Comprobante", (v) => v.cod_proveedor],
  ["Contrato", "Comprobante", (v) => v.nrocontrato],
  ["Estado", "Comprobante", (v) => states[v.estado_vale]],
  ["Localidad del vale", "Asignación", (v) => v.localidad],
  ["Código del centro de costo", "Asignación", (v) => v.cod_centrocosto],
  ["Localidad del centro", "Asignación", (v) => v.localidad_centro],
  ["Referencia del centro", "Asignación", (v) => v.referencia_ubicacion_centro],
  ["Unidad organizativa", "Asignación", (v) => v.unidad_organizativa],
  ["Trabajador", "Asignación", (v) => v.trabajador],
  ["DNI del trabajador", "Asignación", (v) => v.dni_trabajador],
  ["Placa", "Asignación", (v) => v.placa],
  ["Zonal base del vehículo", "Asignación", (v) => v.zonal_base_unidad],
  ["Tercero", "Asignación", (v) => v.tercero],
  ["Documento del tercero", "Asignación", (v) => v.documento_tercero],
  ["Destino del tercero", "Asignación", (v) => v.destino_tercero],
  ["Fecha de emisión", "Emisión y consumo", (v) => v.fecha_emision, "fecha"],
  [
    "Galones emitidos",
    "Emisión y consumo",
    (v) => v.cantidad_emitida,
    "cantidad",
  ],
  [
    "Precio referencial por galón",
    "Emisión y consumo",
    (v) => v.precio_referencial,
    "moneda",
  ],
  [
    "Importe estimado",
    "Emisión y consumo",
    (v) => v.importe_estimado,
    "moneda",
  ],
  [
    "Precio sugerido por galón",
    "Emisión y consumo",
    (v) => v.precio_sugerido,
    "moneda",
  ],
  [
    "Precio real por galón",
    "Emisión y consumo",
    (v) => v.precio_real,
    "moneda",
  ],
  ["Observación", "Seguimiento", (v) => v.observacion],
  ["Responsables", "Seguimiento", historialVale],
];

const encabezados = columnas.map(([titulo, grupo, , formato]) => ({
  titulo,
  grupo,
  formato,
}));

const filaVale = (vale: ConsumoFacturado) =>
  columnas.map(([, , leer]) => leer(vale) ?? null);

export function csvGastos(vales: readonly ConsumoFacturado[]) {
  const filas = [
    encabezados.map(({ titulo }) => titulo),
    ...vales.map(filaVale),
  ];
  return (
    "\uFEFF" +
    filas
      .map((fila) =>
        fila
          .map((valor) => {
            let texto =
              typeof valor === "number" ? valor.toFixed(2) : (valor ?? "");
            if (
              typeof valor === "string" &&
              /^[\s]*[=+@-]|^[\t\r\n]/.test(valor)
            ) {
              texto = "'" + texto;
            }
            return '"' + texto.replaceAll('"', '""') + '"';
          })
          .join(";"),
      )
      .join("\r\n")
  );
}

export interface DatosReporteGastos {
  filtros: FiltrosGastos;
  campos: readonly CampoFiltroGastos[];
  resumen: ReturnType<typeof resumirGastos>;
  grupos: readonly GrupoGasto[];
  series: readonly SerieGasto[];
  agrupacion: Agrupacion;
  metrica: Metrica;
  vales: readonly ConsumoFacturado[];
  seleccion?: GastoPorCombustible;
}

export function prepararReporteGastos({
  filtros,
  campos,
  resumen,
  grupos,
  series,
  agrupacion,
  metrica,
  vales,
  seleccion,
}: DatosReporteGastos) {
  const filtrosAplicados = campos
    .filter(({ dimension }) => filtros[dimension])
    .map(({ dimension, etiqueta, opciones }) => ({
      etiqueta,
      valor:
        opciones.find(([id]) => id === filtros[dimension])?.[1] ??
        filtros[dimension],
    }));
  return {
    desde: filtros.desde,
    hasta: filtros.hasta,
    periodo: etiquetaRango(filtros),
    filtros: filtrosAplicados,
    agrupacion: agrupacionesGastos.find(({ id }) => id === agrupacion)!
      .etiqueta,
    metrica,
    indicadores: [
      { etiqueta: "Total facturado", importe: resumen.importe },
      { etiqueta: "Con contrato", importe: resumen.conContrato },
      { etiqueta: "S/C", importe: resumen.sinContrato },
    ],
    series,
    periodos: grupos.map(({ inicio, etiqueta, porCombustible }) => ({
      inicio,
      etiqueta,
      nombre: porCombustible.values().next().value?.periodo ?? etiqueta,
      valores: series.map(({ id, nombre }) => {
        const gasto = porCombustible.get(id);
        return {
          nombre,
          importe: gasto?.importe ?? 0,
          galones: gasto?.galones ?? 0,
          vales: gasto?.vales.length ?? 0,
        };
      }),
    })),
    detalle: {
      columnas: encabezados,
      filas: vales.map(filaVale),
      seleccion: seleccion && {
        combustible: seleccion.nombre,
        periodo: seleccion.periodo,
      },
    },
  };
}

export type ReporteGastos = ReturnType<typeof prepararReporteGastos>;

export function descargarArchivo(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
