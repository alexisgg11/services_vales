import * as ui from "../../components/controles.js";
import { listarContratosVigentes, registrarPrecioContrato } from "../../api/administracion-api.js";
import { centesimos } from "../../model/valores.js";
import formato from "../../shared/formato.js";
import { catalogos } from "../../state/catalogos.js";

export function mostrarPreciosContrato(panel) {
  const e = formato.escape;
  const seleccionar = (nombre, placeholder, opciones = []) =>
    ui.select(nombre, [{ id: "", name: placeholder }, ...opciones], "", "required");

  panel.innerHTML = `<div class="stack">
    <div class="page-heading"><h2>Precios pactados por contrato</h2></div>
    <div class="panel">
      <form class="panel-body" id="contract-price-form">
        <fieldset class="form-grid contract-price-fields" disabled>
          ${ui.field("Proveedor", seleccionar("proveedor", "Seleccionar proveedor", catalogos.providers), { name: "proveedor" })}
          ${ui.field("Contrato vigente", seleccionar("contrato", "Selecciona un proveedor"), { name: "contrato" })}
          <p class="wide muted" data-contrato-aviso role="status">Cargando contratos vigentes…</p>
          ${ui.field("Combustible", seleccionar("suministro", "Selecciona un contrato"), { name: "suministro" })}
          ${ui.field("Precio pactado por galón (S/)", ui.input("precio", "number", "", 'required min="0.01" max="999999999999.99" step="0.01"'), { name: "precio" })}
          <div class="wide row">${ui.button("Guardar precio", { type: "submit", variant: "primary", disabled: true })}</div>
        </fieldset>
      </form>
    </div>
    <section class="panel" aria-label="Combustibles del contrato" data-precios-pactados hidden>
      <div class="panel-heading"><h3>Combustibles del contrato</h3></div>
      <div class="panel-body" data-precios-lista></div>
    </section>
  </div>`;
  const form = panel.querySelector("form");
  const campos = form.elements;
  const grupo = form.querySelector("fieldset");
  const aviso = form.querySelector("[data-contrato-aviso]");
  const guardar = form.querySelector('button[type="submit"]');
  const precios = panel.querySelector("[data-precios-pactados]");
  const lista = precios.querySelector("[data-precios-lista]");
  let contratos = [];

  const opciones = (campo, placeholder, filas) => campo.replaceChildren(
    new Option(placeholder, ""), ...filas.map(({ id, name }) => new Option(name, id)),
  );
  const contratoElegido = () => contratos.find(c => c.id === campos.contrato.value);

  function actualizarSuministros() {
    const contrato = contratoElegido();
    const pactados = contrato?.precios ?? {};
    const disponibles = catalogos.supplies.filter(({ id }) => !Object.hasOwn(pactados, id));
    const habilitado = !!contrato && disponibles.length > 0;
    opciones(campos.suministro, contrato ? "Seleccionar combustible" : "Selecciona un contrato", contrato ? disponibles : []);
    campos.suministro.disabled = !habilitado;
    campos.precio.disabled = !habilitado;
    campos.precio.value = "";
    guardar.disabled = !habilitado;
    precios.hidden = !contrato;
    if (!contrato) {
      aviso.textContent = !campos.proveedor.value ? "Selecciona el proveedor del contrato."
        : campos.contrato.disabled ? "El proveedor no tiene un contrato vigente."
        : "Selecciona el contrato para ver sus combustibles.";
      return;
    }

    const vigencia = "Vigente del " + formato.date(contrato.inicio) + " al " + formato.date(contrato.fin) + ".";
    aviso.textContent = vigencia + (habilitado ? "" : " Todos los combustibles del catálogo ya tienen precio.");
    const filas = Object.entries(pactados).map(([id, precio]) =>
      `<tr><td>${e(catalogos.supply(id)?.name || id)}</td><td class="numeric">${formato.money(centesimos(precio))}</td></tr>`,
    );
    lista.innerHTML = filas.length
      ? `<table class="data-table" aria-label="Precios pactados"><thead><tr><th scope="col">Combustible</th><th scope="col" class="numeric">Precio por galón</th></tr></thead><tbody>${filas.join("")}</tbody></table>`
      : '<p class="muted">El contrato todavía no tiene combustibles con precio pactado.</p>';
  }

  function actualizarContratos() {
    const vigentes = contratos.filter(c => c.proveedor === campos.proveedor.value);
    opciones(campos.contrato, campos.proveedor.value ? "Seleccionar contrato" : "Selecciona un proveedor",
      vigentes.map(c => ({ id: c.id, name: c.id })));
    campos.contrato.disabled = !vigentes.length;
    if (vigentes.length === 1) campos.contrato.value = vigentes[0].id;
    actualizarSuministros();
  }

  form.addEventListener("change", ({ target }) => {
    form.querySelector(".form-error")?.remove();
    if (target === campos.proveedor) actualizarContratos();
    if (target === campos.contrato) actualizarSuministros();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const contrato = contratoElegido();
    if (grupo.disabled || guardar.disabled || !contrato) return;
    const datos = { proveedor: contrato.proveedor, contrato: contrato.id,
      suministro: campos.suministro.value, precio: campos.precio.value };
    grupo.disabled = true;
    form.querySelector(".form-error")?.remove();
    try {
      await registrarPrecioContrato(datos);
      contrato.precios[datos.suministro] = datos.precio;
      if (form.isConnected) {
        actualizarSuministros();
        ui.toast("Precio pactado guardado.");
      }
    } catch (error) {
      if (form.isConnected) ui.error(form, error.message);
    } finally {
      grupo.disabled = false;
    }
  });
  listarContratosVigentes().then(datos => {
    if (!form.isConnected) return;
    contratos = datos;
    grupo.disabled = false;
    actualizarContratos();
  }).catch(error => {
    if (form.isConnected) aviso.textContent = error.message;
  });
}
