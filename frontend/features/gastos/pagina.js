import * as ui from "../../components/controles.js";
import { sheet } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";
import { vales } from "../../state/vales.js";
import { columnasVale, crearTablaVales } from "../vales/tabla.js";
import { DataTable } from "../../components/tabla.js";
import { consultarGastos } from "../../service/contabilidad.js";

export default function mostrarGastos() {
  const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
  ui.page(
    "Consultar gastos",
    `<form id="expenses-form" class="period-form">${ui.field(
      "Año",
      ui.select(
        "report-year",
        [...new Set([formato.today.slice(0, 4),
          ...vales.all().filter((v) => v.consumption).map((v) => v.consumption.slice(0, 4))])]
          .sort().reverse().map((value) => ({ value, label: value })),
        formato.today.slice(0, 4),
      ),
      { name: "report-year" },
    )}${ui.field(
      "Mes",
      ui.select(
        "report-month",
        months.map((label, i) => ({
          value: String(i + 1).padStart(2, "0"),
          label,
        })),
        formato.today.slice(5, 7),
      ),
      { name: "report-month" },
    )}${ui.button("Consultar", { type: "submit", variant: "primary", icon: "search" })}</form><div id="report-results"></div>`,
  );
  const form = document.getElementById("expenses-form"),
    year = form.elements["report-year"],
    month = form.elements["report-month"],
    result = document.getElementById("report-results");
  form.addEventListener("change", () => result.replaceChildren());
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const period = year.value + "-" + month.value;
    let rows;
    try {
      rows = await consultarGastos(period);
      if (!form.isConnected || period !== year.value + "-" + month.value) return;
    } catch (error) {
      if (form.isConnected) ui.error(form, error.message);
      return;
    }
    form.querySelector(".form-error")?.remove();
    const totales = { conContrato: 0, sinContrato: 0, sinDato: 0 };
    for (const vale of rows) {
      const grupo = vale.contract === "S/C" ? "sinContrato" : vale.contract ? "conContrato" : "sinDato";
      totales[grupo] += vale.amount;
    }
    const { conContrato, sinContrato, sinDato } = totales;
    const total = conContrato + sinContrato + sinDato;
    result.innerHTML = `<section class="expenses-result">
      <div class="expenses-heading">
        <h2>${months[Number(month.value) - 1]} de ${year.value}</h2>
        <dl class="expenses-totals" aria-label="Gasto por modalidad">
          <div><dt>Con contrato</dt><dd>${formato.money(conContrato)}</dd></div>
          <div><dt>Sin contrato (S/C)</dt><dd>${formato.money(sinContrato)}</dd></div>
          ${sinDato ? `<div><dt>Modalidad sin dato</dt><dd>${formato.money(sinDato)}</dd></div>` : ""}
          <div><dt>Total facturado</dt><dd>${formato.money(total)}</dd></div>
        </dl>
      </div>
      <div id="report-table"></div>
    </section>`;
    const groups = catalogos.supplies
      .map((s) => {
        const list = rows.filter((v) => v.supply === s.id);
        return {
          id: s.id,
          name: s.name,
          count: list.length,
          quantity: list.reduce((sum, v) => sum + v.consumed, 0),
          total: list.reduce((sum, v) => sum + v.amount, 0),
        };
      })
      .filter((g) => g.count);
    new DataTable(document.getElementById("report-table"), {
      rows: groups,
      label: "suministros",
      sortKey: "total",
      searchLabel: "Buscar suministro",
      empty: "No hay consumos con factura en este período",
      columns: [
        { key: "name", label: "Suministro", identity: true },
        { key: "count", label: "Vales", numeric: true },
        {
          key: "quantity",
          label: "Consumo (gal)",
          numeric: true,
          render: (g) => formato.qty(g.quantity),
        },
        {
          key: "total",
          label: "Importe",
          numeric: true,
          render: (g) => formato.money(g.total),
        },
        {
          key: "actions",
          label: "Detalle",
          sortable: false,
          render: (g) =>
            ui.iconAction("Ver vales de " + catalogos.supply(g.id)?.name, "eye",
              `data-supply-detail="${formato.escape(g.id)}"`),
        },
      ],
    });
    result.querySelector("#report-table").addEventListener("click", (event) => {
      const b = event.target.closest("[data-supply-detail]");
      if (!b) return;
      const supply = catalogos.supply(b.dataset.supplyDetail),
        list = rows.filter((v) => v.supply === supply.id),
        modal = sheet({
          title: supply.name,
          subtitle: months[Number(month.value) - 1] + " de " + year.value,
          content: "<div data-supply-table></div>",
          footer: ui.button("Cerrar", { attrs: "data-close" }),
        });
      crearTablaVales(modal.root.querySelector("[data-supply-table]"), {
        rows: list,
        label: "vales",
        columns: [
          ...columnasVale(["id"]),
          { key: "modalidad", label: "Modalidad", value: v =>
            v.contract === "S/C" ? "Sin contrato (S/C)" : v.contract ? "Con contrato" : "Sin dato" },
          ...columnasVale(["ticket", "consumption", "consumed", "amount"]),
          { key: "invoice", label: "Factura", value: (v) => v.invoiceNumber || catalogos.invoice(v.invoice)?.number },
        ],
      });
    });
    ui.icons();
  });
}
