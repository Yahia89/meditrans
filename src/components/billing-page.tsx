import { CreditCard } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function BillingPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <CreditCard className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
                    <p className="text-muted-foreground">Manage your subscription, invoices, and payment methods.</p>
                </div>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="font-semibold mb-2">Current Plan</h3>
                    <p className="text-sm text-muted-foreground mb-4">You are currently on the Free plan.</p>
                    <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">
                        Free Plan
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <h3 className="font-semibold mb-2">Payment Methods</h3>
                    <p className="text-sm text-muted-foreground mb-4">No payment methods added yet.</p>
                    <div className="h-10 w-full bg-slate-100 animate-pulse rounded" />
                </div>
            </div>
        </div>
    )
}
