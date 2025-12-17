import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useOrganization } from './OrganizationContext'
import { supabase } from '@/lib/supabase'

// Data state progression: empty → onboarding → live
export type DataState = 'empty' | 'onboarding' | 'live'

export interface DataCounts {
    patients: number
    drivers: number
    employees: number
    trips: number
}

export interface UploadRecord {
    id: string
    source: 'drivers' | 'patients' | 'employees'
    original_filename: string
    status: string
    created_at: string
    processed_at: string | null
    notes: string | null
}

export interface SetupChecklistItem {
    id: string
    label: string
    description: string
    completed: boolean
    ctaLabel: string
    ctaAction: () => void
    priority: number
}

interface OnboardingContextType {
    // Data state management
    dataState: DataState
    dataCounts: DataCounts
    isLoading: boolean

    // Demo mode
    isDemoMode: boolean
    setDemoMode: (enabled: boolean) => void

    // Checklist
    setupChecklist: SetupChecklistItem[]
    completedSteps: number
    totalSteps: number
    completionPercentage: number

    // Upload history
    recentUploads: UploadRecord[]
    uploadedTypes: Set<string>
    hasUploadedDrivers: boolean
    hasUploadedPatients: boolean
    hasUploadedEmployees: boolean

    // Actions
    refreshDataCounts: () => Promise<void>
    refreshUploadHistory: () => Promise<void>
    navigateTo: (page: string) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export const useOnboarding = () => {
    const context = useContext(OnboardingContext)
    if (context === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider')
    }
    return context
}

interface OnboardingProviderProps {
    children: React.ReactNode
    onNavigate?: (page: string) => void
}

export const OnboardingProvider = ({ children, onNavigate }: OnboardingProviderProps) => {
    const { currentOrganization } = useOrganization()
    const [isLoading, setIsLoading] = useState(true)
    const [isDemoMode, setIsDemoMode] = useState(false)
    const [dataCounts, setDataCounts] = useState<DataCounts>({
        patients: 0,
        drivers: 0,
        employees: 0,
        trips: 0,
    })
    const [recentUploads, setRecentUploads] = useState<UploadRecord[]>([])

    // Compute uploaded types from recent uploads
    const uploadedTypes = new Set(
        recentUploads
            .filter(u => u.status === 'committed' || u.status === 'ready_for_review')
            .map(u => u.source)
    )
    const hasUploadedDrivers = uploadedTypes.has('drivers')
    const hasUploadedPatients = uploadedTypes.has('patients')
    const hasUploadedEmployees = uploadedTypes.has('employees')

    // Determine data state based on counts
    const getDataState = useCallback((counts: DataCounts): DataState => {
        const totalRecords = counts.patients + counts.drivers + counts.employees
        const hasTrips = counts.trips > 0

        if (totalRecords === 0) {
            return 'empty'
        } else if (!hasTrips || totalRecords < 5) {
            // Onboarding: has some data but not enough to be "live"
            return 'onboarding'
        } else {
            return 'live'
        }
    }, [])

    const dataState = getDataState(dataCounts)

    // Navigate helper
    const navigateTo = useCallback((page: string) => {
        if (onNavigate) {
            onNavigate(page)
        }
    }, [onNavigate])

    // Fetch recent uploads from Supabase
    const refreshUploadHistory = useCallback(async () => {
        if (!currentOrganization) {
            setRecentUploads([])
            return
        }

        try {
            const { data, error } = await supabase
                .from('org_uploads')
                .select('id, source, original_filename, status, created_at, processed_at, notes')
                .eq('org_id', currentOrganization.id)
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) throw error
            setRecentUploads(data || [])
        } catch (error) {
            console.error('Error fetching upload history:', error)
            setRecentUploads([])
        }
    }, [currentOrganization])

    // Fetch data counts from Supabase
    const refreshDataCounts = useCallback(async () => {
        if (!currentOrganization) {
            setDataCounts({ patients: 0, drivers: 0, employees: 0, trips: 0 })
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        try {
            // Fetch counts for each table
            const [patientsRes, driversRes, employeesRes, tripsRes] = await Promise.all([
                supabase
                    .from('patients')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', currentOrganization.id),
                supabase
                    .from('drivers')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', currentOrganization.id),
                supabase
                    .from('employees')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', currentOrganization.id),
                supabase
                    .from('trips')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', currentOrganization.id),
            ])

            setDataCounts({
                patients: patientsRes.count ?? 0,
                drivers: driversRes.count ?? 0,
                employees: employeesRes.count ?? 0,
                trips: tripsRes.count ?? 0,
            })
        } catch (error) {
            console.error('Error fetching data counts:', error)
            setDataCounts({ patients: 0, drivers: 0, employees: 0, trips: 0 })
        } finally {
            setIsLoading(false)
        }
    }, [currentOrganization])

    // Fetch counts and upload history when organization changes
    useEffect(() => {
        refreshDataCounts()
        refreshUploadHistory()
    }, [refreshDataCounts, refreshUploadHistory])

    // Generate setup checklist based on current data state
    const setupChecklist: SetupChecklistItem[] = [
        {
            id: 'add-patients',
            label: 'Add your patients',
            description: 'Import or manually add patient records to start scheduling trips',
            completed: dataCounts.patients > 0,
            ctaLabel: dataCounts.patients > 0 ? 'View Patients' : 'Add Patients',
            ctaAction: () => navigateTo('patients'),
            priority: 1,
        },
        {
            id: 'add-drivers',
            label: 'Add your drivers',
            description: 'Register your driver fleet to begin assigning trips',
            completed: dataCounts.drivers > 0,
            ctaLabel: dataCounts.drivers > 0 ? 'View Drivers' : 'Add Drivers',
            ctaAction: () => navigateTo('drivers'),
            priority: 2,
        },
        {
            id: 'add-employees',
            label: 'Add your team',
            description: 'Invite staff members to help manage operations',
            completed: dataCounts.employees > 0,
            ctaLabel: dataCounts.employees > 0 ? 'View Team' : 'Add Team Members',
            ctaAction: () => navigateTo('employees'),
            priority: 3,
        },
        {
            id: 'upload-data',
            label: 'Bulk upload data',
            description: 'Import existing data from spreadsheets or other systems',
            completed: dataCounts.patients >= 5 || dataCounts.drivers >= 5 || recentUploads.some(u => u.status === 'committed'),
            ctaLabel: recentUploads.length > 0 ? 'View Uploads' : 'Upload Data',
            ctaAction: () => navigateTo('upload'),
            priority: 4,
        },
        {
            id: 'create-trip',
            label: 'Schedule your first trip',
            description: 'Create a trip to connect patients with drivers',
            completed: dataCounts.trips > 0,
            ctaLabel: dataCounts.trips > 0 ? 'View Trips' : 'Create Trip',
            ctaAction: () => navigateTo('dashboard'),
            priority: 5,
        },
    ]

    const completedSteps = setupChecklist.filter(item => item.completed).length
    const totalSteps = setupChecklist.length
    const completionPercentage = Math.round((completedSteps / totalSteps) * 100)

    const value: OnboardingContextType = {
        dataState,
        dataCounts,
        isLoading,
        isDemoMode,
        setDemoMode: setIsDemoMode,
        setupChecklist,
        completedSteps,
        totalSteps,
        completionPercentage,
        recentUploads,
        uploadedTypes,
        hasUploadedDrivers,
        hasUploadedPatients,
        hasUploadedEmployees,
        refreshDataCounts,
        refreshUploadHistory,
        navigateTo,
    }

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    )
}
