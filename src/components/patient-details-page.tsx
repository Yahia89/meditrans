import { useState } from 'react'
import {
    ArrowLeft,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Loader2,
    Pencil,
    ShieldAlert,
    FileText
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { PatientForm } from '@/components/forms/patient-form'
import { DocumentManager } from '@/components/document-manager'
import { TripList } from '@/components/trips/TripList'

interface PatientDetailsPageProps {
    id: string
    onBack: () => void
    onTripClick?: (id: string) => void
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

function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Not specified'
    return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

export function PatientDetailsPage({ id, onBack, onTripClick }: PatientDetailsPageProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'trips'>('overview')
    const [isEditing, setIsEditing] = useState(false)
    const { isAdmin, isOwner } = usePermissions()

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

    // Fetch trip count
    const { data: tripCount = 0 } = useQuery({
        queryKey: ['patient-trips-count', id],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('trips')
                .select('*', { count: 'exact', head: true })
                .eq('patient_id', id);
            if (error) throw error;
            return count || 0;
        }
    });

    // Fetch document count
    const { data: docCount = 0 } = useQuery({
        queryKey: ['patient-docs-count', id],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('org_uploads')
                .select('*', { count: 'exact', head: true })
                .eq('purpose', 'patient_document')
                .eq('notes', id);
            if (error) throw error;
            return count || 0;
        }
    });

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
                            className="inline-flex items-center gap-2 rounded-xl"
                        >
                            <Pencil size={16} />
                            Edit Details
                        </Button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
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
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'documents'
                            ? "border-[#3D5A3D] text-[#3D5A3D]"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    Documents
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        activeTab === 'documents' ? "bg-[#3D5A3D] text-white" : "bg-slate-100 text-slate-500"
                    )}>
                        {docCount}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('trips')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'trips'
                            ? "border-[#3D5A3D] text-[#3D5A3D]"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    Trip History
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        activeTab === 'trips' ? "bg-[#3D5A3D] text-white" : "bg-slate-100 text-slate-500"
                    )}>
                        {tripCount}
                    </span>
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
                        <DocumentManager
                            ownerId={id}
                            purpose="patient_document"
                            source="patients"
                        />
                    )}

                    {activeTab === 'trips' && (
                        <TripList
                            patientId={id}
                            onTripClick={(tripId) => onTripClick?.(tripId)}
                            hideHeader
                        />
                    )}
                </div>

                {/* Sidebar Stats/Summary */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Patient Status</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Total Trips</span>
                                <span className="text-sm font-semibold text-slate-900">{tripCount}</span>
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
