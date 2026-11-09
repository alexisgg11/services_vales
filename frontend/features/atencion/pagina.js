import * as ui from "../../components/controles.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import valePresentador from "../vales/presentador.js";
import { BuscadorVale } from "../vales/buscador.js";
import { abrirDetalleVale } from "../vales/detalle.js";
import { abrirModalAtencion } from "./modal.js";
import { mostrarResultadoAtencion } from "./resultado.js";

function limpiarBusqueda() {
  const input = document.getElementById("attention-code");
  input.value = "";
  input.dispatchEvent(new Event("input"));
  input.focus();
}

export default function mostrarAtencion(vale) {
  ui.page("Registrar atención", '<div id="attention-lookup"></div>');
  const unavailable = {
    title: "Vale no disponible",
    message: "Verifica el número o el QR. Solo puedes atender vales autorizados de tu grifo y zonal.",
    icon: "search-x",
  };
  const blocked = {
    0: {
      title: "Vale pendiente de autorización",
      message: "El vale debe ser autorizado por Jefatura antes del despacho.",
      icon: "clock",
    },
    3: {
      title: "Vale usado",
      message: "Este vale ya fue atendido. Cada vale admite una sola atención.",
      icon: "receipt-text",
    },
    4: {
      title: "Vale anulado",
      message: "El vale está anulado y no se puede usar para despachar combustible.",
      icon: "circle-alert",
      danger: true,
    },
  };
  const buscador = new BuscadorVale(document.getElementById("attention-lookup"), {
    key: "attention",
    scan: true,
    rows: () => vales.all().filter((v) => permisos.eligible("atencion", v)),
    visible: permisos.visibleForAttention,
    unavailable: () => unavailable,
    validate: (v) => permisos.eligible("atencion", v) ? "" : blocked[v.state] ?? unavailable,
    onFound: (v, host, { scanned }) => {
      const open = () => abrirModalAtencion(v, valeAtendido => {
        if (!host.isConnected) return;
        mostrarResultadoAtencion(host, valeAtendido, {
          verDetalle: () => abrirDetalleVale(valeAtendido),
          consultarOtro: limpiarBusqueda,
        });
      });
      host.innerHTML = `<section class="service-result">${valePresentador.card(v)}<div class="operation-actions">${ui.button("Registrar atención", { id: "open-attention", variant: "primary", icon: "receipt" })}</div></section>`;
      host
        .querySelector("#open-attention")
        .addEventListener("click", open);
      if (!scanned) open();
    },
  });
  if (vale) buscador.mostrarResultado(vale);
}
