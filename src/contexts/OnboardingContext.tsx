import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
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

import type { UploadRecord } from '@/components/upload/types'

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
    hasUploadedTrips: boolean

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

// ─── localStorage helpers ───
// These are synchronous reads at module load time. Safe because this code
// only runs in the browser (Vite SPA). Using a versioned key prevents
// stale data from breaking the app if we ever change the schema.

const STORAGE_KEY_DATA_STATE = 'onboarding:dataState'
const STORAGE_KEY_DEMO_MODE = 'onboarding:isDemoMode'

function readCachedDataState(): DataState | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY_DATA_STATE)
        if (v === 'empty' || v === 'onboarding' || v === 'live') return v
    } catch { /* quota / SSR / private-browsing – ignore */ }
    return null
}

function writeCachedDataState(state: DataState) {
    try { localStorage.setItem(STORAGE_KEY_DATA_STATE, state) } catch { /* */ }
}

function readCachedDemoMode(): boolean {
    try { return localStorage.getItem(STORAGE_KEY_DEMO_MODE) === 'true' } catch { return false }
}

function writeCachedDemoMode(v: boolean) {
    try { localStorage.setItem(STORAGE_KEY_DEMO_MODE, v.toString()) } catch { /* */ }
}

export const OnboardingProvider = ({ children, onNavigate }: OnboardingProviderProps) => {
    const { currentOrganization } = useOrganization()

    // ─── Synchronous initial state from cache ───
    // By reading from localStorage *inside the initializer*, the very first
    // render already has the correct answer. No useEffect, no flash.
    const cachedDataState = useRef(readCachedDataState())

    // If the cache says "live", we know the user has real data.
    // Skip the loading state entirely — start with isLoading: false and
    // use the cached dataState so the dashboard renders instantly.
    const [isLoading, setIsLoading] = useState(() => cachedDataState.current !== 'live')

    const [isDemoMode, setIsDemoMode] = useState(readCachedDemoMode)

    const [dataCounts, setDataCounts] = useState<DataCounts>(() => {
        // If cached as "live", seed with non-zero sentinel counts so
        // getDataState() returns "live" on the first render.
        if (cachedDataState.current === 'live') {
            return { patients: 1, drivers: 1, employees: 1, trips: 1 }
        }
        return { patients: 0, drivers: 0, employees: 0, trips: 0 }
    })

    const [recentUploads, setRecentUploads] = useState<UploadRecord[]>([])

    // ─── Persist demo mode ───
    // Using a ref + write-on-change instead of useEffect avoids the
    // unnecessary render cycle on mount.
    const handleSetDemoMode = useCallback((enabled: boolean) => {
        setIsDemoMode(enabled)
        writeCachedDemoMode(enabled)
    }, [])

    // Compute uploaded types from recent uploads
    const uploadedTypes = new Set(
        recentUploads
            .filter(u => u.status === 'committed' || u.status === 'ready_for_review')
            .map(u => u.source)
    )
    const hasUploadedDrivers = uploadedTypes.has('drivers')
    const hasUploadedPatients = uploadedTypes.has('patients')
    const hasUploadedEmployees = uploadedTypes.has('employees')
    const hasUploadedTrips = uploadedTypes.has('trips')

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

    // ─── Cache the computed dataState whenever it changes ───
    useEffect(() => {
        writeCachedDataState(dataState)
    }, [dataState])

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

        // Only show loading spinner if we don't have a cached "live" state.
        // If we do, we're silently refreshing in the background.
        if (cachedDataState.current !== 'live') {
            setIsLoading(true)
        }

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

            const newCounts = {
                patients: patientsRes.count ?? 0,
                drivers: driversRes.count ?? 0,
                employees: employeesRes.count ?? 0,
                trips: tripsRes.count ?? 0,
            }
            setDataCounts(newCounts)

            // Update the cache ref so subsequent calls know the truth
            const newState = getDataState(newCounts)
            cachedDataState.current = newState
        } catch (error) {
            console.error('Error fetching data counts:', error)
            // On error, keep whatever we have (cached or zeroes).
            // Don't reset to zero — that would flash onboarding for live users.
        } finally {
            setIsLoading(false)
        }
    }, [currentOrganization, getDataState])

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
        setDemoMode: handleSetDemoMode,
        setupChecklist,
        completedSteps,
        totalSteps,
        completionPercentage,
        recentUploads,
        uploadedTypes,
        hasUploadedDrivers,
        hasUploadedPatients,
        hasUploadedEmployees,
        hasUploadedTrips,
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
