import { Bell } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function NotificationsPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                    <Bell className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
                    <p className="text-muted-foreground">Configure how you want to receive alerts and updates.</p>
                </div>
            </div>
            <Separator />
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm">
                        <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                        <div className="flex-1">
                            <div className="h-4 w-1/4 bg-slate-100 animate-pulse rounded mb-2" />
                            <div className="h-3 w-3/4 bg-slate-50 animate-pulse rounded" />
                        </div>
                        <div className="h-4 w-16 bg-slate-100 animate-pulse rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}
