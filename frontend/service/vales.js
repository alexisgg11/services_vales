import * as api from "../api/vales-api.js";
import { catalogos } from "../state/catalogos.js";
import { aplicarContexto, enOrden } from "./sesion.js";
import { aDecimal } from "../model/valores.js";

export function registrarVale(datos) {
  return enOrden(async () => aplicarContexto(await api.registrarVale({
    dni: datos.worker, proveedor: datos.provider, suministro: datos.supply,
    cantidad: aDecimal(datos.quantity), observacion: datos.note, fecha: datos.emission,
    centro: datos.center || null, localidad: catalogos.localityCode(datos.zone, datos.locality),
    unidadMovil: datos.unit ? Number(datos.unit) : null, sinContrato: datos.mode !== "CONTRATO",
    tercero: datos.third || null, destino: datos.destination || null,
  })));
}

export const autorizarVales = ids =>
  enOrden(async () => aplicarContexto(await api.autorizarVales(ids)));

export const anularVale = (id, motivo) =>
  enOrden(async () => aplicarContexto(await api.anularVale(id, motivo)));
