import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
    FileXls,
    X,
    Check,
    CloudArrowUp,
    CircleNotch,
    ArrowRight,
    Table,
    Warning,
    Eye,
} from "@phosphor-icons/react"
import { useQueryState } from 'nuqs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/contexts/OrganizationContext'

type ImportSource = 'drivers' | 'patients' | 'employees'

interface ParsedSheet {
    name: string
    headers: string[]
    rows: Record<string, any>[]
    totalRows: number
}

interface UploadState {
    step: 'select' | 'preview' | 'staging'
    file: File | null
    sheets: ParsedSheet[]
    selectedSheet: string
    importSource: ImportSource
    isProcessing: boolean
    error: string | null
}

// Column mappings for each import type
const COLUMN_MAPPINGS: Record<ImportSource, Record<string, string[]>> = {
    drivers: {
        full_name: ['name', 'full_name', 'fullname', 'driver', 'driver_name', 'driver name'],
        email: ['email', 'email_address', 'e-mail'],
        phone: ['phone', 'mobile', 'cell', 'contact', 'phone_number', 'phone number'],
        license_number: ['license', 'license_number', 'dl', 'license_no', 'license no'],
        vehicle_info: ['vehicle', 'car', 'vehicle_info', 'make_model', 'make', 'model'],
    },
    patients: {
        full_name: ['name', 'full_name', 'fullname', 'patient', 'patient_name', 'patient name'],
        email: ['email', 'email_address', 'e-mail'],
        phone: ['phone', 'mobile', 'cell', 'contact', 'phone_number', 'phone number'],
        date_of_birth: ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'birthday'],
        primary_address: ['address', 'primary_address', 'street', 'street_address'],
        notes: ['notes', 'note', 'comments', 'comment'],
    },
    employees: {
        full_name: ['name', 'full_name', 'fullname', 'employee', 'employee_name'],
        email: ['email', 'email_address', 'e-mail'],
        phone: ['phone', 'mobile', 'cell', 'contact', 'phone_number'],
        role: ['role', 'title', 'position', 'job_title'],
        department: ['department', 'dept', 'team'],
        hire_date: ['hire_date', 'start_date', 'date_hired', 'joined'],
    },
}

