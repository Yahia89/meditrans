import { useState } from 'react'
import {
    MagnifyingGlass,
    Plus,
    DotsThreeVertical,
    Phone,
    Envelope,
    MapPin,
    CalendarBlank,
    Funnel,
    DownloadSimple,
    CloudArrowUp,
} from "@phosphor-icons/react"
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { PatientsEmptyState } from '@/components/ui/empty-state'
import { PatientForm } from '@/components/forms/patient-form'
import { Loader2, Pencil, Trash } from 'lucide-react'
import { exportToExcel } from '@/lib/export'
import { usePermissions } from '@/hooks/usePermissions'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQueryClient } from '@tanstack/react-query'

interface Patient {
    id: string
    name: string
    age: number
    phone: string
    email: string
    address: string
    lastVisit: string
    status: 'active' | 'inactive'
    totalTrips: number
    date_of_birth?: string | null
    notes?: string | null
    custom_fields?: Record<string, string> | null
}

// Demo data for preview mode
const demoPatients: Patient[] = [
    {
        id: '1',
        name: 'John Smith',
        age: 68,
        phone: '(555) 123-4567',
        email: 'john.smith@email.com',
        address: '123 Main St, Springfield',
        lastVisit: '2024-03-15',
        status: 'active',
        totalTrips: 24
    },
    {
        id: '2',
        name: 'Sarah Johnson',
        age: 72,
        phone: '(555) 234-5678',
        email: 'sarah.j@email.com',
        address: '456 Oak Ave, Springfield',
        lastVisit: '2024-03-14',
        status: 'active',
        totalTrips: 18
    },
    {
        id: '3',
        name: 'Robert Brown',
        age: 65,
        phone: '(555) 345-6789',
        email: 'r.brown@email.com',
        address: '789 Pine Rd, Springfield',
        lastVisit: '2024-03-10',
        status: 'active',
        totalTrips: 31
    },
    {
        id: '4',
        name: 'Emily Davis',
        age: 70,
        phone: '(555) 456-7890',
        email: 'emily.d@email.com',
        address: '321 Elm St, Springfield',
        lastVisit: '2024-02-28',
        status: 'inactive',
        totalTrips: 12
    },
    {
        id: '5',
        name: 'Michael Wilson',
        age: 75,
        phone: '(555) 567-8901',
        email: 'm.wilson@email.com',
        address: '654 Maple Dr, Springfield',
        lastVisit: '2024-03-12',
        status: 'active',
        totalTrips: 27
    },
]

// Inline stat component matching reference design
function InlineStat({ label, value, valueColor = "text-slate-900" }: {
    label: string;
    value: string | number;
    valueColor?: string;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">{label}</span>
            <span className={cn("text-2xl font-semibold tracking-tight", valueColor)}>
                {value}
            </span>
        </div>
    );
}

// Zero stat for empty state
function ZeroStat({ label }: { label: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-2xl font-semibold tracking-tight text-slate-300">
                0
            </span>
        </div>
    );
}

// Demo mode indicator badge
function DemoIndicator() {
    return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            Demo Data
        </span>
    );
}

