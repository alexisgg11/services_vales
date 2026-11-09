import F from "../../shared/formato.js";
import { badge, iconAction, icon } from "../../components/controles.js";
import { DataTable } from "../../components/tabla.js";
import { catalogos as C } from "../../state/catalogos.js";
import { abrirDetalleVale } from "./detalle.js";

const e = F.escape;
const definitions = {
  id: {
    key: "id",
    label: "Código",
    identity: true,
    value: F.code,
    render: (v) =>
      `<button class="sort-button code" data-row-action="detail" data-id="${e(v.id)}">${e(F.code(v))}</button><small class="table-provider">${icon("map-pin")}${e(v.zone)}</small>`,
  },
  worker: {
    key: "worker",
    label: "Trabajador",
    value: (v) => C.worker(v.worker)?.name ?? v.workerName,
  },
  provider: {
    key: "provider",
    label: "Proveedor",
    value: (v) => C.provider(v.provider)?.name,
  },
  supply: {
    key: "supply",
    label: "Suministro",
    value: (v) => C.supply(v.supply)?.name,
  },
  quantity: {
    key: "quantity",
    label: "Emitido (gal)",
    numeric: true,
    render: (v) => F.qty(v.quantity),
  },
  consumed: {
    key: "consumed",
    label: "Consumido (gal)",
    numeric: true,
    render: (v) => F.qty(v.consumed),
  },
  emission: {
    key: "emission",
    label: "Emisión",
    render: (v) => e(F.date(v.emission)),
  },
  consumption: {
    key: "consumption",
    label: "Consumo",
    render: (v) => e(F.date(v.consumption)),
  },
  state: { key: "state", label: "Estado", render: (v) => badge(v.state) },
  amount: {
    key: "amount",
    label: "Importe",
    numeric: true,
    render: (v) => F.money(v.amount),
  },
  unit: {
    key: "unit",
    label: "Unidad",
    value: (v) => C.unit(v.unit)?.plate || v.plate || "Sin unidad",
  },
  invoice: {
    key: "invoice",
    label: "Factura",
    value: (v) => C.invoice(v.invoice)?.number || v.invoiceNumber || "Sin asociar",
  },
  actions: {
    key: "actions",
    label: "Acciones",
    sortable: false,
    render: (v) =>
      iconAction("Ver vale " + F.reference(v), "eye", `data-row-action="detail" data-id="${e(v.id)}"`),
  },
  ticket: { key: "ticket", label: "Ticket", value: (v) => v.ticket || "—" },
};
export const columnasVale = (keys) => keys.map((key) => ({ ...definitions[key] }));

export function seleccionarValeEnTabla(tabla, vale) {
  if (!vale) return;
  const indice = tabla.rows().findIndex(fila => fila.id === vale.id);
  if (indice === -1) return;
  tabla.selected.add(vale.id);
  tabla.page = Math.floor(indice / tabla.size) + 1;
  tabla.draw();
  tabla.notify();
}

export function crearTablaVales(host, config) {
  return new DataTable(host, {
    searchLabel: "Buscar por código o trabajador",
    empty: "No se encontraron vales",
    ...config,
    searchValues: vale => [C.worker(vale.worker)?.name ?? vale.workerName, C.provider(vale.provider)?.name, C.supply(vale.supply)?.name],
    selectionPageLabel: "Seleccionar los vales de esta página",
    selectionLabel: vale => "Seleccionar vale " + F.reference(vale),
    onAction(action, vale) {
      if (action === "detail") abrirDetalleVale(vale);
      else config.onAction?.(action, vale);
    },
  });
}
