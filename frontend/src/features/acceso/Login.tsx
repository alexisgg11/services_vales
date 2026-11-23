import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Fuel, Ticket } from "lucide-react";
import { Field } from "@/components/formularios/campos";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/api";
import { contextoConsulta } from "@/lib/consultas";

export default function Login() {
  const queries = useQueryClient();
  const [usuario, setUsuario] = useState(""),
    [clave, setClave] = useState(""),
    [claveVisible, setClaveVisible] = useState(false),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const accionClave = claveVisible
    ? "Ocultar contraseña"
    : "Mostrar contraseña";
  return (
    <div className="login">
      <div className="login-brand">
        <div className="login-brand-lockup">
          <span>
            <Fuel aria-hidden="true" />
          </span>
          <div>
            <strong>Vales</strong>
            <small>Control de combustible</small>
          </div>
        </div>
        <div className="login-copy">
          <Ticket size={60} />
          <h2>
            Cada atención,
            <br />
            con su respaldo.
          </h2>
          <p>Registro, autorización y control de los vales de la empresa.</p>
        </div>
      </div>
      <main className="login-form">
        <h1>Iniciar sesión</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              const url = await login(usuario, clave);
              const target = new URL(url);
              if (target.origin !== location.origin)
                throw new Error("El destino de la sesión no es válido.");
              if (
                target.pathname.startsWith("/vales/") ||
                target.pathname === "/consulta"
              )
                history.replaceState(null, "", target.pathname + target.search);
              queries.removeQueries({
                predicate: (q) => q.queryKey[0] !== "contexto",
              });
              await queries.resetQueries({
                queryKey: contextoConsulta.queryKey,
              });
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Usuario">
            <Input
              id="username"
              name="username"
              placeholder="Escribe tu usuario"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </Field>
          <Field label="Contraseña">
            <div className="login-password">
              <Input
                id="password"
                name="password"
                type={claveVisible ? "text" : "password"}
                placeholder="Escribe tu contraseña"
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="login-password-toggle"
                aria-label={accionClave}
                aria-controls="password"
                title={accionClave}
                onClick={() => setClaveVisible((visible) => !visible)}
              >
                {claveVisible ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </Button>
            </div>
          </Field>
          <ErrorText error={error} />
          <Button disabled={busy} className="w-full">
            {busy ? "Ingresando" : "Ingresar"}
          </Button>
        </form>
      </main>
    </div>
  );
}
