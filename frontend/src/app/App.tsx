import ConsultaPublica from "@/features/consulta/ConsultaPublica";
import Workspace from "./Workspace";

export default function App() {
  if (
    location.pathname.startsWith("/vales/q/") &&
    !location.pathname.endsWith("/documento")
  )
    return <ConsultaPublica />;
  return <Workspace />;
}
