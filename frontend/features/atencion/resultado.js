import * as ui from "../../components/controles.js";
import valePresentador from "../vales/presentador.js";

export function mostrarResultadoAtencion(host, vale, { verDetalle, consultarOtro }) {
  host.innerHTML = valePresentador.result(vale, {
    title: "Atención registrada",
    content: valePresentador.section(
      "Datos de la atención",
      "receipt",
      valePresentador.attentionFacts(vale, { context: true }) + valePresentador.amount(vale),
    ),
    actions:
      ui.iconAction("Ver detalle del vale", "eye", "data-ver-vale") +
      ui.button("Consultar otro vale", { variant: "primary", icon: "search", attrs: "data-consultar-otro" }),
  });
  host.querySelector("[data-ver-vale]").addEventListener("click", verDetalle);
  host.querySelector("[data-consultar-otro]").addEventListener("click", consultarOtro);
  ui.icons();
  const titulo = host.querySelector("h2");
  titulo.tabIndex = -1;
  titulo.focus();
}
