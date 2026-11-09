import * as ui from "../../components/controles.js";
import { confirm } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import { BuscadorVale } from "./buscador.js";
import valePresentador from "./presentador.js";
import { anularVale } from "../../service/vales.js";

export default function mostrarAnulacion(vale) {
  ui.page("Anular vale", '<div id="cancel-lookup"></div>');
  const buscador = new BuscadorVale(document.getElementById("cancel-lookup"), {
    key: "cancel",
    rows: () => vales.all().filter((v) => permisos.eligible("anulacion", v)),
    validate: (v) =>
      permisos.eligible("anulacion", v)
        ? ""
        : "El vale está " +
          formato.states[v.state].toLowerCase() +
          ". Solo el emisor puede anular un vale antes del uso.",
    onFound: (v, host) => {
      host.innerHTML = `<section class="service-result">${valePresentador.card(v, { clickable: true })}<form id="cancel-form" class="operation-form">${ui.field("Motivo de anulación", '<textarea id="cancel-reason" name="reason" required maxlength="500"></textarea>', { name: "cancel-reason" })}<div class="operation-actions">${ui.button("Anular vale", { type: "submit", variant: "danger", icon: "circle-slash" })}</div></form></section>`;
      const form = host.querySelector("form");
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const reason = form.elements.reason.value;
        if (
          !(await confirm({
            title: "Anular vale " + formato.reference(v),
            message: reason,
            label: "Confirmar anulación",
            danger: true,
          }))
        )
          return;
        try {
          await anularVale(v.id, reason);
          host.innerHTML = valePresentador.result(vales.get(v.id), { title: "Vale anulado" });
          ui.icons();
        } catch (err) {
          ui.error(form, err.message);
        }
      });
    },
  });
  if (vale) buscador.mostrarResultado(vale);
}
