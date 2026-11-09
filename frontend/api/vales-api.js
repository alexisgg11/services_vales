import { solicitar } from "./cliente-http.js";

const base = "/api/vales";
const rutaQr = idQr => base + "/qr/" + encodeURIComponent(idQr);

export const registrarVale = datos => solicitar(base, datos);
export const autorizarVales = ids => solicitar(base + "/autorizacion", { vales: ids });
export const anularVale = (id, motivo) => solicitar(base + "/" + encodeURIComponent(id) + "/anulacion", { motivo });
export const listarReferencias = () => solicitar(base + "/qr");
export const consultarQr = idQr => solicitar(rutaQr(idQr));
export const verificarQr = idQr => solicitar("/api/publico/vales/" + encodeURIComponent(idQr));
export const sugerirPrecio = (idQr, fecha) => solicitar(rutaQr(idQr) + "/precio?" + new URLSearchParams({ fecha }));
export const registrarAtencion = (idQr, datos) => solicitar(rutaQr(idQr) + "/atencion", datos);
