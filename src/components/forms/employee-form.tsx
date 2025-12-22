import { useState } from 'react'
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
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { cn, formatPhoneNumber } from '@/lib/utils'


// Schema for employee form
const employeeSchema = z.object({
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
})


interface EmployeeFormData extends z.infer<typeof employeeSchema> {
    id?: string
}

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
        } : {

            full_name: '',
            email: '',
            phone: '',
            role: '',
            department: '',
            hire_date: '',
            notes: '',
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

            // Reset form and close
            handleClose()
        } catch (err) {
            console.error('Failed to save employee:', err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        reset()
        setCustomFields([])
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Hire Date</label>
                        <Input
                            {...register('hire_date')}
                            type="date"
                        />
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
                                            <Trash2 className="h-4 w-4" />
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
            </DialogContent>
        </Dialog>
    )
}