export function PatientsPage({ onPatientClick }: { onPatientClick?: (id: string) => void }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
    const { isDemoMode, navigateTo } = useOnboarding()
    const { currentOrganization } = useOrganization()
    const { isAdmin, isOwner } = usePermissions()
    const queryClient = useQueryClient()

    const canManagePatients = isAdmin || isOwner

    const { data: realPatients, isLoading } = useQuery({
        queryKey: ['patients', currentOrganization?.id],
        queryFn: async () => {
            if (!currentOrganization) return []

            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .eq('org_id', currentOrganization.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            return data.map(p => {
                // Calculate age from DOB
                let age = 0
                if (p.date_of_birth) {
                    const dob = new Date(p.date_of_birth)
                    const diff = Date.now() - dob.getTime()
                    age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
                }

                return {
                    id: p.id,
                    name: p.full_name,
                    age: age,
                    phone: p.phone || '',
                    email: p.email || '',
                    address: p.primary_address || '',
                    lastVisit: p.created_at, // Using created_at as proxy for now
                    status: (p.status || 'active').toLowerCase() as 'active' | 'inactive',
                    totalTrips: 0, // Placeholder
                    date_of_birth: p.date_of_birth,
                    notes: p.notes,
                    custom_fields: p.custom_fields
                } as Patient
            })
        },
        enabled: !!currentOrganization
    })

    const handleExport = () => {
        if (!patients.length) return
        const exportData = patients.map(p => ({
            Name: p.name,
            Email: p.email,
            Phone: p.phone,
            Address: p.address,
            'Last Visit': p.lastVisit,
            Status: p.status,
            'Total Trips': p.totalTrips
        }))
        exportToExcel(exportData, `patients_${new Date().toISOString().split('T')[0]}`)
    }

    const handleDeletePatient = async (id: string) => {
        if (isDemoMode) return
        if (!window.confirm('Are you sure you want to delete this patient?')) return

        try {
            const { error } = await supabase.from('patients').delete().eq('id', id)
            if (error) throw error
            queryClient.invalidateQueries({ queryKey: ['patients', currentOrganization?.id] })
        } catch (err) {
            console.error('Failed to delete patient:', err)
        }
    }

    const hasRealData = realPatients && realPatients.length > 0
    const showData = hasRealData || isDemoMode
    const patients = hasRealData ? realPatients : (isDemoMode ? demoPatients : [])

    const filteredPatients = patients.filter(patient => {
        const nameMatch = (patient.name || '').toLowerCase().includes(searchQuery.toLowerCase())
        const emailMatch = (patient.email || '').toLowerCase().includes(searchQuery.toLowerCase())
        const phoneMatch = (patient.phone || '').includes(searchQuery)
        return nameMatch || emailMatch || phoneMatch
    })

    const activeCount = patients.filter(p => p.status === 'active').length
    const totalTrips = patients.reduce((sum, p) => sum + p.totalTrips, 0)

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    // Show empty state if no real data and not in demo mode
    if (!showData) {
        return (
            <div className="space-y-6">
                {/* Patient Form (Add/Edit) */}
                <PatientForm
                    open={showAddForm || !!editingPatient}
                    onOpenChange={(open) => {
                        if (!open) {
                            setShowAddForm(false)
                            setEditingPatient(null)
                        }
                    }}
                    initialData={editingPatient ? {
                        id: editingPatient.id,
                        full_name: editingPatient.name,
                        email: editingPatient.email,
                        phone: editingPatient.phone,
                        primary_address: editingPatient.address,
                        date_of_birth: editingPatient.date_of_birth || '',
                        notes: editingPatient.notes || '',
                        custom_fields: editingPatient.custom_fields
                    } : undefined}
                />

                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
                        <p className="text-sm text-slate-500">
                            Manage and view all patient records
                        </p>
                    </div>
                </div>

                {/* Stats Row with zeros */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
                        <div className="pl-0">
                            <ZeroStat label="Total Patients" />
                        </div>
                        <div className="pl-8">
                            <ZeroStat label="Active" />
                        </div>
                        <div className="pl-8">
                            <ZeroStat label="New This Month" />
                        </div>
                        <div className="pl-8">
                            <ZeroStat label="Total Trips" />
                        </div>
                    </div>
                </div>

                {/* Empty State */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <PatientsEmptyState
                        onAddPatient={() => setShowAddForm(true)}
                        onUpload={() => navigateTo('upload')}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center">
                        <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
                        {isDemoMode && <DemoIndicator />}
                    </div>
                    <p className="text-sm text-slate-500">
                        Manage and view all patient records
                    </p>
                </div>
                {canManagePatients && (
                    <Button
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
                    >
                        <Plus size={18} weight="bold" />
                        Add Patient
                    </Button>
                )}
            </div>

            {/* Patient Form (Add/Edit) */}
            <PatientForm
                open={showAddForm || !!editingPatient}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowAddForm(false)
                        setEditingPatient(null)
                    }
                }}
                initialData={editingPatient ? {
                    id: editingPatient.id,
                    full_name: editingPatient.name,
                    email: editingPatient.email,
                    phone: editingPatient.phone,
                    primary_address: editingPatient.address,
                    date_of_birth: editingPatient.date_of_birth || '',
                    notes: editingPatient.notes || '',
                    custom_fields: editingPatient.custom_fields
                } : undefined}
            />

            {/* Demo Mode Banner */}
            {isDemoMode && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                            <CloudArrowUp size={20} weight="duotone" className="text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-900">
                                Viewing demo patient data
                            </p>
                            <p className="text-xs text-amber-700">
                                Upload your own data or add patients to see real records
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateTo('upload')}
                            className="border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                            Upload Data
                        </Button>
                    </div>
                </div>
            )}

            {/* Stats Row - Inline like reference  */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
                    <div className="pl-0">
                        <InlineStat label="Total Patients" value={patients.length} />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="Active" value={activeCount} valueColor="text-[#2E7D32]" />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="New This Month" value="23" valueColor="text-[#1976D2]" />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="Total Trips" value={totalTrips} valueColor="text-[#E65100]" />
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <MagnifyingGlass
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        placeholder="Search patients by name, email, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                    />
                </div>
                <Button variant="outline" className="inline-flex items-center gap-2 rounded-lg border-slate-200 bg-white hover:bg-slate-50">
                    <Funnel size={16} />
                    Filters
                </Button>
                <Button
                    variant="outline"
                    onClick={handleExport}
                    className="inline-flex items-center gap-2 rounded-lg border-slate-200 bg-white hover:bg-slate-50"
                >
                    <DownloadSimple size={16} />
                    Export
                </Button>
            </div>

            {/* Patients Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Patient
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Address
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Last Visit
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Trips
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPatients.map((patient) => (
                                <tr
                                    key={patient.id}
                                    onClick={() => canManagePatients && onPatientClick?.(patient.id)}
                                    className={cn(
                                        "hover:bg-slate-50/50 transition-colors",
                                        canManagePatients && "cursor-pointer"
                                    )}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#3D5A3D] flex items-center justify-center text-white font-semibold text-sm">
                                                {patient.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{patient.name}</p>
                                                <p className="text-sm text-slate-500">Age: {patient.age}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Phone size={14} weight="duotone" className="text-slate-400" />
                                                {patient.phone}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Envelope size={14} weight="duotone" className="text-slate-400" />
                                                {patient.email}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <MapPin size={14} weight="duotone" className="text-slate-400 flex-shrink-0" />
                                            <span className="line-clamp-1">{patient.address}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <CalendarBlank size={14} weight="duotone" className="text-slate-400" />
                                            {new Date(patient.lastVisit).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {patient.totalTrips}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={cn(
                                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                                            patient.status === 'active'
                                                ? "bg-[#E8F5E9] text-[#2E7D32]"
                                                : "bg-slate-100 text-slate-600"
                                        )}>
                                            {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {canManagePatients && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        disabled={isDemoMode}
                                                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                                                    >
                                                        <DotsThreeVertical size={18} weight="bold" className="text-slate-500" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={() => setEditingPatient(patient)} className="gap-2">
                                                        <Pencil className="h-4 w-4" />
                                                        Edit Patient
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeletePatient(patient.id)}
                                                        className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{filteredPatients.length}</span> of <span className="font-semibold text-slate-900">{patients.length}</span> patients
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled className="rounded-lg border-slate-200">
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled className="rounded-lg border-slate-200">
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}