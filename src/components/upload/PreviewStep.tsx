import {
    FileXls,
    X,
    Check,
    CircleNotch,
    Table,
    Eye,
    CheckCircle
} from "@phosphor-icons/react"
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from '@/lib/utils'
import type { ParsedSheet, ImportSource } from './types'
import { COLUMN_MAPPINGS } from './types'

interface PreviewStepProps {
    file: File | null
    sheets: ParsedSheet[]
    selectedSheet: string
    importSource: ImportSource
    isProcessing: boolean
    onSheetChange: (sheetName: string) => void
    onConfirm: () => void
    onCancel: () => void
}

export function PreviewStep({
    file,
    sheets,
    selectedSheet,
    importSource,
    isProcessing,
    onSheetChange,
    onConfirm,
    onCancel,
}: PreviewStepProps) {
    const currentSheet = sheets.find(s => s.name === selectedSheet)
    if (!currentSheet) return null

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* File Info & Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200 gap-6 shadow-xl shadow-slate-200/40">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center border border-green-100/50 shadow-inner">
                        <FileXls className="w-10 h-10 text-green-600" weight="duotone" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-xl tracking-tight truncate max-w-[200px] md:max-w-md">{file?.name}</h3>
                        <p className="text-sm text-slate-500 font-bold flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider text-[10px] text-slate-600 border border-slate-200/50">
                                {currentSheet.totalRows} records
                            </span>
                            <span>•</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider text-[10px] border border-indigo-100/50">
                                Sheet: {currentSheet.name}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="h-12 px-6 rounded-xl border-slate-200 font-bold hover:bg-slate-50 text-slate-600 transition-all"
                    >
                        <X className="mr-2" weight="bold" /> Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-slate-900 border-none font-black tracking-wide shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                        {isProcessing ? (
                            <><CircleNotch className="mr-2 animate-spin" weight="bold" /> Staging Data...</>
                        ) : (
                            <><Check className="mr-2" weight="bold" /> Confirm Import</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Sheet Selector (if multiple sheets) */}
            {sheets.length > 1 && (
                <div className="p-5 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm animate-in fade-in duration-700">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Workbook Content</label>
                    <Select
                        value={selectedSheet}
                        onValueChange={onSheetChange}
                    >
                        <SelectTrigger className="w-full sm:w-72 h-11 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {sheets.map(sheet => (
                                <SelectItem key={sheet.name} value={sheet.name} className="py-2.5">
                                    <div className="flex items-center justify-between w-full min-w-[200px]">
                                        <span className="font-semibold">{sheet.name}</span>
                                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-1.5 rounded">{sheet.totalRows}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Data Preview Table */}
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-2xl shadow-indigo-900/5 transition-all duration-500 hover:shadow-indigo-900/10">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Table className="text-indigo-600 w-6 h-6" weight="duotone" />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 tracking-tight">Structured Preview</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated normalization engine results</p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                            <tr>
                                <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 w-16">#</th>
                                {currentSheet.headers.map((header, i) => (
                                    <th key={i} className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 whitespace-nowrap min-w-[150px]">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentSheet.rows.slice(0, 20).map((row, rowIdx) => (
                                <tr key={rowIdx} className="group hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-5 py-4 text-slate-300 font-black text-xs group-hover:text-indigo-400 transition-colors">{rowIdx + 1}</td>
                                    {currentSheet.headers.map((header, colIdx) => (
                                        <td key={colIdx} className="px-5 py-4 text-slate-700 font-medium max-w-xs truncate group-hover:text-slate-900 transition-colors">
                                            {row[header] ?? <span className="text-slate-200 font-black">---</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {currentSheet.totalRows > 20 && (
                        <div className="p-4 bg-slate-50/50 text-center border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Rendering first 20 records • {currentSheet.totalRows - 20} more rows hidden
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mapping Preview */}
            <div className="p-8 bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-[2.5rem] border border-indigo-800/50 shadow-2xl relative overflow-hidden group/mapping">
                {/* Decorative Elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] transition-all duration-700 group-hover/mapping:bg-indigo-500/30" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 ring-1 ring-white/20">
                            <CheckCircle className="text-white w-6 h-6" weight="fill" />
                        </div>
                        <div>
                            <h4 className="font-black text-white text-xl tracking-tight">SmarterField™ Mapping</h4>
                            <p className="text-indigo-200/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">AI-Powered Relationship Detection</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(COLUMN_MAPPINGS[importSource]).map(([targetField, sourceFields]) => {
                            const matchedHeader = currentSheet.headers.find(h =>
                                h && sourceFields.some(sf => h.toLowerCase().replace(/[^a-z]/g, '').includes(sf.replace(/[^a-z]/g, '')))
                            )
                            return (
                                <div key={targetField} className={cn(
                                    "p-5 rounded-[1.5rem] transition-all duration-500 border backdrop-blur-md",
                                    matchedHeader
                                        ? "bg-white/10 border-white/20 ring-1 ring-white/5 shadow-lg group/field"
                                        : "bg-black/20 border-white/5 border-dashed"
                                )}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest group-hover/field:text-white transition-colors">
                                            {targetField.replace('_', ' ')}
                                        </p>
                                        {matchedHeader && <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/40"><Check className="text-green-400 w-3 h-3" weight="bold" /></div>}
                                    </div>
                                    {matchedHeader ? (
                                        <p className="font-bold text-white text-base truncate pr-2">
                                            {matchedHeader}
                                        </p>
                                    ) : (
                                        <p className="text-white/20 text-sm font-bold italic tracking-wide">Missing Data Source</p>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md flex items-start gap-4 transition-all hover:bg-white/[0.08]">
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                            <span className="text-sm">⚙️</span>
                        </div>
                        <p className="text-xs text-indigo-100/70 leading-relaxed font-medium">
                            <strong className="text-white">Heuristic Analysis Complete:</strong> Any unmapped source columns will be automatically encrypted and stored as <code className="bg-indigo-500/30 text-white px-2 py-0.5 rounded font-mono text-[10px] border border-white/10">custom_fields</code> to prevent any data loss during the migration process.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
