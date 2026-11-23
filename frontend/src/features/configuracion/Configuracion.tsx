import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Administracion from "@/features/administracion/Administracion";
import RutasTrabajo from "@/features/autorizacion/RutasTrabajo";
import PrestamosUnidades from "./PrestamosUnidades";
import "./configuracion.css";

function ConfiguracionJefatura() {
  return (
    <Tabs defaultValue="rutas" className="configuracion-jefatura">
      <TabsList aria-label="Configuración de Jefatura">
        <TabsTrigger value="rutas">Rutas de trabajo</TabsTrigger>
        <TabsTrigger value="prestamos">Préstamos de unidades</TabsTrigger>
      </TabsList>
      <TabsContent value="rutas">
        <RutasTrabajo />
      </TabsContent>
      <TabsContent value="prestamos">
        <PrestamosUnidades />
      </TabsContent>
    </Tabs>
  );
}

export default function Configuracion({
  jefatura,
  administracion,
  seccionInicial,
}: {
  jefatura: boolean;
  administracion: boolean;
  seccionInicial: "jefatura" | "administracion";
}) {
  if (!jefatura) return administracion ? <Administracion /> : null;
  if (!administracion) return <ConfiguracionJefatura />;

  return (
    <Tabs defaultValue={seccionInicial}>
      <TabsList aria-label="Configuración por rol">
        <TabsTrigger value="jefatura">Jefatura</TabsTrigger>
        <TabsTrigger value="administracion">Administración</TabsTrigger>
      </TabsList>
      <TabsContent value="jefatura">
        <ConfiguracionJefatura />
      </TabsContent>
      <TabsContent value="administracion">
        <Administracion />
      </TabsContent>
    </Tabs>
  );
}
