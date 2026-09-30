import { createContext, useContext, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './auth-context'
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

const STORAGE_KEY_DEMO_MODE = 'onboarding:isDemoMode'
const EMPTY_COUNTS: DataCounts = { patients: 0, drivers: 0, employees: 0, trips: 0 }
const EMPTY_UPLOADS: UploadRecord[] = []

function readCachedDemoMode(): boolean {
    try { return localStorage.getItem(STORAGE_KEY_DEMO_MODE) === 'true' } catch { return false }
}

function writeCachedDemoMode(v: boolean) {
    try { localStorage.setItem(STORAGE_KEY_DEMO_MODE, v.toString()) } catch { /* */ }
}

export const OnboardingProvider = ({ children, onNavigate }: OnboardingProviderProps) => {
    const { currentOrganization } = useOrganization()
    const { user } = useAuth()
    const orgId = currentOrganization?.id
    const [isDemoMode, setIsDemoMode] = useState(readCachedDemoMode)

    // Cache server data per user and company; never seed another company's counts.
    const countsQuery = useQuery({
        queryKey: ['onboarding', 'counts', user?.id, orgId],
        enabled: !!orgId && !!user,
        staleTime: 5 * 60_000,
        queryFn: async ({ signal }): Promise<DataCounts> => {
            const responses = await Promise.all([
                supabase.from('patients').select('id', { count: 'exact', head: true }).eq('org_id', orgId!).abortSignal(signal),
                supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('org_id', orgId!).abortSignal(signal),
                supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId!).abortSignal(signal),
                supabase.from('trips').select('id', { count: 'exact', head: true }).eq('org_id', orgId!).abortSignal(signal),
            ])
            for (const response of responses) {
                if (response.error) throw response.error
            }
            return {
                patients: responses[0].count ?? 0,
                drivers: responses[1].count ?? 0,
                employees: responses[2].count ?? 0,
                trips: responses[3].count ?? 0,
            }
        },
    })
    const uploadsQuery = useQuery({
        queryKey: ['onboarding', 'uploads', user?.id, orgId],
        enabled: !!orgId && !!user,
        staleTime: 5 * 60_000,
        queryFn: async ({ signal }): Promise<UploadRecord[]> => {
            const { data, error } = await supabase
                .from('org_uploads')
                .select('id, source, original_filename, status, created_at, processed_at, notes')
                .eq('org_id', orgId!)
                .order('created_at', { ascending: false })
                .limit(10)
                .abortSignal(signal)
            if (error) throw error
            return data || []
        },
    })
    const dataCounts = countsQuery.data ?? EMPTY_COUNTS
    const recentUploads = uploadsQuery.data ?? EMPTY_UPLOADS
    // A failed count request should not claim an established company is empty.
    const isLoading = !!orgId && countsQuery.data === undefined
    const { refetch: refetchCounts } = countsQuery
    const { refetch: refetchUploads } = uploadsQuery
    const refreshDataCounts = useCallback(async () => { if (orgId) await refetchCounts() }, [orgId, refetchCounts])
    const refreshUploadHistory = useCallback(async () => { if (orgId) await refetchUploads() }, [orgId, refetchUploads])

    // Persist demo mode when the user changes it.
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

    // Navigate helper
    const navigateTo = useCallback((page: string) => {
        if (onNavigate) {
            onNavigate(page)
        }
    }, [onNavigate])

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
