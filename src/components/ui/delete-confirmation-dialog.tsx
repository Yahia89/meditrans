import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Warning } from "@phosphor-icons/react";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDeleting = false,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-slate-200">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <Warning weight="duotone" className="w-6 h-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-slate-900">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            {description}
            {itemName && (
              <span className="font-bold text-slate-900 ml-1">{itemName}</span>
            )}
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel className="rounded-xl border-slate-200 font-bold h-11">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-red-200/50"
          >
            {isDeleting ? "Deleting..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
