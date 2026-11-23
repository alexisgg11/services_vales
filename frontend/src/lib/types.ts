export interface Rol {
  codigo_rol: string;
  cod_zonal: string | null;
  cod_proveedor: string | null;
}
export interface Evento {
  accion: string;
  nombre: string;
  cargo: string;
  fecha: string;
}
export interface Vale {
  id_vale: string;
  id_qr: string;
  codigo_vale: string;
  cod_zonal: string;
  zonal: string;
  localidad: string;
  cod_proveedor: string;
  grifo: string;
  id_suministro: string;
  suministro: string;
  fecha_emision: string;
  cantidad_emitida: number;
  precio_referencial: number;
  importe_estimado: number;
  estado_vale: number;
  dni_trabajador: string;
  trabajador: string;
  id_trabajador: number;
  registrado_por: number;
  unidad_organizativa: string;
  centro_costo: string;
  cod_centrocosto: string;
  localidad_centro?: string;
  referencia_ubicacion_centro?: string;
  codigo_unidad_movil: number | null;
  placa: string | null;
  zonal_base_unidad?: string;
  nrocontrato: string | null;
  codigo_tercero: number | null;
  documento_tercero: string | null;
  tercero: string | null;
  destino_tercero: string | null;
  observacion: string | null;
  fecha_consumo: string | null;
  cantidad_consumida: number | null;
  precio_real: number | null;
  precio_sugerido: number | null;
  importe: number | null;
  ticket: string | null;
  codigo_factura: string | null;
  factura_numero: string | null;
  responsables: Evento[];
  observacion_anulacion?: string;
  puede_atender?: boolean;
}
export interface Factura {
  codigo_factura: string;
  cod_proveedor: string;
  serie: string;
  numero: string;
  fecha_emision: string;
  total: number;
  tickets: string[];
  asociado_por: number | null;
  numero_completo?: string;
}
export interface Unidad {
  codigo: number;
  placa: string;
  descripcion: string;
  cod_zonal: string;
  habilitaciones: {
    zonal: string;
    centro: string;
    desde: string;
    hasta: string;
  }[];
}
export interface Centro {
  cod_centro_costo: string;
  descripcion: string;
  cod_localidad: string | null;
  ubicacion_referencia?: string;
}
export interface Contrato {
  id: string;
  proveedor: string;
  inicio: string;
  fin: string;
  activo: boolean;
  saldo: number;
  precios: Record<string, number>;
}
export interface Cuenta {
  actor: number;
  nombre: string;
  roles: Rol[];
  trabajador: {
    dni: string;
    zonal: string;
    localidad: string;
    unidad: string;
    centro: string;
  };
  zonales: { id_zona: string; nom_zona: string }[];
  localidades: {
    id_localidad: string;
    id_zona: string;
    nom_localidad: string;
  }[];
  proveedores: { cod_proveedor: string; razon_social: string }[];
  suministros: { id_suministro: string; descripcion: string }[];
  maquinaria: Unidad[];
  unidad: string;
  centros: Centro[];
  contratos: Contrato[];
  tarifas: {
    proveedor: string;
    suministro: string;
    inicio: string;
    precio: number;
  }[];
  facturas: Factura[];
}
export interface Contexto {
  cuenta: Cuenta;
  vales: Vale[];
  publicBaseUrl: string;
  id: string | null;
}
export interface Persona {
  documento: string;
  nombre: string;
  origen: string;
}
export interface Recomendacion {
  proveedor: string;
  nombre: string;
  precio: number;
  combustible: number;
  distanciaKm: number | null;
  traslado: number | null;
  estimado: number;
  latitud: number | null;
  longitud: number | null;
  demostracion: boolean;
  criterio: string;
  recorridoKm?: number;
  minutos?: number;
  minutosAdicionales?: number;
  trazado?: number[][];
}
export interface Coordenadas {
  latitud: number;
  longitud: number;
}
export interface PuntoPartidaRuta extends Coordenadas {
  localidad?: string;
}
export interface ParadaTrabajo extends Coordenadas {
  nombre: string;
  centro: string | null;
  orden?: number;
}
export interface RutaTrabajo {
  id: string;
  nombre: string;
  cod_zonal: string;
  desde: string;
  hasta: string;
  activa: boolean;
  version: number;
  trabajadores: number[];
  origen?: PuntoPartidaRuta | null;
  paradas: ParadaTrabajo[];
}
export interface ContextoRutas {
  rutas: RutaTrabajo[];
  trabajadores: {
    id: number;
    nombre: string;
    zonal: string;
    localidad?: string | null;
  }[];
  centros: {
    codigo: string;
    nombre: string;
    localidad: string | null;
    direccion?: string | null;
    punto?: Coordenadas | null;
  }[];
}
export interface VinculoRuta {
  rutaId: string;
  rutaVersion: number;
  origenRuta?: Coordenadas;
}
