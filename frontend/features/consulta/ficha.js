import { elemento, etiquetaEstado } from "./elementos.js";
import { accionesPdf, vistaPreviaPdf } from "../documentos/visor-pdf.js";
import { permisos } from "../../state/permisos.js";

const operaciones = [
  ["autorizacion", "Autorizar vale"],
  ["atencion", "Registrar atención"],
  ["facturas", "Asociar factura"],
  ["anulacion", "Anular vale"],
];

export function crearFicha(vale) {
  const ficha = elemento("article", null, "ficha");
  const cabecera = elemento("header");
  const datos = elemento("div");
  datos.append(
    elemento("h1", "Vale " + vale.code),
    elemento("p", vale.zone + " / " + vale.locality, "zonal"),
    etiquetaEstado(vale.state),
  );
  const acciones = elemento("div", null, "ficha-acciones");
  acciones.innerHTML = accionesPdf({ soloIconos: true });
  for (const [servicio, etiqueta] of operaciones) {
    if (!permisos.eligible(servicio, vale)) continue;
    const enlace = elemento("a", etiqueta, servicio === "anulacion" ? "btn" : "btn btn--primary");
    const referencia = new URLSearchParams({ vale: vale.id_qr });
    enlace.href = "/app/index.html#" + servicio + "?" + referencia;
    acciones.append(enlace);
  }
  cabecera.append(datos, acciones);

  const documento = elemento("section", null, "ficha-documento");
  documento.setAttribute("aria-label", "Documento del vale");
  documento.innerHTML = vistaPreviaPdf;
  ficha.append(cabecera, documento);

  if (vale.state === 4 && vale.cancelReason) {
    const anulacion = elemento("section");
    anulacion.append(elemento("h2", "Motivo de anulación"), elemento("p", vale.cancelReason));
    ficha.append(anulacion);
  }
  return ficha;
}
