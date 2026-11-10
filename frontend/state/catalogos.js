import { centesimos, identificador } from "../model/valores.js";

export const catalogos = {};

export function cargarCatalogos(cuenta, vales, perfil) {
  const ficha = cuenta.trabajador;
  const zonales = cuenta.zonales || [];
  const localidades = cuenta.localidades || [];
  const centros = (cuenta.centros || []).map(c => ({
    id: c.cod_centro_costo, name: c.descripcion,
    locality: localidades.find(l => l.id_localidad === c.cod_localidad)?.nom_localidad,
    locationReference: c.ubicacion_referencia,
  }));
  const nombreZonal = codigo => zonales.find(zonal => zonal.id_zona === codigo)?.nom_zona;
  const trabajadores = new Map(vales.map(v => [v.worker, { id: v.worker, name: v.workerName }]));
  if (perfil.worker) trabajadores.set(ficha.dni, {
    id: ficha.dni, name: cuenta.nombre, zone: nombreZonal(ficha.zonal), center: ficha.centro,
    org: cuenta.unidad, locality: localidades.find(l => l.id_localidad === ficha.localidad)?.nom_localidad,
  });
  const unidades = new Map(vales.filter(v => v.unit).map(v => [v.unit, { id: v.unit, plate: v.plate }]));
  const maquinaria = (cuenta.maquinaria || []).map(unidad => ({
    id: identificador(unidad.codigo), plate: unidad.placa, name: unidad.descripcion,
    zone: unidad.cod_zonal, authorizations: unidad.habilitaciones || [],
  }));
  for (const unidad of maquinaria) unidades.set(unidad.id, unidad);
  const facturas = new Map(vales.filter(v => v.invoice).map(v => [v.invoice, {
    id: v.invoice, provider: v.provider, number: v.invoiceNumber, associated: true,
  }]));
  for (const factura of cuenta.facturas || []) {
    const id = identificador(factura.codigo_factura);
    facturas.set(id, {
      id, provider: factura.cod_proveedor, number: factura.serie + "-" + factura.numero,
      total: centesimos(factura.total), date: factura.fecha_emision,
    });
  }
  Object.assign(catalogos, {
    zones: zonales.map(z => z.nom_zona),
    providers: (cuenta.proveedores || []).map(x => ({ id: x.cod_proveedor, ruc: x.cod_proveedor, name: x.razon_social })),
    supplies: (cuenta.suministros || []).map(x => ({ id: x.id_suministro, name: x.descripcion })),
    workers: [...trabajadores.values()], units: maquinaria, invoices: [...facturas.values()],
    contracts: cuenta.contratos || [], tariffs: cuenta.tarifas || [],
    zoneCode: zona => zonales.find(z => z.nom_zona === zona)?.id_zona,
    zoneName: nombreZonal,
    localities: zona => localidades.filter(l => nombreZonal(l.id_zona) === zona).map(l => l.nom_localidad),
    localityCode: (zona, localidad) => localidades.find(l =>
      l.nom_localidad === localidad && nombreZonal(l.id_zona) === zona)?.id_localidad ?? null,
    centerOptions: () => centros,
    centerName: codigo => centros.find(c => c.id === codigo)?.name,
    centerLocality: codigo => centros.find(c => c.id === codigo)?.locality,
    centerLocationReference: codigo => centros.find(c => c.id === codigo)?.locationReference,
    worker: clave => trabajadores.get(clave),
    unit: clave => unidades.get(clave),
    invoice: clave => facturas.get(clave),
    provider: clave => catalogos.providers.find(x => x.id === clave),
    supply: clave => catalogos.supplies.find(x => x.id === clave),
  });
}
