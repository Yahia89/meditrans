-- Migration: Auto-link Drivers to Users by Email
-- This ensures that when an existing User (like an Owner) is added as a Driver,
-- their User ID is automatically linked, enabling features like Location Tracking.

-- 1. Create a function to link driver => user_id on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.link_driver_on_email_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only attempt link if user_id is NULL and email is provided
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    -- Try to find a matching user in auth.users
    -- Note: We select specific columns to avoid permission issues if any
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE email = NEW.email
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Create the Trigger on public.drivers
DROP TRIGGER IF EXISTS link_driver_user_trigger ON public.drivers;
CREATE TRIGGER link_driver_user_trigger
BEFORE INSERT OR UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.link_driver_on_email_match();

-- 3. Backfill: Link any existing unlinked drivers where email matches
DO $$
BEGIN
  UPDATE public.drivers d
  SET user_id = u.id
  FROM auth.users u
  WHERE d.email = u.email
    AND d.user_id IS NULL;
END $$;

-- 4. (Optional) Trigger on auth.users to link User => Driver on signup
-- This handles the reverse case: Driver added first -> User signs up later
CREATE OR REPLACE FUNCTION public.link_user_to_driver_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.drivers
  SET user_id = NEW.id
  WHERE email = NEW.email
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

-- Apply trigger to auth.users (if permissions allow)
DO $$
BEGIN
  -- We wrap this in a block to catch permission errors gracefully if running as restricted user
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created_link_driver ON auth.users;
    CREATE TRIGGER on_auth_user_created_link_driver
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.link_user_to_driver_on_signup();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create trigger on auth.users: %', SQLERRM;
  END;
END $$;
