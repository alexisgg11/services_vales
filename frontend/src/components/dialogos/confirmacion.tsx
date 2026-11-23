import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/feedback";

interface ModalState {
  title: string;
  body: ReactNode;
  action?: () => Promise<void>;
  label?: string;
  cancelLabel?: string;
  success?: boolean;
  destructive?: boolean;
}
const ModalContext = createContext<(m: ModalState) => void>(() => {});
export function useModal() {
  return useContext(ModalContext);
}
export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const dialogRoot = useRef<HTMLDivElement>(null);
  const show = (m: ModalState) => {
    setError(undefined);
    setModal(m);
  };
  return (
    <ModalContext.Provider value={show}>
      {children}
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o && !busy) setModal(null);
        }}
      >
        <DialogContent
          ref={dialogRoot}
          className="modal"
          showCloseButton={!busy}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogRoot.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <div className={"notice-icon " + (modal?.success ? "success" : "")}>
              {modal?.success ? (
                <CheckCircle2 size={48} />
              ) : (
                <AlertCircle size={48} />
              )}
            </div>
            <DialogTitle>{modal?.title}</DialogTitle>
          </DialogHeader>
          <div className="modal-body">
            <DialogDescription asChild>
              <div>{modal?.body}</div>
            </DialogDescription>
            <ErrorText error={error} />
          </div>
          <div className="actions">
            {modal?.action && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                {modal.cancelLabel || "Volver"}
              </Button>
            )}
            <Button
              variant={modal?.destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                if (!modal?.action) {
                  setModal(null);
                  return;
                }
                setBusy(true);
                try {
                  await modal.action();
                  setModal(null);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <LoaderCircle className="spin" /> : null}
              {modal?.action ? modal.label || "Confirmar" : "Entendido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  );
}
