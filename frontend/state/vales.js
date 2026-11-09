import { mapearVale } from "../model/vale.js";

let porId = new Map();

export function reemplazarVales(documentos) {
  const anteriores = porId;
  porId = new Map(documentos.map(documento => {
    const nuevo = mapearVale(documento);
    return [nuevo.id, Object.assign(anteriores.get(nuevo.id) || {}, nuevo)];
  }));
}

export function actualizarVale(vale) {
  const actual = Object.assign(porId.get(vale.id) || {}, vale);
  porId.set(vale.id, actual);
  return actual;
}

export const vales = {
  all: () => [...porId.values()],
  get: id => porId.get(id),
};
