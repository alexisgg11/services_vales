import { cents } from "@/lib/api";
import type { Factura, Vale } from "@/lib/types";

type ValePendiente = Vale & { ticket: string; importe: number };

export function valePendienteDeAsociar(vale: Vale): vale is ValePendiente {
  return (
    vale.estado_vale === 3 &&
    !vale.codigo_factura &&
    !!vale.ticket &&
    vale.importe != null
  );
}

export function conciliar(
  factura: Factura | undefined,
  vales: readonly Vale[],
) {
  const suma = vales.reduce(
    (total, vale) => total + cents(vale.importe ?? 0),
    0,
  );
  const respaldo = factura?.tickets ?? [];
  const esperados = new Set(respaldo);
  const coincidentes = new Set<string>();
  const sobrantes: Vale[] = [];
  for (const vale of vales) {
    const ticket = vale.ticket;
    if (
      ticket &&
      vale.cod_proveedor === factura?.cod_proveedor &&
      esperados.has(ticket) &&
      !coincidentes.has(ticket)
    ) {
      coincidentes.add(ticket);
    } else {
      sobrantes.push(vale);
    }
  }

  const faltantes = [...esperados].filter(
    (ticket) => !coincidentes.has(ticket),
  );
  const diferencia = factura ? suma - cents(factura.total) : 0;
  const importes = !!factura && diferencia === 0;
  const tickets =
    respaldo.length > 0 &&
    respaldo.length === esperados.size &&
    !faltantes.length &&
    !sobrantes.length;
  const proveedor =
    !!factura &&
    vales.every(
      (vale) =>
        valePendienteDeAsociar(vale) &&
        vale.cod_proveedor === factura.cod_proveedor,
    );

  return {
    suma: suma / 100,
    importes,
    tickets,
    proveedor,
    listo: importes && tickets && proveedor && factura?.asociado_por == null,
    diferencia: diferencia / 100,
    coincidentes: [...coincidentes],
    faltantes,
    sobrantes,
  };
}

export function sugerirFacturas(
  facturas: readonly Factura[],
  vales: readonly Vale[],
) {
  return facturas
    .filter((factura) => factura.asociado_por == null)
    .map((factura) => ({ factura, resultado: conciliar(factura, vales) }))
    .filter(({ resultado }) => resultado.coincidentes.length > 0)
    .sort(
      ({ resultado: a }, { resultado: b }) =>
        Number(b.listo) - Number(a.listo) ||
        b.coincidentes.length - a.coincidentes.length ||
        a.faltantes.length - b.faltantes.length ||
        Math.abs(a.diferencia) - Math.abs(b.diferencia),
    );
}

export function cambiosDeSeleccion(
  factura: Factura,
  resultado: ReturnType<typeof conciliar>,
  pendientes: readonly Vale[],
) {
  const porTicket = new Map(
    pendientes
      .filter(valePendienteDeAsociar)
      .filter((vale) => vale.cod_proveedor === factura.cod_proveedor)
      .map((vale) => [vale.ticket, vale]),
  );
  const agregar: ValePendiente[] = [];
  const sinVale: string[] = [];
  for (const ticket of resultado.faltantes) {
    const vale = porTicket.get(ticket);
    if (vale) agregar.push(vale);
    else sinVale.push(ticket);
  }
  return { agregar, quitar: resultado.sobrantes, sinVale };
}

type Optimizacion =
  | { estado: "encontrada"; factura: Factura; vales: Vale[] }
  | { estado: "sin-coincidencia" | "varias-coincidencias" };

export function optimizarAsociacion(
  facturas: readonly Factura[],
  seleccion: readonly Vale[],
  pendientes: readonly Vale[],
  facturaElegida?: string,
): Optimizacion {
  const opciones = sugerirFacturas(facturas, seleccion).flatMap(
    ({ factura, resultado }) => {
      const { agregar, quitar, sinVale } = cambiosDeSeleccion(
        factura,
        resultado,
        pendientes,
      );
      if (sinVale.length) return [];

      const descartados = new Set(quitar.map(({ id_vale }) => id_vale));
      const vales = [
        ...seleccion.filter(({ id_vale }) => !descartados.has(id_vale)),
        ...agregar,
      ];
      return conciliar(factura, vales).listo
        ? [{ factura, vales, ajustes: agregar.length + quitar.length }]
        : [];
    },
  );
  opciones.sort((a, b) => a.ajustes - b.ajustes);

  const elegida = opciones.find(
    ({ factura }) => factura.codigo_factura === facturaElegida,
  );
  const [primera, segunda] = opciones;
  const mejor = elegida ?? primera;
  if (!mejor) return { estado: "sin-coincidencia" };
  if (!elegida && mejor.ajustes === segunda?.ajustes) {
    return { estado: "varias-coincidencias" };
  }
  return { estado: "encontrada", factura: mejor.factura, vales: mejor.vales };
}
