import * as ui from "../../components/controles.js";
import { confirm, sheet } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import valePresentador from "../vales/presentador.js";
import { sugerirPrecio, registrarAtencion } from "../../service/atencion.js";

export function abrirModalAtencion(v, alRegistrar) {
  const esTercero = v.hasThird;
  const modal = sheet({
    title: "Registrar atención",
    subtitle: "Vale " + formato.reference(v),
    centered: true,
    content: `${valePresentador.card(v)}<form id="attention-form" class="operation-form">
    <fieldset class="atencion-identidad">
      <legend>${esTercero ? "Identidad del tercero" : "Identidad del conductor"}</legend>
      ${ui.field(esTercero ? "DNI del tercero presentado" : "DNI presentado",
        ui.input("dniPresentado", "text", "", 'required inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off"'),
        { name: "dniPresentado", hint: esTercero ? "Tercero autorizado: " + (v.third || "El indicado en el vale") : "" })}
      <label><input type="checkbox" name="identidadVerificada" required> Confirmo que la foto del DNI original coincide con ${esTercero ? "el tercero presente" : "el conductor"}.</label>
    </fieldset><div class="form-grid">
      ${ui.field("Fecha de consumo", ui.input("consumption", "date", formato.today, `required min="${v.emission}" max="${formato.today}"`), { name: "consumption", icon: "calendar-days" })}
      ${ui.field("Ticket del grifo", ui.input("ticket", "text", "", 'readonly placeholder="Se genera al registrar"'), { name: "ticket", icon: "receipt" })}
      ${ui.field("Consumido (gal)", ui.input("consumed", "number", "", `required min="0.01" max="${v.quantity / 100}" step="0.01" placeholder="Ej. 12.50"`), { name: "consumed", icon: "droplet" })}
      ${ui.field("Precio real por galón (S/)", ui.input("real", "number", "", 'required min="0.01" step="0.01" placeholder="Ej. 16.20"'), { name: "real" })}
      <p id="price-source" class="wide muted" role="status"></p>
    </div><div class="operation-total"><span>Importe real</span><strong id="attention-total" aria-live="polite">—</strong></div></form>`,
    footer:
      ui.button("Volver", { attrs: "data-close" }) +
      ui.button("Registrar atención", {
        type: "submit",
        attrs: 'form="attention-form"',
        variant: "primary",
        icon: "check",
      }),
  });
  const form = modal.root.querySelector("form");
  const submit = modal.root.querySelector('button[form="attention-form"]');
  const amount = () => {
    const q = formato.scaled(form.elements.consumed.value);
    const p = formato.scaled(form.elements.real.value);
    modal.root.querySelector("#attention-total").textContent =
      q > 0 && p > 0 ? formato.money(formato.amount(q, p)) : "—";
  };
  let priceRequest = 0;
  const refreshPrice = async () => {
    const current = ++priceRequest;
    const source = form.querySelector("#price-source");
    submit.disabled = true;
    try {
      const proposed = await sugerirPrecio(v, form.elements.consumption.value);
      if (current !== priceRequest) return;
      form.elements.real.value = (proposed.price / 100).toFixed(2);
      source.textContent = "Precio sugerido por " + proposed.source.toLowerCase();
      submit.disabled = false;
    } catch (err) {
      if (current !== priceRequest) return;
      form.elements.real.value = "";
      source.textContent = err.message;
      submit.disabled = true;
    }
    amount();
  };
  form.elements.consumption.addEventListener("change", refreshPrice);
  form.addEventListener("input", amount);
  let pending = false;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (pending) return;
    pending = true;
    try {
      const consumption = form.elements.consumption.value;
      const consumed = formato.scaled(form.elements.consumed.value);
      const real = formato.scaled(form.elements.real.value);
      if (!formato.validValue(consumed) || !formato.validValue(real)) {
        ui.error(form, "Indica una cantidad y un precio real válidos.");
        return;
      }
      const identity = {
        dniPresentado: form.elements.dniPresentado.value,
        identidadVerificada: form.elements.identidadVerificada.checked,
      };
      const proposed = await sugerirPrecio(v, consumption);
      if (!modal.root.open) return;
      const cambioPrecio = real !== proposed.price;
      const datosAtencion = valePresentador.facts([
        ["Fecha de consumo", formato.date(consumption), "calendar-days"],
        ["Cantidad consumida", formato.qty(consumed) + " gal", "droplet"],
        ...(cambioPrecio ? [["Precio sugerido por galón", formato.money(proposed.price)]] : []),
        ["Precio real por galón", formato.money(real)],
      ]);
      const resumen = valePresentador.card(v, {
        content: datosAtencion + valePresentador.amount({ amount: formato.amount(consumed, real) }),
      });
      const confirmado = await confirm({
        title: "Confirmar atención",
        content: `<div class="stack">
          ${cambioPrecio ? '<p class="note">El precio real difiere del precio sugerido.</p>' : ""}
          ${resumen}
          <p class="muted">Al confirmar, se genera el ticket y el vale queda usado.</p>
        </div>`,
        label: "Confirmar atención",
      });
      if (!confirmado || !modal.root.open) return;
      const valeAtendido = await registrarAtencion(v, { consumed, real, consumption, confirmedPrice: proposed.price, ...identity });
      modal.close();
      alRegistrar(valeAtendido);
    } catch (err) {
      ui.error(form, err.message);
    } finally {
      pending = false;
    }
  });
  refreshPrice();
  form.elements.dniPresentado.focus();
}
