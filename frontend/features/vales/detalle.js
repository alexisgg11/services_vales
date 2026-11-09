import F from "../../shared/formato.js";
import { button } from "../../components/controles.js";
import { sheet } from "../../components/dialogos.js";
import { vales } from "../../state/vales.js";
import { enlaceQr } from "../../service/sesion.js";
import { crearQr } from "../../shared/codigo-qr.js";
import presentador from "./presentador.js";

function mostrarQr(vale) {
  const enlace = enlaceQr(vale.id_qr);
  const qr = crearQr(enlace).createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  return `<section class="vale-qr">
    <a href="${F.escape(enlace)}" target="_blank" rel="noopener" aria-label="Abrir consulta del vale ${F.escape(F.reference(vale))}">${qr}</a>
    <div><h3>QR del vale</h3><p>Escanéalo desde Registrar atención o abre el enlace para consultar el vale.</p></div>
  </section>`;
}

export function abrirDetalleVale(vale) {
  if (!vale) return;
  sheet({
    title: "Vale " + F.reference(vale),
    subtitle: "Detalle del vale",
    content: presentador.details(vale, vale.id_qr ? mostrarQr(vale) : ""),
    footer: button("Cerrar", { attrs: "data-close" }),
  });
}

export function habilitarDetalleVales() {
  document.addEventListener("click", evento => {
    const control = evento.target.closest("[data-vale-detail]");
    if (control) abrirDetalleVale(vales.get(control.dataset.valeDetail));
  });
}
