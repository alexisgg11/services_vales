import { lazy } from "react";
import {
  Ticket,
  CheckCircle2,
  ScanLine,
  Receipt,
  Ban,
  FileText,
  ChartColumn,
} from "lucide-react";

export const Registrar = lazy(() => import("@/features/emision/RegistrarVale")),
  Autorizar = lazy(() => import("@/features/autorizacion/AutorizarVales")),
  Atender = lazy(() => import("@/features/atencion/RegistrarAtencion")),
  Facturas = lazy(() => import("@/features/facturacion/Facturas")),
  Anular = lazy(() => import("@/features/anulacion/AnularVale")),
  Documentos = lazy(() => import("@/features/documentos/Documentos")),
  Gastos = lazy(() => import("@/features/gastos/Gastos")),
  Configuracion = lazy(() => import("@/features/configuracion/Configuracion"));
export const services = [
  { id: "emision", name: "Registrar vale", icon: Ticket, roles: ["OPERATIVO"] },
  {
    id: "autorizacion",
    name: "Autorizar vales",
    icon: CheckCircle2,
    roles: ["JEFE"],
  },
  {
    id: "atencion",
    name: "Registrar atención",
    icon: ScanLine,
    roles: ["GRIFO"],
  },
  {
    id: "facturacion",
    name: "Asociar factura",
    icon: Receipt,
    roles: ["CONTABILIDAD", "GRIFO"],
  },
  { id: "anulacion", name: "Anular vale", icon: Ban, roles: ["OPERATIVO"] },
  {
    id: "documentos",
    name: "PDF del vale",
    icon: FileText,
    roles: ["OPERATIVO", "JEFE", "GRIFO", "CONTABILIDAD", "ADMIN"],
  },
  {
    id: "gastos",
    name: "Consultar gastos",
    icon: ChartColumn,
    roles: ["CONTABILIDAD"],
  },
];
export const roleNames: Record<string, string> = {
  OPERATIVO: "Operativo",
  JEFE: "Jefatura",
  GRIFO: "Atención",
  CONTABILIDAD: "Contabilidad",
  ADMIN: "Administrador",
};
