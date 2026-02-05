-- Migration: Add timezone columns to organizations and user_profiles
-- Date: 2026-02-04

DO $$
BEGIN
  -- 1. Add timezone column to organizations table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN timezone text DEFAULT 'America/Chicago';
  END IF;

  -- 2. Add timezone column to user_profiles table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN timezone text;
  END IF;
END $$;
