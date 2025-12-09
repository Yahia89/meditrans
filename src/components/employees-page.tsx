import { useState } from 'react'
import {
    MagnifyingGlass,
    Plus,
    DotsThreeVertical,
    Phone,
    Envelope,
    Briefcase,
    Funnel,
    DownloadSimple,
    Calendar,
    MapPin,
} from "@phosphor-icons/react"
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Employee {
    id: string
    name: string
    phone: string
    email: string
    department: string
    position: string
    hireDate: string
    location: string
    status: 'active' | 'on-leave' | 'inactive'
}

const mockEmployees: Employee[] = [
    {
        id: '1',
        name: 'Sarah Johnson',
        phone: '(555) 101-2021',
        email: 'sarah.johnson@meditrans.com',
        department: 'Operations',
        position: 'Operations Manager',
        hireDate: '2022-03-15',
        location: 'Main Office',
        status: 'active'
    },
    {
        id: '2',
        name: 'Mark Thompson',
        phone: '(555) 202-3032',
        email: 'mark.thompson@meditrans.com',
        department: 'Dispatch',
        position: 'Senior Dispatcher',
        hireDate: '2021-08-22',
        location: 'Main Office',
        status: 'active'
    },
    {
        id: '3',
        name: 'Emily Rodriguez',
        phone: '(555) 303-4043',
        email: 'emily.r@meditrans.com',
        department: 'Customer Service',
        position: 'Customer Service Rep',
        hireDate: '2023-01-10',
        location: 'Downtown Branch',
        status: 'active'
    },
    {
        id: '4',
        name: 'James Wilson',
        phone: '(555) 404-5054',
        email: 'james.wilson@meditrans.com',
        department: 'Finance',
        position: 'Accountant',
        hireDate: '2022-06-01',
        location: 'Main Office',
        status: 'on-leave'
    },
    {
        id: '5',
        name: 'Lisa Chen',
        phone: '(555) 505-6065',
        email: 'lisa.chen@meditrans.com',
        department: 'IT',
        position: 'IT Support Specialist',
        hireDate: '2023-04-18',
        location: 'Main Office',
        status: 'active'
    },
    {
        id: '6',
        name: 'Robert Brown',
        phone: '(555) 606-7076',
        email: 'robert.brown@meditrans.com',
        department: 'HR',
        position: 'HR Coordinator',
        hireDate: '2021-11-30',
        location: 'Main Office',
        status: 'inactive'
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
            <div className="flex items-center gap-1">
                <span className={cn("text-2xl font-semibold tracking-tight", valueColor)}>
                    {value}
                </span>
            </div>
        </div>
    );
}

export function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [employees] = useState<Employee[]>(mockEmployees)

    const filteredEmployees = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.phone.includes(searchQuery) ||
        employee.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.position.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const activeCount = employees.filter(e => e.status === 'active').length
    const onLeaveCount = employees.filter(e => e.status === 'on-leave').length
    const departments = [...new Set(employees.map(e => e.department))].length

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
                    <p className="text-sm text-slate-500">
                        Manage staff members and departments
                    </p>
                </div>
                <Button className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]">
                    <Plus size={18} weight="bold" />
                    Add Employee
                </Button>
            </div>

            {/* Stats Row - Inline like reference */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
                    <div className="pl-0">
                        <InlineStat label="Total Employees" value={employees.length} />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="Active" value={activeCount} valueColor="text-[#2E7D32]" />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="On Leave" value={onLeaveCount} valueColor="text-[#E65100]" />
                    </div>
                    <div className="pl-8">
                        <InlineStat label="Departments" value={departments} valueColor="text-[#1976D2]" />
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
                        placeholder="Search employees by name, email, department or position..."
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

            {/* Employees Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredEmployees.map((employee) => (
                    <div
                        key={employee.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-lg font-semibold">
                                    {employee.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{employee.name}</h3>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Briefcase size={14} weight="duotone" className="text-slate-400" />
                                        <span className="text-sm text-slate-600">
                                            {employee.position}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                                employee.status === 'active' && "bg-[#E8F5E9] text-[#2E7D32]",
                                employee.status === 'on-leave' && "bg-[#FFF3E0] text-[#E65100]",
                                employee.status === 'inactive' && "bg-slate-100 text-slate-600"
                            )}>
                                {employee.status === 'on-leave' ? 'On Leave' : employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Phone size={14} weight="duotone" className="text-slate-400" />
                                    {employee.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Envelope size={14} weight="duotone" className="text-slate-400" />
                                    <span className="truncate">{employee.email}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <MapPin size={14} weight="duotone" className="text-slate-400" />
                                    {employee.location}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Calendar size={14} weight="duotone" className="text-slate-400" />
                                    {formatDate(employee.hireDate)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <Briefcase
                                size={16}
                                weight="duotone"
                                className="text-[#1976D2]"
                            />
                            <span className="text-sm text-slate-600">
                                {employee.department}
                            </span>
                        </div>

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
                    Showing <span className="font-semibold text-slate-900">{filteredEmployees.length}</span> of <span className="font-semibold text-slate-900">{employees.length}</span> employees
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
