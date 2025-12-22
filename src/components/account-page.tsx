import { BadgeCheck } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function AccountPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <BadgeCheck className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
                    <p className="text-muted-foreground">Manage your account information and preferences.</p>
                </div>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="font-semibold mb-2">Profile Information</h3>
                    <p className="text-sm text-muted-foreground mb-4">Update your name, email, and avatar.</p>
                    <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
                        <div className="h-4 w-2/3 bg-slate-100 animate-pulse rounded" />
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="font-semibold mb-2">Security</h3>
                    <p className="text-sm text-muted-foreground mb-4">Change your password and enable 2FA.</p>
                    <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
                        <div className="h-4 w-2/3 bg-slate-100 animate-pulse rounded" />
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="font-semibold mb-2">Preferences</h3>
                    <p className="text-sm text-muted-foreground mb-4">Language and regional settings.</p>
                    <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
                        <div className="h-4 w-2/3 bg-slate-100 animate-pulse rounded" />
                    </div>
                </div>
            </div>
        </div>
    )
}
