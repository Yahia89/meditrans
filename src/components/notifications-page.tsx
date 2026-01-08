import { Bell } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SMSSettings } from "./admin/SMSSettings";

export function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Configure how you want to receive alerts and updates.
          </p>
        </div>
      </div>
      <Separator />
      <div className="max-w-4xl space-y-6">
        <SMSSettings />

        {/* Future notification settings can go here */}
      </div>
    </div>
  );
}
