import { obtenerCsrf, solicitar } from "./cliente-http.js";

export const cargarContexto = () => solicitar("/api/aplicacion");

export async function cerrarSesion() {
  const { token } = await obtenerCsrf();
  const formulario = document.createElement("form");
  formulario.method = "post";
  formulario.action = "/logout";
  const campo = document.createElement("input");
  campo.type = "hidden";
  campo.name = "_csrf";
  campo.value = token;
  formulario.append(campo);
  document.body.append(formulario);
  formulario.submit();
}
