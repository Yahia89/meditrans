import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { useQueryState } from 'nuqs'
import type {
    UploadState,
    ImportSource,
    ParsedSheet
} from './types'
import { COLUMN_MAPPINGS } from './types'
import { useUploadHistory } from '@/hooks/use-upload-history'

export function useUploadFlow() {
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
    const { currentOrganization } = useOrganization()
    const { refreshUploadHistory: refreshOnboardingHistory, refreshDataCounts } = useOnboarding()
    const { refresh: refreshQueryHistory } = useUploadHistory()

    const parseFile = useCallback(async (file: File) => {
        setState(s => ({ ...s, isProcessing: true, error: null }))

        try {
            const buffer = await file.arrayBuffer()
            // Improved parsing options for better date and format support
            const workbook = XLSX.read(buffer, {
                type: 'array',
                cellDates: true,
                cellNF: true,
                cellText: true
            })

            const sheets: ParsedSheet[] = workbook.SheetNames.map(name => {
                const worksheet = workbook.Sheets[name]
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

                if (rawData.length === 0) {
                    return { name, headers: [], rows: [], totalRows: 0 }
                }

                // Expanded known headers to match the new comprehensive mappings
                const knownHeaders = [
                    'name', 'fullname', 'email', 'phone', 'mobile', 'address',
                    'license', 'dob', 'date', 'vehicle', 'role', 'department', 'note',
                    'id', 'plate', 'insurance', 'policy', 'referral', 'waiver', 'case', 'manager',
                    'pickup', 'dropoff', 'destination', 'time', 'status', 'county'
                ]

                let headerRowIndex = 0
                let maxMatches = 0

                // Look through first 20 rows for the header row (sometimes there's junk at the top)
                for (let i = 0; i < Math.min(rawData.length, 20); i++) {
                    const row = rawData[i]
                    if (!Array.isArray(row)) continue

                    const matches = row.filter(cell => {
                        if (!cell) return false
                        const normalized = String(cell).toLowerCase().replace(/[^a-z]/g, '')
                        return knownHeaders.some(h => normalized.includes(h))
                    }).length

                    if (matches > maxMatches) {
                        maxMatches = matches
                        headerRowIndex = i
                    }
                }

                const headers = Array.from(rawData[headerRowIndex] || []).map((h, i) =>
                    String(h || `Column_${i + 1}`).trim()
                )

                const rows: Record<string, any>[] = []
                for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                    const rowArray = rawData[i]
                    if (!Array.isArray(rowArray) || rowArray.every(cell => !cell)) continue

                    const rowObj: Record<string, any> = {}
                    headers.forEach((header, idx) => {
                        if (idx < rowArray.length) {
                            let val = rowArray[idx]
                            // Handle Excel Date objects
                            if (val instanceof Date && !isNaN(val.getTime())) {
                                val = val.toISOString().split('T')[0]
                            }
                            rowObj[header] = val
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

    const handleFileSelect = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
            setState(s => ({ ...s, error: 'Supported files: .xlsx, .xls, .csv' }))
            return
        }
        parseFile(file)
    }

    const handleConfirmAndStage = async () => {
        if (!currentOrganization || !state.file) return

        setState(s => ({ ...s, isProcessing: true, error: null }))

        try {
            const selectedSheet = state.sheets.find(s => s.name === state.selectedSheet)
            if (!selectedSheet) throw new Error('No sheet selected')

            const { data: { user } } = await supabase.auth.getUser()
            const timestamp = Date.now()
            const sanitizedName = state.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `${currentOrganization.id}/uploads/${timestamp}_${sanitizedName}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, state.file)

            if (uploadError) throw uploadError

            const { data: uploadRecord, error: dbError } = await supabase
                .from('org_uploads')
                .insert({
                    org_id: currentOrganization.id,
                    uploaded_by: user?.id,
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

            const recordType = state.importSource.slice(0, -1) // drivers -> driver
            const mappings = COLUMN_MAPPINGS[state.importSource]

            const stagingRecords = selectedSheet.rows.map((row, index) => {
                // Pre-normalize current row keys for easier matching
                const normalizedRowKeys: Record<string, string> = {}
                Object.keys(row).forEach(key => {
                    normalizedRowKeys[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = key
                })

                const metadata: Record<string, any> = {}
                const mapped: Record<string, any> = {
                    upload_id: uploadRecord.id,
                    org_id: currentOrganization.id,
                    record_type: recordType,
                    row_index: index,
                    raw_data: row,
                    status: 'pending',
                    metadata: metadata,
                }

                // Enhanced mapping logic with better fuzzy matching
                Object.entries(mappings).forEach(([targetField, sourceVariations]) => {
                    let bestMatchKey: string | null = null

                    // Try to find the best matching column for this field
                    for (const variation of sourceVariations) {
                        const normalizedVar = variation.toLowerCase().replace(/[^a-z0-9]/g, '')

                        // 1. Exact normalized match
                        if (normalizedRowKeys[normalizedVar]) {
                            bestMatchKey = normalizedRowKeys[normalizedVar]
                            break
                        }

                        // 2. Partial match (if variation is contained in a column name)
                        const partialMatch = Object.keys(normalizedRowKeys).find(k =>
                            k.includes(normalizedVar) || normalizedVar.includes(k)
                        )
                        if (partialMatch) {
                            bestMatchKey = normalizedRowKeys[partialMatch]
                            // Keep looking for an exact match, but store this
                        }
                    }

                    if (bestMatchKey) {
                        let value = row[bestMatchKey]

                        // Basic data cleanup/formatting
                        if (typeof value === 'string') {
                            value = value.trim()

                            // If it's a date field, try to ensure YYYY-MM-DD
                            if (targetField.includes('date') || targetField === 'dob') {
                                // Basic check for MM/DD/YYYY or DD/MM/YYYY
                                if (value.includes('/') || value.includes('-')) {
                                    const d = new Date(value)
                                    if (!isNaN(d.getTime())) {
                                        value = d.toISOString().split('T')[0]
                                    }
                                }
                            }
                        }

                        // Assign to top level or metadata
                        if (['full_name', 'email', 'phone'].includes(targetField)) {
                            mapped[targetField] = value
                        } else {
                            metadata[targetField] = value
                        }
                    }
                })

                if (!mapped.full_name) {
                    mapped.status = 'error'
                    mapped.validation_errors = { missing: ['full_name'] }
                }

                return mapped
            })


            const { error: stageError } = await supabase
                .from('staging_records')
                .insert(stagingRecords)

            if (stageError) throw stageError

            await supabase
                .from('org_uploads')
                .update({
                    status: 'ready_for_review',
                    processed_at: new Date().toISOString(),
                    notes: `Staged ${stagingRecords.length} rows for review.`,
                })
                .eq('id', uploadRecord.id)

            // Trigger navigation first to get off the upload page
            setUploadIdParam(uploadRecord.id)
            setPage('review_import')

            // Perform refreshes in the background if still mounted, 
            // but don't block the nav as much
            Promise.all([
                refreshOnboardingHistory(),
                refreshDataCounts(),
                refreshQueryHistory()
            ]).catch(console.error)

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
    }

    const setImportSource = (source: ImportSource) => {
        setState(s => ({ ...s, importSource: source }))
    }

    const setSelectedSheet = (sheetName: string) => {
        setState(s => ({ ...s, selectedSheet: sheetName }))
    }

    const clearError = () => {
        setState(s => ({ ...s, error: null }))
    }

    return {
        state,
        handleFileSelect,
        handleConfirmAndStage,
        reset,
        setImportSource,
        setSelectedSheet,
        clearError
    }
}
