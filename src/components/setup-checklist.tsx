import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import type { SetupChecklistItem } from "@/contexts/OnboardingContext";
import { Check, ArrowRight, RocketLaunch } from "@phosphor-icons/react";

interface SetupChecklistProps {
  className?: string;
}

export function SetupChecklist({ className }: SetupChecklistProps) {
  const {
    setupChecklist,
    completedSteps,
    totalSteps,
    completionPercentage,
    dataState,
  } = useOnboarding();

  // Don't show if already live
  if (dataState === "live") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      {/* Header with progress */}
      <div className="p-8 bg-emerald-900 text-white">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RocketLaunch size={24} weight="duotone" />
              <h2 className="text-xl font-bold tracking-tight">
                Onboarding Navigator
              </h2>
            </div>
            <p className="text-sm text-emerald-100/80 font-medium max-w-xs leading-relaxed">
              Configure your workspace settings to unlock advanced operational
              insights.
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md">
            <span className="text-xs font-bold uppercase tracking-widest">
              Phase {completedSteps} of {totalSteps}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-1000 ease-in-out shadow-[0_0_12px_rgba(52,211,153,0.3)]"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.2em]">
              System Readiness: {completionPercentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-slate-100">
        {setupChecklist
          .sort((a, b) => a.priority - b.priority)
          .map((item, index) => (
            <ChecklistItem key={item.id} item={item} index={index + 1} />
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
  );
}

interface ChecklistItemProps {
  item: SetupChecklistItem;
  index: number;
}

function ChecklistItem({ item, index }: ChecklistItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 transition-colors",
        item.completed ? "bg-slate-50/50" : "hover:bg-slate-50/50"
      )}
    >
      {/* Step indicator */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
          item.completed
            ? "bg-emerald-500 text-white"
            : "bg-slate-100 text-slate-500 border-2 border-slate-200"
        )}
      >
        {item.completed ? <Check size={16} weight="bold" /> : index}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            "text-sm font-medium transition-colors",
            item.completed ? "text-slate-500 line-through" : "text-slate-900"
          )}
        >
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
            : "bg-emerald-900 hover:bg-emerald-950 text-white font-bold px-4"
        )}
      >
        {item.ctaLabel}
        {!item.completed && (
          <ArrowRight size={14} weight="bold" className="ml-1" />
        )}
      </Button>
    </div>
  );
}

// Compact version for sidebar or smaller spaces
export function CompactSetupProgress({ className }: { className?: string }) {
  const { completedSteps, totalSteps, completionPercentage, dataState } =
    useOnboarding();

  if (dataState === "live") {
    return null;
  }

  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-gradient-to-br from-[#3D5A3D]/10 to-[#3D5A3D]/5 border border-[#3D5A3D]/20",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">
          Setup Progress
        </span>
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
          ? "Complete setup to unlock analytics"
          : "Setup complete!"}
      </p>
    </div>
  );
}
