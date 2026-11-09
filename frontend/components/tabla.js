import F from "../shared/formato.js";
import { empty, icon, icons } from "./controles.js";

const e = F.escape;
export class DataTable {
  constructor(host, config) {
    this.host = host;
    this.config = config;
    this.selected = new Set();
    this.hidden = new Set();
    this.query = "";
    this.filters = {};
    this.page = 1;
    this.size = 5;
    this.sortKey = config.sortKey || "id";
    this.direction = -1;
    host.classList.add("panel", "table-card");
    host.innerHTML = this.estructura();
    host.addEventListener("input", (event) => {
      if (event.target.matches("[data-table-search]")) {
        this.query = event.target.value;
        this.page = 1;
        this.draw();
      }
    });
    host.addEventListener("change", (event) => this.change(event));
    host.addEventListener("click", (event) => this.click(event));
    this.draw();
  }
  estructura() {
    const { columns, filters = [], label, searchLabel, selectionFooter } = this.config;
    const filtros = filters.map(filtro => `<select class="table-filter" data-filter="${e(filtro.key)}"
      aria-label="${e(filtro.label)}"><option value="">${e(filtro.label)}</option>${filtro.options.map(opcion =>
        `<option value="${e(opcion.value ?? opcion.id)}">${e(opcion.label ?? opcion.name)}</option>`
      ).join("")}</select>`).join("");
    const opciones = columns.map(columna => `<label><input type="checkbox" data-column="${e(columna.key)}"
      checked ${columna.identity || columna.key === "actions" ? "disabled" : ""}>${e(columna.label)}</label>`).join("");
    return `<div class="table-tools">
      <label class="search">${icon("search")}<input data-table-search aria-label="Buscar en la tabla"
        placeholder="${e(searchLabel || "Buscar en la tabla")}" autocomplete="off"></label>
      ${filtros}
      <details class="columns"><summary class="btn btn--small">${icon("columns-3")}Columnas</summary>
        <div class="columns-menu">${opciones}</div>
      </details>
    </div>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${e(label || "Registros")}">
      <table class="data-table"><thead></thead><tbody></tbody></table>
    </div>
    <div class="table-footer"></div>${selectionFooter || ""}`;
  }

