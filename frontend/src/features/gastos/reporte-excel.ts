import ExcelJS, { type CellValue, type Worksheet } from "exceljs";
import {
  formatearFechaResponsable,
  type ReporteGastos,
} from "./gastos-exportacion";
import type { ConsumoFacturado } from "./gastos-datos";

const moneda = '"S/" #,##0.00';
const cantidad = "#,##0.00";
const fecha = "dd/mm/yyyy";

const responsables = [
  { titulo: "Emitido por", accion: "EMISION" },
  { titulo: "Autorizado por", accion: "AUTORIZACION" },
  { titulo: "Atendido por", accion: "ATENCION" },
  { titulo: "Factura asociada por", accion: "FACTURA" },
];

function agregarTabla(
  hoja: Worksheet,
  nombre: string,
  filaInicial: number,
  encabezados: string[],
  filas: CellValue[][],
) {
  if (!filas.length) {
    const encabezado = hoja.getRow(filaInicial);
    encabezado.values = encabezados;
    encabezado.eachCell((celda) => {
      celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF087F86" },
      };
    });
    return;
  }
  hoja.addTable({
    name: nombre,
    ref: "A" + filaInicial,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: encabezados.map((name) => ({ name, filterButton: true })),
    rows: filas,
  });
}

export async function crearExcelGastos(
  reporte: ReporteGastos,
  consumos: readonly ConsumoFacturado[],
  origen: string,
) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Vales";
  libro.title = "Reporte de gastos";
  const resumen = libro.addWorksheet("Resumen");
  agregarTabla(
    resumen,
    "ImportesFacturados",
    1,
    ["Indicador", "Importe"],
    reporte.indicadores.map(({ etiqueta, importe }) => [etiqueta, importe]),
  );
  resumen.getColumn(1).width = 25;
  resumen.getColumn(2).width = 56;
  for (let fila = 2; fila <= reporte.indicadores.length + 1; fila++) {
    resumen.getCell(fila, 2).numFmt = moneda;
  }
  agregarTabla(
    resumen,
    "FiltrosConsulta",
    7,
    ["Consulta", "Valor"],
    [
      ["Período", reporte.periodo],
      ["Agrupar por", reporte.agrupacion],
      [
        "Unidad del gráfico",
        reporte.metrica === "importe" ? "Importe" : "Galones",
      ],
      ...reporte.filtros.map(({ etiqueta, valor }) => [etiqueta, valor]),
      ...(reporte.detalle.seleccion
        ? [
            [
              "Punto seleccionado",
              reporte.detalle.seleccion.combustible +
                ", " +
                reporte.detalle.seleccion.periodo,
            ],
          ]
        : []),
      ["Vales en el detalle", reporte.detalle.filas.length],
    ],
  );

  const comparativo = libro.addWorksheet("Comparativo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  agregarTabla(
    comparativo,
    "ComparativoCombustibles",
    1,
    ["Período", "Combustible", "Importe", "Galones", "Vales"],
    reporte.periodos.flatMap((periodo) =>
      periodo.valores.map(({ nombre, importe, galones, vales }) => [
        periodo.nombre,
        nombre,
        importe,
        galones,
        vales,
      ]),
    ),
  );
  [28, 22, 17, 16, 12].forEach(
    (ancho, i) => (comparativo.getColumn(i + 1).width = ancho),
  );
  comparativo.getColumn(3).numFmt = moneda;
  comparativo.getColumn(4).numFmt = cantidad;

  const vales = libro.addWorksheet("Vales facturados", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  const columnas = reporte.detalle.columnas
    .map((columna, indice) => ({ ...columna, indice }))
    .filter(({ titulo }) => titulo !== "Responsables");
  agregarTabla(
    vales,
    "ValesFacturados",
    1,
    [
      ...columnas.map(({ titulo }) => titulo),
      ...responsables.map(({ titulo }) => titulo),
      "Detalle del vale",
    ],
    reporte.detalle.filas.map((fila, i) => {
      const vale = consumos[i];
      const enlace = new URL(
        "/vales/q/" + encodeURIComponent(vale.id_qr) + "/documento",
        origen,
      );
      return [
        ...columnas.map(({ indice, formato }) => {
          const valor = fila[indice];
          return valor && formato === "fecha"
            ? new Date(valor + "T00:00:00Z")
            : valor;
        }),
        ...responsables.map(({ accion }) => {
          const evento = vale.responsables?.find((e) => e.accion === accion);
          return evento
            ? [evento.nombre, formatearFechaResponsable(evento.fecha)]
                .filter(Boolean)
                .join("\n")
            : null;
        }),
        { text: "Ver vale", hyperlink: enlace.href },
      ];
    }),
  );
  columnas.forEach(({ titulo, formato }, i) => {
    const columna = vales.getColumn(i + 1);
    columna.width = Math.max(
      titulo.length + 5,
      formato || titulo === "Vale" ? 18 : 24,
    );
    columna.alignment = { vertical: "top", wrapText: true };
    if (formato) {
      columna.numFmt =
        formato === "fecha" ? fecha : formato === "moneda" ? moneda : cantidad;
    }
  });
  responsables.forEach((_, i) => {
    const columna = vales.getColumn(columnas.length + i + 1);
    columna.width = 29;
    columna.alignment = { vertical: "top", wrapText: true };
  });
  const enlaces = vales.getColumn(columnas.length + responsables.length + 1);
  enlaces.width = 22;
  enlaces.eachCell((celda, fila) => {
    if (fila > 1) {
      celda.font = { color: { argb: "FF087F86" }, underline: true };
      celda.alignment = { vertical: "top" };
      vales.getRow(fila).height = 34;
    }
  });
  return new Blob([new Uint8Array(await libro.xlsx.writeBuffer())], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
