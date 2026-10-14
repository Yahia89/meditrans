import { Suspense, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

/** Load a form on first use, then keep it mounted for its normal close/reset flow. */
export function DeferredForm({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);
  if (!open && !hasOpened) return null;

  return (
    <Suspense
      fallback={
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Loading form</DialogTitle>
            <DialogDescription role="status">Please wait…</DialogDescription>
          </DialogContent>
        </Dialog>
      }
    >
      {children}
    </Suspense>
  );
}
