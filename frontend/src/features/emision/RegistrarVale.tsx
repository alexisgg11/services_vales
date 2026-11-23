import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Search, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UnidadMovilSelect } from "@/components/unidad-movil-select";
import { api, money, today } from "@/lib/api";
import {
  guardarValor,
  leerGuardado,
  prefijoBorrador,
} from "@/lib/almacenamiento";
import { actualizarContexto } from "@/lib/consultas";
import type { Contexto, Persona, Vale } from "@/lib/types";
import { InfoPopover } from "@/components/info-popover";
import {
  Field,
  ErrorText,
  ValeCard,
  useData,
  useModal,
} from "@/components/common";
import { condiciones, unidades, type Modalidad } from "./condiciones";
import { CompararGrifos } from "./CompararGrifos";
import { useRutaEmision } from "./use-ruta-emision";
interface Form {
  modalidad: Modalidad;
  fecha: string;
  proveedor: string;
  suministro: string;
  cantidad: string;
  tercero: string;
  destino: string;
  centro: string;
  localidad: string;
  unidadMovil: string;
  observacion: string;
}

const camposBorrador = [
  "fecha",
  "proveedor",
  "suministro",
  "cantidad",
  "centro",
  "unidadMovil",
] as const;

function recuperarBorrador(clave: string, inicial: Form) {
  try {
    const dato: unknown = JSON.parse(
      leerGuardado("sessionStorage", clave) ?? "null",
    );
    if (!dato || typeof dato !== "object") return inicial;
    const guardado = dato as Record<string, unknown>;
    const borrador = { ...inicial };
    for (const campo of camposBorrador) {
      const valor = guardado[campo];
      if (typeof valor === "string") borrador[campo] = valor;
    }
    const { modalidad } = guardado;
    if (
      modalidad === "CONTRATO" ||
      modalidad === "SC_TRABAJADOR" ||
      modalidad === "SC_TERCERO"
    ) {
      borrador.modalidad = modalidad;
    }
    return borrador;
  } catch {
    return inicial;
  }
}

