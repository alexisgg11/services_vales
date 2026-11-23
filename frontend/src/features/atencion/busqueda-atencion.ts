import type { Rol, Vale } from "@/lib/types";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const identificador = new RegExp("^" + uuid + "$", "i");
const enlaceVale = new RegExp(
  "^/vales/q/(" + uuid + ")(?:/documento)?/?$",
  "i",
);

export function referenciaQr(texto: string) {
  const valor = texto.trim();
  if (identificador.test(valor)) return valor;
  try {
    const url = new URL(valor, "https://vales.local");
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    return enlaceVale.exec(url.pathname)?.[1];
  } catch {
    return;
  }
}

export function correspondeAlGrifo(vale: Vale, roles: Rol[]) {
  return roles.some(
    (r) =>
      r.codigo_rol === "GRIFO" &&
      r.cod_proveedor === vale.cod_proveedor &&
      r.cod_zonal === vale.cod_zonal,
  );
}

function textoComparable(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function coincideBusqueda(vale: Vale, consulta: string) {
  const datos = [
    vale.codigo_vale,
    vale.trabajador,
    vale.tercero,
    vale.placa,
    vale.ticket,
  ];
  return textoComparable(datos.join(" ")).includes(textoComparable(consulta));
}

export function mensajeEstado(vale: Vale) {
  if (vale.estado_vale === 0) return "El vale está pendiente de autorización.";
  if (vale.estado_vale === 4) return "El vale está anulado.";
  return "El vale ya no está disponible para atención.";
}
