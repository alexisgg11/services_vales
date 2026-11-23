type Almacenamiento = "localStorage" | "sessionStorage";

export const prefijoBorrador = "vales-borrador-";

export function leerGuardado(almacen: Almacenamiento, clave: string) {
  try {
    return window[almacen].getItem(clave);
  } catch {
    return null;
  }
}

export function guardarValor(
  almacen: Almacenamiento,
  clave: string,
  valor: string | null,
) {
  try {
    if (valor === null) window[almacen].removeItem(clave);
    else window[almacen].setItem(clave, valor);
  } catch {
    // El formulario sigue funcionando si el navegador bloquea el almacenamiento.
  }
}

export function leerPreferencia<T extends string>(
  clave: string,
  opciones: readonly T[],
  inicial: T,
) {
  const valor = leerGuardado("localStorage", clave);
  return opciones.find((opcion) => opcion === valor) ?? inicial;
}

export function limpiarBorradores() {
  try {
    const sesion = window.sessionStorage;
    for (const clave of Object.keys(sesion)) {
      if (clave.startsWith(prefijoBorrador)) sesion.removeItem(clave);
    }
  } catch {
    // El acceso a sessionStorage puede estar deshabilitado.
  }
}