export default function RegistrarVale({
  onOpen,
}: {
  onOpen: (v: Vale) => void;
}) {
  const { data } = useData(),
    modal = useModal(),
    c = data!.cuenta;
  const cache = useQueryClient();
  const claveBorrador = prefijoBorrador + c.actor;
  const blank: Form = {
    modalidad: "CONTRATO",
    fecha: today(),
    proveedor: "",
    suministro: "",
    cantidad: "",
    tercero: "",
    destino: "",
    centro: c.trabajador.centro,
    localidad: c.trabajador.localidad,
    unidadMovil: "",
    observacion: "",
  };
  const [f, setF] = useState<Form>(() =>
      recuperarBorrador(claveBorrador, blank),
    ),
    [step, setStep] = useState(0),
    [error, setError] = useState<unknown>(),
    [persona, setPersona] = useState<Persona>(),
    [loading, setLoading] = useState(false),
    [created, setCreated] = useState<Vale>();
  const seleccionRuta = useRutaEmision(c, f.fecha);
  const stepHeading = useRef<HTMLHeadingElement>(null),
    previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepHeading.current?.focus({ preventScroll: true });
    stepHeading.current?.scrollIntoView({ block: "start" });
  }, [step]);
  const datos = useMemo(
    () => condiciones(c, f.proveedor, f.fecha, f.modalidad),
    [c, f.proveedor, f.fecha, f.modalidad],
  );
  const providers = c.proveedores.filter((p) =>
    Object.values(
      condiciones(c, p.cod_proveedor, f.fecha, f.modalidad).precios,
    ).some((v) => v > 0),
  );
  const supplies = c.suministros.filter((s) =>
      f.proveedor
        ? (datos.precios as Record<string, number>)[s.id_suministro] > 0
        : providers.some(
            (p) =>
              (
                condiciones(c, p.cod_proveedor, f.fecha, f.modalidad)
                  .precios as Record<string, number>
              )[s.id_suministro] > 0,
          ),
    ),
    vehicles = unidades(c, f.centro, f.fecha),
    price = Number(
      (datos.precios as Record<string, number>)[f.suministro] || 0,
    ),
    estimated = Math.round(Number(f.cantidad || 0) * price * 100) / 100;
  const change = <K extends keyof Form>(k: K, v: Form[K]) => {
    setError(undefined);
    setF((o) => ({
      ...o,
      [k]: v,
      ...(["modalidad", "fecha"].includes(k)
        ? { proveedor: "", suministro: "" }
        : k === "proveedor"
          ? { suministro: "" }
          : {}),
      ...(["centro", "fecha"].includes(k) ? { unidadMovil: "" } : {}),
      ...(k === "modalidad" ? { tercero: "", destino: "" } : {}),
    }));
    if (k === "tercero" || k === "modalidad") setPersona(undefined);
  };
  useEffect(() => {
    if (created) return;
    const borrador = Object.fromEntries(
      camposBorrador.map((campo) => [campo, f[campo]]),
    );
    guardarValor(
      "sessionStorage",
      claveBorrador,
      JSON.stringify({ ...borrador, modalidad: f.modalidad }),
    );
  }, [f, claveBorrador, created]);
  const draft = useMemo(
    () => ({
      ...({} as Vale),
      id_vale: "borrador",
      codigo_vale: "Vale",
      id_qr: "",
      estado_vale: 0,
      zonal:
        c.zonales.find((z) => z.id_zona === c.trabajador.zonal)?.nom_zona || "",
      trabajador: c.nombre,
      grifo:
        c.proveedores.find((p) => p.cod_proveedor === f.proveedor)
          ?.razon_social || "",
      suministro:
        c.suministros.find((s) => s.id_suministro === f.suministro)
          ?.descripcion || "",
      importe_estimado: estimated,
      importe: null,
      ticket: null,
    }),
    [c, f.proveedor, f.suministro, estimated],
  );
  const check = (stage: number) => {
    if (
      stage === 0 &&
      (!f.proveedor ||
        !f.suministro ||
        !f.cantidad ||
        !Number.isFinite(Number(f.cantidad)) ||
        Number(f.cantidad) <= 0 ||
        !price)
    )
      throw new Error("Selecciona grifo, suministro y una cantidad positiva.");
    if (
      stage === 0 &&
      datos.contrato &&
      estimated > Number(datos.contrato.saldo)
    )
      throw new Error("El importe estimado supera el saldo del contrato.");
    if (
      stage === 0 &&
      f.modalidad === "SC_TERCERO" &&
      (!persona || persona.documento !== f.tercero || !f.destino.trim())
    )
      throw new Error(
        "Consulta el DNI del tercero e indica el destino o motivo.",
      );
    if (stage === 1 && (!f.centro || !f.localidad))
      throw new Error("Selecciona centro de costo y localidad.");
  };
  async function lookup() {
    setError(undefined);
    setLoading(true);
    try {
      setPersona(
        await api<Persona>("/api/v1/identidad/dni", { dni: f.tercero }),
      );
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  const sending = useRef(false);
  function confirm() {
    try {
      check(0);
      check(1);
      modal({
        title: "Registrar este vale",
        body: (
          <>
            <ValeCard vale={draft} />
            <p>El vale quedará pendiente de autorización.</p>
          </>
        ),
        label: "Registrar vale",
        action: async () => {
          if (sending.current) return;
          sending.current = true;
          try {
            const r = await api<Contexto>("/api/v1/emision/vales", {
              dni: c.trabajador.dni,
              proveedor: f.proveedor,
              suministro: f.suministro,
              cantidad: Number(f.cantidad),
              observacion: f.observacion,
              fecha: f.fecha,
              centro: f.centro,
              localidad: f.localidad,
              unidadMovil: f.unidadMovil ? Number(f.unidadMovil) : null,
              sinContrato: f.modalidad !== "CONTRATO",
              tercero: f.modalidad === "SC_TERCERO" ? f.tercero : null,
              destino: f.modalidad === "SC_TERCERO" ? f.destino : null,
              ...seleccionRuta.vinculo,
            });
            setCreated(r.vales.find((v) => v.id_vale === r.id));
            guardarValor("sessionStorage", claveBorrador, null);
            await actualizarContexto(cache, r);
          } finally {
            sending.current = false;
          }
        },
      });
    } catch (e) {
      setError(e);
    }
  }
  if (created)
    return (
      <div className="narrow stack">
        <div className="success-line">
          <Check /> Vale registrado
        </div>
        <ValeCard vale={created} onOpen={onOpen} />
        <Button
          onClick={() => {
            setCreated(undefined);
            setF(blank);
            seleccionRuta.reiniciar();
            setStep(0);
          }}
        >
          Registrar otro vale
        </Button>
      </div>
    );
  return (
    <div className="emission-layout">
      <section className="panel wizard">
        <ol className="steps">
          {["Emisión", "Asignación", "Revisión"].map((s, i) => (
            <li
              key={s}
              className={step === i ? "current" : step > i ? "done" : ""}
            >
              <span>{step > i ? <Check size={14} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 2) {
              try {
                check(step);
                setStep(step + 1);
              } catch (e) {
                setError(e);
              }
            } else confirm();
          }}
        >
          <h2 ref={stepHeading} tabIndex={-1} className="wizard-step-heading">
            {
              [
                "Datos de emisión",
                "Asignación del trabajo",
                "Revisar y registrar",
              ][step]
            }
          </h2>
          {step === 0 && (
            <div className="form-grid">
              <Field label="Modalidad">
                <select
                  aria-label="Modalidad"
                  value={f.modalidad}
                  onChange={(e) =>
                    change("modalidad", e.target.value as Modalidad)
                  }
                >
                  <option value="CONTRATO">Con contrato</option>
                  <option value="SC_TRABAJADOR">
                    Sin contrato por vencimiento
                  </option>
                  <option value="SC_TERCERO">Sin contrato para tercero</option>
                </select>
              </Field>
              <Field label="Fecha de emisión">
                <Input
                  aria-label="Fecha de emisión"
                  type="date"
                  value={f.fecha}
                  onChange={(e) => change("fecha", e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Grifo"
                help="Se muestran los grifos con precios aplicables a la modalidad y fecha."
              >
                <div className="emission-grifo-control">
                  <select
                    aria-label="Grifo"
                    value={f.proveedor}
                    onChange={(e) => change("proveedor", e.target.value)}
                    required
                  >
                    <option value="">Seleccionar grifo</option>
                    {providers.map((p) => (
                      <option key={p.cod_proveedor} value={p.cod_proveedor}>
                        {p.razon_social}
                      </option>
                    ))}
                  </select>
                  <CompararGrifos
                    cuenta={c}
                    fecha={f.fecha}
                    modalidad={f.modalidad}
                    suministro={f.suministro}
                    cantidad={Number(f.cantidad)}
                    seleccionRuta={seleccionRuta}
                    onElegir={(proveedor) => {
                      setError(undefined);
                      setF((actual) => ({ ...actual, proveedor }));
                    }}
                  />
                </div>
              </Field>
              <Field label="Suministro">
                <select
                  aria-label="Suministro"
                  value={f.suministro}
                  onChange={(e) => change("suministro", e.target.value)}
                  required
                  disabled={!supplies.length}
                >
                  <option value="">Seleccionar suministro</option>
                  {supplies.map((s) => (
                    <option value={s.id_suministro} key={s.id_suministro}>
                      {s.descripcion}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad en galones">
                <Input
                  aria-label="Cantidad en galones"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={f.cantidad}
                  onChange={(e) => change("cantidad", e.target.value)}
                  required
                />
              </Field>
              <Field label="Precio referencial por galón">
                <Input
                  aria-label="Precio referencial"
                  disabled
                  value={price ? money(price) : "Selecciona el suministro"}
                />
              </Field>
              {datos.contrato && (
                <p className="subtle full">
                  Contrato {datos.contrato.id}{" "}
                  <span>Saldo {money(Number(datos.contrato.saldo))}</span>
                </p>
              )}
              {f.modalidad === "SC_TERCERO" && (
                <>
                  <Field label="DNI del tercero">
                    <div className="inline">
                      <Input
                        aria-label="DNI del tercero"
                        inputMode="numeric"
                        maxLength={8}
                        pattern="[0-9]{8}"
                        value={f.tercero}
                        onChange={(e) =>
                          change("tercero", e.target.value.replace(/\D/g, ""))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading || f.tercero.length !== 8}
                        onClick={lookup}
                      >
                        <Search />
                        Consultar
                      </Button>
                      <InfoPopover title="Consulta del DNI">
                        <p>
                          Se consulta el nombre antes de asignar el vale al
                          tercero. Para las pruebas pueden usarse los DNI
                          99000001 y 99000002.
                        </p>
                      </InfoPopover>
                    </div>
                    {persona && (
                      <div className="identity-result">
                        <div className="row spaced">
                          <strong>{persona.nombre}</strong>
                          <InfoPopover title="Origen de la consulta">
                            <p>{persona.origen}</p>
                          </InfoPopover>
                        </div>
                      </div>
                    )}
                  </Field>
                  <Field label="Destino o motivo">
                    <Input
                      aria-label="Destino o motivo"
                      value={f.destino}
                      onChange={(e) => change("destino", e.target.value)}
                      required
                    />
                  </Field>
                </>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="form-grid">
              <Field label="Trabajador">
                <Input value={c.nombre} disabled aria-label="Trabajador" />
              </Field>
              <Field label="Unidad organizativa">
                <Input
                  value={c.unidad || "Sin unidad"}
                  disabled
                  aria-label="Unidad organizativa"
                />
              </Field>
              <Field label="Centro de costo">
                <select
                  aria-label="Centro de costo"
                  value={f.centro}
                  onChange={(e) => change("centro", e.target.value)}
                >
                  {(c.centros || []).map((x) => (
                    <option key={x.cod_centro_costo} value={x.cod_centro_costo}>
                      {x.descripcion}
                      {x.cod_localidad
                        ? " — " +
                          c.localidades.find(
                            (l) => l.id_localidad === x.cod_localidad,
                          )?.nom_localidad
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Localidad del trabajador">
                <Input
                  aria-label="Localidad del trabajador"
                  disabled
                  value={
                    c.localidades.find(
                      (l) => l.id_localidad === c.trabajador.localidad,
                    )?.nom_localidad || c.trabajador.localidad
                  }
                />
              </Field>
              <Field
                label="Unidad móvil"
                help="Primero las unidades de su zonal. Otras unidades requieren habilitación para el centro de costo y la fecha."
              >
                <UnidadMovilSelect
                  value={f.unidadMovil}
                  onChange={(value) => change("unidadMovil", value)}
                  unidades={vehicles}
                  zonales={c.zonales}
                />
              </Field>
              <Field label="Observación">
                <Textarea
                  aria-label="Observación"
                  value={f.observacion}
                  onChange={(e) => change("observacion", e.target.value)}
                  maxLength={1000}
                />
              </Field>
            </div>
          )}
          {step === 2 && (
            <div className="stack">
              <ValeCard vale={draft} />
              <dl className="facts">
                <div>
                  <dt>Fecha</dt>
                  <dd>{f.fecha}</dd>
                </div>
                <div>
                  <dt>Cantidad</dt>
                  <dd>{f.cantidad} gal</dd>
                </div>
                <div>
                  <dt>Centro de costo</dt>
                  <dd>
                    {
                      c.centros?.find((x) => x.cod_centro_costo === f.centro)
                        ?.descripcion
                    }
                  </dd>
                </div>
                <div>
                  <dt>Localidad del trabajador</dt>
                  <dd>
                    {c.localidades.find(
                      (l) => l.id_localidad === c.trabajador.localidad,
                    )?.nom_localidad || c.trabajador.localidad}
                  </dd>
                </div>
                <div>
                  <dt>Unidad móvil</dt>
                  <dd>
                    {vehicles.find((u) => String(u.codigo) === f.unidadMovil)
                      ?.placa || "Sin unidad móvil"}
                  </dd>
                </div>
                {persona && (
                  <div>
                    <dt>Tercero</dt>
                    <dd>{persona.nombre}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          <ErrorText error={error} />
          <div className="total-line">
            <span>Importe estimado</span>
            <strong>{money(estimated)}</strong>
          </div>
          <div className="actions">
            {step > 0 && (
              <Button
                variant="outline"
                type="button"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft />
                Atrás
              </Button>
            )}
            <Button type="submit">
              {step < 2 ? (
                <>
                  {"Continuar"}
                  <ArrowRight />
                </>
              ) : (
                <>
                  <Save />
                  Registrar vale
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