  rows() {
    let rows =
      typeof this.config.rows === "function"
        ? this.config.rows()
        : this.config.rows;
    const q = this.query.toLocaleLowerCase("es");
    rows = rows.filter(
      (v) =>
        (!q ||
          [
            ...Object.values(v),
            ...(this.config.searchValues?.(v) || []),
          ].join(" ").toLocaleLowerCase("es").includes(q)) &&
        Object.entries(this.filters).every(
          ([key, value]) => !value || String(v[key]) === value,
        ),
    );
    const col = this.config.columns.find((c) => c.key === this.sortKey);
    return rows.slice().sort((a, b) => {
      const av = col?.value ? col.value(a) : a[this.sortKey],
        bv = col?.value ? col.value(b) : b[this.sortKey];
      return (
        (typeof av === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), "es", {
              numeric: true,
            })) * this.direction
      );
    });
  }
  draw() {
    const active = document.activeElement;
    const focusAttribute = this.host.contains(active)
      ? [
          "data-sort",
          "data-page",
          "data-page-size",
          "data-select-row",
          "data-select-page",
        ].find((key) => active.hasAttribute(key))
      : null;
    const focusValue = focusAttribute
      ? active.getAttribute(focusAttribute)
      : null;
    const all = this.rows(),
      pages = Math.max(1, Math.ceil(all.length / this.size));
    this.page = Math.min(this.page, pages);
    this.visibleRows = all.slice(
      (this.page - 1) * this.size,
      this.page * this.size,
    );
    const cols = this.config.columns.filter((c) => !this.hidden.has(c.key));
    this.host.querySelector("thead").innerHTML = this.encabezado(cols);
    this.host.querySelector("tbody").innerHTML = this.visibleRows.length
      ? this.visibleRows.map(fila => this.fila(fila, cols)).join("")
      : `<tr><td colspan="${cols.length + (this.config.selectable ? 1 : 0)}">${empty(
          this.config.empty || "No se encontraron registros",
          "Prueba con otra búsqueda o cambia los filtros.",
        )}</td></tr>`;
    this.host.querySelector(".table-footer").innerHTML = this.paginacion(all.length, pages);
    icons();
    if (focusAttribute && !active.isConnected) {
      const next = [
        ...this.host.querySelectorAll("[" + focusAttribute + "]"),
      ].find((el) => el.getAttribute(focusAttribute) === focusValue);
      (next && !next.disabled
        ? next
        : this.host.querySelector("[data-table-page]")
      )?.focus({ preventScroll: true });
    }
  }
  encabezado(columnas) {
    const seleccion = this.config.selectable
      ? `<th class="select-cell"><input type="checkbox" data-select-page
          aria-label="${e(this.config.selectionPageLabel || "Seleccionar las filas de esta página")}"
          ${this.visibleRows.length && this.visibleRows.every(fila => this.selected.has(String(fila.id))) ? "checked" : ""}
          ${this.visibleRows.length ? "" : "disabled"}></th>`
      : "";
    const celdas = columnas.map(columna => {
      const activa = columna.key === this.sortKey;
      const orden = activa ? (this.direction > 0 ? "ascending" : "descending") : "";
      const simbolo = activa ? (this.direction > 0 ? "arrow-up" : "arrow-down") : "chevrons-up-down";
      const titulo = e(columna.label);
      return `<th class="${columna.numeric ? "numeric" : ""} ${columna.identity ? "identity" : ""}"
          ${orden ? `aria-sort="${orden}"` : ""}>${columna.sortable === false ? titulo :
          `<button class="sort-button" data-sort="${e(columna.key)}">${titulo}${icon(simbolo)}</button>`}</th>`;
    }).join("");
    return `<tr>${seleccion}${celdas}</tr>`;
  }

  fila(fila, columnas) {
    const etiqueta = this.config.selectionLabel?.(fila) || ("Seleccionar fila " + fila.id);
    const seleccion = this.config.selectable
      ? `<td class="select-cell"><input type="checkbox" data-select-row="${e(fila.id)}"
          aria-label="${e(etiqueta)}" ${this.selected.has(String(fila.id)) ? "checked" : ""}></td>`
      : "";
    const celdas = columnas.map(columna => {
      const valor = columna.render
        ? columna.render(fila)
        : e(columna.value ? columna.value(fila) : fila[columna.key]);
      return `<td class="${columna.numeric ? "numeric" : ""} ${columna.identity ? "identity" : ""}">
        ${valor}</td>`;
    }).join("");
    return `<tr>${seleccion}${celdas}</tr>`;
  }

  paginacion(total, paginas) {
    const inicio = total ? (this.page - 1) * this.size + 1 : 0;
    const fin = Math.min(this.page * this.size, total);
    const opciones = [5, 10, 20].map(n => `<option ${n === this.size ? "selected" : ""}>${n}</option>`).join("");
    return `<span>Mostrando ${inicio}–${fin} de ${total} ${e(this.config.label || "registros")}</span>
      <div class="row">
        <label>Filas <select data-page-size aria-label="Filas por página">${opciones}</select></label>
        <button class="icon-btn" data-page="-1" aria-label="Página anterior" ${this.page === 1 ? "disabled" : ""}>${icon("chevron-left")}</button>
        <span class="numeric" data-table-page tabindex="-1">${this.page} de ${paginas}</span>
        <button class="icon-btn" data-page="1" aria-label="Página siguiente" ${this.page === paginas ? "disabled" : ""}>${icon("chevron-right")}</button>
      </div>`;
  }

  notify() {
    this.config.onSelection?.([...this.selected]);
  }
  change(event) {
    const t = event.target;
    if (t.matches("[data-column]")) {
      t.checked
        ? this.hidden.delete(t.dataset.column)
        : this.hidden.add(t.dataset.column);
      this.draw();
    }
    if (t.matches("[data-filter]")) {
      this.filters[t.dataset.filter] = t.value;
      this.page = 1;
      this.selected.clear();
      this.notify();
      this.draw();
    }
    if (t.matches("[data-page-size]")) {
      this.size = Number(t.value);
      this.page = 1;
      this.draw();
    }
    if (t.matches("[data-select-row]")) {
      t.checked
        ? this.selected.add(t.dataset.selectRow)
        : this.selected.delete(t.dataset.selectRow);
      this.draw();
      this.notify();
    }
    if (t.matches("[data-select-page]")) {
      this.visibleRows.forEach((v) =>
        t.checked ? this.selected.add(String(v.id)) : this.selected.delete(String(v.id)),
      );
      this.draw();
      this.notify();
    }
  }
  click(event) {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.sort) {
      this.direction = this.sortKey === b.dataset.sort ? -this.direction : 1;
      this.sortKey = b.dataset.sort;
      this.page = 1;
      this.draw();
    }
    if (b.dataset.page) {
      this.page += Number(b.dataset.page);
      this.draw();
    }
    if (b.dataset.rowAction) {
      const fila = this.visibleRows.find(row => String(row.id) === b.dataset.id);
      if (fila) this.config.onAction?.(b.dataset.rowAction, fila);
    }
  }
}
document.addEventListener("click", (event) =>
  document.querySelectorAll("details.columns[open]").forEach((d) => {
    if (!d.contains(event.target)) d.open = false;
  }),
);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape")
    document.querySelectorAll("details.columns[open]").forEach((d) => {
      d.open = false;
      d.querySelector("summary").focus();
    });
});
