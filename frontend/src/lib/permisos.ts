import type { Cuenta, Vale } from "./types";

export function puedeAutorizarVale(
  cuenta: Pick<Cuenta, "actor" | "roles">,
  vale: Pick<Vale, "estado_vale" | "registrado_por" | "cod_zonal">,
) {
  return (
    vale.estado_vale === 0 &&
    vale.registrado_por !== cuenta.actor &&
    cuenta.roles.some(
      (r) => r.codigo_rol === "JEFE" && r.cod_zonal === vale.cod_zonal,
    )
  );
}

export function puedeAnularVale(
  cuenta: Pick<Cuenta, "actor" | "roles">,
  vale: Pick<Vale, "estado_vale" | "registrado_por" | "cod_zonal">,
) {
  return (
    (vale.estado_vale === 0 || vale.estado_vale === 1) &&
    vale.registrado_por === cuenta.actor &&
    cuenta.roles.some(
      (rol) =>
        rol.codigo_rol === "OPERATIVO" && rol.cod_zonal === vale.cod_zonal,
    )
  );
}
