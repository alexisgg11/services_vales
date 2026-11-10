import * as ui from "../../components/controles.js";
import { confirm, sheet } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";
import { DataTable } from "../../components/tabla.js";
import * as administracion from "../../api/administracion-api.js";
import { mostrarPreciosContrato } from "./precios-contrato.js";
import { mostrarUnidades } from "./unidades.js";

export default function mostrarAdministracion() {
  ui.page("Administración", `<div class="row" aria-label="Secciones de administración">
    ${ui.button("Tarifas", { attrs: 'data-admin-tab="tarifas"' })}
    ${ui.button("Precios de contrato", { attrs: 'data-admin-tab="contratos"' })}
    ${ui.button("Unidades móviles", { attrs: 'data-admin-tab="unidades"' })}
    ${ui.button("Usuarios y acceso", { attrs: 'data-admin-tab="usuarios"' })}
  </div><div id="admin-panel"><p role="status">Cargando administración…</p></div>`);
  const panel = document.getElementById("admin-panel");
  const tabs = [...document.querySelectorAll("[data-admin-tab]")];
  let current = "tarifas", data;
  const empty = { id: "", name: "Seleccionar" };
  const select = (name, options, value = "") => ui.select(name, [empty, ...options], value, "required");
  const nameOfRole = (code) => data.roles.find(role => role.codigo === code)?.descripcion || code;
  const nameOfZone = (id) => data.zonales.find(zone => zone.id_zona === id)?.nom_zona || id;

  function openForm(title, fields, save, submitLabel = "Guardar", extra = "") {
    const modal = sheet({
      title, centered: true,
      content: `<form id="admin-form"><div class="form-grid">${fields}</div></form>`,
      footer: ui.button("Volver", { attrs: "data-close" }) + extra +
        ui.button(submitLabel, { type: "submit", variant: "primary", attrs: 'form="admin-form"' }),
    });
    const form = modal.root.querySelector("form");
    const actions = [...modal.root.querySelectorAll('[form="admin-form"]')];
    let saving = false;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      const initiallyDisabled = actions.map(action => action.disabled);
      actions.forEach(action => action.disabled = true);
      try {
        const message = await save(form, event.submitter);
        if (!message) return;
        modal.close();
        await load();
        ui.toast(message);
      } catch (error) {
        if (form.isConnected) ui.error(form, error.message);
        else if (panel.isConnected) ui.toast(error.message);
      } finally {
        saving = false;
        actions.forEach((action, index) => action.disabled = initiallyDisabled[index]);
      }
    });
    return form;
  }

  const roleFields = () =>
    ui.field("Rol", select("rol", data.roles.map(r => ({ id: r.codigo, name: r.descripcion }))), { name: "rol", wide: true }) +
    `<div data-admin-scope="zonal" hidden>${ui.field("Zonal", select("zonal", data.zonales.map(z => ({ id: z.id_zona, name: z.nom_zona }))), { name: "zonal" })}</div>` +
    `<div data-admin-scope="grifo" hidden>${ui.field("Grifo", select("grifo", catalogos.providers), { name: "grifo" })}</div>`;
  function bindRole(form, roles = []) {
    const fields = form.elements;
    const update = () => {
      const role = fields.rol.value, entry = roles.find(r => r.codigo_rol === role);
      const needs = { zonal: ["OPERATIVO", "JEFE", "GRIFO"].includes(role), grifo: role === "GRIFO" };
      for (const [key, required] of Object.entries(needs)) {
        fields[key].disabled = !required;
        fields[key].required = required;
        form.querySelector(`[data-admin-scope="${key}"]`).hidden = !required;
      }
      fields.zonal.value = entry?.cod_zonal || "";
      fields.grifo.value = entry?.cod_proveedor || "";
      const remove = form.closest("dialog").querySelector("[data-remove-role]");
      if (remove) remove.disabled = !entry;
    };
    fields.rol.addEventListener("change", update);
    update();
  }
  const roleData = (fields, otorgar = true) => ({
    codigo: fields.rol.value,
    zonal: otorgar && !fields.zonal.disabled ? fields.zonal.value : null,
    grifo: otorgar && !fields.grifo.disabled ? fields.grifo.value : null,
    otorgar,
  });

  function cuenta(user) {
    const creating = !user;
    const fields = creating
      ? ui.field("Trabajador", select("trabajador", data.trabajadores.map(t => ({ id: t.id, name: t.nombre + " (" + t.dni + ")" }))), { name: "trabajador", wide: true }) +
        ui.field("Usuario", ui.input("login", "text", "", 'required minlength="3" maxlength="80" autocomplete="off"'), { name: "login" })
      : ui.field("Usuario", ui.input("login", "text", user.login, "readonly"), { name: "login" });
    const form = openForm(creating ? "Nueva cuenta" : "Editar acceso", fields +
      ui.field(creating ? "Contraseña" : "Nueva contraseña (opcional)",
        ui.input("clave", "password", "", `minlength="8" maxlength="72" autocomplete="new-password" ${creating ? "required" : ""}`), { name: "clave" }) +
      `<label class="wide"><input type="checkbox" name="activo" ${creating || user.activo ? "checked" : ""}> Cuenta activa</label>` +
      (creating ? roleFields() : ""), async form => {
        const f = form.elements;
        const datos = {
          login: f.login.value.trim(), trabajador: creating ? Number(f.trabajador.value) : null,
          clave: f.clave.value, activo: f.activo.checked, rol: creating ? roleData(f) : null,
        };
        if (creating) await administracion.crearCuenta(datos);
        else await administracion.editarCuenta(user.id, datos);
        return creating ? "Cuenta creada." : "Acceso actualizado.";
      });
    if (creating) bindRole(form);
  }

  function roles(user) {
    const form = openForm("Roles de " + user.login, roleFields(), async (form, submitter) => {
      const otorgar = !submitter?.hasAttribute("data-remove-role");
      if (!otorgar && !(await confirm({ title: "Quitar rol", message: "La cuenta perderá los permisos de este rol.",
        label: "Quitar rol", danger: true }))) return;
      await administracion.guardarRol(user.id, roleData(form.elements, otorgar));
      return otorgar ? "Rol actualizado." : "Rol retirado.";
    }, "Guardar rol", ui.button("Quitar rol", { type: "submit", attrs: 'form="admin-form" formnovalidate data-remove-role' }));
    bindRole(form, user.roles);
  }

  function tarifa() {
    openForm("Nueva tarifa",
      ui.field("Grifo", select("grifo", catalogos.providers), { name: "grifo", wide: true }) +
      ui.field("Combustible", select("suministro", catalogos.supplies), { name: "suministro", wide: true }) +
      ui.field("Vigente desde", ui.input("desde", "date", formato.today, "required"), { name: "desde" }) +
      ui.field("Precio por galón (S/)", ui.input("precio", "number", "", 'required min="0.01" step="0.01"'), { name: "precio" }),
      async form => {
        const f = form.elements;
        await administracion.registrarTarifa({ grifo: f.grifo.value, suministro: f.suministro.value,
          desde: f.desde.value, precio: f.precio.value });
        return "Tarifa registrada.";
      }, "Registrar tarifa");
  }

  function draw() {
    tabs.forEach(tab => {
      const selected = tab.dataset.adminTab === current;
      tab.classList.toggle("btn--primary", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    if (current === "contratos") {
      mostrarPreciosContrato(panel);
      return;
    }
    if (current === "unidades") {
      mostrarUnidades(panel, data.zonales, openForm);
      return;
    }
    const users = current === "usuarios";
    panel.innerHTML = `<div class="page-heading"><h2>${users ? "Usuarios y acceso" : "Tarifas por grifo y combustible"}</h2>
      ${ui.button(users ? "Nueva cuenta" : "Nueva tarifa", { id: "admin-new", icon: "plus", variant: "primary",
        disabled: users && !data.trabajadores.length })}</div><div id="admin-table"></div>`;
    panel.querySelector("#admin-new").addEventListener("click", users ? () => cuenta() : tarifa);
    new DataTable(panel.querySelector("#admin-table"), users ? {
      rows: data.cuentas.map(u => ({ ...u, id: String(u.id) })), label: "cuentas", sortKey: "login",
      searchLabel: "Buscar por usuario, nombre o rol",
      searchValues: usuario => usuario.roles.map(rol => nameOfRole(rol.codigo_rol)),
      columns: [
        { key: "login", label: "Usuario", identity: true },
        { key: "nombre", label: "Trabajador" },
        { key: "roles", label: "Roles y ámbito", value: user => user.roles.map(r => nameOfRole(r.codigo_rol)).join(", "),
          render: user => user.roles.length ? user.roles.map(r =>
            `<span class="detail-value">${formato.escape(nameOfRole(r.codigo_rol))}</span>${r.cod_zonal
              ? `<small class="table-provider">${formato.escape(nameOfZone(r.cod_zonal))}</small>` : ""}${r.cod_proveedor
              ? `<small class="table-provider">${formato.escape(catalogos.provider(r.cod_proveedor)?.name)}</small>` : ""}`).join("") : "Sin roles" },
        { key: "activo", label: "Estado", value: u => u.activo ? "Activa" : "Inactiva" },
        { key: "actions", label: "Acciones", sortable: false, render: user =>
          ui.iconAction("Editar acceso de " + user.login, "pencil", `data-row-action="editar" data-id="${formato.escape(user.id)}"`) +
          ui.iconAction("Gestionar roles de " + user.login, "shield-check", `data-row-action="roles" data-id="${formato.escape(user.id)}"`) },
      ],
      onAction: (action, user) => action === "roles" ? roles(user) : cuenta(user),
    } : {
      rows: data.tarifas.map(a => ({ ...a, id: a.cod_proveedor + a.id_suministro + a.vigente_desde })),
      label: "tarifas", sortKey: "vigente_desde",
      searchLabel: "Buscar por grifo o combustible",
      searchValues: tarifa => [catalogos.provider(tarifa.cod_proveedor)?.name, catalogos.supply(tarifa.id_suministro)?.name],
      columns: [
        { key: "proveedor", label: "Grifo", identity: true, value: a => catalogos.provider(a.cod_proveedor)?.name },
        { key: "suministro", label: "Combustible", value: a => catalogos.supply(a.id_suministro)?.name },
        { key: "vigente_desde", label: "Vigente desde", render: a => formato.date(a.vigente_desde) },
        { key: "precio", label: "Precio por galón", numeric: true, render: a => formato.money(formato.scaled(a.precio)) },
      ],
    });
    ui.icons();
  }

  async function load() {
    data = await administracion.consultarAdministracion();
    if (panel.isConnected) draw();
  }
  tabs.forEach(tab => tab.addEventListener("click", () => {
    current = tab.dataset.adminTab;
    if (data) draw();
  }));
  load().catch(error => {
    if (panel.isConnected) panel.innerHTML = `<p role="alert">${formato.escape(error.message)}</p>`;
  });
}
