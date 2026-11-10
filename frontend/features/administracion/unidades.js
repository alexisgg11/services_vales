import * as ui from "../../components/controles.js";
import { DataTable } from "../../components/tabla.js";
import formato from "../../shared/formato.js";
import { asignarZonalUnidad, habilitarUnidad, listarUnidades } from "../../api/administracion-api.js";

export function mostrarUnidades(panel, zonales, openForm) {
  panel.innerHTML = `<div class="stack">
    <div class="page-heading"><h2>Unidades móviles</h2></div>
    <div data-units><p role="status">Cargando unidades…</p></div>
    <section><h3>Habilitaciones por trabajo</h3><div data-unit-authorizations></div></section>
  </div>`;
  const lista = panel.querySelector("[data-units]");
  const habilitaciones = panel.querySelector("[data-unit-authorizations]");
  const nombreZonal = codigo => zonales.find(z => z.id_zona === codigo)?.nom_zona || "Sin zonal base";
  const opcionesZonal = zonales.map(z => ({ id: z.id_zona, name: z.nom_zona }));
  const select = (name, options, value = "") =>
    ui.select(name, [{ id: "", name: "Seleccionar" }, ...options], value, "required");

  function editarZonal(unidad) {
    openForm("Zonal base de " + unidad.placa,
      ui.field("Zonal base", select("zonal", opcionesZonal, unidad.cod_zonal || ""), { name: "zonal", wide: true }),
      async form => {
        await asignarZonalUnidad(unidad.codigo, form.elements.zonal.value);
        return "Zonal base actualizada.";
      });
  }

  function autorizar(unidad, centros) {
    openForm("Habilitar " + unidad.placa + " para otra zonal",
      ui.field("Zonal de trabajo", select("zonal", opcionesZonal.filter(z => z.id !== unidad.cod_zonal)), { name: "zonal" }) +
      ui.field("Centro de costo", select("centro", centros), { name: "centro" }) +
      ui.field("Desde", ui.input("desde", "date", formato.today, "required"), { name: "desde" }) +
      ui.field("Hasta", ui.input("hasta", "date", formato.today, "required"), { name: "hasta" }),
      async form => {
        await habilitarUnidad(unidad.codigo, Object.fromEntries(new FormData(form)));
        return "Unidad habilitada para el trabajo.";
      }, "Habilitar");
  }

  listarUnidades().then(({ unidades, centros, habilitaciones: filas }) => {
    if (!lista.isConnected) return;
    const opcionesCentro = centros.map(c => ({ id: c.cod_centro_costo, name: c.descripcion }));
    const unidadesPorCodigo = new Map(unidades.map(u => [u.codigo, u]));
    const centrosPorCodigo = new Map(opcionesCentro.map(c => [c.id, c.name]));
    new DataTable(lista, {
      rows: unidades.map(u => ({ ...u, id: String(u.codigo) })), label: "unidades", sortKey: "placa",
      searchLabel: "Buscar por placa, descripción o zonal",
      columns: [
        { key: "placa", label: "Placa", identity: true },
        { key: "descripcion", label: "Unidad móvil" },
        { key: "zonal", label: "Zonal base", value: u => nombreZonal(u.cod_zonal) },
        { key: "actions", label: "Acciones", sortable: false, render: u =>
          ui.iconAction("Editar zonal base de " + u.placa, "pencil", `data-row-action="base" data-id="${u.id}"`) +
          (u.cod_zonal ? ui.iconAction("Habilitar " + u.placa + " para otra zonal", "clipboard-check",
            `data-row-action="autorizar" data-id="${u.id}"`) : "") },
      ],
      onAction: (accion, unidad) => accion === "base" ? editarZonal(unidad) : autorizar(unidad, opcionesCentro),
    });
    new DataTable(habilitaciones, {
      rows: filas.map(h => ({ ...h, id: [h.codigo_unidad, h.cod_zonal, h.cod_centro_costo, h.desde].join("/") })),
      label: "habilitaciones", sortKey: "desde", searchLabel: "Buscar por placa, zonal o centro",
      columns: [
        { key: "placa", label: "Placa", identity: true, value: h => unidadesPorCodigo.get(h.codigo_unidad)?.placa },
        { key: "zonal", label: "Zonal de trabajo", value: h => nombreZonal(h.cod_zonal) },
        { key: "centro", label: "Centro de costo", value: h => centrosPorCodigo.get(h.cod_centro_costo) },
        { key: "desde", label: "Desde", render: h => formato.date(h.desde) },
        { key: "hasta", label: "Hasta", render: h => formato.date(h.hasta) },
      ],
    });
  }).catch(error => {
    if (lista.isConnected) lista.innerHTML = `<p role="alert">${formato.escape(error.message)}</p>`;
  });
}
