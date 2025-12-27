import { useState } from 'react'
import {
    ArrowLeft,
    Phone,
    Mail,
    Loader2,
    Pencil,
    ShieldAlert,
    Car,
    ScanEye,
    Star,
    TrendingUp,
    FileText
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { DriverForm } from '@/components/forms/driver-form'
import { DocumentManager } from '@/components/document-manager'
import { TripList } from '@/modules/trips/components/TripList'

interface DriverDetailsPageProps {
    id: string
    onBack: () => void
    onTripClick?: (id: string) => void
}

interface Driver {
    id: string
    org_id: string
    full_name: string
    email: string | null
    phone: string | null
    license_number: string | null
    vehicle_info: string | null
    status: string
    created_at: string
    custom_fields: Record<string, any> | null
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Not specified'
    return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

function getStatusConfig(status: string | null) {
    const s = (status || '').toUpperCase()
    if (s === 'AVAILABLE') return { label: 'Available', className: "bg-emerald-100 text-emerald-700" }
    if (s === 'ON_TRIP' || s === 'ON-TRIP') return { label: 'On Trip', className: "bg-blue-100 text-blue-700" }
    return { label: s || 'Offline', className: "bg-slate-100 text-slate-700" }
}

export function DriverDetailsPage({ id, onBack, onTripClick }: DriverDetailsPageProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'trips'>('overview')
    const [isEditing, setIsEditing] = useState(false)
    const { isAdmin, isOwner } = usePermissions()

    const canManageDrivers = isAdmin || isOwner

    // Fetch driver data
    const { data: driver, isLoading: isLoadingDriver } = useQuery({
        queryKey: ['driver', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('drivers')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Driver
        },
        enabled: !!id
    })

    // Fetch trip count
    const { data: tripCount = 0 } = useQuery({
        queryKey: ['driver-trips-count', id],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('trips')
                .select('*', { count: 'exact', head: true })
                .eq('driver_id', id);
            if (error) throw error;
            return count || 0;
        }
    });

    // Fetch document count
    const { data: docCount = 0 } = useQuery({
        queryKey: ['driver-docs-count', id],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('org_uploads')
                .select('*', { count: 'exact', head: true })
                .eq('purpose', 'driver_document')
                .eq('notes', id);
            if (error) throw error;
            return count || 0;
        }
    });

    if (isLoadingDriver) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (!driver) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Driver not found</p>
                <Button variant="link" onClick={onBack}>Go back to drivers</Button>
            </div>
        )
    }

    const statusInfo = getStatusConfig(driver.status)

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
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold text-slate-900">{driver.full_name}</h1>
                            <span className={cn(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                statusInfo.className
                            )}>
                                {statusInfo.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">ID: {driver.id.substring(0, 8)}</span>
                        </div>
                    </div>
                </div>

                {canManageDrivers && (
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
                            {/* Fleet Information */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-slate-900 mb-6">Fleet Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <ScanEye className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">License Number</p>
                                                <p className="text-slate-900 mt-0.5">{driver.license_number || 'Not specified'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <Car className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Vehicle Info</p>
                                                <p className="text-slate-900 mt-0.5">{driver.vehicle_info || 'Not registered'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <Phone className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Contact Phone</p>
                                                <p className="text-slate-900 mt-0.5">{driver.phone || 'Not specified'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <Mail className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Email Address</p>
                                                <p className="text-slate-900 mt-0.5">{driver.email || 'Not specified'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Fields Display */}
                            {driver.custom_fields && Object.keys(driver.custom_fields).length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-semibold text-slate-900">Additional Information</h3>
                                        <FileText className="w-5 h-5 text-slate-300" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {Object.entries(driver.custom_fields).map(([key, value]) => (
                                            <div key={key} className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{key}</span>
                                                <span className="text-slate-900">{value as string}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Performance Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Current Rating</h3>
                                        <Star className="w-5 h-5 text-amber-400" fill="currentColor" />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-slate-900">5.0</span>
                                        <span className="text-slate-500 text-sm">Target Score</span>
                                    </div>
                                    <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 w-full rounded-full" />
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Trips</h3>
                                        <TrendingUp className="w-5 h-5 text-[#3D5A3D]" />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-slate-900">{tripCount}</span>
                                        <span className="text-slate-500 text-sm">Transports</span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-400 italic">
                                        {tripCount > 0 ? `${tripCount} trips successfully managed.` : 'No trip history recorded yet.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <DocumentManager
                            ownerId={id}
                            purpose="driver_document"
                            source="drivers"
                        />
                    )}

                    {activeTab === 'trips' && (
                        <TripList
                            driverId={id}
                            onTripClick={(tripId: string) => onTripClick?.(tripId)}
                            hideHeader
                        />
                    )}
                </div>

                {/* Sidebar Stats/Summary */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Driver Profile</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Account Type</span>
                                <span className="text-sm font-semibold text-slate-900">Standard Driver</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Last Active</span>
                                <span className="text-sm text-slate-900">Never</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-500">Member Since</span>
                                <span className="text-sm text-slate-900">{formatDate(driver.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    {!canManageDrivers && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                            <div className="flex items-center gap-3 text-amber-800 mb-2">
                                <ShieldAlert size={20} />
                                <span className="font-semibold">View Only</span>
                            </div>
                            <p className="text-sm text-amber-700 leading-relaxed">
                                You have view-only access to this driver's profile. Only administrators and owners can modify details or manage documentation.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Form */}
            <DriverForm
                open={isEditing}
                onOpenChange={setIsEditing}
                initialData={{
                    id: driver.id,
                    full_name: driver.full_name,
                    email: driver.email || '',
                    phone: driver.phone || '',
                    license_number: driver.license_number || '',
                    vehicle_info: driver.vehicle_info || '',
                    custom_fields: driver.custom_fields
                }}
            />
        </div>
    )
}
