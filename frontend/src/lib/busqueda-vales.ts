import type { Vale } from "./types";

export function matches(v: Vale, q: string) {
  return [v.codigo_vale, v.trabajador, v.ticket, v.zonal, v.placa]
    .join(" ")
    .toLowerCase()
    .includes(q.trim().toLowerCase());
}
