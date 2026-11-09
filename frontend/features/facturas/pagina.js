import * as ui from "../../components/controles.js";
import { confirm } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";
import { vales } from "../../state/vales.js";
import { permisos } from "../../state/permisos.js";
import { columnasVale, crearTablaVales, seleccionarValeEnTabla } from "../vales/tabla.js";
import facturaPresentador from "./presentador.js";
import { asociarFactura } from "../../service/contabilidad.js";

export default function mostrarFacturas(vale) {
  const e = formato.escape;
  ui.page(
    "Asociar factura",
    `<div class="invoice-workspace"><section class="invoice-selection"><div class="section-title">${ui.icon("tickets")}<h2>Vales atendidos</h2></div><div id="invoice-table"></div></section>
    <section class="invoice-panel"><div class="section-title">${ui.icon("arrow-left-right")}<h2>Comparar y asociar</h2></div>
    <section class="invoice-comparison" id="invoice-comparison">
      <div class="comparison-card"><div class="comparison-heading">${ui.icon("tickets")}<h3>Vales seleccionados</h3><span id="invoice-count" class="count-pill">0</span></div><p class="comparison-provider" id="selected-provider">Sin selección</p><ul id="selected-vouchers" class="selected-vouchers"><li class="muted">Selecciona los vales de la lista.</li></ul><div class="comparison-total"><span>Total de vales</span><strong id="invoice-total">—</strong></div></div>
      <div class="comparison-bridge" aria-hidden="true">${ui.icon("arrow-left-right")}</div>
      <div class="comparison-card"><div class="comparison-heading">${ui.icon("file-check-2")}<h3>Factura</h3></div>${ui.field("Número de factura", ui.select("invoice-number", [{ id: "", name: "Primero selecciona los vales" }], "", "disabled"), { name: "invoice-number" })}<div id="invoice-meta" class="invoice-meta"><span>El importe se carga desde la factura.</span></div><div class="comparison-total"><span>Importe de factura</span><strong id="invoice-amount">—</strong></div></div>
    </section><div class="comparison-actions"><p id="invoice-balance" aria-live="polite">Selecciona los vales del mismo proveedor.</p>${ui.button("Asociar factura", { id: "associate-invoice", variant: "primary", icon: "link", disabled: true })}</div><div id="invoice-result"></div></section></div>`,
  );
  const number = document.getElementById("invoice-number"),
    button = document.getElementById("associate-invoice");
  let ids = [];
  const available = (provider) =>
    catalogos.invoices.filter(
      (i) =>
        i.provider === provider && !i.associated && !vales.all().some((v) => v.invoice === i.id),
    );
  const update = () => {
    const batch = ids.map((id) => vales.get(id)),
      providers = new Set(batch.map((v) => v.provider)),
      same = providers.size === 1,
      provider = same ? batch[0].provider : "",
      total = batch.reduce((s, v) => s + v.amount, 0);
    const previous = number.value,
      list = same ? available(provider) : [];
    number.innerHTML =
      `<option value="">${!ids.length ? "Primero selecciona los vales" : !same ? "Selecciona un solo proveedor" : !list.length ? "Sin facturas disponibles" : "Seleccionar factura"}</option>` +
      list
        .map((i) => `<option value="${e(i.id)}">${e(i.number)}</option>`)
        .join("");
    number.value = list.some((i) => i.id === previous) ? previous : "";
    number.disabled = !same || !list.length;
    const invoice = catalogos.invoice(number.value),
      match = !!invoice && same && ids.length > 0 && total === invoice.total;
    document.getElementById("invoice-count").textContent = ids.length;
    document.getElementById("selected-provider").innerHTML =
      ui.icon("fuel") +
      `<span>${e(same ? catalogos.provider(provider).name : ids.length ? "Hay vales de distintos proveedores" : "Sin selección")}</span>`;
    const selectedHost = document.getElementById("selected-vouchers"),
      expanded = new Set(
        [...selectedHost.querySelectorAll("[data-vale-disclosure][open]")].map(
          (el) => el.dataset.valeDisclosure,
        ),
      );
    selectedHost.innerHTML = batch.length
      ? facturaPresentador.selected(batch, { expanded })
      : '<li class="muted">Selecciona los vales de la lista.</li>';
    document.getElementById("invoice-total").textContent = ids.length
      ? formato.money(total)
      : "—";
    document.getElementById("invoice-amount").textContent = invoice
      ? formato.money(invoice.total)
      : "—";
    document.getElementById("invoice-meta").innerHTML = invoice
      ? facturaPresentador.metadata(invoice)
      : "<span>El importe se carga desde la factura.</span>";
    document
      .getElementById("invoice-comparison")
      .classList.toggle("matched", match);
    const balance = document.getElementById("invoice-balance");
    balance.classList.toggle("matched", match);
    balance.innerHTML =
      ui.icon(match ? "circle-check" : invoice ? "circle-alert" : "arrow-up") +
      `<span>${!ids.length ? "Selecciona los vales del mismo proveedor." : !same ? "Los vales deben pertenecer al mismo proveedor." : !invoice ? "Ahora selecciona una factura." : match ? "Los importes coinciden. Puedes asociar." : "Diferencia pendiente: " + formato.money(Math.abs(total - invoice.total))}</span>`;
    button.disabled = !match;
    ui.icons();
  };
  const table = crearTablaVales(document.getElementById("invoice-table"), {
    rows: () => vales.all().filter((v) => permisos.eligible("facturas", v)),
    label: "vales sin factura",
    selectable: true,
    columns: [
      {
        ...columnasVale(["id"])[0],
        label: "Vale",
        render: (v) =>
          `<button class="sort-button code" data-row-action="detail" data-id="${e(v.id)}">${e(formato.code(v))}</button><small class="table-provider">${ui.icon("map-pin")}${e(v.zone)}</small><small class="table-provider">${ui.icon("fuel")}${e(catalogos.provider(v.provider)?.name)}</small>`,
      },
      ...columnasVale(["ticket", "consumed", "amount"]),
    ],
    filters: [
      { key: "provider", label: "Todos los proveedores", options: catalogos.providers },
    ],
    onSelection: (selection) => {
      ids = selection;
      document.getElementById("invoice-result").replaceChildren();
      update();
    },
  });
  seleccionarValeEnTabla(table, vale);
  document
    .getElementById("selected-vouchers")
    .addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-remove-vale]");
      if (b) {
        table.selected.delete(b.dataset.removeVale);
        table.draw();
        table.notify();
      }
    });
  number.addEventListener("change", update);
  button.addEventListener("click", async () => {
    const selected = ids.slice(),
      invoice = catalogos.invoice(number.value);
    if (!invoice) return;
    if (
      !(await confirm({
        title: "Asociar factura " + invoice.number,
        content: facturaPresentador.confirmation(
          invoice,
          selected.map((id) => vales.get(id)),
        ),
        dialogClass: "invoice-confirm-dialog",
        label: "Asociar factura",
      }))
    )
      return;
    try {
      await asociarFactura(invoice.id, selected);
      if (!button.isConnected) return;
      ids = [];
      table.selected.clear();
      table.draw();
      update();
      document.getElementById("invoice-result").innerHTML =
        `<p class="inline-success" role="status">${ui.icon("circle-check")}Factura ${e(invoice.number)} asociada.</p>`;
      ui.icons();
    } catch (err) {
      ui.toast(err.message);
    }
  });
}
