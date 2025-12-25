import { useState, useEffect } from 'react'
import {
    ArrowLeft,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Clock,
    Plus,
    Loader2,
    Pencil,
    ShieldAlert,
    Trash
} from 'lucide-react'
import {
    File as FileIcon,
    FilePdf,
    FileDoc,
    FileXls,
    FileImage,
    FileText,
    Files,
    MagnifyingGlassPlus,
    MagnifyingGlassMinus,
    ArrowSquareOut,
    Eye,
    DownloadSimple
} from "@phosphor-icons/react"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PatientForm } from '@/components/forms/patient-form'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

interface PatientDetailsPageProps {
    id: string
    onBack: () => void
}

interface Patient {
    id: string
    org_id: string
    full_name: string
    date_of_birth: string | null
    phone: string | null
    email: string | null
    primary_address: string | null
    notes: string | null
    created_at: string
}

interface PatientDocument {
    id: string
    file_path: string
    file_type: string
    original_filename: string
    file_size: number
    created_at: string
    uploaded_by: string
    uploader_profile?: {
        full_name: string
    }
}

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileKind(mime?: string | null, name?: string | null) {
    const lower = (name ?? "").toLowerCase()
    const m = (mime ?? "").toLowerCase()

    if (m.includes("pdf") || lower.endsWith(".pdf")) return "pdf"
    if (m.includes("image") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".heic")) return "image"
    if (m.includes("spreadsheet") || m.includes("excel") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || m.includes("csv") || lower.endsWith(".csv")) return "xls"
    if (m.includes("word") || m.includes("officedocument.word") || lower.endsWith(".docx") || lower.endsWith(".doc")) return "word"
    return "file"
}

