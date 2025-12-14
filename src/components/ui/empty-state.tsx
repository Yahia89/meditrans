import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@phosphor-icons/react'

interface EmptyStateProps {
    icon: ReactNode
    title: string
    description: string
    primaryAction?: {
        label: string
        onClick: () => void
        icon?: ReactNode
    }
    secondaryAction?: {
        label: string
        onClick: () => void
    }
    className?: string
    variant?: 'default' | 'compact' | 'card'
}

export function EmptyState({
    icon,
    title,
    description,
    primaryAction,
    secondaryAction,
    className,
    variant = 'default',
}: EmptyStateProps) {
    if (variant === 'compact') {
        return (
            <div className={cn(
                "flex flex-col items-center justify-center py-12 px-6 text-center",
                className
            )}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                    {icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
                {primaryAction && (
                    <Button
                        onClick={primaryAction.onClick}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
                    >
                        {primaryAction.icon}
                        {primaryAction.label}
                    </Button>
                )}
            </div>
        )
    }

    if (variant === 'card') {
        return (
            <div className={cn(
                "rounded-2xl border border-slate-200 bg-white p-8 shadow-sm",
                className
            )}>
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3D5A3D]/10 to-[#3D5A3D]/5 flex items-center justify-center text-[#3D5A3D] mb-5">
                        {icon}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>
                    <div className="flex items-center gap-3">
                        {primaryAction && (
                            <Button
                                onClick={primaryAction.onClick}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
                            >
                                {primaryAction.icon}
                                {primaryAction.label}
                            </Button>
                        )}
                        {secondaryAction && (
                            <Button
                                variant="outline"
                                onClick={secondaryAction.onClick}
                                className="rounded-lg border-slate-200 hover:bg-slate-50"
                            >
                                {secondaryAction.label}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Default variant - full page empty state
    return (
        <div className={cn(
            "flex flex-col items-center justify-center min-h-[500px] py-16 px-8",
            className
        )}>
            {/* Decorative background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-[#3D5A3D]/5 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
                {/* Icon container with animated gradient border */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#3D5A3D] to-emerald-600 blur-lg opacity-20 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#3D5A3D]/10 via-white to-[#3D5A3D]/5 flex items-center justify-center text-[#3D5A3D] shadow-lg border border-[#3D5A3D]/10">
                        {icon}
                    </div>
                </div>

                <h2 className="text-2xl font-semibold text-slate-900 mb-3">{title}</h2>
                <p className="text-base text-slate-500 mb-8 leading-relaxed">{description}</p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {primaryAction && (
                        <Button
                            onClick={primaryAction.onClick}
                            size="lg"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#3D5A3D] px-6 py-3 text-base font-medium text-white shadow-lg shadow-[#3D5A3D]/20 transition-all hover:bg-[#2E4A2E] hover:shadow-xl hover:shadow-[#3D5A3D]/30 hover:-translate-y-0.5"
                        >
                            {primaryAction.icon}
                            {primaryAction.label}
                            <ArrowRight size={18} weight="bold" className="ml-1" />
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="ghost"
                            onClick={secondaryAction.onClick}
                            className="text-slate-600 hover:text-slate-900"
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

// Pre-configured empty states for common scenarios
export function PatientsEmptyState({ onAddPatient, onUpload }: { onAddPatient: () => void, onUpload: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
            }
            title="No patients yet"
            description="Start by adding your first patient record. You can add patients manually or import them from a spreadsheet."
            primaryAction={{
                label: 'Add your first patient',
                onClick: onAddPatient,
            }}
            secondaryAction={{
                label: 'Upload patient data',
                onClick: onUpload,
            }}
        />
    )
}

export function DriversEmptyState({ onAddDriver, onUpload }: { onAddDriver: () => void, onUpload: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
            }
            title="No drivers yet"
            description="Register your driver fleet to start assigning trips. Add drivers manually or import from a file."
            primaryAction={{
                label: 'Add your first driver',
                onClick: onAddDriver,
            }}
            secondaryAction={{
                label: 'Upload driver data',
                onClick: onUpload,
            }}
        />
    )
}

export function EmployeesEmptyState({ onAddEmployee, onUpload }: { onAddEmployee: () => void, onUpload: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
            }
            title="No team members yet"
            description="Add your staff to help manage daily operations. Invite dispatchers, admins, and support personnel."
            primaryAction={{
                label: 'Add your first team member',
                onClick: onAddEmployee,
            }}
            secondaryAction={{
                label: 'Upload employee data',
                onClick: onUpload,
            }}
        />
    )
}
