import * as api from "../api/contabilidad-api.js";
import { aplicarContexto, enOrden } from "./sesion.js";
import { vales } from "../state/vales.js";
import { centesimos, identificador } from "../model/valores.js";

export const asociarFactura = (factura, ids) =>
  enOrden(async () => aplicarContexto(await api.asociarFactura(factura, ids)));

export async function consultarGastos(periodo) {
  const reporte = await api.consultarGastos(periodo);
  const documentos = new Map(vales.all().map(vale => [vale.zoneCode + "/" + vale.code, vale]));
  return reporte.vales.map(fila => {
    const vale = documentos.get(fila.cod_zonal + "/" + fila.codigo_vale);
    return {
      ...vale, id: vale?.id || identificador(fila.id_vale), code: fila.codigo_vale,
      zone: vale?.zone || fila.cod_zonal, supply: fila.id_suministro,
      contract: fila.nrocontrato === null ? "S/C" : fila.nrocontrato ?? vale?.contract,
      ticket: fila.ticket, consumption: fila.fecha_consumo,
      consumed: centesimos(fila.cantidad_consumida), amount: centesimos(fila.importe),
      invoiceNumber: fila.serie + "-" + fila.numero,
    };
  });
}
