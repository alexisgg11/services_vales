import * as api from "../api/vales-api.js";
import { ErrorHttp } from "../api/cliente-http.js";
import { aDecimal, centesimos } from "../model/valores.js";
import { mapearVale } from "../model/vale.js";
import { actualizarVale, vales } from "../state/vales.js";
import { permisos } from "../state/permisos.js";
import { enOrden } from "./sesion.js";

function completarFicha(documento, anterior) {
  const vale = mapearVale(documento);
  if (anterior) {
    vale.id = anterior.id;
    vale.worker = anterior.worker;
    vale.workerDocument = anterior.workerDocument;
    if (anterior.invoice === vale.invoice) vale.invoiceNumber = anterior.invoiceNumber;
  }
  return vale;
}

export function consultarValePorQr(uuid) {
  return enOrden(async () => {
    try {
      const { vale } = await api.consultarQr(uuid);
      const anterior = vales.all().find(documento => documento.id_qr === uuid);
      const nuevo = completarFicha(vale, anterior);
      // El ámbito de despacho puede ser más estrecho que el de consulta de la cuenta.
      if (!permisos.visibleForAttention(nuevo)) return undefined;
      return actualizarVale(nuevo);
    } catch (error) {
      if (error instanceof ErrorHttp && error.status === 404) return undefined;
      throw error;
    }
  });
}

export async function sugerirPrecio(vale, fecha) {
  const resultado = await api.sugerirPrecio(vale.id_qr, fecha);
  return { price: centesimos(resultado.precio), source: resultado.fuente };
}

export function registrarAtencion(vale, datos) {
  return enOrden(async () => {
    const respuesta = await api.registrarAtencion(vale.id_qr, {
      fecha: datos.consumption, cantidad: aDecimal(datos.consumed), precio: aDecimal(datos.real),
      precioConfirmado: aDecimal(datos.confirmedPrice), dniPresentado: datos.dniPresentado,
      identidadVerificada: datos.identidadVerificada,
    });
    return actualizarVale(completarFicha(respuesta.vale, vales.get(vale.id) ?? vale));
  });
}
