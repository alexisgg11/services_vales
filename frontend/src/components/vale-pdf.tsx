import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Vale } from "@/lib/types";

const ValePdfDialog = lazy(() => import("@/features/documentos/ValePdfDialog"));
const PdfContext = createContext<(vale: Vale) => void>(() => {});

export function useValePdf() {
  return useContext(PdfContext);
}

export function ValePdfProvider({ children }: { children: ReactNode }) {
  const [vale, setVale] = useState<Vale | null>(null);
  return (
    <PdfContext.Provider value={setVale}>
      {children}
      {vale && (
        <Suspense fallback={null}>
          <ValePdfDialog
            key={vale.id_qr}
            vale={vale}
            onClose={() => setVale(null)}
          />
        </Suspense>
      )}
    </PdfContext.Provider>
  );
}
