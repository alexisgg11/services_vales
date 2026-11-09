export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

let csrfEnCurso;

export function obtenerCsrf() {
  csrfEnCurso ||= solicitar("/api/csrf").catch(error => {
    csrfEnCurso = undefined;
    throw error;
  });
  return csrfEnCurso;
}

export async function solicitar(ruta, datos) {
  const headers = { Accept: "application/json" };
  const opciones = { headers, cache: "no-store" };
  if (datos !== undefined) {
    const csrf = await obtenerCsrf();
    headers["Content-Type"] = "application/json";
    headers[csrf.header] = csrf.token;
    opciones.method = "POST";
    opciones.body = JSON.stringify(datos);
  }

  const respuesta = await fetch(ruta, opciones);
  if (respuesta.status === 401 || (respuesta.redirected && new URL(respuesta.url).pathname === "/app/login")) {
    if (location.pathname.startsWith("/vales/q/") || location.pathname === "/consulta")
      location.reload();
    else location.replace("/app/login");
    throw new ErrorHttp(401, "La sesión terminó. Vuelve a ingresar.");
  }
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    const mensaje = respuesta.status === 403
      ? "Tu cuenta no puede realizar esta operación."
      : "No se pudo completar la operación. Vuelve a intentarlo.";
    throw new ErrorHttp(respuesta.status, error.detail || mensaje);
  }
  return respuesta.json();
}
