import { solicitar } from "./cliente-http.js";

export const asociarFactura = (factura, ids) =>
  solicitar("/api/facturas/" + encodeURIComponent(factura) + "/vales", { vales: ids });

export const consultarGastos = periodo =>
  solicitar("/api/gastos?" + new URLSearchParams({ mes: periodo + "-01" }));
