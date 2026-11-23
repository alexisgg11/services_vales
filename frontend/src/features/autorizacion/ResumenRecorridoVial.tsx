import { Clock3, Route } from "lucide-react";
import { InfoPopover } from "@/components/ui/info-popover";
import { mostrarDistancia } from "@/lib/geografia/coordenadas";

export type RecorridoVial = {
  trazado: number[][];
  metros: number;
  segundos: number;
  distanciasAVia: number[];
};

export function ResumenRecorridoVial({
  recorrido,
}: {
  recorrido: RecorridoVial;
}) {
  const minutos = Math.round(recorrido.segundos / 60);
  const horas = Math.floor(minutos / 60);
  const duracion = horas ? `${horas} h ${minutos % 60} min` : `${minutos} min`;
  const accesos = recorrido.distanciasAVia.flatMap((metros, indice) =>
    metros >= 100 ? [{ indice, metros: Math.round(metros) }] : [],
  );

  return (
    <div className="route-map-summary">
      <dl className="route-map-metrics" aria-live="polite">
        <div>
          <dt className="sr-only">Distancia vial estimada</dt>
          <dd>
            <Route aria-hidden="true" />{" "}
            {mostrarDistancia(recorrido.metros / 1000)}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Tiempo de conducción estimado</dt>
          <dd>
            <Clock3 aria-hidden="true" /> {duracion}
          </dd>
        </div>
      </dl>
      {accesos.length > 0 && (
        <InfoPopover title="Accesos a la vía">
          <p>
            El trazado llega por carretera hasta los accesos de estos puntos.
          </p>
          <ul className="route-access-list">
            {accesos.map(({ indice, metros }) => (
              <li key={indice}>
                <strong>{indice === 0 ? "Partida" : `Parada ${indice}`}</strong>
                <span>{metros} m hasta la vía</span>
              </li>
            ))}
          </ul>
        </InfoPopover>
      )}
    </div>
  );
}
