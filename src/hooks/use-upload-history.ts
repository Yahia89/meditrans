import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { UploadRecord } from '../components/upload/types'

export const UPLOAD_HISTORY_QUERY_KEY = ['upload_history']

export function useUploadHistory() {
    const { currentOrganization } = useOrganization()
    const queryClient = useQueryClient()

    const queryKey = [...UPLOAD_HISTORY_QUERY_KEY, currentOrganization?.id]

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentOrganization) return []

            // 1. Fetch from Database (Metadata Rich)
            const { data: dbData, error: dbError } = await supabase
                .from('org_uploads')
                .select(`
                    id, source, file_path, original_filename, status, created_at, processed_at, notes, file_size, 
                    committed_by,
                    committed_by_profile:committed_by (full_name)
                `)
                .eq('org_id', currentOrganization.id)
                .order('created_at', { ascending: false })
                .limit(15)

            if (dbError) throw dbError

            // 2. Fetch from Storage (The raw reality of the backend)
            // This ensures that even if DB sync fails, we know what's there
            const { data: storageData, error: storageError } = await supabase.storage
                .from('documents')
                .list(`${currentOrganization.id}/uploads`, {
                    limit: 50,
                    sortBy: { column: 'created_at', order: 'desc' },
                })

            if (storageError) {
                console.warn('Storage fetch failed:', storageError)
            }

            // 3. Synthesize and Merge
            // We want to show everything in DB, but also discover "unlinked" storage files
            const records: (UploadRecord & { existsInStorage: boolean; source_type: 'db' | 'storage' })[] = []

            // Add processed DB records
            dbData?.forEach(dbRec => {
                const fileName = dbRec.file_path?.split('/').pop()
                const inStorage = storageData?.find(f => f.name === fileName)
                
                records.push({
                    ...dbRec,
                    existsInStorage: !!inStorage,
                    source_type: 'db'
                } as any)
            })

            // add discovered Storage files that aren't in DB
            storageData?.forEach(file => {
                const isLinked = dbData?.some(dbRec => dbRec.file_path?.includes(file.name))
                if (!isLinked) {
                    records.push({
                        id: `storage-${file.name}`,
                        source: 'unknown' as any,
                        original_filename: file.name.split('_').slice(1).join('_') || file.name,
                        status: 'unlinked',
                        created_at: file.created_at,
                        processed_at: null,
                        notes: 'Discovered in storage but unlinked to database.',
                        file_path: `${currentOrganization.id}/uploads/${file.name}`,
                        file_size: file.metadata?.size || 0,
                        existsInStorage: true,
                        source_type: 'storage'
                    } as any)
                }
            })

            // Sort by creation date
            return records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        },
        enabled: !!currentOrganization,
        staleTime: 1000 * 30, // 30 seconds
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey })
    }

    const deleteMutation = useMutation({
        mutationFn: async (upload: UploadRecord) => {
            if (!upload.id) return

            const { data, error } = await supabase.functions.invoke('delete-upload', {
                body: { 
                    upload_id: upload.id,
                    file_path: (upload as any).file_path 
                }
            })

            if (error) throw error
            if (data?.error) throw new Error(data.error)
            
            return data
        },
        onSuccess: () => {
            refresh()
        }
    })

    return {
        ...query,
        refresh,
        recentUploads: query.data || [],
        isLoading: query.isLoading,
        deleteUpload: (upload: UploadRecord) => deleteMutation.mutate(upload),
        isDeleting: deleteMutation.isPending,
    }
}
