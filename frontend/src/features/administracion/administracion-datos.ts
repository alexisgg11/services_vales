import type { Rol } from "@/lib/types";

export interface Usuario {
  id: number;
  login: string;
  activo: boolean;
  nombre: string;
  roles: Rol[];
}

export interface Tarifa {
  cod_proveedor: string;
  id_suministro: string;
  vigente_desde: string;
  precio: number;
}

export interface AdminDatos {
  cuentas: Usuario[];
  trabajadores: { id: number; nombre: string; dni: string }[];
  roles: { codigo: string; descripcion: string }[];
  tarifas: Tarifa[];
}

export function campo(formulario: FormData, nombre: string) {
  return String(formulario.get(nombre) ?? "");
}
