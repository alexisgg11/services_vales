import * as ui from "../../components/controles.js";
import { confirm } from "../../components/dialogos.js";
import { DataTable } from "../../components/tabla.js";
import formato from "../../shared/formato.js";
import { centesimos } from "../../model/valores.js";
import { catalogos } from "../../state/catalogos.js";
import { vales } from "../../state/vales.js";
import facturaPresentador from "./presentador.js";
import { asociarFactura, validarTickets } from "../../service/contabilidad.js";

const estados = {
  VALIDO: "Coincide",
  NO_ENCONTRADO: "No encontrado en este grifo",
  FACTURADO: "Ya facturado",
  NO_ATENDIDO: "Sin atención registrada",
};

export default function mostrarFacturas(vale) {
  ui.page("Asociar factura", `<div class="invoice-workspace">
    <section class="panel invoice-selection">
      <div class="panel-heading"><h2>Factura y respaldo</h2></div>
      <form class="panel-body" id="invoice-form">
        ${ui.field("Número de factura", ui.select("factura", [], "", "required"), { name: "factura" })}
        <fieldset class="stack invoice-evidence" data-invoice-evidence disabled>
          ${ui.field("Origen de los tickets", ui.select("origen", [
            { id: "FACTURA", name: "Factura" }, { id: "ANEXO", name: "Anexo del grifo" },
          ]), { name: "origen" })}
          <div data-invoice-reference hidden>${ui.field("Referencia del anexo",
            ui.input("referenciaAnexo", "text", "", 'maxlength="150" disabled'), { name: "referenciaAnexo" })}</div>
          ${ui.field("Números de ticket", '<textarea id="tickets" name="tickets" rows="5" required spellcheck="false"></textarea>', {
            name: "tickets", hint: "Copia un número por línea tal como aparece en el respaldo del grifo.",
          })}
          <div>${ui.button("Validar tickets", { type: "submit", icon: "list-checks" })}</div>
        </fieldset>
      </form>
    </section>
    <section class="invoice-panel">
      <div class="section-title">${ui.icon("arrow-left-right")}<h2>Comparar y asociar</h2></div>
      <div class="invoice-comparison" id="invoice-comparison">
        <section class="comparison-card">
          <div class="comparison-heading">${ui.icon("file-check-2")}<h3>Factura</h3></div>
          <div id="invoice-meta" class="invoice-meta"></div>
          <div class="comparison-total"><span>Importe de factura</span><strong id="invoice-amount">—</strong></div>
        </section>
        <div class="comparison-bridge" aria-hidden="true">${ui.icon("arrow-left-right")}</div>
        <section class="comparison-card">
          <div class="comparison-heading">${ui.icon("tickets")}<h3>Tickets del respaldo</h3></div>
          <div class="comparison-total"><span>Total de tickets válidos</span><strong id="invoice-total">—</strong></div>
        </section>
      </div>
      <div id="invoice-tickets"></div>
      <div class="comparison-actions"><p id="invoice-balance" aria-live="polite"></p>
        ${ui.button("Asociar factura", { id: "associate-invoice", variant: "primary", icon: "link", disabled: true })}
      </div><div id="invoice-result"></div>
    </section></div>`);

  const form = document.getElementById("invoice-form");
  const fields = form.elements;
  const evidence = form.querySelector("[data-invoice-evidence]");
  const validate = form.querySelector('button[type="submit"]');
  const associate = document.getElementById("associate-invoice");
  const result = document.getElementById("invoice-result");
  const comparison = document.getElementById("invoice-comparison");
  const tickets = document.getElementById("invoice-tickets");
  const balance = document.getElementById("invoice-balance");
  let revision;
  let busy = false;

  function listarFacturas() {
    const facturas = catalogos.invoices.filter(i => !i.associated);
    if (vale?.provider) {
      facturas.sort((a, b) => Number(b.provider === vale.provider) - Number(a.provider === vale.provider));
    }
    fields.factura.replaceChildren(
      new Option(facturas.length ? "Seleccionar factura" : "Sin facturas disponibles", ""),
      ...facturas.map(i => new Option(i.number + " (" + catalogos.provider(i.provider)?.name + ")", i.id)),
    );
  }

  function dibujar() {
    const factura = catalogos.invoice(fields.factura.value);
    const coincide = !!revision?.coincide;
    const anexo = fields.origen.value === "ANEXO";
    evidence.disabled = !factura || busy;
    fields.factura.disabled = busy || fields.factura.options.length < 2;
    fields.referenciaAnexo.disabled = !anexo;
    fields.referenciaAnexo.required = anexo;
    form.querySelector("[data-invoice-reference]").hidden = !anexo;
    associate.disabled = !coincide || busy;
    comparison.classList.toggle("matched", coincide);
    balance.classList.toggle("matched", coincide);
    document.getElementById("invoice-meta").innerHTML = factura
      ? facturaPresentador.metadata(factura) : '<p class="muted">Selecciona una factura para empezar.</p>';
    document.getElementById("invoice-amount").textContent = factura ? formato.money(factura.total) : "—";
    document.getElementById("invoice-total").textContent = revision
      ? formato.money(centesimos(revision.total_vales)) : "—";
    balance.textContent = !factura ? "" : !revision ? "Ingresa y valida los tickets del respaldo."
      : !revision.todos_validos ? "Revisa los tickets pendientes en el resultado."
      : coincide ? "Los tickets y el total coinciden."
      : "Diferencia de " + formato.money(Math.abs(centesimos(revision.total_factura) - centesimos(revision.total_vales))) + ".";
    ui.icons();
  }

  function invalidar() {
    revision = undefined;
    tickets.replaceChildren();
    result.replaceChildren();
    form.querySelector(".form-error")?.remove();
    dibujar();
  }

  function respaldo() {
    return {
      origen: fields.origen.value,
      referenciaAnexo: fields.origen.value === "ANEXO" ? fields.referenciaAnexo.value.trim() : null,
      tickets: fields.tickets.value.split(/\r?\n/).map(numero => numero.trim()).filter(Boolean),
    };
  }

  function mostrarTickets(filas) {
    new DataTable(tickets, {
      rows: filas.map(t => ({ ...t, id: t.ticket })), label: "tickets del respaldo", sortKey: "ticket",
      searchLabel: "Buscar por ticket o vale",
      columns: [
        { key: "ticket", label: "Ticket", identity: true },
        { key: "codigo_vale", label: "Vale", value: t => t.codigo_vale ?? "—" },
        { key: "estado", label: "Resultado", value: t => estados[t.estado] },
        { key: "importe", label: "Importe", numeric: true,
          render: t => t.importe == null ? "—" : formato.money(centesimos(t.importe)) },
      ],
    });
  }

  fields.factura.addEventListener("change", () => {
    fields.origen.value = "FACTURA";
    fields.referenciaAnexo.value = "";
    fields.tickets.value = "";
    invalidar();
  });
  evidence.addEventListener("input", invalidar);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !fields.factura.value) return;
    const datos = respaldo();
    if (datos.origen === "ANEXO" && !datos.referenciaAnexo) {
      ui.error(form, "Indica la referencia del anexo.");
      return;
    }
    invalidar();
    busy = true;
    dibujar();
    try {
      revision = await validarTickets(fields.factura.value, datos);
      if (form.isConnected) mostrarTickets(revision.tickets);
    } catch (error) {
      if (form.isConnected) ui.error(form, error.message);
    } finally {
      busy = false;
      if (form.isConnected) {
        dibujar();
        validate.focus();
      }
    }
  });

  associate.addEventListener("click", async () => {
    if (busy || !revision?.coincide) return;
    const factura = catalogos.invoice(fields.factura.value);
    const datos = respaldo();
    const detalle = revision.tickets.map(t => ({ ...t, vale: vales.get(t.id_vale) }));
    busy = true;
    dibujar();
    try {
      const aprobado = await confirm({
        title: "Asociar factura " + factura.number,
        content: facturaPresentador.confirmation(factura, detalle, datos, centesimos(revision.total_vales)),
        dialogClass: "invoice-confirm-dialog",
        label: "Asociar factura",
      });
      if (!aprobado) return;
      await asociarFactura(factura.id, datos);
      if (!form.isConnected) return;
      listarFacturas();
      form.reset();
      invalidar();
      result.textContent = "Factura " + factura.number + " asociada.";
      result.className = "inline-success";
      result.setAttribute("role", "status");
    } catch (error) {
      if (form.isConnected) {
        invalidar();
        ui.error(form, error.message);
      }
    } finally {
      busy = false;
      if (form.isConnected) dibujar();
    }
  });

  listarFacturas();
  dibujar();
}
