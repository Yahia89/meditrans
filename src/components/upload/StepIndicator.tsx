import { cn } from '@/lib/utils'
import { Check, ArrowRight } from "@phosphor-icons/react"

interface StepIndicatorProps {
    currentStep: 'select' | 'preview' | 'staging'
}

const steps = [
    { id: 'select', label: 'Select File' },
    { id: 'preview', label: 'Preview & Confirm' },
    { id: 'staging', label: 'Review & Commit' },
]

export function StepIndicator({ currentStep }: StepIndicatorProps) {
    const getStepStatus = (index: number) => {
        const stepIds = steps.map(s => s.id)
        const currentIndex = stepIds.indexOf(currentStep)

        if (index < currentIndex) return 'completed'
        if (index === currentIndex) return 'current'
        return 'upcoming'
    }

    return (
        <div className="flex items-center gap-4 mb-8">
            {steps.map((step, i) => {
                const status = getStepStatus(i)
                return (
                    <div key={step.id} className="flex items-center gap-2">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                            status === 'current' && "bg-indigo-600 text-white",
                            status === 'completed' && "bg-green-500 text-white",
                            status === 'upcoming' && "bg-slate-200 text-slate-500",
                        )}>
                            {status === 'completed' ? <Check weight="bold" /> : i + 1}
                        </div>
                        <span className={cn(
                            "text-sm font-medium",
                            status === 'upcoming' ? "text-slate-400" : "text-slate-900"
                        )}>
                            {step.label}
                        </span>
                        {i < steps.length - 1 && <ArrowRight className="text-slate-300 mx-2" />}
                    </div>
                )
            })}
        </div>
    )
}
