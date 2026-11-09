import { solicitar } from "./cliente-http.js";

const base = "/api/administracion";
const cuenta = id => base + "/usuarios/" + encodeURIComponent(id);

export const consultarAdministracion = () => solicitar(base);
export const crearCuenta = datos => solicitar(base + "/usuarios", datos);
export const editarCuenta = (id, datos) => solicitar(cuenta(id), datos);
export const guardarRol = (id, datos) => solicitar(cuenta(id) + "/roles", datos);
export const registrarTarifa = datos => solicitar(base + "/tarifas", datos);
export const listarContratosVigentes = () => solicitar(base + "/contratos-vigentes");
export const registrarPrecioContrato = datos => solicitar(base + "/precios-contrato", datos);
