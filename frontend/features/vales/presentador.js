import * as ui from "../../components/controles.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";

// Shared voucher identity, sectioned detail and operation receipts.
export default (() => {
  const e = formato.escape;
  const facts = (items, className = "") =>
    `<dl class="vale-facts ${className}">${items.map(([label, value, icon]) => `<div><dt>${icon ? ui.icon(icon) : ""}${e(label)}</dt><dd>${e(value ?? "—")}</dd></div>`).join("")}</dl>`;
  const identity = (v, { inline = false } = {}) => {
    const tag = inline ? "span" : "div";
    return `<${tag} class="voucher-stub"><span class="record-icon voucher-mark">${ui.icon("ticket")}</span><${tag} class="voucher-identity"><span class="voucher-label">Vale de combustible</span><strong class="voucher-code">${e(formato.code(v))}</strong><span class="voucher-label">${e(v.zone)}</span></${tag}>${ui.badge(v.state)}</${tag}>`;
  };
  const section = (title, icon, content) =>
    `<section class="vale-detail-section"><h3>${ui.icon(icon)}${e(title)}</h3>${content}</section>`;
  const supplyName = (v) => catalogos.supply?.(v.supply)?.name || v.supplyName;
  const providerName = (v) => catalogos.provider?.(v.provider)?.name || v.providerName;
  const attentionFacts = (v, { context = false } = {}) =>
    facts([
      ...(context
        ? [
            ["Suministro", supplyName(v)],
            ["Proveedor", providerName(v)],
          ]
        : []),
      ["Fecha de consumo", formato.date(v.consumption)],
      ["Ticket del grifo", v.ticket],
      ["Cantidad consumida", formato.qty(v.consumed) + " gal"],
      ["Precio real por galón", formato.money(v.real)],
      ...(v.suggestedPrice ? [["Precio sugerido", formato.money(v.suggestedPrice)], ["Origen del precio", v.priceSource]] : []),
      ["Atendido por", v.attendedBy?.name || "Sin registro"],
      ["Fecha de registro", formato.date(v.attendedAt || v.consumption)],
    ]);
  const amount = (v) =>
    `<div class="receipt-total"><span>Importe real de atención</span><strong>${formato.money(v.amount)}</strong></div>`;
  const details = (v, qr = "") => `<div class="vale-details">
    ${identity(v)}
    ${qr}
    ${section(
      "Emisión",
      "file-text",
      facts([
        ["Fecha de emisión", formato.date(v.emission)],
        ["Proveedor", catalogos.provider(v.provider)?.name],
        ["RUC", catalogos.provider(v.provider)?.ruc],
        ["Contrato", v.contract],
        ...(v.third ? [["Tercero", v.third], ["Destino o motivo", v.destination]] : []),
      ]),
    )}
    ${section(
      "Combustible",
      "droplet",
      facts([
        ["Suministro", catalogos.supply(v.supply)?.name],
        ["Cantidad emitida", formato.qty(v.quantity) + " gal"],
        ["Precio referencial por galón", formato.money(v.price)],
        ["Importe estimado", formato.money(formato.amount(v.quantity, v.price))],
      ]),
    )}
    ${section(
      "Asignación",
      "user-round",
      facts([
        ["Trabajador", catalogos.worker(v.worker)?.name || v.workerName],
        ["DNI", v.workerDocument || "Se verifica con el documento del conductor"],
        ["Unidad organizativa", v.org],
        ["Centro de costo", v.center],
        ["Zonal", v.zone],
        ["Localidad", v.locality],
        ["Unidad móvil", catalogos.unit(v.unit)?.plate || v.plate || "Sin unidad móvil"],
      ]),
    )}
    ${v.consumption ? section("Atención registrada", "receipt", attentionFacts(v) + amount(v) + facts([["Factura", catalogos.invoice(v.invoice)?.number || "Sin asociar"]])) : ""}
    ${
      v.cancelReason
        ? section(
            "Anulación",
            "circle-slash",
            facts([
              ["Fecha", formato.date(v.cancelDate)],
              ["Motivo", v.cancelReason],
            ]),
          )
        : ""
    }
    ${section(
      "Responsables",
      "history",
      `<ul class="vale-history">${[
        ["Registrado por", v.registeredBy, v.registeredAt || v.emission],
        ...(v.authorizedBy
          ? [["Autorizado por", v.authorizedBy, v.authorized]]
          : []),
        ...(v.attendedBy
          ? [["Atendido por", v.attendedBy, v.attendedAt || v.consumption]]
          : []),
        ...(v.associatedBy ? [["Factura asociada por", v.associatedBy, v.associatedAt]] : []),
        ...(v.canceledBy ? [["Anulado por", v.canceledBy, v.cancelDate]] : []),
      ]
        .map(
          ([label, person, date]) =>
            `<li><span>${e(label)}</span><strong>${e(person?.name || "Sin registro")}</strong><time>${e(formato.date(date))}</time></li>`,
        )
        .join("")}</ul>`,
    )}
    ${section("Observación", "message-square", `<p class="vale-note">${e(v.note || "Sin observación")}</p>`)}
  </div>`;
  const baseFacts = (v) =>
    facts([
      ["Suministro", supplyName(v), "droplet"],
      ["Cantidad emitida", formato.qty(v.quantity) + " gal", "gauge"],
      ["Proveedor", providerName(v), "fuel"],
      [v.hasThird ? "Trabajador responsable" : "Trabajador", catalogos.worker?.(v.worker)?.name || v.workerName, "user-round"],
    ]);
  const card = (
    v,
    {
      clickable = false,
      collapsible = false,
      expanded = false,
      content = baseFacts(v),
    } = {},
  ) => {
    if (collapsible)
      return `<details class="voucher-receipt voucher-card voucher-card--collapsible" data-vale-disclosure="${e(v.id)}" ${expanded ? "open" : ""}><summary class="voucher-card-summary" aria-label="Mostrar u ocultar detalle del vale ${e(formato.reference(v))}">${identity(v, { inline: true })}<span class="voucher-disclosure-icon">${ui.icon("chevron-down")}</span></summary><div class="receipt-content">${content}<div class="voucher-card-tools">${ui.iconAction("Ver detalle completo del vale " + formato.reference(v), "eye", `data-vale-detail="${e(v.id)}"`)}</div></div></details>`;
    return `<article class="voucher-receipt voucher-card ${clickable ? "voucher-card--clickable" : ""}">${identity(v)}<div class="receipt-content">${content}</div>${clickable ? `<button type="button" class="voucher-card-hit" data-vale-detail="${e(v.id)}" aria-label="Ver detalle del vale ${e(formato.reference(v))}"><span class="sr-only">Ver detalle del vale ${e(formato.reference(v))}</span></button>` : ""}</article>`;
  };
  const result = (v, { title, content, actions = "" }) =>
    `<section class="operation-result success-result" aria-label="${e(title)}"><div class="receipt-status" role="status">${ui.icon("circle-check")}<h2>${e(title)}</h2></div>${card(v, { content })}${actions ? `<footer class="receipt-actions">${actions}</footer>` : ""}</section>`;
  const selection = (vales) =>
    `<ul class="approval-vales">${vales.map((v) => `<li>${card(v, { clickable: true })}</li>`).join("")}</ul>`;
  return {
    facts,
    identity,
    section,
    attentionFacts,
    amount,
    details,
    result,
    selection,
    baseFacts,
    card,
  };
})();
