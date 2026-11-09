import * as ui from "../../components/controles.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";
import valePresentador from "../vales/presentador.js";

// Shared invoice metadata, selected vouchers and association confirmation.
export default (() => {
  const e = formato.escape;
  const metadata = (invoice) =>
    `<div class="entity-line">${ui.icon("fuel")}<span><small>Grifo</small>${e(catalogos.provider(invoice.provider).name)}</span></div><div class="entity-line">${ui.icon("badge-check")}<span><small>RUC</small>${e(catalogos.provider(invoice.provider).ruc)}</span></div><div class="entity-line">${ui.icon("calendar-days")}<span><small>Fecha de emisión</small>${e(formato.date(invoice.date))}</span></div>`;
  const consumption = (v) =>
    valePresentador.facts([
      ["Suministro", catalogos.supply(v.supply)?.name, "droplet"],
      ["Consumido", formato.qty(v.consumed) + " gal", "gauge"],
      ["Proveedor", catalogos.provider(v.provider)?.name, "fuel"],
      ["Trabajador", catalogos.worker(v.worker)?.name, "user-round"],
      ["Ticket del grifo", v.ticket, "receipt"],
      ["Importe real", formato.money(v.amount), "banknote"],
    ]);
  const selected = (vales, { removable = true, expanded = new Set() } = {}) =>
    vales
      .map(
        (v) =>
          `<li class="selected-voucher-item">${valePresentador.card(v, { collapsible: true, expanded: expanded.has(v.id), content: consumption(v) })}${removable ? `<button type="button" class="icon-btn selected-voucher-remove" data-remove-vale="${e(v.id)}" aria-label="Quitar vale ${e(formato.reference(v))}">${ui.icon("x")}</button>` : ""}</li>`,
      )
      .join("");
  const confirmation = (invoice, vales) => {
    const total = vales.reduce((s, v) => s + v.amount, 0);
    return `<div class="invoice-confirmation"><section class="invoice-confirm-document"><div class="invoice-confirm-title"><span>${ui.icon("receipt-text")}</span><div><small>Factura</small><strong>${e(invoice.number)}</strong></div><span class="invoice-confirm-count">${vales.length} ${vales.length === 1 ? "vale" : "vales"}</span></div><div class="invoice-meta">${metadata(invoice)}</div></section><div class="invoice-confirm-totals"><div><span>Total de vales</span><strong>${formato.money(total)}</strong></div><span class="invoice-confirm-link">${ui.icon("arrow-left-right")}</span><div><span>Importe de factura</span><strong>${formato.money(invoice.total)}</strong></div></div><p class="invoice-confirm-status">${ui.icon("circle-check")}Los importes coinciden</p><h3 class="invoice-confirm-label">${ui.icon("tickets")}Vales por asociar</h3><ul class="invoice-confirm-vales">${selected(vales, { removable: false })}</ul></div>`;
  };
  return { metadata, selected, confirmation };
})();
