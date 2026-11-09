export const estados = { 0: "Emitido", 1: "Autorizado", 3: "Usado", 4: "Anulado" };

export function elemento(tag, texto, clase) {
  const nodo = document.createElement(tag);
  if (texto != null) nodo.textContent = texto;
  if (clase) nodo.className = clase;
  return nodo;
}

export function etiquetaEstado(codigo) {
  const etiqueta = elemento("span", estados[codigo], "estado");
  etiqueta.dataset.estado = codigo;
  return etiqueta;
}

