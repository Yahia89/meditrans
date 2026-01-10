import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChatCircleText, Spinner } from "@phosphor-icons/react";

export function SMSSettings() {
  const { currentOrganization } = useOrganization();
  const { isAdmin, isOwner } = usePermissions();
  const [enabled, setEnabled] = useState(false);
  const [originalEnabled, setOriginalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = enabled !== originalEnabled;

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
      const value = data?.sms_notifications_enabled ?? true;
      setEnabled(value);
      setOriginalEnabled(value);
    } catch (error) {
      console.error("Error loading SMS settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin && !isOwner) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("organizations")
        .update({ sms_notifications_enabled: enabled })
        .eq("id", currentOrganization!.id);

      if (error) throw error;

      // Update the original value after successful save
      setOriginalEnabled(enabled);
    } catch (err) {
      console.error("Failed to save SMS settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin && !isOwner) return null;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <ChatCircleText
              weight="duotone"
              className="w-5 h-5 sm:w-6 sm:h-6"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              SMS ETA Notifications
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Automatically send text messages to patients when their driver is
              5 minutes away. Includes real-time ETA calculation.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-2 sm:pt-0">
          {loading ? (
            <Spinner className="animate-spin text-slate-400" />
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sms-mode"
                  checked={enabled}
                  onCheckedChange={(checked) => setEnabled(checked === true)}
                />
                <Label
                  htmlFor="sms-mode"
                  className="font-bold text-slate-700 cursor-pointer text-sm"
                >
                  {enabled ? "Enabled" : "Disabled"}
                </Label>
              </div>

              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-[#3D5A3D] hover:bg-[#2E4A2E] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                size="sm"
              >
                {saving ? (
                  <>
                    <Spinner className="animate-spin w-4 h-4 mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {!loading && !enabled && (
        <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-xs sm:text-sm rounded-xl font-medium border border-amber-100 flex gap-2">
          <span>⚠️</span>
          <span>
            Patients will not receive arrival updates while this is disabled.
          </span>
        </div>
      )}
    </div>
  );
}
