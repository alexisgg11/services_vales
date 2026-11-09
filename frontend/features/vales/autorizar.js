import * as ui from "../../components/controles.js";
import { confirm } from "../../components/dialogos.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import { catalogos } from "../../state/catalogos.js";
import { columnasVale, crearTablaVales, seleccionarValeEnTabla } from "./tabla.js";
import valePresentador from "./presentador.js";
import { autorizarVales } from "../../service/vales.js";

export default function mostrarAutorizacion(vale) {
  ui.page("Autorizar vales", '<div id="authorize-table"></div>');
  const table = crearTablaVales(document.getElementById("authorize-table"), {
    label: "vales pendientes",
    rows: () => vales.all().filter((v) => permisos.eligible("autorizacion", v)),
    selectable: true,
    columns: columnasVale([
      "id",
      "worker",
      "supply",
      "quantity",
      "emission",
      "actions",
    ]),
    filters: [
      {
        key: "provider",
        label: "Todos los proveedores",
        options: catalogos.providers,
      },
    ],
    selectionFooter: `<div class="selection-bar"><div class="row"><strong id="selection-count">0 seleccionados</strong><button type="button" class="text-link" id="select-all-pending">Seleccionar todos</button></div>${ui.button("Autorizar", { id: "authorize-selected", variant: "primary", icon: "check-check", disabled: true })}</div>`,
    onSelection: (ids) => {
      document.getElementById("selection-count").textContent =
        ids.length + " seleccionados";
      document.getElementById("authorize-selected").disabled = !ids.length;
    },
  });
  seleccionarValeEnTabla(table, vale);
  document
    .getElementById("select-all-pending")
    .addEventListener("click", () => {
      table.rows().forEach((v) => table.selected.add(v.id));
      table.draw();
      table.notify();
    });
  document
    .getElementById("authorize-selected")
    .addEventListener("click", async () => {
      const ids = [...table.selected];
      if (
        !(await confirm({
          title:
            "Autorizar " +
            ids.length +
            " " +
            (ids.length === 1 ? "vale" : "vales"),
          content: valePresentador.selection(ids.map((id) => vales.get(id))),
          label: "Autorizar",
        }))
      )
        return;
      try {
        await autorizarVales(ids);
        table.selected.clear();
        table.draw();
        table.notify();
        ui.toast(ids.length + " vales autorizados.");
      } catch (err) {
        ui.toast(err.message);
      }
    });
}
