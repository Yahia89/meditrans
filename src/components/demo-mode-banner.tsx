import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/contexts/OnboardingContext'
import {
    Eye,
    EyeSlash,
    Info,
    X,
} from '@phosphor-icons/react'

interface DemoModeBannerProps {
    className?: string
}

export function DemoModeBanner({ className }: DemoModeBannerProps) {
    const { isDemoMode, setDemoMode, dataState } = useOnboarding()

    // Don't show if already have real data (live state)
    if (dataState === 'live') {
        return null
    }

    if (isDemoMode) {
        return (
            <div className={cn(
                "relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 shadow-lg",
                className
            )}>
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
                    }} />
                </div>

                <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                            <Eye size={20} weight="duotone" className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">
                                Demo Mode Active
                            </h3>
                            <p className="text-xs text-white/80">
                                You're viewing sample data. This won't affect your real data.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDemoMode(false)}
                        className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                    >
                        <X size={14} weight="bold" className="mr-1" />
                        Exit Demo
                    </Button>
                </div>
            </div>
        )
    }

    // Show toggle to enable demo mode
    return (
        <div className={cn(
            "rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4",
            className
        )}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                        <Info size={20} weight="duotone" className="text-slate-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-slate-900">
                            Want to see how it looks with data?
                        </h3>
                        <p className="text-xs text-slate-500">
                            Preview the dashboard with sample data before adding your own
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDemoMode(true)}
                    className="gap-2 border-slate-200 hover:border-slate-300"
                >
                    <Eye size={14} weight="duotone" />
                    Try Demo Mode
                </Button>
            </div>
        </div>
    )
}

// Compact toggle for header/nav
export function DemoModeToggle({ className }: { className?: string }) {
    const { isDemoMode, setDemoMode, dataState } = useOnboarding()

    if (dataState === 'live') {
        return null
    }

    return (
        <button
            onClick={() => setDemoMode(!isDemoMode)}
            className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                isDemoMode
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                className
            )}
        >
            {isDemoMode ? (
                <>
                    <EyeSlash size={14} weight="duotone" />
                    Exit Demo
                </>
            ) : (
                <>
                    <Eye size={14} weight="duotone" />
                    Demo Mode
                </>
            )}
        </button>
    )
}
