import { useState, useEffect } from 'react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Loader2, Plus, Trash } from 'lucide-react'
import { cn, formatPhoneNumber } from '@/lib/utils'


// Schema for employee form
const employeeSchema = z.object({
    id: z.string().optional(),
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string()
        .regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Invalid phone format (555) 555-5555')
        .optional()
        .or(z.literal('')),
    role: z.string().optional(),
    department: z.string().optional(),
    hire_date: z.string().optional(),
    notes: z.string().optional(),
    system_role: z.string(),
})



type EmployeeFormData = z.infer<typeof employeeSchema>


interface CustomField {
    key: string
    value: string
}

interface EmployeeFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: EmployeeFormData & { custom_fields?: Record<string, string> | null }
}

export function EmployeeForm({ open, onOpenChange, initialData }: EmployeeFormProps) {
    const { currentOrganization } = useOrganization()
    const queryClient = useQueryClient()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [customFields, setCustomFields] = useState<CustomField[]>(() => {
        if (initialData?.custom_fields) {
            return Object.entries(initialData.custom_fields).map(([key, value]) => ({ key, value }))
        }
        return []
    })
    const [hasOwner, setHasOwner] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [inviteToken, setInviteToken] = useState<string | null>(null)
    const [lastInviteEmail, setLastInviteEmail] = useState('')


    // Check for existing owner
    useEffect(() => {
        if (!open || !currentOrganization) return

        const checkOwner = async () => {
            const { count: mCount } = await supabase
                .from('organization_memberships')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', currentOrganization.id)
                .eq('role', 'owner')

            const { count: iCount } = await supabase
                .from('org_invites')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', currentOrganization.id)
                .eq('role', 'owner')
                .is('accepted_at', null)

            setHasOwner(((mCount || 0) + (iCount || 0)) > 0)
        }
        checkOwner()
    }, [open, currentOrganization])


    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<EmployeeFormData>({

        resolver: zodResolver(employeeSchema),
        values: initialData ? {
            full_name: initialData.full_name,
            email: initialData.email || '',
            phone: initialData.phone ? formatPhoneNumber(initialData.phone) : '',
            role: initialData.role || '',
            department: initialData.department || '',
            hire_date: initialData.hire_date || '',
            notes: initialData.notes || '',
            system_role: 'none',
        } : {
            full_name: '',
            email: '',
            phone: '',
            role: '',
            department: '',
            hire_date: '',
            notes: '',
            system_role: 'none',
        },
    })


    const addCustomField = () => {
        setCustomFields([...customFields, { key: '', value: '' }])
    }

    const removeCustomField = (index: number) => {
        setCustomFields(customFields.filter((_, i) => i !== index))
    }

    const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...customFields]
        updated[index][field] = value
        setCustomFields(updated)
    }

    const onSubmit = async (data: EmployeeFormData) => {
        if (!currentOrganization) return

        setIsSubmitting(true)

        try {
            const fieldsObj: Record<string, string> = {}
            customFields.forEach(cf => {
                if (cf.key.trim()) {
                    fieldsObj[cf.key.trim()] = cf.value
                }
            })

            if (data.system_role !== 'none') {
                if (!data.email) {
                    throw new Error('Email is required to invite a user to the system.')
                }

                // If role is owner, check if one already exists (membership or pending invite)
                if (data.system_role === 'owner') {
                    // Check memberships
                    const { count: memberCount, error: memberError } = await supabase
                        .from('organization_memberships')
                        .select('*', { count: 'exact', head: true })
                        .eq('org_id', currentOrganization.id)
                        .eq('role', 'owner')

                    if (memberError) throw memberError

                    // Check pending invites
                    const { count: inviteCount, error: inviteError } = await supabase
                        .from('org_invites')
                        .select('*', { count: 'exact', head: true })
                        .eq('org_id', currentOrganization.id)
                        .eq('role', 'owner')
                        .is('accepted_at', null)

                    if (inviteError) throw inviteError

                    const totalOwners = (memberCount || 0) + (inviteCount || 0)

                    if (totalOwners > 0) {
                        throw new Error('This organization already has an owner or a pending owner invitation. Only one owner is allowed.')
                    }
                }

                // Create invitation
                const { error: inviteError } = await supabase
                    .from('org_invites')
                    .insert({
                        org_id: currentOrganization.id,
                        email: data.email,
                        role: data.system_role as any,
                        invited_by: (await supabase.auth.getUser()).data.user?.id
                    })

                if (inviteError) {
                    if (inviteError.code === '23505') {
                        throw new Error('An invitation for this email already exists in this organization.')
                    }
                    throw inviteError
                }
            }

            const employeeData = {
                org_id: currentOrganization.id,
                full_name: data.full_name,
                email: data.email || null,
                phone: data.phone || null,
                role: data.role || null,
                department: data.department || null,
                hire_date: data.hire_date || null,
                notes: data.notes || null,
                custom_fields: Object.keys(fieldsObj).length > 0 ? fieldsObj : null,
            }

            if (initialData?.id) {
                const { error } = await supabase
                    .from('employees')
                    .update(employeeData)
                    .eq('id', initialData.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('employees')
                    .insert(employeeData)
                if (error) throw error
            }


            // Invalidate and refetch employees
            await queryClient.invalidateQueries({ queryKey: ['employees', currentOrganization.id] })

            if (data.system_role !== 'none') {
                const { data: inviteData } = await supabase
                    .from('org_invites')
                    .select('token')
                    .eq('org_id', currentOrganization.id)
                    .eq('email', data.email)
                    .is('accepted_at', null)
                    .single()

                setInviteToken(inviteData?.token || null)
                setLastInviteEmail(data.email || '')
                setShowSuccess(true)
            } else {
                handleClose()
            }

        } catch (err) {
            console.error('Failed to save employee:', err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        reset()
        setCustomFields([])
        setShowSuccess(false)
        setInviteToken(null)
        onOpenChange(false)
    }


    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                {showSuccess ? (
                    <div className="py-6 text-center space-y-6">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-slate-900">Invite Sent!</h2>
                            <p className="text-sm text-slate-500">
                                An invitation email has been sent to <strong>{lastInviteEmail}</strong>. You can also share the link manually if needed:
                            </p>
                        </div>


                        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <code className="text-[10px] flex-1 truncate text-left">
                                {`${window.location.origin}${import.meta.env.BASE_URL}?page=accept-invite&token=${inviteToken}`}
                            </code>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => {
                                    const url = `${window.location.origin}${import.meta.env.BASE_URL}?page=accept-invite&token=${inviteToken}`
                                    navigator.clipboard.writeText(url)
                                    alert('Copied!')
                                }}
                            >
                                Copy
                            </Button>
                        </div>

                        <Button onClick={handleClose} className="w-full bg-[#3D5A3D]">
                            Done
                        </Button>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold text-slate-900">
                                {initialData ? 'Edit Employee' : 'Add New Employee'}
                            </DialogTitle>

                            <DialogDescription>
                                {initialData
                                    ? 'Update the employee\'s information below.'
                                    : 'Enter the employee\'s information below. Custom fields can be added for organization-specific data.'}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {/* Required Field */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    {...register('full_name')}
                                    placeholder="Sarah Johnson"
                                    className={cn(errors.full_name && 'border-red-500')}
                                />
                                {errors.full_name && (
                                    <p className="text-xs text-red-500">{errors.full_name.message}</p>
                                )}
                            </div>

                            {/* Contact Info Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Email</label>
                                    <Input
                                        {...register('email')}
                                        type="email"
                                        placeholder="employee@company.com"
                                        className={cn(errors.email && 'border-red-500')}
                                    />
                                    {errors.email && (
                                        <p className="text-xs text-red-500">{errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Phone</label>
                                    <Input
                                        {...register('phone')}
                                        onChange={(e) => {
                                            const formatted = formatPhoneNumber(e.target.value)
                                            setValue('phone', formatted, { shouldValidate: true })
                                        }}
                                        placeholder="(555) 123-4567"
                                        className={cn(errors.phone && 'border-red-500')}
                                    />
                                    {errors.phone && (
                                        <p className="text-xs text-red-500">{errors.phone.message}</p>
                                    )}
                                </div>

                            </div>

                            {/* Role and Department Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Role / Position</label>
                                    <Input
                                        {...register('role')}
                                        placeholder="Operations Manager"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Department</label>
                                    <Input
                                        {...register('department')}
                                        placeholder="Operations"
                                    />
                                </div>
                            </div>

                            {/* Hire Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Hire Date</label>
                                    <Input
                                        {...register('hire_date')}
                                        type="date"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">
                                        System Role (INVITE)
                                    </label>
                                    <select
                                        {...register('system_role')}
                                        className="w-full h-10 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                                    >
                                        <option value="none">No System Access</option>
                                        <option value="owner" disabled={hasOwner}>
                                            Owner (Primary) {hasOwner ? '(Already Assigned)' : ''}
                                        </option>
                                        <option value="admin">Administrator</option>

                                        <option value="employee">Staff / Employee</option>
                                        <option value="driver">Driver</option>
                                        <option value="patient">Patient Portal</option>
                                    </select>
                                    <p className="text-[10px] text-slate-500 italic">
                                        Choosing a role will send an invite to the email provided above.
                                    </p>
                                </div>
                            </div>


                            {/* Notes */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Notes</label>
                                <textarea
                                    {...register('notes')}
                                    placeholder="Any additional notes about the employee..."
                                    className="w-full min-h-[80px] rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
                                />
                            </div>

                            {/* Custom Fields Section */}
                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-900">Custom Fields</h4>
                                        <p className="text-xs text-slate-500">Add organization-specific data</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addCustomField}
                                        className="gap-1"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Add Field
                                    </Button>
                                </div>

                                {customFields.length > 0 && (
                                    <div className="space-y-2">
                                        {customFields.map((cf, index) => (
                                            <div key={index} className="flex gap-2 items-center">
                                                <Input
                                                    placeholder="Field name"
                                                    value={cf.key}
                                                    onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Input
                                                    placeholder="Value"
                                                    value={cf.value}
                                                    onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeCustomField(index)}
                                                    className="text-slate-400 hover:text-red-500"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {customFields.length === 0 && (
                                    <p className="text-xs text-slate-400 italic">
                                        No custom fields added. Click "Add Field" to create organization-specific fields.
                                    </p>
                                )}
                            </div>

                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-[#3D5A3D] hover:bg-[#2E4A2E]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            {initialData ? 'Saving...' : 'Adding...'}
                                        </>
                                    ) : (
                                        initialData ? 'Save Changes' : 'Add Employee'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

