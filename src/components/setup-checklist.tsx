import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/contexts/OnboardingContext'
import type { SetupChecklistItem } from '@/contexts/OnboardingContext'
import {
    Check,
    ArrowRight,
    Sparkle,
    RocketLaunch,
} from '@phosphor-icons/react'

interface SetupChecklistProps {
    className?: string
}

export function SetupChecklist({ className }: SetupChecklistProps) {
    const {
        setupChecklist,
        completedSteps,
        totalSteps,
        completionPercentage,
        dataState,
    } = useOnboarding()

    // Don't show if already live
    if (dataState === 'live') {
        return null
    }

    return (
        <div className={cn(
            "rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden",
            className
        )}>
            {/* Header with progress */}
            <div className="p-6 bg-gradient-to-br from-[#3D5A3D] to-[#2E4A2E] text-white">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <RocketLaunch size={20} weight="duotone" />
                            <h2 className="text-lg font-semibold">Get Started</h2>
                        </div>
                        <p className="text-sm text-white/80">
                            Complete these steps to set up your workspace
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                        <Sparkle size={14} weight="fill" className="text-amber-300" />
                        <span className="text-sm font-medium">
                            {completedSteps}/{totalSteps}
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="relative">
                    <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-300 transition-all duration-500 ease-out"
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                    <p className="text-xs text-white/60 mt-2">
                        {completionPercentage}% complete
                    </p>
                </div>
            </div>

            {/* Checklist items */}
            <div className="divide-y divide-slate-100">
                {setupChecklist
                    .sort((a, b) => a.priority - b.priority)
                    .map((item, index) => (
                        <ChecklistItem
                            key={item.id}
                            item={item}
                            index={index + 1}
                        />
                    ))}
            </div>

            {/* Footer */}
            {completionPercentage === 100 && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-t border-emerald-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                            <Check size={20} weight="bold" />
                        </div>
                        <div>
                            <p className="font-semibold text-emerald-900">All set!</p>
                            <p className="text-sm text-emerald-700">
                                You're ready to start using the full dashboard
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

interface ChecklistItemProps {
    item: SetupChecklistItem
    index: number
}

function ChecklistItem({ item, index }: ChecklistItemProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-4 p-4 transition-colors",
                item.completed
                    ? "bg-slate-50/50"
                    : "hover:bg-slate-50/50"
            )}
        >
            {/* Step indicator */}
            <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                item.completed
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-500 border-2 border-slate-200"
            )}>
                {item.completed ? (
                    <Check size={16} weight="bold" />
                ) : (
                    index
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h3 className={cn(
                    "text-sm font-medium transition-colors",
                    item.completed ? "text-slate-500 line-through" : "text-slate-900"
                )}>
                    {item.label}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {item.description}
                </p>
            </div>

            {/* Action button */}
            <Button
                variant={item.completed ? "ghost" : "default"}
                size="sm"
                onClick={item.ctaAction}
                className={cn(
                    "flex-shrink-0 rounded-lg transition-all",
                    item.completed
                        ? "text-slate-500 hover:text-slate-700"
                        : "bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white"
                )}
            >
                {item.ctaLabel}
                {!item.completed && <ArrowRight size={14} weight="bold" className="ml-1" />}
            </Button>
        </div>
    )
}

// Compact version for sidebar or smaller spaces
export function CompactSetupProgress({ className }: { className?: string }) {
    const { completedSteps, totalSteps, completionPercentage, dataState } = useOnboarding()

    if (dataState === 'live') {
        return null
    }

    return (
        <div className={cn(
            "p-4 rounded-xl bg-gradient-to-br from-[#3D5A3D]/10 to-[#3D5A3D]/5 border border-[#3D5A3D]/20",
            className
        )}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Setup Progress</span>
                <span className="text-xs font-semibold text-[#3D5A3D]">
                    {completedSteps}/{totalSteps}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-[#3D5A3D] to-emerald-500 transition-all duration-500"
                    style={{ width: `${completionPercentage}%` }}
                />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
                {completionPercentage < 100
                    ? 'Complete setup to unlock analytics'
                    : 'Setup complete!'}
            </p>
        </div>
    )
}
