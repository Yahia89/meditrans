import { useState } from 'react'
import {
    MagnifyingGlass,
    Plus,
    DotsThreeVertical,
    Phone,
    Envelope,
    Star,
    Funnel,
    DownloadSimple,
    NavigationArrow,
    Car,
} from "@phosphor-icons/react"
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Driver {
    id: string
    name: string
    phone: string
    email: string
    vehicleType: string
    licensePlate: string
    rating: number
    totalTrips: number
    status: 'available' | 'on-trip' | 'offline'
    currentLocation?: string
}

const mockDrivers: Driver[] = [
    {
        id: '1',
        name: 'Michael Chen',
        phone: '(555) 111-2222',
        email: 'michael.chen@meditrans.com',
        vehicleType: 'Van',
        licensePlate: 'ABC-1234',
        rating: 4.9,
        totalTrips: 342,
        status: 'available',
        currentLocation: 'Downtown District'
    },
    {
        id: '2',
        name: 'David Wilson',
        phone: '(555) 222-3333',
        email: 'david.wilson@meditrans.com',
        vehicleType: 'Sedan',
        licensePlate: 'XYZ-5678',
        rating: 4.8,
        totalTrips: 298,
        status: 'on-trip',
        currentLocation: 'En route to City Medical'
    },
    {
        id: '3',
        name: 'James Davis',
        phone: '(555) 333-4444',
        email: 'james.davis@meditrans.com',
        vehicleType: 'SUV',
        licensePlate: 'LMN-9012',
        rating: 4.7,
        totalTrips: 256,
        status: 'available',
        currentLocation: 'West Side'
    },
    {
        id: '4',
        name: 'Robert Martinez',
        phone: '(555) 444-5555',
        email: 'robert.m@meditrans.com',
        vehicleType: 'Van',
        licensePlate: 'PQR-3456',
        rating: 4.9,
        totalTrips: 412,
        status: 'on-trip',
        currentLocation: 'Highway 101'
    },
    {
        id: '5',
        name: 'Thomas Anderson',
        phone: '(555) 555-6666',
        email: 'thomas.a@meditrans.com',
        vehicleType: 'Sedan',
        licensePlate: 'STU-7890',
        rating: 4.6,
        totalTrips: 189,
        status: 'offline'
    },
]

// Inline stat component matching reference design
function InlineStat({ label, value, valueColor = "text-slate-900", suffix }: {
    label: string;
    value: string | number;
    valueColor?: string;
    suffix?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-500">{label}</span>
            <div className="flex items-center gap-1">
                <span className={cn("text-2xl font-semibold tracking-tight", valueColor)}>
                    {value}
                </span>
                {suffix}
            </div>
        </div>
    );
}

export function DriversPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [drivers] = useState<Driver[]>(mockDrivers)

    const filteredDrivers = drivers.filter(driver =>
        driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.phone.includes(searchQuery) ||
        driver.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const availableCount = drivers.filter(d => d.status === 'available').length
    const onTripCount = drivers.filter(d => d.status === 'on-trip').length
    const avgRating = (drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length).toFixed(1)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-slate-900">Drivers</h1>
                    <p className="text-sm text-slate-500">
                        Manage driver fleet and availability
                    </p>
                </div>
                <Button className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]">
                    <Plus size={18} weight="bold" />
                    Add Driver
                </Button>
            </div>

            {/* Stats Row - Inline like reference */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
                    <div className="pl-0">
                        <InlineStat label="Total Drivers" value={drivers.length} />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="Available Now" value={availableCount} valueColor="text-[#2E7D32]" />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="On Trip" value={onTripCount} valueColor="text-[#1976D2]" />
                    </div>
                    <div className="pl-8">
                        <InlineStat
                            label="Avg Rating"
                            value={avgRating}
                            valueColor="text-[#E65100]"
                            suffix={<Star size={20} weight="fill" className="text-[#FFA726]" />}
                        />
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
                        placeholder="Search drivers by name, email, phone or license plate..."
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

            {/* Drivers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredDrivers.map((driver) => (
                    <div
                        key={driver.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-[#3D5A3D] flex items-center justify-center text-white text-lg font-semibold">
                                    {driver.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{driver.name}</h3>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Star size={14} weight="fill" className="text-[#FFA726]" />
                                        <span className="text-sm font-semibold text-slate-900">{driver.rating}</span>
                                        <span className="text-sm text-slate-500">
                                            ({driver.totalTrips} trips)
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                                driver.status === 'available' && "bg-[#E8F5E9] text-[#2E7D32]",
                                driver.status === 'on-trip' && "bg-[#E3F2FD] text-[#1976D2]",
                                driver.status === 'offline' && "bg-slate-100 text-slate-600"
                            )}>
                                {driver.status === 'on-trip' ? 'On Trip' : driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Phone size={14} weight="duotone" className="text-slate-400" />
                                    {driver.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Envelope size={14} weight="duotone" className="text-slate-400" />
                                    <span className="truncate">{driver.email}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Car size={14} weight="duotone" className="text-slate-400" />
                                    {driver.vehicleType}
                                </div>
                                <div className="text-sm text-slate-600">
                                    <span className="font-medium text-slate-500">Plate:</span> {driver.licensePlate}
                                </div>
                            </div>
                        </div>

                        {driver.currentLocation && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <NavigationArrow
                                    size={16}
                                    weight="duotone"
                                    className={cn(
                                        driver.status === 'on-trip' ? "text-[#1976D2]" : "text-slate-400"
                                    )}
                                />
                                <span className="text-sm text-slate-600">
                                    {driver.currentLocation}
                                </span>
                            </div>
                        )}

                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 rounded-lg border-slate-200 hover:bg-slate-50"
                            >
                                View Details
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg border-slate-200 hover:bg-slate-50"
                            >
                                <DotsThreeVertical size={16} weight="bold" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{filteredDrivers.length}</span> of <span className="font-semibold text-slate-900">{drivers.length}</span> drivers
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