export function UploadPage() {
    const [state, setState] = useState<UploadState>({
        step: 'select',
        file: null,
        sheets: [],
        selectedSheet: '',
        importSource: 'drivers',
        isProcessing: false,
        error: null,
    })

    const [, setPage] = useQueryState('page')
    const [, setUploadIdParam] = useQueryState('upload_id')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { currentOrganization } = useOrganization()

    // Parse XLSX file on client side
    const parseFile = useCallback(async (file: File) => {
        setState(s => ({ ...s, isProcessing: true, error: null }))

        try {
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: 'array' })

            const sheets: ParsedSheet[] = workbook.SheetNames.map(name => {
                const worksheet = workbook.Sheets[name]
                // Get as array of arrays first
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

                if (rawData.length === 0) {
                    return { name, headers: [], rows: [], totalRows: 0 }
                }

                // Smart header detection - find row with most recognizable headers
                const knownHeaders = [
                    'name', 'fullname', 'email', 'phone', 'mobile', 'address',
                    'license', 'dob', 'date', 'vehicle', 'role', 'department', 'note'
                ]

                let headerRowIndex = 0
                let maxMatches = 0

                for (let i = 0; i < Math.min(rawData.length, 10); i++) {
                    const row = rawData[i]
                    if (!Array.isArray(row)) continue

                    const matches = row.filter(cell => {
                        const normalized = String(cell || '').toLowerCase().replace(/[^a-z]/g, '')
                        return knownHeaders.some(h => normalized.includes(h))
                    }).length

                    if (matches > maxMatches) {
                        maxMatches = matches
                        headerRowIndex = i
                    }
                }

                // Extract headers from detected row
                // Array.from ensures we handle sparse arrays (empty cells) correctly
                const headers = Array.from(rawData[headerRowIndex] || []).map((h, i) =>
                    String(h || `Column_${i + 1}`).trim()
                )

                // Convert remaining rows to objects
                const rows: Record<string, any>[] = []
                for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                    const rowArray = rawData[i]
                    if (!Array.isArray(rowArray) || rowArray.every(cell => !cell)) continue

                    const rowObj: Record<string, any> = {}
                    headers.forEach((header, idx) => {
                        if (idx < rowArray.length) {
                            rowObj[header] = rowArray[idx]
                        }
                    })
                    rows.push(rowObj)
                }

                return { name, headers, rows, totalRows: rows.length }
            }).filter(s => s.totalRows > 0)

            if (sheets.length === 0) {
                throw new Error('No data found in the Excel file')
            }

            setState(s => ({
                ...s,
                file,
                sheets,
                selectedSheet: sheets[0].name,
                step: 'preview',
                isProcessing: false,
            }))
        } catch (err: any) {
            setState(s => ({
                ...s,
                isProcessing: false,
                error: err.message || 'Failed to parse file',
            }))
        }
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['xlsx', 'xls'].includes(ext || '')) {
            setState(s => ({ ...s, error: 'Only Excel files (.xlsx, .xls) are supported' }))
            return
        }

        parseFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (!file) return

        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['xlsx', 'xls'].includes(ext || '')) {
            setState(s => ({ ...s, error: 'Only Excel files (.xlsx, .xls) are supported' }))
            return
        }

        parseFile(file)
    }

    // Map columns and stage data
    const handleConfirmAndStage = async () => {
        if (!currentOrganization || !state.file) return

        setState(s => ({ ...s, isProcessing: true, error: null }))

        try {
            const selectedSheet = state.sheets.find(s => s.name === state.selectedSheet)
            if (!selectedSheet) throw new Error('No sheet selected')

            // 1. Upload file to storage
            const timestamp = Date.now()
            const sanitizedName = state.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `${currentOrganization.id}/uploads/${timestamp}_${sanitizedName}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, state.file)

            if (uploadError) throw uploadError

            // 2. Create upload record
            const { data: uploadRecord, error: dbError } = await supabase
                .from('org_uploads')
                .insert({
                    org_id: currentOrganization.id,
                    uploaded_by: (await supabase.auth.getUser()).data.user?.id,
                    file_path: filePath,
                    original_filename: state.file.name,
                    file_size: state.file.size,
                    mime_type: state.file.type,
                    source: state.importSource,
                    status: 'processing',
                })
                .select()
                .single()

            if (dbError) throw dbError

            // 3. Map and stage data
            const mappings = COLUMN_MAPPINGS[state.importSource]
            const stagingRecords = selectedSheet.rows.map((row, index) => {
                const mapped: Record<string, any> = {
                    upload_id: uploadRecord.id,
                    org_id: currentOrganization.id,
                    row_index: index,
                    raw_data: row, // Preserve original row
                    status: 'pending',
                }

                // Map known columns
                const normalizedRow: Record<string, any> = {}
                Object.entries(row).forEach(([key, value]) => {
                    normalizedRow[key.toLowerCase().replace(/[^a-z0-9]/g, '_')] = value
                })

                Object.entries(mappings).forEach(([targetField, sourceFields]) => {
                    const matchedField = sourceFields.find(sf =>
                        Object.keys(normalizedRow).some(k => k.includes(sf.replace(/[^a-z]/g, '')))
                    )
                    if (matchedField) {
                        const key = Object.keys(normalizedRow).find(k =>
                            k.includes(matchedField.replace(/[^a-z]/g, ''))
                        )
                        if (key) {
                            mapped[targetField] = normalizedRow[key]
                        }
                    }
                })

                // Validation - mark as error if required fields missing
                if (!mapped.full_name) {
                    mapped.status = 'error'
                    mapped.validation_errors = { missing: ['full_name'] }
                }

                return mapped
            })

            // 4. Insert to staging table
            const tableName = `staging_${state.importSource}`
            const { error: stageError } = await supabase
                .from(tableName)
                .insert(stagingRecords)

            if (stageError) throw stageError

            // 5. Update upload record
            await supabase
                .from('org_uploads')
                .update({
                    status: 'ready_for_review',
                    processed_at: new Date().toISOString(),
                    notes: `Staged ${stagingRecords.length} rows for review.`,
                })
                .eq('id', uploadRecord.id)

            // 6. Navigate to review page
            setUploadIdParam(uploadRecord.id)
            setPage('review_import')

        } catch (err: any) {
            setState(s => ({
                ...s,
                isProcessing: false,
                error: err.message || 'Failed to stage data',
            }))
        }
    }

    const reset = () => {
        setState({
            step: 'select',
            file: null,
            sheets: [],
            selectedSheet: '',
            importSource: 'drivers',
            isProcessing: false,
            error: null,
        })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const currentSheet = state.sheets.find(s => s.name === state.selectedSheet)

    return (
        <div className="relative w-full min-h-[calc(100vh-4rem)] p-8 overflow-auto">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 -z-10" />

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Import Data
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Upload an Excel file to import {state.importSource} into {currentOrganization?.name || 'your organization'}
                    </p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-4 mb-8">
                    {['Select File', 'Preview & Confirm', 'Review & Commit'].map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                                i === 0 && state.step === 'select' && "bg-indigo-600 text-white",
                                i === 1 && state.step === 'preview' && "bg-indigo-600 text-white",
                                i === 2 && state.step === 'staging' && "bg-indigo-600 text-white",
                                (i === 0 && state.step !== 'select') && "bg-green-500 text-white",
                                (i > 0 && state.step === 'select') && "bg-slate-200 text-slate-500",
                                (i > 1 && state.step === 'preview') && "bg-slate-200 text-slate-500",
                            )}>
                                {(i === 0 && state.step !== 'select') ? <Check weight="bold" /> : i + 1}
                            </div>
                            <span className={cn(
                                "text-sm font-medium",
                                ((i === 0 && state.step === 'select') || (i === 1 && state.step === 'preview'))
                                    ? "text-slate-900" : "text-slate-400"
                            )}>{label}</span>
                            {i < 2 && <ArrowRight className="text-slate-300 mx-2" />}
                        </div>
                    ))}
                </div>

                {/* Error Display */}
                {state.error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                        <Warning weight="fill" className="h-5 w-5" />
                        <span className="flex-1">{state.error}</span>
                        <button onClick={() => setState(s => ({ ...s, error: null }))} className="hover:text-red-900">
                            <X weight="bold" />
                        </button>
                    </div>
                )}

                {/* Step 1: Select File */}
                {state.step === 'select' && (
                    <div className="space-y-6">
                        {/* Source Selection */}
                        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                What are you importing?
                            </label>
                            <Select
                                value={state.importSource}
                                onValueChange={(v: ImportSource) => setState(s => ({ ...s, importSource: v }))}
                            >
                                <SelectTrigger className="w-64">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="drivers">Drivers</SelectItem>
                                    <SelectItem value="patients">Patients</SelectItem>
                                    <SelectItem value="employees">Employees</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Drop Zone */}
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "relative p-16 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                                "bg-white hover:bg-indigo-50/50 hover:border-indigo-300",
                                "border-slate-200",
                                state.isProcessing && "pointer-events-none opacity-60"
                            )}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="text-center">
                                {state.isProcessing ? (
                                    <CircleNotch className="w-16 h-16 mx-auto text-indigo-500 animate-spin" />
                                ) : (
                                    <CloudArrowUp className="w-16 h-16 mx-auto text-indigo-400" weight="duotone" />
                                )}
                                <h3 className="mt-4 text-xl font-semibold text-slate-700">
                                    {state.isProcessing ? 'Parsing file...' : 'Drop your Excel file here'}
                                </h3>
                                <p className="mt-2 text-slate-500">
                                    or click to browse. Only <strong>.xlsx</strong> and <strong>.xls</strong> files are supported.
                                </p>
                            </div>
                        </div>

                        {/* Format Guidelines */}
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                <FileXls className="text-green-600" weight="duotone" />
                                Expected Columns for {state.importSource}
                            </h4>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(COLUMN_MAPPINGS[state.importSource]).map(([field, aliases]) => (
                                    <span key={field} className="px-3 py-1 bg-white rounded-full text-sm border border-slate-200">
                                        <strong>{field.replace('_', ' ')}</strong>
                                        <span className="text-slate-400 ml-1">({aliases[0]})</span>
                                    </span>
                                ))}
                            </div>
                            <p className="mt-3 text-sm text-slate-500">
                                Don't worry if your columns don't match exactly—we'll detect and map them automatically.
                                Any extra columns will be preserved in <code>custom_fields</code>.
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview & Confirm */}
                {state.step === 'preview' && currentSheet && (
                    <div className="space-y-6">
                        {/* File Info & Actions */}
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                            <div className="flex items-center gap-4">
                                <FileXls className="w-10 h-10 text-green-600" weight="duotone" />
                                <div>
                                    <p className="font-semibold text-slate-800">{state.file?.name}</p>
                                    <p className="text-sm text-slate-500">
                                        {currentSheet.totalRows} rows • Sheet: {currentSheet.name}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={reset}>
                                    <X className="mr-2" /> Cancel
                                </Button>
                                <Button
                                    onClick={handleConfirmAndStage}
                                    disabled={state.isProcessing}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {state.isProcessing ? (
                                        <><CircleNotch className="mr-2 animate-spin" /> Staging...</>
                                    ) : (
                                        <><Check className="mr-2" weight="bold" /> Confirm & Stage</>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Sheet Selector (if multiple sheets) */}
                        {state.sheets.length > 1 && (
                            <div className="p-4 bg-white rounded-xl border border-slate-200">
                                <label className="block text-sm font-medium mb-2">Select Sheet</label>
                                <Select
                                    value={state.selectedSheet}
                                    onValueChange={v => setState(s => ({ ...s, selectedSheet: v }))}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {state.sheets.map(sheet => (
                                            <SelectItem key={sheet.name} value={sheet.name}>
                                                {sheet.name} ({sheet.totalRows} rows)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Data Preview Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div className="flex items-center gap-2">
                                    <Table className="text-indigo-600" weight="duotone" />
                                    <h3 className="font-semibold">Data Preview</h3>
                                    <span className="text-sm text-slate-500">
                                        (showing first 20 of {currentSheet.totalRows} rows)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Eye weight="duotone" />
                                    {currentSheet.headers.length} columns detected
                                </div>
                            </div>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-600 w-12">#</th>
                                            {currentSheet.headers.map((header, i) => (
                                                <th key={i} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentSheet.rows.slice(0, 20).map((row, rowIdx) => (
                                            <tr key={rowIdx} className="border-t border-slate-100 hover:bg-slate-50">
                                                <td className="px-4 py-3 text-slate-400">{rowIdx + 1}</td>
                                                {currentSheet.headers.map((header, colIdx) => (
                                                    <td key={colIdx} className="px-4 py-3 text-slate-700 max-w-xs truncate">
                                                        {row[header] ?? <span className="text-slate-300">—</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mapping Preview */}
                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <h4 className="font-semibold text-indigo-900 mb-3">Column Mapping Preview</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.entries(COLUMN_MAPPINGS[state.importSource]).map(([targetField, sourceFields]) => {
                                    const matchedHeader = currentSheet.headers.find(h =>
                                        h && sourceFields.some(sf => h.toLowerCase().replace(/[^a-z]/g, '').includes(sf.replace(/[^a-z]/g, '')))
                                    )
                                    return (
                                        <div key={targetField} className={cn(
                                            "p-3 rounded-lg",
                                            matchedHeader ? "bg-white border border-green-200" : "bg-white/50 border border-dashed border-slate-300"
                                        )}>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                {targetField.replace('_', ' ')}
                                            </p>
                                            {matchedHeader ? (
                                                <p className="font-medium text-green-700 flex items-center gap-1">
                                                    <Check weight="bold" className="text-green-500" />
                                                    → {matchedHeader}
                                                </p>
                                            ) : (
                                                <p className="text-slate-400 text-sm">Not found</p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            <p className="mt-4 text-sm text-indigo-700">
                                Unmapped columns will be preserved in <code className="bg-indigo-100 px-1 rounded">raw_data</code> for reference.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}