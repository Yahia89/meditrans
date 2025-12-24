import { X, Warning } from "@phosphor-icons/react"
import { useOnboarding } from '@/contexts/OnboardingContext'
import { useUploadFlow } from './upload/use-upload-flow'
import { UploadHeader } from './upload/UploadHeader'
import { StepIndicator } from './upload/StepIndicator'
import { UploadHistory } from './upload/UploadHistory'
import { SelectFileStep } from './upload/SelectFileStep'
import { PreviewStep } from './upload/PreviewStep'

export function UploadPage() {
    const {
        state,
        handleFileSelect,
        handleConfirmAndStage,
        reset,
        setImportSource,
        setSelectedSheet,
        clearError
    } = useUploadFlow()

    const {
        hasUploadedDrivers,
        hasUploadedPatients,
        hasUploadedEmployees,
        hasUploadedTrips
    } = useOnboarding()

    return (
        <div className="relative w-full min-h-[calc(100vh-4rem)] p-4 md:p-8 overflow-auto">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-slate-50/50 -z-10" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 blur-[120px] rounded-full -z-10 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-200/20 blur-[100px] rounded-full -z-10" />

            <div className="max-w-5xl mx-auto">
                <UploadHeader importSource={state.importSource} />

                <StepIndicator currentStep={state.step} />

                {/* Error Display */}
                {state.error && (
                    <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-4 duration-300">
                        <Warning weight="fill" className="h-5 w-5 shrink-0" />
                        <span className="flex-1 text-sm font-medium">{state.error}</span>
                        <button
                            onClick={clearError}
                            className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                        >
                            <X weight="bold" />
                        </button>
                    </div>
                )}

                <div className="space-y-8 pb-12">
                    {state.step === 'select' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Left Side: Upload Controls */}
                            <div className="lg:col-span-12 space-y-6">
                                <UploadHistory />

                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                                    <SelectFileStep
                                        importSource={state.importSource}
                                        onSourceChange={setImportSource}
                                        onFileSelected={handleFileSelect}
                                        isProcessing={state.isProcessing}
                                        hasUploadedDrivers={hasUploadedDrivers}
                                        hasUploadedPatients={hasUploadedPatients}
                                        hasUploadedEmployees={hasUploadedEmployees}
                                        hasUploadedTrips={hasUploadedTrips}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {state.step === 'preview' && (
                        <div className="animate-in fade-in zoom-in-95 duration-400">
                            <PreviewStep
                                file={state.file}
                                sheets={state.sheets}
                                selectedSheet={state.selectedSheet}
                                importSource={state.importSource}
                                isProcessing={state.isProcessing}
                                onSheetChange={setSelectedSheet}
                                onConfirm={handleConfirmAndStage}
                                onCancel={reset}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}