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
            const workbook = XLSX.read(buffer, { type: 'array' })

            const sheets: ParsedSheet[] = workbook.SheetNames.map(name => {
                const worksheet = workbook.Sheets[name]
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

                if (rawData.length === 0) {
                    return { name, headers: [], rows: [], totalRows: 0 }
                }

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

    const handleFileSelect = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['xlsx', 'xls'].includes(ext || '')) {
            setState(s => ({ ...s, error: 'Only Excel files (.xlsx, .xls) are supported' }))
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

            const mappings = COLUMN_MAPPINGS[state.importSource]
            const stagingRecords = selectedSheet.rows.map((row, index) => {
                const mapped: Record<string, any> = {
                    upload_id: uploadRecord.id,
                    org_id: currentOrganization.id,
                    row_index: index,
                    raw_data: row,
                    status: 'pending',
                }

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

                if (!mapped.full_name) {
                    mapped.status = 'error'
                    mapped.validation_errors = { missing: ['full_name'] }
                }

                return mapped
            })

            const tableName = `staging_${state.importSource}`
            const { error: stageError } = await supabase
                .from(tableName)
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

            // Refresh both contexts/queries
            await Promise.all([
                refreshOnboardingHistory(),
                refreshDataCounts(),
                refreshQueryHistory()
            ])
            
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
