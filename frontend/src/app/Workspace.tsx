import { Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Fuel,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  Settings,
  WifiOff,
  RefreshCw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Busy, ErrorText } from "@/components/ui/feedback";
import { useModal } from "@/components/dialogos/confirmacion";
import { ValeDetail } from "@/components/vales/DetalleVale";
import { useValePdf } from "@/components/vales/pdf-provider";
import Login from "@/features/acceso/Login";
import { ApiError, logout } from "@/lib/api";
import { guardarValor, leerGuardado } from "@/lib/almacenamiento";
import { detalleValeConsulta, useData, useRefresh } from "@/lib/consultas";
import type { Vale } from "@/lib/types";
import {
  Registrar,
  Autorizar,
  Atender,
  Facturas,
  Anular,
  Documentos,
  Gastos,
  Configuracion,
  services,
  roleNames,
} from "./modulos";

export default function Workspace() {
  const context = useData(),
    modal = useModal(),
    refresh = useRefresh();
  const cache = useQueryClient();
  const abrirPdf = useValePdf();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [route, setRoute] = useState(location.hash.slice(2).split("?")[0]),
    [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState(
      () => leerGuardado("localStorage", "vales-menu") === "compacto",
    ),
    [detail, setDetail] = useState<{
      vale: Vale;
      onAuthorize?: (actual: Vale) => void;
    } | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);
  useEffect(() => {
    const hash = () => {
        setRoute(location.hash.slice(2).split("?")[0]);
        setMobile(false);
      },
      on = () => setOnline(navigator.onLine),
      prompt = (e: Event) => {
        e.preventDefault();
        setInstall(e as Event & { prompt: () => Promise<void> });
      };
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    setDetail(null);
    const documento = location.pathname.match(
      /^\/vales\/q\/([^/]+)\/documento$/,
    );
    const parametros = new URLSearchParams(location.search);
    const uuid = documento?.[1] || parametros.get("vale");
    if (!context.data || !uuid) return;
    const formatoPdf = documento && parametros.get("formato") === "pdf";
    let vigente = true;
    cache
      .fetchQuery(detalleValeConsulta(uuid))
      .then(({ vale }) => {
        if (!vigente) return;
        if (formatoPdf) abrirPdf(vale);
        else setDetail({ vale });
      })
      .catch((e) => {
        if (vigente)
          modal({ title: "Documento no disponible", body: <p>{e.message}</p> });
      });
    return () => {
      vigente = false;
    };
  }, [context.data?.cuenta.actor]);
  if (context.isPending) return <Busy />;
  if (
    context.error &&
    (!context.data ||
      (context.error instanceof ApiError && context.error.status === 401))
  ) {
    if (context.error instanceof ApiError && context.error.status === 401)
      return <Login />;
    return (
      <div className="login">
        <section className="panel">
          <h1>No se pudo cargar Vales</h1>
          <ErrorText error={context.error} />
          <Button onClick={() => context.refetch()}>
            <RefreshCw />
            Reintentar
          </Button>
        </section>
      </div>
    );
  }
  const c = context.data!.cuenta,
    allowed = services.filter((s) =>
      c.roles.some((r) => s.roles.includes(r.codigo_rol)),
    ),
    admin = c.roles.some((r) => r.codigo_rol === "ADMIN"),
    jefatura = c.roles.some((r) => r.codigo_rol === "JEFE"),
    configuracion = admin || jefatura;
  const mostrarConfiguracion =
    (route === "configuracion" && configuracion) ||
    (route === "administracion" && admin);
  const active =
    allowed.find((s) => s.id === route)?.id ||
    (mostrarConfiguracion ? "configuracion" : allowed[0]?.id || "documentos");
  const title =
    active === "configuracion"
      ? "Configuración"
      : active === "facturacion" &&
          !c.roles.some((r) => r.codigo_rol === "CONTABILIDAD")
        ? "Facturas del grifo"
        : services.find((s) => s.id === active)?.name;
  const nav = (
    <>
      <a className="brand" href="/app/">
        <span>
          <Fuel />
        </span>
        <div>
          <strong>Vales</strong>
          <small>Control de combustible</small>
        </div>
      </a>
      <nav aria-label="Servicios de Vales">
        {allowed.map((s) => (
          <a
            key={s.id}
            href={"#/+id".replace("+id", s.id)}
            title={s.name}
            aria-current={active === s.id ? "page" : undefined}
            onClick={() => setMobile(false)}
          >
            <s.icon />
            <span>
              {s.id === "facturacion" &&
              !c.roles.some((r) => r.codigo_rol === "CONTABILIDAD")
                ? "Facturas del grifo"
                : s.name}
            </span>
          </a>
        ))}
        {configuracion && (
          <div className="nav-extra">
            <a
              href="#/configuracion"
              aria-current={active === "configuracion" ? "page" : undefined}
              title="Configuración"
              onClick={() => setMobile(false)}
            >
              <Settings />
              <span>Configuración</span>
            </a>
          </div>
        )}
      </nav>
      <div className="profile">
        <span className="avatar">
          {c.nombre
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
        <div>
          <strong>{c.nombre}</strong>
          {c.roles.map((r) => (
            <div
              key={`${r.codigo_rol}-${r.cod_zonal ?? ""}-${r.cod_proveedor ?? ""}`}
            >
              <span>{roleNames[r.codigo_rol]}</span>
              <small>
                {r.cod_proveedor
                  ? c.proveedores.find(
                      (p) => p.cod_proveedor === r.cod_proveedor,
                    )?.razon_social
                  : r.cod_zonal
                    ? c.zonales.find((z) => z.id_zona === r.cod_zonal)?.nom_zona
                    : "Empresa"}
              </small>
            </div>
          ))}
        </div>
      </div>
    </>
  );
  const props = { onOpen: (vale: Vale) => setDetail({ vale }) };
  const attendFromQr = (v: Vale) => {
    setDetail(null);
    location.hash = "/atencion?vale=" + v.id_qr;
    setRoute("atencion");
  };
  return (
    <div className={"workspace " + (collapsed ? "compact" : "")}>
      <aside className="sidebar">{nav}</aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="mobile-menu"
          closeLabel="Cerrar menú"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            menuTrigger.current?.focus({ preventScroll: true });
          }}
        >
          <SheetTitle className="sr-only">Menú de Vales</SheetTitle>
          <SheetDescription className="sr-only">
            Servicios disponibles para el perfil
          </SheetDescription>
          {nav}
        </SheetContent>
      </Sheet>
      <div className="workspace-main">
        <header className="app-header">
          <Button
            ref={menuTrigger}
            variant="ghost"
            size="icon"
            className="mobile-only"
            aria-label="Abrir menú"
            aria-haspopup="dialog"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="desktop-only"
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            onClick={() => {
              setCollapsed(!collapsed);
              guardarValor(
                "localStorage",
                "vales-menu",
                collapsed ? "expandido" : "compacto",
              );
            }}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <span className="app-header-title">Control de combustible</span>
          {install && (
            <Button
              variant="ghost"
              className="install"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              <Download />
              Instalar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Actualizar datos"
            onClick={() => refresh()}
          >
            <RefreshCw className={context.isFetching ? "spin" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={() =>
              modal({
                title: "Cerrar sesión",
                body: (
                  <p>Se cerrará el acceso de {c.nombre} en este dispositivo.</p>
                ),
                label: "Cerrar sesión",
                action: logout,
              })
            }
          >
            <LogOut />
          </Button>
        </header>
        {!online && (
          <div className="offline">
            <WifiOff />
            Sin conexión. Se puede revisar el borrador. Para guardar se necesita
            recuperar la conexión y confirmar.
          </div>
        )}
        <main>
          {active !== "gastos" && (
            <div className="page-heading">
              <h1>{title}</h1>
              <p>
                {c.roles.some((r) => r.cod_zonal)
                  ? c.zonales.find(
                      (z) =>
                        z.id_zona ===
                        c.roles.find((r) => r.cod_zonal)?.cod_zonal,
                    )?.nom_zona
                  : "Control de combustible de la empresa"}
              </p>
            </div>
          )}
          <Suspense fallback={<Busy />}>
            {active === "emision" ? (
              <Registrar {...props} />
            ) : active === "autorizacion" ? (
              <Autorizar
                onOpen={(vale, onAuthorize) => setDetail({ vale, onAuthorize })}
                onCloseDetail={() => setDetail(null)}
              />
            ) : active === "atencion" ? (
              <Atender {...props} />
            ) : active === "facturacion" ? (
              <Facturas {...props} />
            ) : active === "anulacion" ? (
              <Anular {...props} />
            ) : active === "documentos" ? (
              <Documentos {...props} />
            ) : active === "gastos" ? (
              <Gastos {...props} />
            ) : active === "configuracion" ? (
              <Configuracion
                key={route}
                jefatura={jefatura}
                administracion={admin}
                seccionInicial={
                  route === "administracion" ? "administracion" : "jefatura"
                }
              />
            ) : null}
          </Suspense>
        </main>
      </div>
      <ValeDetail
        vale={detail?.vale ?? null}
        onClose={() => setDetail(null)}
        onAuthorize={
          active === "autorizacion" ? detail?.onAuthorize : undefined
        }
        onAttend={
          detail?.vale.estado_vale === 1 &&
          c.roles.some(
            (r) =>
              r.codigo_rol === "GRIFO" &&
              r.cod_zonal === detail.vale.cod_zonal &&
              r.cod_proveedor === detail.vale.cod_proveedor,
          )
            ? attendFromQr
            : undefined
        }
      />
    </div>
  );
}
