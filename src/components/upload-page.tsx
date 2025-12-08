import { useState, useRef } from 'react'
import {
    UploadSimple,
    File,
    FileXls,
    X,
    Check,
    WarningCircle,
    DownloadSimple,
    CloudArrowUp,
} from "@phosphor-icons/react"
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface UploadedFile {
    id: string
    name: string
    size: number
    status: 'uploading' | 'success' | 'error'
    progress: number
    type: string
}

export function UploadPage() {
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return

        const newFiles: UploadedFile[] = Array.from(selectedFiles).map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name,
            size: file.size,
            status: 'uploading',
            progress: 0,
            type: file.type
        }))

        setFiles(prev => [...prev, ...newFiles])

        // Simulate upload progress
        newFiles.forEach((file) => {
            simulateUpload(file.id)
        })
    }

    const simulateUpload = (fileId: string) => {
        let progress = 0
        const interval = setInterval(() => {
            progress += Math.random() * 30
            if (progress >= 100) {
                progress = 100
                clearInterval(interval)
                setFiles(prev => prev.map(f =>
                    f.id === fileId ? { ...f, status: 'success', progress: 100 } : f
                ))
            } else {
                setFiles(prev => prev.map(f =>
                    f.id === fileId ? { ...f, progress } : f
                ))
            }
        }, 500)
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

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-slate-900">Upload Data</h1>
                <p className="text-sm text-slate-500">
                    Import patient and driver data from CSV or Excel files
                </p>
            </div>

            {/* Instructions Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#90CAF9] bg-[#E3F2FD] p-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1976D2] shadow-sm">
                            <FileXls size={20} weight="duotone" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-1">Supported Formats</h3>
                            <p className="text-sm text-slate-600">
                                CSV, Excel (.xlsx, .xls)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-[#A5D6A7] bg-[#E8F5E9] p-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2E7D32] shadow-sm">
                            <Check size={20} weight="bold" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-1">Data Types</h3>
                            <p className="text-sm text-slate-600">
                                Patients, Drivers, Trips
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-[#FFCC80] bg-[#FFF3E0] p-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#E65100] shadow-sm">
                            <DownloadSimple size={20} weight="duotone" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-1">Templates</h3>
                            <p className="text-sm text-slate-600">
                                <a href="#" className="text-[#E65100] hover:underline font-medium">
                                    Download sample files
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Area */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "relative rounded-2xl border-2 border-dashed transition-all duration-200",
                    isDragging
                        ? "border-[#3D5A3D] bg-[#3D5A3D]/5"
                        : "border-slate-200 bg-white hover:border-slate-300"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                />

                <div className="p-12 text-center">
                    <div className={cn(
                        "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 transition-all duration-200",
                        isDragging
                            ? "bg-[#3D5A3D] scale-110"
                            : "bg-[#3D5A3D]"
                    )}>
                        <CloudArrowUp size={32} weight="duotone" className="text-white" />
                    </div>

                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                        {isDragging ? "Drop files here" : "Upload your files"}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        Drag and drop files here, or click to browse
                    </p>

                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
                    >
                        <UploadSimple size={18} weight="bold" />
                        Select Files
                    </Button>

                    <p className="text-sm text-slate-400 mt-4">
                        Maximum file size: 10MB
                    </p>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Uploaded Files ({files.length})
                        </h2>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFiles([])}
                            className="rounded-lg border-slate-200 hover:bg-slate-50"
                        >
                            Clear All
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                                        file.status === 'success' && "bg-[#E8F5E9]",
                                        file.status === 'error' && "bg-red-50",
                                        file.status === 'uploading' && "bg-[#E3F2FD]"
                                    )}>
                                        {file.status === 'success' ? (
                                            <Check size={22} weight="bold" className="text-[#2E7D32]" />
                                        ) : file.status === 'error' ? (
                                            <WarningCircle size={22} weight="duotone" className="text-red-500" />
                                        ) : (
                                            <File size={22} weight="duotone" className="text-[#1976D2]" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-medium text-slate-900 truncate">
                                                {file.name}
                                            </p>
                                            <button
                                                onClick={() => removeFile(file.id)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0 ml-2"
                                            >
                                                <X size={16} className="text-slate-400" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-slate-500">
                                                {formatFileSize(file.size)}
                                            </span>

                                            {file.status === 'uploading' && (
                                                <>
                                                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#3D5A3D] transition-all duration-300 rounded-full"
                                                            style={{ width: `${file.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-semibold text-[#3D5A3D]">
                                                        {Math.round(file.progress)}%
                                                    </span>
                                                </>
                                            )}

                                            {file.status === 'success' && (
                                                <span className="text-sm font-medium text-[#2E7D32]">
                                                    Uploaded successfully
                                                </span>
                                            )}

                                            {file.status === 'error' && (
                                                <span className="text-sm font-medium text-red-500">
                                                    Upload failed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}