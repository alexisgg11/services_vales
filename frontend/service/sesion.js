import { cargarContexto } from "../api/sesion-api.js";
import { cargarCatalogos } from "../state/catalogos.js";
import { cargarPerfil, permisos } from "../state/permisos.js";
import { reemplazarVales, vales } from "../state/vales.js";

let origenPublico;
let pendiente = Promise.resolve();

export function enOrden(operacion) {
  const siguiente = pendiente.then(operacion);
  pendiente = siguiente.catch(() => {});
  return siguiente;
}

export function aplicarContexto({ cuenta, vales: documentos, publicBaseUrl, id }) {
  reemplazarVales(documentos);
  cargarPerfil(cuenta);
  cargarCatalogos(cuenta, vales.all(), permisos.current);
  origenPublico = publicBaseUrl;
  return id;
}

export const actualizarSesion = () => enOrden(async () => aplicarContexto(await cargarContexto()));

export const enlaceQr = uuid => origenPublico + "/vales/q/" + encodeURIComponent(uuid);
