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
  const selected = (tickets) => tickets.map(t => {
    const contenido = t.vale
      ? valePresentador.card(t.vale, { collapsible: true, content: consumption(t.vale) })
      : valePresentador.facts([["Vale", t.codigo_vale, "tickets"], ["Ticket del grifo", t.ticket, "receipt"]]);
    return `<li class="selected-voucher-item">${contenido}</li>`;
  }).join("");
  const confirmation = (invoice, vales, respaldo, total) => {
    const origen = respaldo.origen === "ANEXO" ? respaldo.referenciaAnexo : "Factura " + invoice.number;
    return `<div class="invoice-confirmation"><section class="invoice-confirm-document"><div class="invoice-confirm-title"><span>${ui.icon("receipt-text")}</span><div><small>Factura</small><strong>${e(invoice.number)}</strong></div><span class="invoice-confirm-count">${respaldo.tickets.length} ${respaldo.tickets.length === 1 ? "ticket" : "tickets"}</span></div><div class="invoice-meta">${metadata(invoice)}</div><div class="entity-line">${ui.icon("file-text")}<span><small>Respaldo</small>${e(origen)}</span></div></section><div class="invoice-confirm-totals"><div><span>Total de tickets</span><strong>${formato.money(total)}</strong></div><span class="invoice-confirm-link">${ui.icon("arrow-left-right")}</span><div><span>Importe de factura</span><strong>${formato.money(invoice.total)}</strong></div></div><p class="invoice-confirm-status">${ui.icon("circle-check")}Los tickets y el total coinciden</p><h3 class="invoice-confirm-label">${ui.icon("tickets")}Vales por asociar</h3><ul class="invoice-confirm-vales">${selected(vales)}</ul></div>`;
  };
  return { metadata, confirmation };
})();
