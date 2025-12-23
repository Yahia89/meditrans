import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Building2, UserPlus, Shield } from 'lucide-react'

const founderSchema = z.object({
    org_name: z.string().min(3, 'Organization name must be at least 3 characters'),
    owner_email: z.string().email('Invalid email address'),
    owner_name: z.string().min(2, 'Owner name must be at least 2 characters'),
})

type FounderFormData = z.infer<typeof founderSchema>

export function FounderInviteForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [inviteToken, setInviteToken] = useState<string | null>(null)
    const [lastInviteEmail, setLastInviteEmail] = useState<string>('')

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FounderFormData>({
        resolver: zodResolver(founderSchema),
        defaultValues: {
            org_name: '',
            owner_email: '',
            owner_name: '',
        }
    })

    const onSubmit = async (data: FounderFormData) => {
        setIsSubmitting(true)
        try {
            // 1. Create Organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: data.org_name,
                    slug: data.org_name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
                })
                .select()
                .single()

            if (orgError) throw orgError

            // 2. Create Invite for the first owner
            const { error: inviteError } = await supabase
                .from('org_invites')
                .insert({
                    org_id: org.id,
                    email: data.owner_email,
                    role: 'owner',
                    // Assuming the current user is the founder
                    invited_by: (await supabase.auth.getUser()).data.user?.id
                })

            if (inviteError) throw inviteError

            // Fetch the generated token to show the manual link
            const { data: inviteData } = await supabase
                .from('org_invites')
                .select('token')
                .eq('org_id', org.id)
                .eq('email', data.owner_email)
                .is('accepted_at', null)
                .single()

            setInviteToken(inviteData?.token || null)
            setLastInviteEmail(data.owner_email)
            setSuccess(true)
            reset()
        } catch (err: any) {
            console.error('Founder tool error:', err)
            alert(err.message || 'Failed to create organization and invite.')
        } finally {
            setIsSubmitting(false)
        }
    }


    if (success) {
        const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL}?page=accept-invite&token=${inviteToken}`

        return (
            <div className="p-8 text-center space-y-6">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Building2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Organization Created!</h2>
                    <p className="text-slate-500 max-w-md mx-auto">
                        The organization has been established and an invitation email has been sent to <strong>{lastInviteEmail}</strong>. You can also share the link manually:
                    </p>
                </div>


                <div className="flex items-center gap-2 max-w-md mx-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <code className="text-xs flex-1 truncate text-left">{inviteUrl}</code>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            navigator.clipboard.writeText(inviteUrl)
                            alert('Link copied to clipboard!')
                        }}
                    >
                        Copy
                    </Button>
                </div>

                <div className="pt-4">
                    <Button onClick={() => setSuccess(false)} variant="outline">
                        Create Another Organization
                    </Button>
                </div>
            </div>
        )
    }


    return (
        <div className="max-w-xl mx-auto p-6 space-y-8">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="h-6 w-6 text-[#3D5A3D]" />
                    Founder Onboarding Tool
                </h1>
                <p className="text-slate-500 text-sm">
                    Create a new organization and invite its first owner. The owner will then be able to manage their own employees, drivers, and patients.
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4 rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                    <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Organization Details
                    </h3>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Organization Name</label>
                        <Input
                            {...register('org_name')}
                            placeholder="e.g., City Medical Transport"
                            className={cn(errors.org_name && 'border-red-500')}
                        />
                        {errors.org_name && (
                            <p className="text-xs text-red-500">{errors.org_name.message}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-4 rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                    <h3 className="font-medium text-slate-900 flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        First Owner Details
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Name</label>
                            <Input
                                {...register('owner_name')}
                                placeholder="e.g., John Smith"
                                className={cn(errors.owner_name && 'border-red-500')}
                            />
                            {errors.owner_name && (
                                <p className="text-xs text-red-500">{errors.owner_name.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email Address</label>
                            <Input
                                {...register('owner_email')}
                                type="email"
                                placeholder="owner@company.com"
                                className={cn(errors.owner_email && 'border-red-500')}
                            />
                            {errors.owner_email && (
                                <p className="text-xs text-red-500">{errors.owner_email.message}</p>
                            )}
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full bg-[#3D5A3D] hover:bg-[#2E4A2E]"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Establishing Organization...
                        </>
                    ) : (
                        'Create Organization & Send Invite'
                    )}
                </Button>
            </form>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ')
}
