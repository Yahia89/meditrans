-- Migration: Create organization_fees table
-- Date: 2026-01-27

CREATE TABLE IF NOT EXISTS public.organization_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    base_fee NUMERIC(10, 2) DEFAULT 0.00,
    per_mile_fee NUMERIC(10, 2) DEFAULT 0.00,
    per_minute_wait_fee NUMERIC(10, 2) DEFAULT 0.00,
    discharge_fee NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(org_id)
);

-- Enable RLS
ALTER TABLE public.organization_fees ENABLE ROW LEVEL SECURITY;

-- Add triggers for updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.organization_fees
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
-- Owners and Admins can do everything
CREATE POLICY "Owners and Admins can manage organization fees" ON public.organization_fees
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE user_id = auth.uid()
            AND org_id = organization_fees.org_id
            AND role IN ('owner', 'admin', 'dispatch')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE user_id = auth.uid()
            AND org_id = organization_fees.org_id
            AND role IN ('owner', 'admin', 'dispatch')
        )
    );

-- Backfill existing organizations with a default fee row (using $50 as requested)
INSERT INTO public.organization_fees (org_id, base_fee)
SELECT id, 50.00
FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;
