import { centesimos, identificador } from "./valores.js";

const fechaLima = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" });
const responsable = evento => evento && { name: evento.nombre, role: evento.cargo };
const fechaEvento = evento => evento?.fecha && fechaLima.format(new Date(evento.fecha));

export function mapearVale(datos) {
  const eventos = new Map((datos.responsables || []).map(evento => [evento.accion, evento]));
  const emision = eventos.get("EMISION"), autorizacion = eventos.get("AUTORIZACION"),
    atencion = eventos.get("ATENCION"), factura = eventos.get("FACTURA"), anulacion = eventos.get("ANULACION");
  return {
    id: identificador(datos.id_vale), id_qr: datos.id_qr, code: datos.codigo_vale,
    zoneCode: datos.cod_zonal, zone: datos.zonal, locality: datos.localidad,
    provider: datos.cod_proveedor, providerName: datos.grifo,
    supply: datos.id_suministro, supplyName: datos.suministro,
    worker: datos.dni_trabajador || "t-" + datos.id_trabajador, workerDocument: datos.dni_trabajador || "",
    workerName: datos.trabajador, unit: identificador(datos.codigo_unidad_movil), plate: datos.placa,
    center: datos.centro_costo, org: datos.unidad_organizativa, contract: datos.nrocontrato || "S/C",
    third: datos.tercero, hasThird: datos.codigo_tercero != null, destination: datos.destino_tercero, emission: datos.fecha_emision,
    quantity: centesimos(datos.cantidad_emitida), price: centesimos(datos.precio_referencial),
    state: datos.estado_vale, note: datos.observacion, consumption: datos.fecha_consumo,
    consumed: centesimos(datos.cantidad_consumida), real: centesimos(datos.precio_real),
    suggestedPrice: centesimos(datos.precio_sugerido), priceSource: datos.fuente_precio,
    amount: centesimos(datos.importe), ticket: datos.ticket,
    invoice: identificador(datos.codigo_factura), invoiceNumber: datos.factura_numero,
    registeredActor: datos.registrado_por, registeredBy: responsable(emision), registeredAt: fechaEvento(emision),
    authorizedBy: responsable(autorizacion), authorized: fechaEvento(autorizacion),
    attendedBy: responsable(atencion), attendedAt: fechaEvento(atencion),
    associatedBy: responsable(factura), associatedAt: fechaEvento(factura),
    canceledBy: responsable(anulacion), cancelDate: fechaEvento(anulacion), cancelReason: datos.observacion_anulacion,
  };
}
