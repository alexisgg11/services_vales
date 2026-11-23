import { useState, type Key, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Save,
  X,
} from "lucide-react";
import { Empty, ErrorText } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const filasPorPagina = 6;

export function TablaAdministracion<T>({
  titulo,
  filas,
  clave,
  columnas,
  acciones,
  vacio,
}: {
  titulo: string;
  filas: readonly T[];
  clave: (fila: T) => Key;
  columnas: {
    titulo: string;
    mostrar: (fila: T) => ReactNode;
    numerica?: boolean;
  }[];
  acciones?: (fila: T) => ReactNode;
  vacio: string;
}) {
  const [pagina, paginar] = useState(0);
  const paginas = Math.ceil(filas.length / filasPorPagina);
  if (!filas.length) {
    return <Empty>{vacio}</Empty>;
  }
  const actual = Math.min(pagina, paginas - 1);
  const visibles = filas.slice(
    actual * filasPorPagina,
    (actual + 1) * filasPorPagina,
  );
  const [principal, ...detalle] = columnas;

  return (
    <div className="admin-listado list-surface">
      <div className="admin-tabla">
        <div
          className="table-scroll"
          role="region"
          aria-label={titulo}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {columnas.map(({ titulo, numerica }) => (
                  <th
                    key={titulo}
                    scope="col"
                    className={numerica ? "admin-numero" : undefined}
                  >
                    {titulo}
                  </th>
                ))}
                {acciones && (
                  <th className="admin-acciones-titulo" scope="col">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={clave(fila)}>
                  {columnas.map(({ titulo, mostrar, numerica }) => (
                    <td
                      key={titulo}
                      className={numerica ? "admin-numero" : undefined}
                    >
                      {mostrar(fila)}
                    </td>
                  ))}
                  {acciones && (
                    <td className="admin-acciones-celda">
                      <div className="admin-acciones">{acciones(fila)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ul className="admin-tarjetas" aria-label={titulo}>
        {visibles.map((fila) => (
          <li key={clave(fila)} className="admin-tarjeta">
            <div className="admin-tarjeta-titulo">
              {principal.mostrar(fila)}
            </div>
            <dl>
              {detalle.map(({ titulo, mostrar }) => (
                <div key={titulo}>
                  <dt>{titulo}</dt>
                  <dd>{mostrar(fila)}</dd>
                </div>
              ))}
            </dl>
            {acciones && <div className="admin-acciones">{acciones(fila)}</div>}
          </li>
        ))}
      </ul>
      {paginas > 1 && (
        <footer className="pagination admin-paginacion">
          <small>
            Página {actual + 1} de {paginas}
          </small>
          <div className="admin-acciones">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={
                "Página anterior de " + titulo.toLocaleLowerCase("es-PE")
              }
              onClick={() => paginar(actual - 1)}
              disabled={actual === 0}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={
                "Página siguiente de " + titulo.toLocaleLowerCase("es-PE")
              }
              onClick={() => paginar(actual + 1)}
              disabled={actual + 1 >= paginas}
            >
              <ChevronRight />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

export function DialogoAdministracion({
  titulo,
  descripcion,
  guardar,
  cerrar,
  children,
  etiqueta = "Guardar cambios",
  bloqueado,
  destructivo,
}: {
  titulo: string;
  descripcion?: string;
  guardar: (formulario: FormData) => Promise<void>;
  cerrar: () => void;
  children?: ReactNode;
  etiqueta?: string;
  bloqueado?: boolean;
  destructivo?: boolean;
}) {
  const [error, setError] = useState<unknown>();
  const [guardando, setGuardando] = useState(false);
  const [invocador] = useState(() => document.activeElement);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !guardando) cerrar();
      }}
    >
      <DialogContent
        className="admin-dialogo"
        showCloseButton={false}
        {...(!descripcion && { "aria-describedby": undefined })}
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          if (invocador instanceof HTMLElement && invocador.isConnected) {
            event.preventDefault();
            invocador.focus();
          }
        }}
      >
        <DialogHeader className="admin-dialogo-cabecera">
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="admin-dialogo-cerrar"
            aria-label="Cerrar"
            disabled={guardando}
          >
            <X />
          </Button>
        </DialogClose>
        <form
          aria-busy={guardando}
          onSubmit={async (event) => {
            event.preventDefault();
            if (guardando || bloqueado) return;
            const formulario = new FormData(event.currentTarget);
            setError(undefined);
            setGuardando(true);
            try {
              await guardar(formulario);
              cerrar();
            } catch (error) {
              setError(error);
            } finally {
              setGuardando(false);
            }
          }}
        >
          <div className="admin-dialogo-cuerpo">
            <fieldset disabled={guardando}>{children}</fieldset>
            <ErrorText error={error} />
          </div>
          <DialogFooter className="admin-dialogo-pie">
            <Button
              type="button"
              variant="outline"
              onClick={cerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={destructivo ? "destructive" : "default"}
              disabled={guardando || bloqueado}
            >
              {guardando ? (
                <LoaderCircle className="spin" />
              ) : (
                !destructivo && <Save />
              )}
              {etiqueta}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AvisoAdministracion({ mensaje }: { mensaje: string }) {
  return (
    <div role="status" className="admin-aviso">
      {mensaje && (
        <>
          <CheckCircle2 aria-hidden="true" />
          {mensaje}
        </>
      )}
    </div>
  );
}
