import registro from "../features/vales/registro.js";
import autorizacion from "../features/vales/autorizar.js";
import anulacion from "../features/vales/anular.js";
import atencion from "../features/atencion/pagina.js";
import facturas from "../features/facturas/pagina.js";
import documentos from "../features/documentos/pagina.js";
import gastos from "../features/gastos/pagina.js";
import administracion from "../features/administracion/pagina.js";
import { servicios } from "./servicios.js";

export const rutas = { registro, autorizacion, anulacion, atencion, facturas, documentos, gastos, administracion };
export const tituloRuta = ruta => servicios.find(servicio => servicio.id === ruta)?.label || "Administración";
