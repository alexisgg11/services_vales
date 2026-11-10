import { catalogos } from "../state/catalogos.js";
import { centesimos } from "../model/valores.js";

export function consultarCondiciones({ provider, supply, emission, mode }) {
  if (!provider || !emission || !mode) return { supplies: [] };
  const contratosGrifo = catalogos.contracts.filter(c => c.proveedor === provider);
  const contratos = contratosGrifo.filter(c => c.activo !== false && c.inicio <= emission && emission <= c.fin);
  const hayVencido = contratosGrifo.some(c => c.fin < emission);
  if (mode === "SC_TRABAJADOR") {
    if (contratos.length)
      return { supplies: [], error: "El grifo tiene un contrato vigente. Elige la modalidad Con contrato." };
    if (!hayVencido)
      return { supplies: [], error: "Esta modalidad requiere un contrato vencido del grifo en la fecha de emisión." };
  }
  if (mode === "S/C" || mode === "SC_TRABAJADOR") {
    const tarifas = catalogos.tariffs.filter(t => t.proveedor === provider && t.inicio <= emission);
    const tarifa = tarifas.findLast(t => t.suministro === supply);
    const suministrosConTarifa = new Set(tarifas.map(t => t.suministro));
    const supplies = catalogos.supplies.filter(({ id }) => suministrosConTarifa.has(id));
    const detalle = supply
      ? "El combustible seleccionado no tiene tarifa aplicable para el grifo y la fecha de emisión."
      : "El grifo no tiene tarifas aplicables en la fecha de emisión.";
    return {
      contract: "S/C",
      supplies,
      price: tarifa && centesimos(tarifa.precio),
      error: !supplies.length || (supply && !tarifa)
        ? detalle + " Pide a Administración que cargue la tarifa."
        : "",
    };
  }
  if (!contratos.length) {
    const indicacion = hayVencido
      ? "Para emitir este vale al trabajador, cambia la modalidad a «Sin contrato por vencimiento»."
      : "Revisa la fecha o selecciona otro proveedor.";
    return { supplies: [], error: "El grifo no tiene un contrato vigente en la fecha de emisión. " + indicacion };
  }
  if (contratos.length > 1)
    return {
      supplies: [],
      error: "El grifo tiene más de un contrato vigente en la fecha de emisión. Pide que revisen las vigencias.",
    };
  const [contrato] = contratos;
  const supplies = catalogos.supplies.filter(({ id }) => centesimos(contrato.precios?.[id]) > 0);
  return {
    contract: contrato.id,
    supplies,
    price: centesimos(contrato.precios?.[supply]),
    balance: centesimos(contrato.saldo),
    error: supplies.length
      ? ""
      : "El contrato vigente " + contrato.id + " no tiene combustibles con precio pactado. Pide que revisen el detalle del contrato.",
  };
}

export function proveedoresParaEmision({ emission, mode }) {
  if (!emission || !mode) return [];
  return catalogos.providers.filter(({ id }) =>
    consultarCondiciones({ provider: id, emission, mode }).supplies.length > 0,
  );
}

export function unidadesParaEmision({ zone, center, emission }) {
  const propias = [], prestadas = [];
  if (!zone || !emission) return { propias, prestadas };
  for (const unidad of catalogos.units) {
    if (unidad.zone === zone) {
      propias.push(unidad);
    } else if (center && unidad.authorizations.some(a =>
      a.zonal === zone && a.centro === center && a.desde <= emission && emission <= a.hasta
    )) {
      prestadas.push(unidad);
    }
  }
  return { propias, prestadas };
}
