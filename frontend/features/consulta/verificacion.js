import { verificarQr } from "../../api/vales-api.js";
import formato from "../../shared/formato.js";
import { elemento, etiquetaEstado } from "./elementos.js";

const idQr = location.pathname.split("/")[3];
const aviso = document.querySelector("#estado-carga");

function mostrar({ codigo, grifo, fechaEmision, estado }) {
  const ficha = elemento("article", null, "ficha");
  const cabecera = elemento("header");
  const encabezado = elemento("div");
  encabezado.append(
    elemento("p", "Verificación del vale", "muted"),
    elemento("h1", "Vale " + codigo),
    etiquetaEstado(estado),
  );
  cabecera.append(encabezado);

  const cuerpo = elemento("section");
  const datos = elemento("dl", null, "verificacion-datos");
  for (const [etiqueta, valor] of [["Grifo asignado", grifo], ["Fecha de emisión", formato.date(fechaEmision)]]) {
    const campo = elemento("div");
    campo.append(elemento("dt", etiqueta), elemento("dd", valor));
    datos.append(campo);
  }
  const enlace = elemento("a", "Iniciar sesión para ver el PDF", "btn btn--primary");
  enlace.href = "/vales/q/" + encodeURIComponent(idQr) + "/documento";
  cuerpo.append(datos, enlace, elemento("p", "Acceso con una cuenta de Vales.", "muted"));
  ficha.append(cabecera, cuerpo);
  document.querySelector("#resultado").replaceChildren(ficha);
  document.title = "Vale " + codigo;
  aviso.hidden = true;
}

async function cargar() {
  if (!idQr) {
    aviso.textContent = "Vale no disponible.";
    return;
  }
  try {
    mostrar(await verificarQr(idQr));
  } catch (error) {
    aviso.textContent = [400, 404].includes(error.status)
      ? "Vale no disponible."
      : "No se pudo verificar el vale. Vuelve a intentarlo.";
  }
}

cargar();
