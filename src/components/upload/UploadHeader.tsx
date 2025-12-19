import { useOrganization } from '@/contexts/OrganizationContext'
import type { ImportSource } from './types'

interface UploadHeaderProps {
    importSource: ImportSource
}

export function UploadHeader({ importSource }: UploadHeaderProps) {
    const { currentOrganization } = useOrganization()

    return (
        <div className="mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Import Data
            </h1>
            <p className="text-slate-500 mt-2 text-lg">
                Upload an Excel file to import {importSource} into {currentOrganization?.name || 'your organization'}
            </p>
        </div>
    )
}
