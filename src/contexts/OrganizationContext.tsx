import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth-context'
import { supabase } from '@/lib/supabase'

// Types
interface Organization {
    id: string
    name: string
    created_at: string
}

interface OrganizationContextType {
    currentOrganization: Organization | null
    organizations: Organization[]
    loading: boolean
    setCurrentOrganization: (org: Organization | null) => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export const useOrganization = () => {
    const context = useContext(OrganizationContext)
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider')
    }
    return context
}

interface OrganizationProviderProps {
    children: React.ReactNode
}

export const OrganizationProvider = ({ children }: OrganizationProviderProps) => {
    const { user, memberships, profile } = useAuth()
    const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch organizations based on user's memberships
    useEffect(() => {
        const fetchOrganizations = async () => {
            if (!user || memberships.length === 0) {
                setOrganizations([])
                setCurrentOrganization(null)
                setLoading(false)
                return
            }

            try {
                // Get all organization IDs from memberships
                const orgIds = memberships.map(m => m.org_id)

                // Fetch organization details
                const { data, error } = await supabase
                    .from('organizations')
                    .select('*')
                    .in('id', orgIds)

                if (error) throw error

                setOrganizations(data || [])

                // Set current organization based on user's default or first membership
                if (data && data.length > 0) {
                    // Try to use the default org from profile
                    if (profile?.default_org_id) {
                        const defaultOrg = data.find(org => org.id === profile.default_org_id)
                        if (defaultOrg) {
                            setCurrentOrganization(defaultOrg)
                            setLoading(false)
                            return
                        }
                    }

                    // Otherwise, use the primary membership's organization
                    const primaryMembership = memberships.find(m => m.is_primary)
                    if (primaryMembership) {
                        const primaryOrg = data.find(org => org.id === primaryMembership.org_id)
                        if (primaryOrg) {
                            setCurrentOrganization(primaryOrg)
                            setLoading(false)
                            return
                        }
                    }

                    // Fallback to first organization
                    setCurrentOrganization(data[0])
                }
            } catch (error) {
                console.error('Error fetching organizations:', error)
                setOrganizations([])
                setCurrentOrganization(null)
            } finally {
                setLoading(false)
            }
        }

        fetchOrganizations()
    }, [user, memberships, profile])

    const value = {
        currentOrganization,
        organizations,
        loading,
        setCurrentOrganization,
    }

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    )
}
