import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { getAccessStateLabel } from "@/lib/user-access-policy";

export type AccessTargetType = "employee" | "driver" | "patient";

interface ToggleAccessResult {
  disabled: boolean;
  auth_user_updated: boolean;
}

interface UserAccessToggleButtonProps {
  targetType: AccessTargetType;
  recordId: string;
  subjectName: string;
  disabled: boolean;
  canManage: boolean;
  isDemoMode?: boolean;
  onSuccess?: () => void;
}

interface UserAccessConfirmDialogProps extends UserAccessToggleButtonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function getFunctionErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = await error.context.clone().json();
      if (body && typeof body.error === "string") return body.error;
      if (body && typeof body.message === "string") return body.message;
    } catch {
      const text = await error.context.clone().text();
      if (text) return text;
    }
  }

  return error instanceof Error ? error.message : "Please try again.";
}

export function AccessStatusBadge({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        disabled
          ? "bg-red-100 text-red-700"
          : "bg-emerald-100 text-emerald-700",
      )}
    >
      {getAccessStateLabel(disabled)}
    </span>
  );
}

export function UserAccessConfirmDialog({
  targetType,
  recordId,
  subjectName,
  disabled,
  canManage,
  isDemoMode = false,
  onSuccess,
  open,
  onOpenChange,
}: UserAccessConfirmDialogProps) {
  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<ToggleAccessResult>(
        "toggle-user-access",
        {
          body: {
            target_type: targetType,
            record_id: recordId,
          },
        },
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      onOpenChange(false);
      onSuccess?.();
      toast.success(result?.disabled ? "Access disabled" : "Access enabled", {
        description: result?.auth_user_updated
          ? result.disabled
            ? `${subjectName} can no longer sign in until access is enabled again.`
            : `${subjectName} can sign in and access organization resources again.`
          : "Record updated. No linked auth account was found.",
      });
    },
    onError: async (error) => {
      const message = await getFunctionErrorMessage(error);
      toast.error("Unable to update access", {
        description: message,
      });
    },
  });

  if (!canManage) return null;

  const nextAction = disabled ? "Enable Access" : "Disable Access";
  const Icon = disabled ? ShieldCheck : LockKeyhole;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-slate-200">
        <AlertDialogHeader>
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
              disabled ? "bg-emerald-50" : "bg-red-50",
            )}
          >
            <Icon
              className={cn(
                "w-6 h-6",
                disabled ? "text-emerald-600" : "text-red-600",
              )}
            />
          </div>
          <AlertDialogTitle className="text-xl font-bold text-slate-900">
            {nextAction}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            {disabled
              ? `${subjectName} will be allowed to sign in and access organization resources again.`
              : `${subjectName} will be suspended from signing in and access will be blocked until re-enabled.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel className="rounded-xl border-slate-200 font-bold h-11">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
            disabled={isDemoMode || mutation.isPending}
            className={cn(
              "text-white rounded-xl font-bold h-11 px-8 shadow-lg",
              disabled
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50"
                : "bg-red-600 hover:bg-red-700 shadow-red-200/50",
            )}
          >
            {mutation.isPending ? "Updating..." : nextAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UserAccessToggleButton(props: UserAccessToggleButtonProps) {
  const [open, setOpen] = useState(false);

  if (!props.canManage) return null;

  const nextAction = props.disabled ? "Enable Access" : "Disable Access";
  const Icon = props.disabled ? ShieldCheck : LockKeyhole;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={props.isDemoMode}
        className={cn(
          "w-full items-center justify-center gap-2 rounded-xl 2xl:w-auto",
          props.disabled
            ? "text-emerald-700 border-emerald-100 hover:bg-emerald-50"
            : "text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700",
        )}
      >
        <Icon size={16} />
        {nextAction}
      </Button>
      <UserAccessConfirmDialog
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
