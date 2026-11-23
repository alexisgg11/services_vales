import type { Cuenta, Contrato } from "@/lib/types";
export type Modalidad = "CONTRATO" | "SC_TRABAJADOR" | "SC_TERCERO";
export function condiciones(
  c: Cuenta,
  proveedor: string,
  fecha: string,
  modalidad: Modalidad,
) {
  const contratos = (c.contratos || []).filter(
      (x) => x.proveedor === proveedor,
    ),
    vigentes = contratos.filter(
      (x) => x.activo && x.inicio <= fecha && x.fin >= fecha,
    );
  if (modalidad === "CONTRATO") {
    if (vigentes.length !== 1)
      return { precios: {}, contrato: undefined as Contrato | undefined };
    return { precios: vigentes[0].precios || {}, contrato: vigentes[0] };
  }
  if (
    modalidad === "SC_TRABAJADOR" &&
    (vigentes.length || !contratos.some((x) => x.fin < fecha))
  )
    return { precios: {}, contrato: undefined };
  const precios: Record<string, number> = {};
  for (const t of [...(c.tarifas || [])].sort((a, b) =>
    a.inicio.localeCompare(b.inicio),
  ))
    if (t.proveedor === proveedor && t.inicio <= fecha)
      precios[t.suministro] = Number(t.precio);
  return { precios, contrato: undefined };
}
export function unidades(c: Cuenta, centro: string, fecha: string) {
  return (c.maquinaria || [])
    .filter(
      (u) =>
        u.cod_zonal === c.trabajador.zonal ||
        u.habilitaciones.some(
          (h) =>
            h.zonal === c.trabajador.zonal &&
            h.centro === centro &&
            h.desde <= fecha &&
            h.hasta >= fecha,
        ),
    )
    .sort(
      (a, b) =>
        Number(b.cod_zonal === c.trabajador.zonal) -
          Number(a.cod_zonal === c.trabajador.zonal) ||
        a.placa.localeCompare(b.placa),
    );
}
