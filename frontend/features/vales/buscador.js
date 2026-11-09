import * as ui from "../../components/controles.js";
import { notice, sheet } from "../../components/dialogos.js";
import lectorQr from "../../components/lector-qr.js";
import formato from "../../shared/formato.js";
import { permisos } from "../../state/permisos.js";
import { vales } from "../../state/vales.js";
import { actualizarSesion } from "../../service/sesion.js";
import { consultarValePorQr } from "../../service/atencion.js";
import { columnasVale, crearTablaVales } from "./tabla.js";

const e = formato.escape;

export class BuscadorVale {
  constructor(host, {
    key, rows, validate = () => "", onFound, scan = false,
    unavailable = () => "No se encontró ese número de vale.",
    visible = (v) => permisos.eligible("documentos", v),
  }) {
    this.host = host;
    this.rows = rows;
    this.validate = validate;
    this.onFound = onFound;
    this.unavailable = unavailable;
    this.visible = visible;
    const inputId = key + "-code",
      sample =
        rows()
          .slice()
          .map(formato.code)
          .sort().at(-1) || formato.today.slice(0, 7).replace("-", "") + "0001";
    host.innerHTML = `<section class="lookup-panel"><form class="lookup-form">${ui.field("Número de vale", ui.input(inputId, "text", "", `required inputmode="numeric" autocomplete="off" placeholder="${e(sample)}"`), { name: inputId })}${ui.button("Buscar", { type: "submit", variant: "primary", icon: "search" })}${scan ? '<button type="button" class="icon-btn lookup-scan" data-scan-vale aria-label="Escanear QR" title="Escanear QR">' + ui.icon("scan-qr-code") + '</button>' : ""}</form><div class="lookup-tools"><button type="button" class="text-link" data-pick-vale>${ui.icon("list")}Elegir de lista</button></div><p class="lookup-error" role="alert" hidden></p></section><div class="lookup-result" id="${e(key)}-result" aria-live="polite"></div>`;
    this.input = host.querySelector("input");
    this.result = host.querySelector(".lookup-result");
    this.error = host.querySelector(".lookup-error");
    this.error.id = key + "-error";
    this.searchButton = host.querySelector('button[type="submit"]');
    host.querySelector("form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const code = this.input.value;
      try {
        if (scan) await actualizarSesion();
        if (this.input.isConnected && code === this.input.value) this.buscarPorCodigo(code);
      } catch (error) {
        notice({ title: "No se pudo consultar el vale", message: error.message, icon: "circle-alert" });
      }
    });
    this.input.addEventListener("input", () => {
      this.result.replaceChildren();
      this.error.hidden = true;
      this.input.removeAttribute("aria-invalid");
      this.input.removeAttribute("aria-describedby");
      this.searchButton.classList.add("btn--primary");
    });
    host
      .querySelector("[data-pick-vale]")
      .addEventListener("click", () => this.elegirDeLista());
    host.querySelector("[data-scan-vale]")?.addEventListener("click", () =>
      lectorQr.open({
        resolve: async ({ idQr }) => ({ vale: await consultarValePorQr(idQr) }),
        onFound: ({ vale }) => {
          if (host.isConnected) this.mostrarResultado(vale, { scanned: true });
        },
      }),
    );
    ui.icons();
  }
  buscarPorCodigo(code) {
    this.result.replaceChildren();
    this.error.hidden = true;
    this.input.value = code.trim();
    const matches = vales.all().filter((v) => formato.code(v) === this.input.value && this.visible(v));
    if (matches.length > 1) {
      this.elegirDeLista(() => matches, "Selecciona la zonal del vale");
      return;
    }
    this.mostrarResultado(matches[0]);
  }
  mostrarResultado(vale, { scanned = false } = {}) {
    this.result.replaceChildren();
    this.error.hidden = true;
    if (vale) this.input.value = formato.code(vale);
    const message = vale ? this.validate(vale) : this.unavailable();
    if (message) {
      if (typeof message !== "string") {
        if (!scanned) this.input.focus();
        notice(message);
        return;
      }
      this.error.textContent = message;
      this.error.hidden = false;
      this.input.setAttribute("aria-invalid", "true");
      this.input.setAttribute("aria-describedby", this.error.id);
      this.input.focus();
      this.searchButton.classList.add("btn--primary");
      return;
    }
    this.input.removeAttribute("aria-invalid");
    this.input.removeAttribute("aria-describedby");
    this.onFound(vale, this.result, { scanned });
    this.searchButton.classList.remove("btn--primary");
    ui.icons();
  }
  elegirDeLista(rows = this.rows, title = "Elegir vale") {
    const modal = sheet({
      title,
      content: "<div data-picker-table></div>",
      footer: ui.button("Cerrar", { attrs: "data-close" }),
    });
    crearTablaVales(modal.root.querySelector("[data-picker-table]"), {
      rows,
      label: "vales",
      columns: [
        ...columnasVale(["id", "worker", "supply", "state"]),
        {
          key: "actions",
          label: "Acción",
          sortable: false,
          render: (v) =>
            ui.iconAction("Elegir vale " + formato.reference(v), "check",
              `data-row-action="choose" data-id="${e(v.id)}"`),
        },
      ],
      onAction: (_, v) => {
        modal.close();
        this.mostrarResultado(v);
      },
    });
  }
}
