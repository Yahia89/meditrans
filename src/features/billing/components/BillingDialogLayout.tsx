import { useRef, type ComponentProps } from "react";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function BillingDialogContent({
  className,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <DialogContent
      onOpenAutoFocus={(event) => {
        openerRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        onOpenAutoFocus?.(event);
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        const opener = openerRef.current;
        openerRef.current = null;
        if (!event.defaultPrevented && opener?.isConnected) {
          event.preventDefault();
          opener.focus({ preventScroll: true });
        }
      }}
      className={cn(
        "billing-surface flex min-w-0 flex-col gap-0 overflow-hidden p-0 sm:p-0",
        "top-4 max-h-[calc(100dvh-2rem)] sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]",
        "[&>[data-slot=dialog-close]]:size-11",
        "motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export function BillingDialogHeader({
  className,
  ...props
}: ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn(
        "shrink-0 border-b px-5 py-5 pr-14 text-left sm:px-6 sm:pr-14",
        className,
      )}
      {...props}
    />
  );
}

export function BillingDialogBody({
  className,
  ...props
}: ComponentProps<typeof FieldGroup>) {
  return (
    <div
      className={cn(
        "@container/billing-dialog min-h-0 min-w-0 flex-1 gap-5 overflow-y-auto overscroll-contain p-5 sm:p-6",
        className,
      )}
    >
      <FieldGroup className="min-w-0 gap-5" {...props} />
    </div>
  );
}

export function BillingDialogFooter({
  className,
  ...props
}: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        "shrink-0 border-t bg-background px-5 py-4 sm:px-6 [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto",
        className,
      )}
      {...props}
    />
  );
}
