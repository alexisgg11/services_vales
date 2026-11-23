import { useState, type ReactNode } from "react";
import {
  CircleCheck,
  CircleOff,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { Field, Search } from "@/components/formularios/campos";
import { useRefresh } from "@/lib/consultas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Cuenta, Rol } from "@/lib/types";
import {
  AvisoAdministracion,
  DialogoAdministracion,
  TablaAdministracion,
} from "./administracion-ui";
import { campo, type AdminDatos, type Usuario } from "./administracion-datos";

type AccionCuenta =
  { tipo: "crear" } | { tipo: "clave" | "roles" | "estado"; id: number };

const requiereZonal = (rol: string) =>
  ["OPERATIVO", "JEFE", "GRIFO"].includes(rol);
const urlUsuarios = "/api/administracion/usuarios";

function leerRol(formulario: FormData) {
  const codigo = campo(formulario, "rol");
  return {
    codigo,
    zonal: requiereZonal(codigo) ? campo(formulario, "zonal") : null,
    grifo: codigo === "GRIFO" ? campo(formulario, "grifo") : null,
    otorgar: true,
  };
}

export default function Accesos({
  datos,
  cuenta,
}: {
  datos: AdminDatos;
  cuenta: Cuenta;
}) {
  const refrescar = useRefresh();
  const [busqueda, buscar] = useState("");
  const [accion, abrir] = useState<AccionCuenta>();
  const [mensaje, avisar] = useState("");
  const usuario =
    accion && accion.tipo !== "crear"
      ? datos.cuentas.find(({ id }) => id === accion.id)
      : undefined;
  const buscarCuenta = busqueda.trim().toLocaleLowerCase("es-PE");
  const visibles = datos.cuentas.filter((u) =>
    [u.login, u.nombre]
      .join(" ")
      .toLocaleLowerCase("es-PE")
      .includes(buscarCuenta),
  );
  const nombreRol = (codigo: string) =>
    datos.roles.find((rol) => rol.codigo === codigo)?.descripcion ?? codigo;
  const ambitoRol = (rol: Rol) => {
    if (rol.cod_proveedor)
      return (
        cuenta.proveedores.find((p) => p.cod_proveedor === rol.cod_proveedor)
          ?.razon_social ?? rol.cod_proveedor
      );
    if (rol.cod_zonal)
      return (
        cuenta.zonales.find((z) => z.id_zona === rol.cod_zonal)?.nom_zona ??
        rol.cod_zonal
      );
    return "Empresa";
  };
  const cerrar = () => abrir(undefined);

  async function guardar(url: string, cuerpo: unknown, mensaje: string) {
    await api(url, cuerpo);
    await refrescar(["administracion"], ["contexto"]);
    avisar(mensaje);
  }

  return (
    <section className="admin-seccion" aria-labelledby="admin-cuentas-titulo">
      <div className="admin-cabecera">
        <h2 id="admin-cuentas-titulo">Cuentas de acceso</h2>
        <div className="admin-herramientas">
          <Search
            value={busqueda}
            onChange={buscar}
            placeholder="Nombre o usuario"
          />
          <Button
            onClick={() => abrir({ tipo: "crear" })}
            disabled={!datos.trabajadores.length}
          >
            <Plus /> Crear cuenta
          </Button>
        </div>
      </div>
      <AvisoAdministracion mensaje={mensaje} />
      {!datos.trabajadores.length && (
        <p className="admin-ayuda">No hay trabajadores activos sin cuenta.</p>
      )}
      <TablaAdministracion
        key={buscarCuenta}
        titulo="Cuentas de acceso"
        filas={visibles}
        clave={(u) => u.id}
        vacio={
          buscarCuenta
            ? "No se encontraron cuentas."
            : "Todavía no hay cuentas."
        }
        columnas={[
          {
            titulo: "Persona",
            mostrar: (u) => (
              <>
                <strong>{u.nombre}</strong>
                <small>{u.login}</small>
              </>
            ),
          },
          {
            titulo: "Roles",
            mostrar: (u) =>
              u.roles.length ? (
                <ul className="admin-roles">
                  {u.roles.map((rol) => (
                    <li key={rol.codigo_rol}>
                      {nombreRol(rol.codigo_rol)}
                      <small>{ambitoRol(rol)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                "Sin roles"
              ),
          },
          {
            titulo: "Estado",
            mostrar: (u) => (
              <Badge
                variant="outline"
                className="admin-estado"
                data-activa={u.activo}
              >
                {u.activo ? "Activa" : "Inactiva"}
              </Badge>
            ),
          },
        ]}
        acciones={(u) => (
          <>
            <AccionAcceso
              etiqueta={"Cambiar contraseña de " + u.nombre}
              onClick={() => abrir({ tipo: "clave", id: u.id })}
            >
              <KeyRound />
            </AccionAcceso>
            <AccionAcceso
              etiqueta={"Gestionar roles de " + u.nombre}
              onClick={() => abrir({ tipo: "roles", id: u.id })}
            >
              <Shield />
            </AccionAcceso>
            <AccionAcceso
              etiqueta={
                (u.activo ? "Desactivar cuenta de " : "Activar cuenta de ") +
                u.nombre
              }
              onClick={() => abrir({ tipo: "estado", id: u.id })}
              disabled={u.id === cuenta.actor && u.activo}
            >
              {u.activo ? <CircleOff /> : <CircleCheck />}
            </AccionAcceso>
          </>
        )}
      />
      {accion?.tipo === "crear" && (
        <DialogoAdministracion
          titulo="Crear cuenta"
          etiqueta="Crear cuenta"
          cerrar={cerrar}
          guardar={(f) =>
            guardar(
              urlUsuarios,
              {
                login: campo(f, "login").trim(),
                trabajador: Number(campo(f, "trabajador")),
                clave: campo(f, "clave"),
                activo: f.has("activa"),
                rol: leerRol(f),
              },
              "Cuenta creada.",
            )
          }
        >
          <div className="admin-campos">
            <Field label="Trabajador">
              <select name="trabajador" defaultValue="" required>
                <option value="">Seleccionar trabajador</option>
                {datos.trabajadores.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} — {t.dni}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Usuario">
              <Input
                name="login"
                placeholder="Escribe el usuario"
                required
                minLength={3}
                maxLength={80}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <ClaveAcceso label="Contraseña" />
            <CamposRol
              roles={datos.roles}
              cuenta={cuenta}
              etiqueta="Rol inicial"
            />
            <label className="admin-checkbox">
              <input name="activa" type="checkbox" defaultChecked /> Cuenta
              activa
            </label>
          </div>
        </DialogoAdministracion>
      )}
      {accion?.tipo === "clave" && usuario && (
        <DialogoAdministracion
          titulo="Cambiar contraseña"
          descripcion={usuario.nombre + " (" + usuario.login + ")"}
          etiqueta="Guardar contraseña"
          cerrar={cerrar}
          guardar={(f) =>
            guardar(
              urlUsuarios + "/" + usuario.id,
              { clave: campo(f, "clave") },
              "Contraseña actualizada.",
            )
          }
        >
          <ClaveAcceso label="Nueva contraseña" />
        </DialogoAdministracion>
      )}
      {accion?.tipo === "roles" && usuario && (
        <RolesCuenta
          usuario={usuario}
          cuenta={cuenta}
          roles={datos.roles}
          nombreRol={nombreRol}
          ambitoRol={ambitoRol}
          guardar={(cuerpo, aviso) =>
            guardar(urlUsuarios + "/" + usuario.id + "/roles", cuerpo, aviso)
          }
          cerrar={cerrar}
        />
      )}
      {accion?.tipo === "estado" && usuario && (
        <DialogoAdministracion
          titulo={usuario.activo ? "Desactivar cuenta" : "Activar cuenta"}
          descripcion={usuario.nombre + " (" + usuario.login + ")"}
          etiqueta={usuario.activo ? "Desactivar cuenta" : "Activar cuenta"}
          destructivo={usuario.activo}
          cerrar={cerrar}
          guardar={() =>
            guardar(
              urlUsuarios + "/" + usuario.id,
              { activo: !usuario.activo },
              usuario.activo ? "Cuenta desactivada." : "Cuenta activada.",
            )
          }
        />
      )}
    </section>
  );
}

function AccionAcceso({
  etiqueta,
  children,
  onClick,
  disabled,
}: {
  etiqueta: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function ClaveAcceso({ label }: { label: string }) {
  const [visible, mostrar] = useState(false);
  const etiqueta = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <Field label={label} hint="Mínimo 8 caracteres.">
      <div className="admin-clave">
        <Input
          name="clave"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Escribe la contraseña"
          required
          minLength={8}
        />
        <AccionAcceso etiqueta={etiqueta} onClick={() => mostrar(!visible)}>
          {visible ? <EyeOff /> : <Eye />}
        </AccionAcceso>
      </div>
    </Field>
  );
}

function CamposRol({
  roles,
  cuenta,
  asignados = [],
  etiqueta = "Rol",
}: {
  roles: AdminDatos["roles"];
  cuenta: Cuenta;
  asignados?: Rol[];
  etiqueta?: string;
}) {
  const [rol, elegir] = useState("");
  const actual = asignados.find((r) => r.codigo_rol === rol);

  return (
    <>
      <Field label={etiqueta}>
        <select
          name="rol"
          required
          value={rol}
          onChange={(e) => elegir(e.target.value)}
        >
          <option value="">Seleccionar rol</option>
          {roles.map((r) => (
            <option key={r.codigo} value={r.codigo}>
              {r.descripcion}
            </option>
          ))}
        </select>
      </Field>
      {requiereZonal(rol) && (
        <Field key={rol + "-zonal"} label="Zonal">
          <select name="zonal" required defaultValue={actual?.cod_zonal ?? ""}>
            <option value="">Seleccionar zonal</option>
            {cuenta.zonales.map((z) => (
              <option key={z.id_zona} value={z.id_zona}>
                {z.nom_zona}
              </option>
            ))}
          </select>
        </Field>
      )}
      {rol === "GRIFO" && (
        <Field label="Grifo">
          <select
            name="grifo"
            required
            defaultValue={actual?.cod_proveedor ?? ""}
          >
            <option value="">Seleccionar grifo</option>
            {cuenta.proveedores.map((p) => (
              <option key={p.cod_proveedor} value={p.cod_proveedor}>
                {p.razon_social}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

function RolesCuenta({
  usuario,
  cuenta,
  roles,
  nombreRol,
  ambitoRol,
  guardar,
  cerrar,
}: {
  usuario: Usuario;
  cuenta: Cuenta;
  roles: AdminDatos["roles"];
  nombreRol: (codigo: string) => string;
  ambitoRol: (rol: Rol) => string;
  guardar: (cuerpo: unknown, aviso: string) => Promise<void>;
  cerrar: () => void;
}) {
  const [retiro, retirar] = useState<Rol>();

  return (
    <DialogoAdministracion
      titulo={retiro ? "Quitar rol" : "Gestionar roles"}
      descripcion={usuario.nombre + " (" + usuario.login + ")"}
      etiqueta={retiro ? "Quitar rol" : "Guardar rol"}
      destructivo={!!retiro}
      cerrar={cerrar}
      guardar={(f) =>
        retiro
          ? guardar(
              {
                codigo: retiro.codigo_rol,
                zonal: retiro.cod_zonal,
                grifo: retiro.cod_proveedor,
                otorgar: false,
              },
              "Rol retirado.",
            )
          : guardar(leerRol(f), "Rol actualizado.")
      }
    >
      {retiro ? (
        <p>Se retirará el rol {nombreRol(retiro.codigo_rol)} de esta cuenta.</p>
      ) : (
        <div className="admin-campos">
          {usuario.roles.length > 0 && (
            <ul
              className="admin-roles admin-roles-editor"
              aria-label="Roles asignados"
            >
              {usuario.roles.map((rol) => (
                <li key={rol.codigo_rol}>
                  <div>
                    {nombreRol(rol.codigo_rol)}
                    <small>{ambitoRol(rol)}</small>
                  </div>
                  <AccionAcceso
                    etiqueta={"Quitar rol " + nombreRol(rol.codigo_rol)}
                    onClick={() => retirar(rol)}
                    disabled={
                      usuario.id === cuenta.actor && rol.codigo_rol === "ADMIN"
                    }
                  >
                    <Trash2 />
                  </AccionAcceso>
                </li>
              ))}
            </ul>
          )}
          <CamposRol roles={roles} cuenta={cuenta} asignados={usuario.roles} />
        </div>
      )}
    </DialogoAdministracion>
  );
}
