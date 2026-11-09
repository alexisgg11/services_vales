import { listarReferencias, consultarQr } from "../../api/vales-api.js";
import { cerrarSesion } from "../../api/sesion-api.js";
import lectorQr from "../../components/lector-qr.js";
import { icons } from "../../components/controles.js";
import { confirmarCierreSesion } from "../../components/dialogos.js";
import { mapearVale } from "../../model/vale.js";
import { actualizarSesion } from "../../service/sesion.js";
import { montarVisorPdf } from "../documentos/visor-pdf.js";
import documentoPdf from "../documentos/modelo-pdf.js";
import { cargarDependenciasPdf } from "../documentos/dependencias-pdf.js";
import { elemento, etiquetaEstado } from "./elementos.js";
import { crearFicha } from "./ficha.js";

const resultado = document.querySelector("#resultado");
const aviso = document.querySelector("#estado-carga");
let limpiarVisor;

function mostrarVale(respuesta) {
  const vale = mapearVale(respuesta.vale);
  const ficha = crearFicha(vale);
  resultado.replaceChildren(ficha);
  limpiarVisor = montarVisorPdf(ficha, vale, async () => {
    await cargarDependenciasPdf();
    return documentoPdf.createFromConsultation(vale, respuesta.qrUrl);
  });
  icons();
  document.title = "Vale " + vale.code;
}

function mostrarLista(vales) {
  const titulo = elemento("h1", "Mis vales");
  const lista = elemento("ul", null, "vales-lista");
  for (const vale of vales) {
    const fila = elemento("li");
    const enlace = elemento("a", null, "fila-vale");
    enlace.href = "/vales/q/" + encodeURIComponent(vale.id_qr) + "/documento";
    const identidad = elemento("span");
    identidad.append(
      elemento("strong", vale.codigo_vale),
      elemento("small", "Zonal " + vale.cod_zonal),
    );
    enlace.append(identidad, etiquetaEstado(vale.estado_vale));
    fila.append(enlace);
    lista.append(fila);
  }
  resultado.replaceChildren(titulo, vales.length ? lista : elemento("p", "Tu cuenta aún no tiene vales visibles."));
}

async function cargar() {
  limpiarVisor?.();
  limpiarVisor = undefined;
  resultado.replaceChildren();
  aviso.textContent = "Cargando…";
  aviso.hidden = false;
  const prefijo = "/vales/q/";
  const idQr = location.pathname.startsWith(prefijo) ? location.pathname.split("/")[3] : null;
  try {
    if (idQr) {
      const [respuesta] = await Promise.all([
        consultarQr(idQr),
        actualizarSesion().catch(() => null),
      ]);
      mostrarVale(respuesta);
    } else {
      mostrarLista(await listarReferencias());
    }
    aviso.hidden = true;
  } catch (error) {
    aviso.textContent = [400, 403, 404].includes(error.status)
      ? "Vale no disponible para esta cuenta."
      : "No se pudo cargar la consulta. Vuelve a intentarlo.";
  }
}

function escanearVale() {
  lectorQr.open({
    resolve: ({ idQr }) => consultarQr(idQr),
    onFound: ({ vale }) => location.assign("/vales/q/" + vale.id_qr + "/documento"),
  });
}

document.querySelector("#escanear-vale").addEventListener("click", escanearVale);
document.querySelector("#cerrar-sesion").addEventListener("click", () => {
  confirmarCierreSesion(cerrarSesion).catch(error => {
    aviso.textContent = error.message;
    aviso.hidden = false;
  });
});

window.addEventListener("pageshow", evento => {
  if (evento.persisted) cargar();
});
icons();
cargar();
