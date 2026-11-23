import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus, Route, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorText } from "@/components/ui/feedback";
import { useData } from "@/lib/consultas";
import { InfoPopover } from "@/components/ui/info-popover";
import { api, date } from "@/lib/api";
import type { ContextoRutas, RutaTrabajo } from "@/lib/types";
import { EditorRuta } from "./EditorRuta";
import "./rutas.css";

function VigenciaRuta({ ruta }: { ruta: RutaTrabajo }) {
  return (
    <>
      <time dateTime={ruta.desde}>{date(ruta.desde)}</time>
      {ruta.desde !== ruta.hasta && (
        <>
          {" al "}
          <time dateTime={ruta.hasta}>{date(ruta.hasta)}</time>
        </>
      )}
    </>
  );
}

function EstadoRuta({ activa }: { activa: boolean }) {
  return (
    <Badge variant="outline" className="work-route-state" data-activa={activa}>
      {activa ? "Habilitada" : "Inactiva"}
    </Badge>
  );
}

export default function RutasTrabajo() {
  const cuenta = useData().data!.cuenta;
  const queries = useQueryClient();
  const q = useQuery({
    queryKey: ["rutas-jefatura", cuenta.actor],
    queryFn: () => api<ContextoRutas>("/api/v1/autorizacion/rutas"),
  });
  const [edicion, setEdicion] = useState<RutaTrabajo | null>();
  const rutas = q.data?.rutas ?? [];

  function actualizarRutas() {
    setEdicion(undefined);
    void queries.invalidateQueries({
      queryKey: ["rutas-jefatura", cuenta.actor],
    });
    void queries.invalidateQueries({ queryKey: ["rutas-emision"] });
  }

  return (
    <section className="stack work-routes">
      <div className="row spaced">
        <h2>Rutas de trabajo</h2>
        <div className="row">
          <InfoPopover title="Asignación de rutas">
            <p>
              Jefatura asigna recorridos a los operativos de su zonal. Cada ruta
              tiene fechas y paradas en orden. Los vales conservan la versión
              utilizada.
            </p>
          </InfoPopover>
          <Button onClick={() => setEdicion(null)} disabled={!q.data}>
            <Plus /> Nueva ruta
          </Button>
        </div>
      </div>
      <ErrorText error={q.error} />
      {q.isPending ? (
        <p role="status">Cargando rutas</p>
      ) : rutas.length ? (
        <>
          <ul
            className="work-route-cards"
            aria-label="Rutas de trabajo registradas"
          >
            {rutas.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="work-route-card"
                  aria-label={"Editar ruta " + r.id + ", " + r.nombre}
                  onClick={() => setEdicion(r)}
                >
                  <span className="work-route-card-head">
                    <span className="work-route-number">
                      <Route aria-hidden="true" /> #{r.id}
                    </span>
                    <EstadoRuta activa={r.activa} />
                  </span>
                  <span className="work-route-card-body">
                    <strong>{r.nombre}</strong>
                    <span className="work-route-period">
                      <CalendarDays aria-hidden="true" />
                      <span>
                        <VigenciaRuta ruta={r} />
                      </span>
                    </span>
                    <span className="work-route-stats">
                      <span>
                        <UsersRound aria-hidden="true" />
                        {r.trabajadores.length}{" "}
                        {r.trabajadores.length === 1
                          ? "operativo"
                          : "operativos"}
                      </span>
                      <span>
                        <MapPin aria-hidden="true" />
                        {r.paradas.length}{" "}
                        {r.paradas.length === 1 ? "parada" : "paradas"}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="list-surface work-routes-desktop">
            <div
              className="table-scroll work-routes-table"
              aria-label="Rutas de trabajo registradas"
              role="region"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Ruta</th>
                    <th scope="col">Vigencia</th>
                    <th scope="col" className="numeric">
                      Operativos
                    </th>
                    <th scope="col" className="numeric">
                      Paradas
                    </th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rutas.map((r) => (
                    <tr key={r.id}>
                      <td className="work-route-name">
                        <Button
                          type="button"
                          variant="link"
                          className="work-route-link"
                          aria-label={"Editar ruta " + r.id + ", " + r.nombre}
                          onClick={() => setEdicion(r)}
                        >
                          {r.nombre}
                        </Button>
                      </td>
                      <td>
                        <VigenciaRuta ruta={r} />
                      </td>
                      <td className="numeric">{r.trabajadores.length}</td>
                      <td className="numeric">{r.paradas.length}</td>
                      <td>
                        <EstadoRuta activa={r.activa} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        q.data && <Empty>Aún no hay rutas de trabajo.</Empty>
      )}
      {edicion !== undefined && q.data && (
        <EditorRuta
          cuenta={cuenta}
          contexto={q.data}
          ruta={edicion}
          onClose={() => setEdicion(undefined)}
          onSaved={actualizarRutas}
        />
      )}
    </section>
  );
}
