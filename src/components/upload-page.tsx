import { useState, useRef, useEffect } from 'react'
import {
    File,
    FileXls,
    X,
    Check,
    CloudArrowUp,
    FilePdf,
    FileDoc,
    Image,
    Folder,
    FolderOpen
} from "@phosphor-icons/react"
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/contexts/OrganizationContext'

interface UploadedFile {
    id: string
    name: string
    size: number
    status: 'pending' | 'uploading' | 'success' | 'error'
    progress: number
    type: string
    file: File
    errorMessage?: string
    storagePath?: string
}

// Allowed MIME types
const ALLOWED_TYPES = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/json',
    'image/jpeg',
    'image/png',
    'image/heic'
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function UploadPage() {
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { currentOrganization } = useOrganization()

    // Add a subtle entrance animation
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const validateFile = (file: File): { valid: boolean; error?: string } => {
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: 'File size exceeds 10MB limit' }
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return { valid: false, error: 'File type not supported' }
        }
        return { valid: true }
    }

    const handleFileSelect = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return

        const newFiles: UploadedFile[] = []

        Array.from(selectedFiles).forEach((file, index) => {
            const validation = validateFile(file)

            const uploadedFile: UploadedFile = {
                id: `${Date.now()}-${index}`,
                name: file.name,
                size: file.size,
                status: validation.valid ? 'pending' : 'error',
                progress: 0,
                type: file.type,
                file: file,
                errorMessage: validation.error
            }

            newFiles.push(uploadedFile)
        })

        setFiles(prev => [...prev, ...newFiles])

        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const uploadFile = async (uploadedFile: UploadedFile) => {
        try {
            const { file } = uploadedFile

            // Update status to uploading
            setFiles(prev => prev.map(f =>
                f.id === uploadedFile.id ? { ...f, status: 'uploading', progress: 0 } : f
            ))

            const timestamp = Date.now()
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const orgId = currentOrganization?.id || 'default'
            const filePath = `${orgId}/uploads/${timestamp}_${sanitizedFileName}`

            // Upload to Supabase
            const { data, error } = await supabase.storage
                .from('documents')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (error) throw error

            // Success
            setFiles(prev => prev.map(f =>
                f.id === uploadedFile.id
                    ? { ...f, status: 'success', progress: 100, storagePath: data.path }
                    : f
            ))

        } catch (error: any) {
            console.error('Upload error:', error)
            setFiles(prev => prev.map(f =>
                f.id === uploadedFile.id
                    ? {
                        ...f,
                        status: 'error',
                        progress: 0,
                        errorMessage: error.message || 'Upload failed'
                    }
                    : f
            ))
        }
    }

    const handleUploadAll = async () => {
        if (!currentOrganization) return

        setIsUploading(true)
        const pendingFiles = files.filter(f => f.status === 'pending')
        await Promise.all(pendingFiles.map(file => uploadFile(file)))
        setIsUploading(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFileSelect(e.dataTransfer.files)
    }

    const removeFile = (fileId: string) => {
        setFiles(prev => prev.filter(f => f.id !== fileId))
    }

    const clearAll = () => {
        setFiles([])
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase()
        if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
            return <FileXls size={24} weight="duotone" className="text-emerald-600" />
        }
        if (['pdf'].includes(ext || '')) {
            return <FilePdf size={24} weight="duotone" className="text-red-500" />
        }
        if (['doc', 'docx'].includes(ext || '')) {
            return <FileDoc size={24} weight="duotone" className="text-blue-500" />
        }
        if (['jpg', 'jpeg', 'png', 'heic'].includes(ext || '')) {
            return <Image size={24} weight="duotone" className="text-purple-500" />
        }
        return <File size={24} weight="duotone" className="text-indigo-400" />
    }

    const pendingCount = files.filter(f => f.status === 'pending').length
    const hasFiles = files.length > 0

    return (
        <div className={cn(
            "relative w-full h-[calc(100vh-4rem)] p-8 overflow-hidden transition-opacity duration-700 flex flex-col",
            mounted ? "opacity-100" : "opacity-0"
        )}>
            {/* Ambient Aurora Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-lime-50 via-purple-50 to-lime-50 -z-20" />
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-lime-200/40 rounded-full blur-3xl mix-blend-multiply animate-blob" />
            <div className="absolute -top-40 right-20 w-96 h-96 bg-lime-200/40 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000" />
            <div className="absolute top-40 left-1/2 w-96 h-96 bg-lime-200/40 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000" />

            {/* Header Content */}
            <div className="max-w-6xl mx-auto mb-10 relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-lime-500">
                            Upload Center
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg">
                            Securely import data to <span className="font-semibold text-slate-700">{currentOrganization?.name || 'your workspace'}</span>
                        </p>
                    </div>
                    {/* Glass Stats Bar */}
                    <div className="flex gap-4 p-2 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-sm">
                        <div className="px-4 py-2 border-r border-slate-200/60 last:border-0">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Formats</span>
                            <div className="text-sm font-medium text-slate-700">CSV, Excel, PDF</div>
                        </div>
                        <div className="px-4 py-2 border-r border-slate-200/60 last:border-0">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Max Size</span>
                            <div className="text-sm font-medium text-slate-700">10 MB / File</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 flex-1 min-h-0">

                {/* LEFT: The "Glass Folder" Drop Zone */}
                <div className="lg:col-span-8 flex flex-col min-h-0">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => currentOrganization && fileInputRef.current?.click()}
                        className={cn(
                            "relative group flex-1 rounded-[2rem] border transition-all duration-500 cursor-pointer flex flex-col min-h-0",
                            isDragging
                                ? "border-indigo-400/50 bg-indigo-50/20 scale-[1.01]"
                                : "border-white/40 bg-white/20 hover:bg-white/30 hover:shadow-2xl hover:-translate-y-1",
                            "backdrop-filter backdrop-blur-xl shadow-xl",
                            !currentOrganization && "opacity-60 cursor-not-allowed grayscale"
                        )}
                    >
                        {/* Folder Tab Effect */}
                        <div className="absolute top-0 left-0 w-48 h-12 bg-white/20 backdrop-blur-md rounded-br-[2rem] border-r border-b border-white/30 z-0" />

                        {/* Dashed Border Overlay */}
                        <div className={cn(
                            "absolute inset-4 rounded-[1.5rem] border-2 border-dashed transition-colors duration-300 z-0",
                            isDragging ? "border-indigo-400 opacity-60" : "border-slate-300/40 opacity-40 group-hover:border-indigo-300/40"
                        )} />

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt,.json,.jpg,.jpeg,.png,.heic"
                            onChange={(e) => handleFileSelect(e.target.files)}
                            className="hidden"
                            disabled={!currentOrganization}
                        />

                        {/* Content Container */}
                        <div className="relative z-10 flex flex-col flex-1 min-h-0">
                            {/* Fixed Header Section */}
                            <div className="flex-shrink-0 flex flex-col items-center justify-center p-10 pb-4">
                                {/* Animated Icon */}
                                <div className={cn(
                                    "w-24 h-24 mb-6 rounded-[2rem] flex items-center justify-center transition-all duration-500",
                                    "bg-gradient-to-br from-white/80 to-white/20 shadow-lg border border-white/60",
                                    isDragging ? "scale-110 rotate-3" : "group-hover:scale-105"
                                )}>
                                    {isDragging ? (
                                        <FolderOpen size={48} weight="duotone" className="text-indigo-600 animate-bounce" />
                                    ) : (
                                        <Folder size={48} weight="duotone" className="text-indigo-500" />
                                    )}
                                </div>

                                <h3 className="text-2xl font-bold text-slate-700 tracking-tight text-center">
                                    {isDragging ? "Drop it like it's hot" : "Drop files to upload"}
                                </h3>
                                <p className="text-slate-500 mt-2 text-center max-w-sm font-medium">
                                    Drag files here or click to browse through your computer
                                </p>
                            </div>

                            {/* Floating File Preview (Decoration) - Centered when no files */}
                            {!hasFiles && (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="flex items-center gap-3 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-500">
                                        <div className="w-12 h-16 bg-white/60 rounded-lg shadow-sm rotate-6 transform translate-y-2 border border-white" />
                                        <div className="w-12 h-16 bg-white/80 rounded-lg shadow-md -rotate-3 z-10 border border-white" />
                                        <div className="w-12 h-16 bg-white/60 rounded-lg shadow-sm -rotate-12 transform translate-y-3 border border-white" />
                                    </div>
                                </div>
                            )}

                            {/* Files "Inside" Folder Visualization - Scrollable Area */}
                            {hasFiles && (
                                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 custom-scrollbar">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {files.map((file) => (
                                            <div key={file.id} className="relative group/card aspect-[3/4] bg-white/40 backdrop-blur-md rounded-xl border border-white/50 shadow-sm flex flex-col items-center justify-center p-3 transition-all hover:bg-white/60">
                                                <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="text-slate-400 hover:text-red-500">
                                                        <X size={14} weight="bold" />
                                                    </button>
                                                </div>
                                                {getFileIcon(file.name)}
                                                <p className="text-[10px] font-medium text-slate-700 mt-2 text-center break-all line-clamp-2 leading-tight">
                                                    {file.name}
                                                </p>
                                                <span className="text-[9px] text-slate-500 mt-1">{formatFileSize(file.size)}</span>
                                                {file.status === 'success' && <div className="absolute bottom-2 right-2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* RIGHT: Frosted Side Panel (Queue & Actions) */}
                <div className="lg:col-span-4 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 bg-white/30 backdrop-blur-2xl rounded-[2rem] border border-white/40 shadow-xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-white/20 flex items-center justify-between pb-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Queue</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {pendingCount} file{pendingCount !== 1 && 's'} pending
                                </p>
                            </div>
                            {hasFiles && (
                                <button onClick={clearAll} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider">
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {!hasFiles ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-50">
                                    <div className="w-16 h-16 rounded-full bg-slate-100/50 flex items-center justify-center">
                                        <CloudArrowUp size={24} className="text-slate-400" />
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium">Your queue is empty</p>
                                </div>
                            ) : (
                                files.map((file) => (
                                    <div key={file.id} className="group flex items-center gap-3 p-3 rounded-2xl bg-white/40 border border-white/50 hover:bg-white/60 transition-all shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0 shadow-sm">
                                            {file.status === 'success' ? <Check size={18} className="text-emerald-500" weight="bold" /> : getFileIcon(file.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 font-medium">{formatFileSize(file.size)}</span>
                                                {file.status === 'error' && <span className="text-[10px] text-red-500 font-bold">• Failed</span>}
                                            </div>
                                            {/* Progress Bar */}
                                            {file.status === 'uploading' && (
                                                <div className="mt-2 h-1 w-full bg-slate-200/50 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full animate-shimmer" style={{ width: `${Math.max(5, file.progress)}%` }} />
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => removeFile(file.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                            <X size={14} weight="bold" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="p-4 bg-white/40 border-t border-white/30 backdrop-blur-md">
                            <Button
                                onClick={handleUploadAll}
                                disabled={!currentOrganization || pendingCount === 0 || isUploading}
                                className={cn(
                                    "w-full h-12 rounded-xl font-bold text-white shadow-lg transition-all  active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none",
                                    "rounded-md bg-gradient-to-tr from-slate-800 to-slate-700 py-2 px-4 border border-transparent text-center text-sm text-white transition-all shadow-md hover:shadow-lg focus:bg-slate-700 focus:shadow-none active:bg-slate-700 hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                                )}
                            >
                                {isUploading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Uploading...
                                    </span>
                                ) : (
                                    `Upload ${pendingCount > 0 ? pendingCount : ''} Files`
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Styles for animations */}
            <style>{`
@keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
    animation: blob 7s infinite;
}
.animation-delay-2000 {
    animation-delay: 2s;
}
.animation-delay-4000 {
    animation-delay: 4s;
}
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.3);
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 163, 184, 0.5);
}
`}</style>
        </div>
    )
}