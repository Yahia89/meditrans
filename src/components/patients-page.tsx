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
} from "@phosphor-icons/react"
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
}

const mockPatients: Patient[] = [
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

export function PatientsPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [patients] = useState<Patient[]>(mockPatients)

    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery)
    )

    const activeCount = patients.filter(p => p.status === 'active').length
    const totalTrips = patients.reduce((sum, p) => sum + p.totalTrips, 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
                    <p className="text-sm text-slate-500">
                        Manage and view all patient records
                    </p>
                </div>
                <Button className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]">
                    <Plus size={18} weight="bold" />
                    Add Patient
                </Button>
            </div>

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
                <Button variant="outline" className="inline-flex items-center gap-2 rounded-lg border-slate-200 bg-white hover:bg-slate-50">
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
                                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
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
                                        <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                                            <DotsThreeVertical size={18} weight="bold" className="text-slate-500" />
                                        </button>
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