function DocumentIcon({ kind }: { kind: string }) {
    const cls = "h-5 w-5"
    switch (kind) {
        case "image":
            return <FileImage className={cls} weight="duotone" />
        case "pdf":
            return <FilePdf className={cls} weight="duotone" />
        case "xls":
            return <FileXls className={cls} weight="duotone" />
        case "word":
            return <FileDoc className={cls} weight="duotone" />
        case "file":
            return <FileText className={cls} weight="duotone" />
        default:
            return <Files className={cls} weight="duotone" />
    }
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Not specified'
    return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

interface DocumentPreviewProps {
    doc: PatientDocument | null
    onClose: () => void
    onDownload: (doc: PatientDocument) => void
}

function DocumentPreview({ doc, onClose, onDownload }: DocumentPreviewProps) {
    const [zoom, setZoom] = useState(100)
    const [signedUrl, setSignedUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!doc) {
            setSignedUrl(null)
            setZoom(100)
            return
        }

        const fetchUrl = async () => {
            setIsLoading(true)
            const { data } = await supabase.storage
                .from('documents')
                .createSignedUrl(doc.file_path, 3600) // 1 hour
            setSignedUrl(data?.signedUrl || null)
            setIsLoading(false)
        }

        fetchUrl()
    }, [doc])

    if (!doc) return null

    const kind = getFileKind(doc.file_type, doc.original_filename)

    return (
        <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0 rounded-[2rem] border-slate-200 shadow-2xl">
                <DialogHeader className="p-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                kind === "image" ? "bg-indigo-50 text-indigo-600" :
                                    kind === "pdf" ? "bg-rose-50 text-rose-600" :
                                        kind === "xls" ? "bg-emerald-50 text-emerald-600" :
                                            kind === "word" ? "bg-blue-50 text-blue-600" :
                                                "bg-slate-50 text-slate-600"
                            )}>
                                <DocumentIcon kind={kind} />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base font-semibold text-slate-900 truncate">
                                    {doc.original_filename}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500">
                                    {formatBytes(doc.file_size)} • Uploaded {formatDate(doc.created_at)}
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {kind === 'image' && (
                                <div className="flex items-center bg-slate-50 rounded-xl p-1 gap-1 border border-slate-200/60 mr-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg"
                                        onClick={() => setZoom(prev => Math.max(25, prev - 25))}
                                    >
                                        <MagnifyingGlassMinus size={16} />
                                    </Button>
                                    <span className="text-[10px] font-bold text-slate-500 w-10 text-center">
                                        {zoom}%
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg"
                                        onClick={() => setZoom(prev => Math.min(400, prev + 25))}
                                    >
                                        <MagnifyingGlassPlus size={16} />
                                    </Button>
                                </div>
                            )}
                            <Button
                                variant="outline"
                                className="h-9 px-4 rounded-xl gap-2 font-semibold text-xs border-slate-200"
                                onClick={() => onDownload(doc)}
                            >
                                <DownloadSimple size={14} />
                                Download
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 bg-slate-50 overflow-auto relative flex items-center justify-center p-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                            <p className="text-xs font-semibold text-slate-400">Loading preview...</p>
                        </div>
                    ) : signedUrl ? (
                        <>
                            {kind === 'image' ? (
                                <div
                                    className="transition-all duration-200"
                                    style={{ width: `${zoom}%`, maxWidth: 'none' }}
                                >
                                    <img
                                        src={signedUrl}
                                        alt={doc.original_filename}
                                        className="w-full h-auto rounded-xl shadow-lg border border-white"
                                    />
                                </div>
                            ) : kind === 'pdf' ? (
                                <iframe
                                    src={`${signedUrl}#view=FitH`}
                                    className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-sm"
                                    title={doc.original_filename}
                                />
                            ) : (
                                <div className="flex flex-col items-center text-center max-w-sm">
                                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6 border border-slate-100">
                                        <DocumentIcon kind={kind} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No Preview Available</h3>
                                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                                        This file type ({kind.toUpperCase()}) cannot be previewed directly in the browser.
                                        Please download the file to view its content.
                                    </p>
                                    <Button
                                        size="lg"
                                        className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-2xl px-12 font-bold shadow-lg gap-3"
                                        onClick={() => onDownload(doc)}
                                    >
                                        <DownloadSimple size={20} weight="bold" />
                                        Download Now
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <ShieldAlert size={40} className="text-rose-200" />
                            <p className="text-sm font-semibold text-slate-400">Failed to load preview URL</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function PatientDetailsPage({ id, onBack }: PatientDetailsPageProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'trips'>('overview')
    const [isEditing, setIsEditing] = useState(false)
    const [docToDelete, setDocToDelete] = useState<PatientDocument | null>(null)
    const [docPreview, setDocPreview] = useState<PatientDocument | null>(null)
    const { currentOrganization } = useOrganization()
    const { isAdmin, isOwner } = usePermissions()
    const queryClient = useQueryClient()

    const canManagePatients = isAdmin || isOwner

    // Fetch patient data
    const { data: patient, isLoading: isLoadingPatient } = useQuery({
        queryKey: ['patient', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Patient
        },
        enabled: !!id
    })

    // Fetch patient documents
    const { data: documents } = useQuery({
        queryKey: ['patient-documents', id],
        queryFn: async () => {
            if (!currentOrganization) return []
            const { data, error } = await supabase
                .from('org_uploads')
                .select(`
                    *,
                    uploader_profile:uploaded_by (
                        full_name
                    )
                `)
                .eq('org_id', currentOrganization.id)
                .eq('purpose', 'patient_document')
                .eq('notes', id)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as PatientDocument[]
        },
        enabled: !!id && !!currentOrganization
    })

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!currentOrganization || !patient) return

            const fileExt = file.name.split('.').pop()
            const fileName = `${patient.id}/${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${currentOrganization.id}/patients/${fileName}`

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // 2. Create record in org_uploads
            const { data: authUser } = await supabase.auth.getUser()
            const { error: dbError } = await supabase
                .from('org_uploads')
                .insert({
                    org_id: currentOrganization.id,
                    file_path: filePath,
                    file_type: file.type,
                    source: 'patients',
                    purpose: 'patient_document',
                    notes: id, // Store patient ID in notes
                    original_filename: file.name,
                    status: 'committed',
                    file_size: file.size,
                    uploaded_by: authUser.user?.id
                })

            if (dbError) throw dbError
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patient-documents', id] })
        },
        onError: (error: any) => {
            console.error('Upload failed:', error)
            alert(`Failed to upload document: ${error.message || 'Unknown error'}`)
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (doc: PatientDocument) => {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([doc.file_path])

            if (storageError) throw storageError

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('org_uploads')
                .delete()
                .eq('id', doc.id)

            if (dbError) throw dbError
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patient-documents', id] })
        }
    })

    const handleDownload = async (doc: PatientDocument) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(doc.file_path, 60, {
                    download: doc.original_filename
                })

            if (error) throw error
            if (data?.signedUrl) {
                // For downloads, we create a temporary link to ensure the browser handles the download correctly
                const link = document.createElement('a')
                link.href = data.signedUrl
                link.download = doc.original_filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }
        } catch (error) {
            console.error('Download failed:', error)
            alert('Failed to generate download link')
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            uploadMutation.mutate(file)
        }
    }

    if (isLoadingPatient) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (!patient) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Patient not found</p>
                <Button variant="link" onClick={onBack}>Go back to patients</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">{patient.full_name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                Active Patient
                            </span>
                            <span className="text-xs text-slate-500">ID: {patient.id.substring(0, 8)}</span>
                        </div>
                    </div>
                </div>

                {canManagePatients && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-2"
                        >
                            <Pencil size={16} />
                            Edit Details
                        </Button>
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={uploadMutation.isPending}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic"
                            />
                            <Button
                                asChild
                                className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white gap-2"
                            >
                                <span>
                                    {uploadMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus size={18} />
                                    )}
                                    Upload Document
                                </span>
                            </Button>
                        </label>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'overview'
                            ? "border-[#3D5A3D] text-[#3D5A3D]"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('documents')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'documents'
                            ? "border-[#3D5A3D] text-[#3D5A3D]"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    Documents ({documents?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('trips')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'trips'
                            ? "border-[#3D5A3D] text-[#3D5A3D]"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    Trip History
                </button>
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Personal Information */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-slate-900 mb-6">Personal Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <Calendar className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Date of Birth</p>
                                                <p className="text-slate-900 mt-0.5">
                                                    {formatDate(patient.date_of_birth)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <Phone className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Phone Number</p>
                                                <p className="text-slate-900 mt-0.5">{patient.phone || 'Not specified'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <Mail className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Email Address</p>
                                                <p className="text-slate-900 mt-0.5">{patient.email || 'Not specified'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <MapPin className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Primary Address</p>
                                                <p className="text-slate-900 mt-0.5">{patient.primary_address || 'Not specified'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Medical Notes */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-slate-900">Medical Notes</h3>
                                    <FileText className="w-5 h-5 text-slate-300" />
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[120px]">
                                    {patient.notes ? (
                                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{patient.notes}</p>
                                    ) : (
                                        <p className="text-slate-400 italic">No notes recorded for this patient.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-900">Patient Documents</h3>
                            </div>
                            <div className="p-6 space-y-3">
                                {documents && documents.length > 0 ? (
                                    documents.map((doc) => {
                                        const kind = getFileKind(doc.file_type, doc.original_filename)
                                        return (
                                            <div
                                                key={doc.id}
                                                onClick={() => setDocPreview(doc)}
                                                className="group flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-3.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm cursor-pointer"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 transition-colors group-hover:bg-slate-100">
                                                        <div
                                                            className={cn(
                                                                kind === "image" ? "text-indigo-600" :
                                                                    kind === "pdf" ? "text-rose-600" :
                                                                        kind === "xls" ? "text-emerald-600" :
                                                                            kind === "word" ? "text-blue-600" :
                                                                                "text-slate-600"
                                                            )}
                                                        >
                                                            <DocumentIcon kind={kind} />
                                                        </div>
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="truncate text-xs font-semibold text-slate-900">
                                                            {doc.original_filename || doc.file_path.split('/').pop()}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                                                {formatDate(doc.created_at)}
                                                                <span className="normal-case"> — {formatBytes(doc.file_size)} • {doc.uploader_profile?.full_name || 'System'}</span>
                                                            </p>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Click to view</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-xl text-slate-400 transition-colors hover:bg-slate-50"
                                                        title="Download"
                                                        onClick={() => handleDownload(doc)}
                                                    >
                                                        <DownloadSimple size={16} />
                                                    </Button>
                                                    {canManagePatients && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                            title="Delete"
                                                            onClick={() => setDocToDelete(doc)}
                                                            disabled={deleteMutation.isPending}
                                                        >
                                                            {deleteMutation.isPending && docToDelete?.id === doc.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash size={16} />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                            <FileText className="text-slate-300" size={24} />
                                        </div>
                                        <p className="text-slate-500 text-sm font-medium">No documents uploaded yet.</p>
                                        <p className="text-slate-400 text-xs mt-1">Uploaded files will appear here.</p>
                                    </div>
                                )}
                            </div>

                            {/* Document Preview Dialog */}
                            <DocumentPreview
                                doc={docPreview}
                                onClose={() => setDocPreview(null)}
                                onDownload={handleDownload}
                            />

                            {/* Delete Confirmation Dialog */}
                            <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
                                <AlertDialogContent className="rounded-[1.5rem] border-slate-200 shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-lg font-semibold text-slate-900">
                                            Delete document?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-slate-600">
                                            This will permanently remove{" "}
                                            <strong className="text-slate-900">
                                                {docToDelete?.original_filename || "this file"}
                                            </strong>{" "}
                                            from this patient's records.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>

                                    <AlertDialogFooter className="mt-2 gap-3">
                                        <AlertDialogCancel className="h-11 rounded-xl font-semibold">Keep</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => {
                                                if (docToDelete) {
                                                    deleteMutation.mutate(docToDelete, {
                                                        onSettled: () => setDocToDelete(null)
                                                    })
                                                }
                                            }}
                                            className="h-11 rounded-xl bg-rose-600 font-semibold hover:bg-rose-700 text-white"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}

                    {activeTab === 'trips' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                            <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 mb-2">Trip History</h3>
                            <p className="text-slate-500">History and future scheduled trips will appear here.</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Stats/Summary */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Patient Status</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Total Trips</span>
                                <span className="text-sm font-semibold text-slate-900">0</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Last Transport</span>
                                <span className="text-sm text-slate-900">Never</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-500">Added On</span>
                                <span className="text-sm text-slate-900">{formatDate(patient.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    {!canManagePatients && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                            <div className="flex items-center gap-3 text-amber-800 mb-2">
                                <ShieldAlert size={20} />
                                <span className="font-semibold">View Only</span>
                            </div>
                            <p className="text-sm text-amber-700 leading-relaxed">
                                You have view-only access to this patient's profile. Only administrators and owners can modify details or upload documents.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Form */}
            <PatientForm
                open={isEditing}
                onOpenChange={setIsEditing}
                initialData={{
                    id: patient.id,
                    full_name: patient.full_name,
                    email: patient.email || '',
                    phone: patient.phone || '',
                    primary_address: patient.primary_address || '',
                    date_of_birth: patient.date_of_birth || '',
                    notes: patient.notes || ''
                }}
            />
        </div>
    )
}
