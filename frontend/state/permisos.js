const roles = {
  OPERATIVO: ["Operativo", "registro", "anulacion", "documentos"],
  JEFE: ["Jefatura", "autorizacion", "documentos"],
  GRIFO: ["Atención", "atencion", "documentos"],
  CONTABILIDAD: ["Contabilidad", "facturas", "gastos", "documentos"],
  ADMIN: ["Administrador", "documentos", "administracion"],
};
let perfil;
let ambitos = [];

export function cargarPerfil(cuenta) {
  ambitos = cuenta.roles;
  const operativo = ambitos.find(rol => rol.codigo_rol === "OPERATIVO");
  const nombreZonal = codigo => cuenta.zonales?.find(zona => zona.id_zona === codigo)?.nom_zona;
  perfil = {
    name: cuenta.nombre,
    initials: cuenta.nombre.split(" ").slice(0, 2).map(nombre => nombre[0]).join(""),
    roles: ambitos.filter(rol => roles[rol.codigo_rol]).map(rol => ({
      label: roles[rol.codigo_rol][0],
      provider: cuenta.proveedores?.find(grifo => grifo.cod_proveedor === rol.cod_proveedor)?.razon_social,
      zone: nombreZonal(rol.cod_zonal),
    })),
    allow: [...new Set(ambitos.flatMap(rol => roles[rol.codigo_rol]?.slice(1) || []))],
    actor: cuenta.actor,
    worker: operativo ? cuenta.trabajador.dni : "",
    zone: nombreZonal(operativo?.cod_zonal),
  };
}

const dentroDelAmbito = (rol, vale) => ambitos.some(ambito => ambito.codigo_rol === rol &&
  (!ambito.cod_zonal || ambito.cod_zonal === vale.zoneCode) &&
  (!ambito.cod_proveedor || ambito.cod_proveedor === vale.provider));

const can = accion => !!perfil && perfil.allow.includes(accion);
const visibleForAttention = vale => dentroDelAmbito("GRIFO", vale);
const condiciones = {
  documentos: () => true,
  autorizacion: vale => vale.state === 0 && dentroDelAmbito("JEFE", vale) && vale.registeredActor !== perfil.actor,
  anulacion: vale => [0, 1].includes(vale.state) && dentroDelAmbito("OPERATIVO", vale) && vale.registeredActor === perfil.actor,
  atencion: vale => vale.state === 1 && visibleForAttention(vale),
  facturas: vale => vale.state === 3 && !vale.invoice,
};

export const permisos = {
  get current() { return perfil; },
  can,
  visibleForAttention,
  eligible: (accion, vale) => !!vale && can(accion) && (condiciones[accion]?.(vale) ?? false),
};
