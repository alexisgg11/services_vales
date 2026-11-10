import { solicitar } from "./cliente-http.js";

const rutaFactura = factura => "/api/facturas/" + encodeURIComponent(factura);

export const validarTickets = (factura, respaldo) => solicitar(rutaFactura(factura) + "/validacion", respaldo);
export const asociarFactura = (factura, respaldo) => solicitar(rutaFactura(factura) + "/vales", respaldo);

export const consultarGastos = periodo =>
  solicitar("/api/gastos?" + new URLSearchParams({ mes: periodo + "-01" }));
