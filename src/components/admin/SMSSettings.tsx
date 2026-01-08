import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase"; // Fix import path if needed
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChatCircleText, Spinner } from "@phosphor-icons/react";
// Assuming sonner is used, or generic toast

export function SMSSettings() {
  const { currentOrganization } = useOrganization(); // Assuming this exposes the org object or ID
  const { isAdmin, isOwner } = usePermissions();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadSettings();
    }
  }, [currentOrganization?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("sms_notifications_enabled")
        .eq("id", currentOrganization!.id)
        .single();

      if (error) throw error;
      setEnabled(data?.sms_notifications_enabled ?? true);
    } catch (error) {
      console.error("Error loading SMS settings", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSMS = async (checked: boolean) => {
    if (!isAdmin && !isOwner) return;

    // Optimistic update
    setEnabled(checked);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({ sms_notifications_enabled: checked })
        .eq("id", currentOrganization!.id);

      if (error) {
        setEnabled(!checked); // Revert
        console.error("Failed to update SMS settings", error);
        throw error;
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAdmin && !isOwner) return null;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <ChatCircleText weight="duotone" className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              SMS ETA Notifications
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Automatically send text messages to patients when their driver is
              5 minutes away. Includes real-time ETA calculation.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {loading ? (
            <Spinner className="animate-spin text-slate-400" />
          ) : (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sms-mode"
                checked={enabled}
                onCheckedChange={(checked) => toggleSMS(checked === true)}
              />
              <Label
                htmlFor="sms-mode"
                className="font-bold text-slate-700 cursor-pointer"
              >
                {enabled ? "Enabled" : "Disabled"}
              </Label>
            </div>
          )}
        </div>
      </div>

      {!enabled && (
        <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-xl font-medium border border-amber-100 flex gap-2">
          <span>⚠️</span>
          Patients will not receive arrival updates while this is disabled.
        </div>
      )}
    </div>
  );
}
