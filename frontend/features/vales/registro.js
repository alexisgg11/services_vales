import * as ui from "../../components/controles.js";
import { notice } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import { Wizard } from "../../components/wizard.js";
import { consultarCondiciones, proveedoresParaEmision, unidadesParaEmision } from "../../service/emision.js";
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
        ${ui.field("Modalidad", options("mode", [
          { id: "CONTRATO", name: "Con contrato" },
          { id: "SC_TRABAJADOR", name: "Sin contrato por vencimiento" },
          { id: "S/C", name: "Sin contrato para tercero" },
        ]), { name: "mode" })}
        ${ui.field("Fecha", ui.input("emission", "date", formato.today, `required max="${formato.today}"`), { name: "emission", icon: "calendar-days" })}
        ${ui.field("Proveedor", ui.select("provider", [], "", 'required aria-describedby="emission-message"'), { name: "provider", icon: "fuel" })}
        ${ui.field("Contrato", ui.input("contract", "text", "", 'readonly disabled placeholder="Según el proveedor"'), { name: "contract", icon: "file-text" })}
        ${ui.field("Suministro", options("supply", []), { name: "supply", icon: "droplet" })}
        ${ui.field("Precio referencial por galón (S/)", ui.input("price", "number", "", 'readonly aria-describedby="emission-message" placeholder="Automático"'), { name: "price" })}
        ${ui.field("Cantidad (gal)", ui.input("quantity", "number", "", 'required min="0.01" step="0.01" placeholder="Ej. 18.50"'), { name: "quantity" })}
        <p id="emission-message" class="wide muted" role="status" hidden>${ui.icon("circle-alert")}<span></span></p>
        <div class="wide" data-third-fields hidden><div class="form-grid">
          ${ui.field("DNI del tercero", ui.input("third", "text", "", 'disabled inputmode="numeric" pattern="[0-9]{8}" maxlength="8"'), { name: "third" })}
          ${ui.field("Destino o motivo", ui.input("destination", "text", "", 'disabled maxlength="150"'), { name: "destination" })}
        </div></div>
      </div></section>
      <section id="step-1" data-step-panel hidden><h2 tabindex="-1">Asignar el vale</h2><div class="form-grid">
        ${ui.field("Trabajador", options("worker", workers), { name: "worker", wide: true, icon: "user-round" })}
        ${ui.field("Unidad organizativa", ui.input("org", "text", "", 'readonly placeholder="Automático"'), { name: "org" })}
        <div>${ui.field("Centro de costo", ui.select("center", [{ id: "", name: "Selecciona un trabajador" }], "", "disabled"), { name: "center" })}
        <small class="muted" data-center-locality></small></div>
        ${ui.field(
          "Zonal",
          options("zone", catalogos.zones.map((name) => ({ id: name, name }))),
          { name: "zone", icon: "map-pin" },
        )}
        ${ui.field("Localidad", ui.select("locality", [{ id: "", name: "Seleccionar" }], "", "required"), { name: "locality" })}
        ${ui.field("Unidad móvil", ui.select("unit", [{ id: "", name: "Sin unidad móvil" }]), {
          name: "unit", wide: true, icon: "truck",
          hint: "Las unidades de otra zonal requieren habilitación para el centro de costo y la fecha del vale.",
        })}
        <small class="wide muted" data-unit-base hidden></small>
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
  const syncOptions = (field, items, placeholder) => {
    const selected = field.value;
    field.replaceChildren(new Option(placeholder, ""), ...items.map(({ id, name }) => new Option(name, id)));
    field.value = items.some(({ id }) => id === selected) ? selected : "";
    field.disabled = !items.length;
  };
  const syncTerms = ({ actualizarListas = false, avisar = false } = {}) => {
    const mode = fields.mode.value;
    const emission = fields.emission.validity.valid ? fields.emission.value : "";
    const contexto = { mode, emission };
    if (actualizarListas) {
      const providers = proveedoresParaEmision(contexto);
      const placeholder = !mode ? "Selecciona una modalidad" : !emission ? "Indica la fecha de emisión" :
        providers.length ? "Seleccionar" : "Sin proveedores disponibles";
      syncOptions(fields.provider, providers, placeholder);
      const { supplies } = consultarCondiciones({ ...contexto, provider: fields.provider.value });
      syncOptions(fields.supply, supplies, fields.provider.value ? "Seleccionar" : "Selecciona un proveedor");
    }
    const terms = consultarCondiciones({
      ...contexto, provider: fields.provider.value, supply: fields.supply.value,
    });
    const sinProveedores = mode && emission && fields.provider.disabled;
    const error = terms.error || (sinProveedores ? {
      CONTRATO: "No hay proveedores con contrato vigente y precios pactados para la fecha de emisión.",
      SC_TRABAJADOR: "No hay proveedores con contrato vencido, sin contrato vigente y con tarifa para la fecha de emisión.",
      "S/C": "No hay proveedores con tarifa para la fecha de emisión. Administración puede registrar una tarifa.",
    }[mode] : "");
    fields.contract.value = terms.contract || "";
    fields.contract.disabled = !fields.provider.value;
    fields.price.value = fields.supply.value && terms.price > 0 ? (terms.price / 100).toFixed(2) : "";
    fields.price.placeholder = error ? "No disponible" : "Automático";
    const thirdParty = mode === "S/C";
    form.querySelector("[data-third-fields]").hidden = !thirdParty;
    for (const field of [fields.third, fields.destination]) {
      field.disabled = !thirdParty;
      field.required = thirdParty;
    }
    const message = form.querySelector("#emission-message");
    const saldo = terms.balance === undefined ? "" : "Saldo del contrato " + formato.money(terms.balance) + ".";
    const texto = error || saldo;
    message.querySelector("span").textContent = texto;
    message.classList.toggle("field-error", !!error);
    message.hidden = !texto;
    if (avisar && error) avisarPrecio(error);
    return { ...terms, error };
  };
  const syncLocality = (worker) => {
    fields.locality.replaceChildren(
      new Option("Seleccionar", ""),
      ...catalogos.localities(fields.zone.value).map((name) => new Option(name, name)),
    );
    fields.locality.value = worker?.locality || "";
    fields.locality.disabled = !fields.zone.value || !!worker?.locality;
  };
  const syncLocations = () => {
    const locality = catalogos.centerLocality(fields.center.value);
    const reference = catalogos.centerLocationReference(fields.center.value);
    form.querySelector("[data-center-locality]").textContent = locality ? "Localidad del centro: " + locality
      : reference ? "Ubicación de referencia: " + reference : "";
    const base = catalogos.zoneName(catalogos.unit(fields.unit.value)?.zone);
    const label = form.querySelector("[data-unit-base]");
    label.textContent = base ? "Zonal base: " + base : "";
    label.hidden = !base;
  };
  const syncUnits = () => {
    const selected = fields.unit.value;
    const { propias, prestadas } = unidadesParaEmision({
      zone: catalogos.zoneCode(fields.zone.value), center: fields.center.value, emission: fields.emission.value,
    });
    fields.unit.replaceChildren(new Option("Sin unidad móvil", "", true, true));
    for (const [label, units] of [["De tu zonal", propias], ["Habilitadas de otra zonal", prestadas]]) {
      if (!units.length) continue;
      const group = document.createElement("optgroup");
      group.label = label;
      group.append(...units.map(({ id, plate, name }) => new Option(plate + " (" + name + ")", id)));
      fields.unit.append(group);
    }
    if ([...propias, ...prestadas].some(({ id }) => id === selected)) fields.unit.value = selected;
    syncLocations();
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
    syncLocality(worker);
    syncUnits();
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
      ["Modalidad", fields.mode.selectedOptions[0]?.text],
      ["Fecha", formato.date(d.emission)],
      ["Proveedor", catalogos.provider(d.provider)?.name],
      ["Contrato", d.contract],
      ...(d.mode === "S/C" ? [["Tercero", d.third], ["Destino o motivo", d.destination]] : []),
      ["Suministro", catalogos.supply(d.supply)?.name],
      ["Cantidad", formato.qty(d.quantity) + " gal"],
      ["Precio referencial", formato.money(d.price)],
      ["Trabajador", worker?.name],
      ["Unidad móvil", catalogos.unit(d.unit)?.plate || "Sin unidad móvil"],
      ...(d.unit ? [["Zonal base de la unidad", catalogos.zoneName(catalogos.unit(d.unit)?.zone)]] : []),
      ["Zonal / localidad", d.zone + " / " + d.locality],
      ["Centro de costo", catalogos.centerName(d.center) || "Sin centro de costo"],
      ...(catalogos.centerLocality(d.center) ? [["Localidad del centro", catalogos.centerLocality(d.center)]] : []),
      ...(catalogos.centerLocationReference(d.center)
        ? [["Ubicación de referencia", catalogos.centerLocationReference(d.center)]] : []),
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
    if (ev.target.name === "mode") fields.provider.value = "";
    if (["mode", "provider"].includes(ev.target.name)) fields.supply.value = "";
    if (["provider", "emission", "mode"].includes(ev.target.name))
      syncTerms({ actualizarListas: true });
    if (ev.target.name === "supply") syncTerms();
    if (ev.target.name === "worker") syncAssignment();
    if (ev.target.name === "zone") syncLocality(catalogos.worker(fields.worker.value));
    if (["zone", "center", "emission"].includes(ev.target.name)) syncUnits();
    if (ev.target.name === "unit") syncLocations();
    summary();
  });
  form.addEventListener("input", summary);
  form.addEventListener("reset", () =>
    setTimeout(() => {
      syncTerms({ actualizarListas: true });
      fields.worker.value = profile.worker || "";
      syncAssignment();
      wizard.reset();
      summary();
      form.querySelector(".form-error")?.remove();
    }, 0),
  );
  fields.worker.value = profile.worker || "";
  fields.worker.disabled = !!profile.worker;
  syncTerms({ actualizarListas: true });
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
          form.elements.mode.focus();
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
