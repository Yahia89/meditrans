import { useRef } from 'react'
import {
    CloudArrowUp,
    CircleNotch,
    FileXls,
    CheckCircle
} from "@phosphor-icons/react"
import { cn } from '@/lib/utils'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import type { ImportSource } from './types'
import { COLUMN_MAPPINGS } from './types'

interface SelectFileStepProps {
    importSource: ImportSource
    onSourceChange: (source: ImportSource) => void
    onFileSelected: (file: File) => void
    isProcessing: boolean
    hasUploadedDrivers?: boolean
    hasUploadedPatients?: boolean
    hasUploadedEmployees?: boolean
}

export function SelectFileStep({
    importSource,
    onSourceChange,
    onFileSelected,
    isProcessing,
    hasUploadedDrivers,
    hasUploadedPatients,
    hasUploadedEmployees
}: SelectFileStepProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) onFileSelected(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) onFileSelected(file)
    }

    return (
        <div className="space-y-6">
            {/* Source Selection */}
            <div className="p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm">
                <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black underline decoration-2 underline-offset-2">1</span>
                    What are you importing today?
                </label>
                <Select
                    value={importSource}
                    onValueChange={(v: ImportSource) => onSourceChange(v)}
                >
                    <SelectTrigger className="w-full sm:w-72 h-11 border-slate-200 rounded-xl bg-white shadow-sm ring-offset-white focus:ring-2 focus:ring-indigo-500">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        <SourceItem value="drivers" label="Drivers Fleet" completed={hasUploadedDrivers} />
                        <SourceItem value="patients" label="Patients List" completed={hasUploadedPatients} />
                        <SourceItem value="employees" label="Team Members" completed={hasUploadedEmployees} />
                    </SelectContent>
                </Select>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={cn(
                    "relative p-12 md:p-20 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all duration-500",
                    "bg-white/40 hover:bg-white/90 hover:border-indigo-400 group shadow-lg shadow-slate-200/50",
                    "border-slate-200/60",
                    isProcessing && "pointer-events-none opacity-60"
                )}
            >
                {/* Visual Glow */}
                <div className="absolute inset-0 bg-indigo-400/0 group-hover:bg-indigo-400/5 rounded-[2rem] transition-colors" />

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                />
                <div className="text-center relative z-10">
                    <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150 group-hover:bg-indigo-500/30 transition-all duration-500" />
                        {isProcessing ? (
                            <CircleNotch className="w-20 h-20 text-indigo-600 animate-spin relative" weight="bold" />
                        ) : (
                            <CloudArrowUp className="w-20 h-20 text-indigo-500 relative transition-transform duration-500 group-hover:-translate-y-2" weight="duotone" />
                        )}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {isProcessing ? 'Processing Workspace...' : 'Drop your Excel file here'}
                    </h3>
                    <p className="mt-3 text-slate-500 font-medium max-w-sm mx-auto">
                        {isProcessing
                            ? "We're analyzing your data structures to ensure a perfect import."
                            : <span>Drag it here or <span className="text-indigo-600 underline underline-offset-4 decoration-2 decoration-indigo-200 hover:decoration-indigo-600 transition-colors">browse files</span>. .xlsx and .xls are supported.</span>
                        }
                    </p>
                </div>
            </div>

            {/* Format Guidelines */}
            <div className="p-6 bg-slate-100/30 backdrop-blur-sm rounded-2xl border border-slate-200 group">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <FileXls className="text-green-600 w-5 h-5 transition-transform group-hover:scale-110" weight="duotone" />
                    </div>
                    Expected Column Schema
                </h4>
                <div className="flex flex-wrap gap-2.5">
                    {Object.entries(COLUMN_MAPPINGS[importSource]).map(([field, aliases]) => (
                        <div key={field} className="group/item flex flex-col px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-200">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-0.5 group-hover/item:text-indigo-500">{field.replace('_', ' ')}</span>
                            <span className="text-sm font-bold text-slate-700">{aliases[0]}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-5 p-3 rounded-xl bg-amber-50 border border-amber-100/50 flex items-start gap-3">
                    <span className="text-lg">💡</span>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        Our <strong>SmarterAI Engine</strong> will automatically detect these patterns.
                        Exact matches are not required. Additional columns will be safely stored in the JSON metadata.
                    </p>
                </div>
            </div>
        </div>
    )
}

function SourceItem({ value, label, completed }: { value: string, label: string, completed?: boolean }) {
    return (
        <SelectItem value={value} className="focus:bg-indigo-50 cursor-pointer py-2.5">
            <span className="flex items-center justify-between w-full pr-2">
                <span className="font-semibold text-slate-700">{label}</span>
                {completed && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-[10px] font-black text-green-700 uppercase">
                        <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                        Imported
                    </div>
                )}
            </span>
        </SelectItem>
    )
}
