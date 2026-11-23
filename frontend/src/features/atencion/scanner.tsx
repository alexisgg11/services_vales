import { useEffect, useRef, useState } from "react";
import { ImageUp, ScanQrCode, VideoOff } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorText } from "@/components/common";

function leerCuadro(
  ctx: CanvasRenderingContext2D,
  imagen: CanvasImageSource,
  ancho: number,
  alto: number,
  maximo: number,
) {
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  ctx.canvas.width = Math.round(ancho * escala);
  ctx.canvas.height = Math.round(alto * escala);
  ctx.drawImage(imagen, 0, 0, ctx.canvas.width, ctx.canvas.height);
  const cuadro = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  return jsQR(cuadro.data, cuadro.width, cuadro.height)?.data;
}

export function Scanner({
  onRead,
  onCancel,
}: {
  onRead: (texto: string, signal: AbortSignal) => Promise<void>;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const procesando = useRef(false);
  const lector = useRef<AbortController | null>(null);
  const recibir = useRef(onRead);
  recibir.current = onRead;
  const [camara, setCamara] = useState<"abriendo" | "lista" | "sin-camara">(
    "abriendo",
  );
  const [errorCamara, setErrorCamara] = useState("");
  const [error, setError] = useState<unknown>();
  const [ocupado, setOcupado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausa = useRef(false);

  async function resolver(obtenerTexto: () => Promise<string | undefined>) {
    if (procesando.current) return;
    procesando.current = true;
    const solicitud = new AbortController();
    lector.current = solicitud;
    setOcupado(true);
    setError(undefined);
    try {
      const contenido = await obtenerTexto();
      if (!contenido)
        throw new Error(
          "No se encontró un QR. Prueba con una imagen más nítida.",
        );
      if (!solicitud.signal.aborted)
        await recibir.current(contenido, solicitud.signal);
    } catch (e) {
      if (!solicitud.signal.aborted) {
        setError(e);
        pausa.current = true;
        setPausado(true);
      }
    } finally {
      if (!solicitud.signal.aborted) {
        procesando.current = false;
        setOcupado(false);
      }
    }
  }

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cuadro = 0;
    let cerrado = false;
    let ultimo = 0;
    let codigoAnterior: string | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!navigator.mediaDevices?.getUserMedia || !ctx) {
      setCamara("sin-camara");
      setErrorCamara(
        "Abre Vales por HTTPS para usar la cámara o carga una imagen.",
      );
      return () => lector.current?.abort();
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then(async (medio) => {
        if (cerrado) {
          medio.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = medio;
        const reproductor = video.current!;
        reproductor.srcObject = medio;
        await reproductor.play();
        if (cerrado) return;
        setCamara("lista");
        function escanear(tiempo: number) {
          if (cerrado) return;
          if (
            !procesando.current &&
            !pausa.current &&
            tiempo - ultimo >= 150 &&
            reproductor.readyState >= 2 &&
            reproductor.videoWidth
          ) {
            ultimo = tiempo;
            const texto = leerCuadro(
              ctx!,
              reproductor,
              reproductor.videoWidth,
              reproductor.videoHeight,
              900,
            );
            if (texto && texto !== codigoAnterior)
              void resolver(async () => texto);
            codigoAnterior = texto;
          }
          cuadro = requestAnimationFrame(escanear);
        }
        cuadro = requestAnimationFrame(escanear);
      })
      .catch((e: Error) => {
        if (cerrado) return;
        stream?.getTracks().forEach((t) => t.stop());
        setCamara("sin-camara");
        setErrorCamara(
          e.name === "NotAllowedError"
            ? "Permite el acceso a la cámara o carga una imagen."
            : "No se pudo abrir la cámara. Carga una imagen del QR.",
        );
      });
    return () => {
      cerrado = true;
      cancelAnimationFrame(cuadro);
      stream?.getTracks().forEach((t) => t.stop());
      lector.current?.abort();
    };
  }, []);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="dialogo-despacho lector-vale">
        <DialogHeader className="dialogo-despacho-encabezado lector-encabezado">
          <span className="lector-icono">
            <ScanQrCode aria-hidden="true" />
          </span>
          <DialogTitle>Escanear QR</DialogTitle>
          <DialogDescription className="sr-only">
            Lee el QR del vale con la cámara o desde una imagen.
          </DialogDescription>
        </DialogHeader>
        <div className="dialogo-despacho-cuerpo lector-cuerpo">
          <div
            className="lector-visual"
            data-camara={camara}
            aria-hidden="true"
          >
            <video ref={video} playsInline muted />
            {camara === "lista" && (
              <div className="lector-marco">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          {camara !== "lista" && (
            <div className="lector-estado" role="status">
              {camara === "abriendo" ? (
                <ScanQrCode aria-hidden="true" />
              ) : (
                <VideoOff aria-hidden="true" />
              )}
              {camara === "abriendo" ? "Abriendo cámara" : errorCamara}
            </div>
          )}
          {(ocupado || (camara === "lista" && !pausado)) && (
            <p role="status" className="lector-indicacion">
              {ocupado
                ? "Consultando vale"
                : "Centra el QR del vale en el marco."}
            </p>
          )}
          <ErrorText error={error} />
        </div>
        <DialogFooter className="dialogo-despacho-pie">
          <input
            type="file"
            accept="image/*"
            aria-label="Imagen del QR"
            ref={archivo}
            hidden
            onChange={(e) => {
              const imagen = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!imagen) return;
              void resolver(async () => {
                const mapa = await createImageBitmap(imagen);
                try {
                  const ctx = document
                    .createElement("canvas")
                    .getContext("2d")!;
                  return leerCuadro(ctx, mapa, mapa.width, mapa.height, 1600);
                } finally {
                  mapa.close();
                }
              });
            }}
          />
          <Button
            type="button"
            variant={camara === "sin-camara" ? "default" : "outline"}
            disabled={ocupado}
            onClick={() => archivo.current?.click()}
          >
            <ImageUp aria-hidden="true" /> Cargar imagen
          </Button>
          {pausado && camara === "lista" && (
            <Button
              type="button"
              disabled={ocupado}
              onClick={() => {
                pausa.current = false;
                setPausado(false);
                setError(undefined);
              }}
            >
              Escanear otro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
