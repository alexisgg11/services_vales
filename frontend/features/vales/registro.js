import * as ui from "../../components/controles.js";
import { notice } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import { Wizard } from "../../components/wizard.js";
import { consultarCondiciones } from "../../service/emision.js";
import { registrarVale } from "../../service/vales.js";
import { abrirDetalleVale } from "./detalle.js";
import valePresentador from "./presentador.js";

export default function mostrarRegistro() {
  const profile = permisos.current;
  const workers = profile.worker ? [catalogos.worker(profile.worker)] : catalogos.workers;
  const e = formato.escape;
  const options = (name, items) =>
    ui.select(name, [{ id: "", name: "Seleccionar" }, ...items], "", "required");
  ui.page(
    "Registrar vale",
    `<div id="register-result"></div>
    <form id="register-form" class="registration-form" novalidate>
      <ol class="wizard-nav" data-wizard-nav aria-label="Pasos del registro"></ol>
      <section id="step-0" data-step-panel><h2 tabindex="-1">Datos de emisión</h2><div class="form-grid">
        ${ui.field("Fecha", ui.input("emission", "date", formato.today, `required max="${formato.today}"`), { name: "emission", icon: "calendar-days" })}
        ${ui.field("Proveedor", options("provider", catalogos.providers), { name: "provider", icon: "fuel" })}
        ${ui.field("Contrato", ui.input("contract", "text", "", 'readonly disabled placeholder="Según el proveedor"'), { name: "contract", icon: "file-text" })}
        ${ui.field("Suministro", options("supply", []), { name: "supply", icon: "droplet" })}
        ${ui.field("Cantidad (gal)", ui.input("quantity", "number", "", 'required min="0.01" step="0.01" placeholder="Ej. 18.50"'), { name: "quantity" })}
        ${ui.field("Precio referencial por galón (S/)", ui.input("price", "number", "", 'readonly aria-describedby="emission-message" placeholder="Automático"'), { name: "price" })}
        ${ui.field("Modalidad", ui.select("mode", [
          { id: "CONTRATO", name: "Con contrato" },
          { id: "SC_TRABAJADOR", name: "Sin contrato por vencimiento" },
          { id: "S/C", name: "Sin contrato para tercero" },
        ], "CONTRATO"), { name: "mode" })}
        <p id="emission-message" class="wide muted" role="status" hidden>${ui.icon("circle-alert")}<span></span></p>
        <div class="wide" data-third-fields hidden><div class="form-grid">
          ${ui.field("DNI del tercero", ui.input("third", "text", "", 'disabled inputmode="numeric" pattern="[0-9]{8}" maxlength="8"'), { name: "third" })}
          ${ui.field("Destino o motivo", ui.input("destination", "text", "", 'disabled maxlength="150"'), { name: "destination" })}
        </div></div>
      </div></section>
      <section id="step-1" data-step-panel hidden><h2 tabindex="-1">Asignar el vale</h2><div class="form-grid">
        ${ui.field("Trabajador", options("worker", workers), { name: "worker", wide: true, icon: "user-round" })}
        ${ui.field("Unidad organizativa", ui.input("org", "text", "", 'readonly placeholder="Automático"'), { name: "org" })}
        ${ui.field("Centro de costo", ui.select("center", [{ id: "", name: "Selecciona un trabajador" }], "", "disabled"), { name: "center" })}
        ${ui.field(
          "Zonal",
          options("zone", catalogos.zones.map((name) => ({ id: name, name }))),
          { name: "zone", icon: "map-pin" },
        )}
        ${ui.field("Localidad", ui.select("locality", [{ id: "", name: "Seleccionar" }], "", "required"), { name: "locality" })}
        ${ui.field("Unidad móvil", ui.select("unit", [{ id: "", name: "Sin unidad móvil" }, ...catalogos.units.map((x) => ({ id: x.id, name: x.plate + " (" + x.name + ")" }))]), { name: "unit", wide: true, icon: "truck" })}
      </div><details class="optional-fields"><summary>Agregar observación</summary>${ui.field("Observación", '<textarea id="note" name="note" maxlength="500"></textarea>', { name: "note" })}</details></section>
      <section id="step-2" data-step-panel hidden><h2 tabindex="-1">Revisar y registrar</h2><div id="register-review"></div></section>
      <div class="operation-total"><span>Importe estimado</span><strong id="summary-amount" aria-live="polite">—</strong></div>
      <div class="wizard-actions"><div>${ui.button("Limpiar", { type: "reset", variant: "ghost" })}</div><div class="row">${ui.button("Atrás", { attrs: "data-prev", icon: "arrow-left" })}${ui.button("Continuar", { attrs: "data-next", variant: "primary", icon: "arrow-right" })}${ui.button("Registrar vale", { type: "submit", attrs: "data-wizard-submit", variant: "primary", icon: "plus" })}</div></div>
    </form>`,
  );
  const form = document.getElementById("register-form"),
    result = document.getElementById("register-result");
  const fields = form.elements;
  const avisarPrecio = (message) => notice({
    title: "Precio referencial no disponible",
    message,
    icon: "circle-alert",
    danger: true,
  });
  const syncTerms = ({ actualizarSuministros = false, avisar = false } = {}) => {
    const mode = fields.mode.value;
    const supply = fields.supply.value;
    const terms = consultarCondiciones({
      provider: fields.provider.value,
      supply,
      emission: fields.emission.validity.valid ? fields.emission.value : "",
      mode,
    });
    if (actualizarSuministros) {
      const placeholder = terms.supplies.length ? "Seleccionar" :
        terms.error ? "Sin suministros disponibles" : "Selecciona un proveedor y una fecha";
      fields.supply.replaceChildren(
        new Option(placeholder, ""),
        ...terms.supplies.map(({ id, name }) => new Option(name, id)),
      );
      fields.supply.value = terms.supplies.some(item => item.id === supply) ? supply : "";
      fields.supply.disabled = !terms.supplies.length;
    }
    fields.contract.value = terms.contract || "";
    fields.contract.disabled = !fields.provider.value;
    fields.price.value = fields.supply.value && terms.price > 0 ? (terms.price / 100).toFixed(2) : "";
    fields.price.placeholder = terms.error ? "No disponible" : "Automático";
    const thirdParty = mode === "S/C";
    form.querySelector("[data-third-fields]").hidden = !thirdParty;
    for (const field of [fields.third, fields.destination]) {
      field.disabled = !thirdParty;
      field.required = thirdParty;
    }
    const message = form.querySelector("#emission-message");
    const hint = supply && !fields.supply.value && terms.supplies.length
      ? "El suministro anterior no está incluido en este contrato. Elige uno de la lista."
      : "Selecciona un suministro para ver el precio referencial.";
    const saldo = terms.balance === undefined ? "" : "Saldo del contrato " + formato.money(terms.balance) + ".";
    const texto = terms.error || (terms.supplies.length && !fields.supply.value ? [hint, saldo].filter(Boolean).join(" ") : saldo);
    message.querySelector("span").textContent = texto;
    message.classList.toggle("field-error", !!terms.error);
    message.hidden = !texto;
    if (avisar && terms.error) avisarPrecio(terms.error);
    return terms;
  };
  const syncLocality = (worker) => {
    fields.locality.replaceChildren(
      new Option("Seleccionar", ""),
      ...catalogos.localities(fields.zone.value).map((name) => new Option(name, name)),
    );
    fields.locality.value = worker?.locality || "";
    fields.locality.disabled = !fields.zone.value || !!worker?.locality;
  };
  const syncAssignment = () => {
    const worker = catalogos.worker(fields.worker.value);
    const defaultCenter = worker?.center || "";
    const centers = catalogos.centerOptions().map(({ id, name }) => new Option(name, id));
    if (!defaultCenter)
      centers.unshift(new Option(worker ? "Sin centro de costo" : "Selecciona un trabajador", ""));
    fields.org.value = worker?.org || "";
    fields.center.replaceChildren(...centers);
    fields.center.value = defaultCenter;
    fields.center.disabled = !worker;
    fields.zone.value = worker?.zone || profile.zone || "";
    fields.zone.disabled = !!(worker?.zone || profile.zone);
    fields.unit.value = worker?.unit || "";
    fields.unit.disabled = !!worker?.unit;
    syncLocality(worker);
  };
  const data = () => {
    const d = Object.fromEntries(new FormData(form));
    for (const name of ["worker", "zone", "locality", "unit", "org"])
      d[name] = fields[name].value;
    d.quantity = formato.scaled(d.quantity);
    d.price = formato.scaled(d.price);
    return d;
  };
  const summary = () => {
    const d = data();
    document.getElementById("summary-amount").textContent =
      d.quantity > 0 && d.price > 0
        ? formato.money(formato.amount(d.quantity, d.price))
        : "—";
  };
  const review = () => {
    const d = data(),
      worker = catalogos.worker(d.worker);
    const items = [
      ["Fecha", formato.date(d.emission)],
      ["Proveedor", catalogos.provider(d.provider)?.name],
      ["Contrato", d.contract],
      ...(d.mode === "SC_TRABAJADOR" ? [["Modalidad", "Sin contrato por vencimiento"]] : []),
      ...(d.mode === "S/C" ? [["Tercero", d.third], ["Destino o motivo", d.destination]] : []),
      ["Suministro", catalogos.supply(d.supply)?.name],
      ["Cantidad", formato.qty(d.quantity) + " gal"],
      ["Precio referencial", formato.money(d.price)],
      ["Trabajador", worker?.name],
      ["Unidad móvil", catalogos.unit(d.unit)?.plate || "Sin unidad móvil"],
      ["Zonal / localidad", d.zone + " / " + d.locality],
      ["Centro de costo", catalogos.centerName(d.center) || "Sin centro de costo"],
    ];
    document.getElementById("register-review").innerHTML =
      `<dl class="review-grid">${items.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join("")}${d.note ? `<div class="wide"><dt>Observación</dt><dd>${e(d.note)}</dd></div>` : ""}</dl>`;
  };
  const validate = (index) => {
    form.querySelector(".form-error")?.remove();
    const terms = index === 0 ? syncTerms({ avisar: true }) : null;
    if (terms?.error) return false;
    for (const control of form
      .querySelector(`#step-${index}`)
      .querySelectorAll("input,select,textarea")) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    }
    if (index === 0) {
      const quantity = formato.scaled(fields.quantity.value);
      const estimated = quantity > 0 && terms.price ? formato.amount(quantity, terms.price) : 0;
      const message = !quantity ? "Indica una cantidad válida." :
        terms.balance !== undefined && estimated > terms.balance ? "El contrato no tiene saldo suficiente." : "";
      if (message) {
        ui.error(form, message);
        return false;
      }
    }
    return true;
  };
  const wizard = new Wizard(form, {
    steps: ["Emisión", "Asignación", "Revisión"],
    validate,
    onChange: (index) => {
      if (index === 2) review();
    },
  });
  form.addEventListener("change", (ev) => {
    if (["provider", "emission", "mode"].includes(ev.target.name))
      syncTerms({ actualizarSuministros: true, avisar: true });
    if (ev.target.name === "supply") syncTerms({ avisar: true });
    if (ev.target.name === "worker") syncAssignment();
    if (ev.target.name === "zone") syncLocality(catalogos.worker(fields.worker.value));
    summary();
  });
  form.addEventListener("input", summary);
  form.addEventListener("reset", () =>
    setTimeout(() => {
      syncTerms({ actualizarSuministros: true });
      fields.worker.value = profile.worker || "";
      syncAssignment();
      wizard.reset();
      summary();
      form.querySelector(".form-error")?.remove();
    }, 0),
  );
  fields.worker.value = profile.worker || "";
  fields.worker.disabled = !!profile.worker;
  syncTerms({ actualizarSuministros: true });
  syncAssignment();
  const submit = form.querySelector("[data-wizard-submit]");
  let saving = false;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (wizard.index !== 2 || saving) return;
    saving = true;
    submit.disabled = true;
    try {
      const id = await registrarVale(data());
      form.hidden = true;
      const vale = vales.get(id),
        presenter = valePresentador;
      result.innerHTML = presenter.result(vale, {
        title: "Vale registrado",
        content: presenter.baseFacts(vale),
        actions:
          ui.iconAction("Ver detalle del vale", "eye", 'id="registered-detail"') +
          ui.button("Registrar otro", {
            variant: "primary",
            id: "register-another",
          }),
      });
      result
        .querySelector("#registered-detail")
        .addEventListener("click", () => abrirDetalleVale(vales.get(id)));
      result
        .querySelector("#register-another")
        .addEventListener("click", () => {
          result.replaceChildren();
          form.hidden = false;
          form.reset();
          form.elements.emission.focus();
        });
      ui.icons();
    } catch (err) {
      ui.error(form, err.message);
    } finally {
      submit.disabled = false;
      saving = false;
    }
  });
}
