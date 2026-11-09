import * as ui from "../../components/controles.js";
import formato from "../../shared/formato.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import { columnasVale, crearTablaVales } from "../vales/tabla.js";
import visorPdf from "./visor-pdf.js";

export default function mostrarDocumentos() {
  ui.page("PDF del vale", '<div id="documents-table"></div>');
  crearTablaVales(document.getElementById("documents-table"), {
    rows: () => vales.all().filter((v) => permisos.eligible("documentos", v)),
    label: "vales",
    columns: [
      ...columnasVale([
        "id",
        "worker",
        "provider",
        "supply",
        "emission",
        "state",
      ]),
      {
        key: "actions",
        label: "Acción",
        sortable: false,
        render: (v) =>
          ui.iconAction("Ver PDF del vale " + formato.reference(v), "eye",
            `data-row-action="pdf" data-id="${formato.escape(v.id)}"`),
      },
    ],
    filters: [
      {
        key: "state",
        label: "Todos los estados",
        options: Object.entries(formato.states).map(([id, name]) => ({ id, name })),
      },
    ],
    onAction: (action, v) => {
      if (action === "pdf") visorPdf.open(v);
    },
  });
}
