import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Eye, EyeSlash, Info } from "@phosphor-icons/react";

interface DemoModeBannerProps {
  className?: string;
}

export function DemoModeBanner({ className }: DemoModeBannerProps) {
  const { isDemoMode, setDemoMode, dataState } = useOnboarding();

  // Don't show if already have real data (live state)
  if (dataState === "live") {
    return null;
  }

  if (isDemoMode) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50 p-4",
          className
        )}
      >
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Eye size={20} weight="duotone" className="text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Demo Mode Active
              </h3>
              <p className="text-xs text-amber-700/80 font-medium">
                You're viewing sample data. This won't affect your real
                operations.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDemoMode(false)}
            className="text-amber-700 hover:bg-amber-100 font-bold px-4 transition-all"
          >
            Exit Demo
          </Button>
        </div>
      </div>
    );
  }

  // Show toggle to enable demo mode
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
            <Info size={20} weight="duotone" className="text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Looking for a preview?
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Explore the dashboard's capabilities with curated sample data.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDemoMode(true)}
          className="gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all font-bold shadow-none"
        >
          <Eye size={14} weight="duotone" />
          Try Demo Mode
        </Button>
      </div>
    </div>
  );
}

// Compact toggle for header/nav
export function DemoModeToggle({ className }: { className?: string }) {
  const { isDemoMode, setDemoMode, dataState } = useOnboarding();

  if (dataState === "live") {
    return null;
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
  );
}
