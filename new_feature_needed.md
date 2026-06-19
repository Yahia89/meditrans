Add Temporary Access Disable Feature for
Employees, Drivers and Clients
This prompt describes how to implement a temporary access disable/enable feature in the meditrans
repository. The goal is to allow to disable an employee, driver, or client (patient) so that the user can
no longer sign in or access resources, without having to delete their record. Once disabled, the user’s status
should be shown as “Disabled” or “Deactivated” in the UI, and admins should be able to re‑enable access
later.
Background
The current data models use status fields for business purposes: employees have statuses such
as "active", "on‑leave" or "inactive"【24†L9-L11】, drivers use "available", "on‑trip" or
"offline"【25†L3-L10】, and patients use "approved", "pending", "expired" or "n/a"【26†L3-L8】.
These statuses do not control authentication.
Supabase’s membership_role enum lists roles like owner , admin , employee , driver and
patient 【27†L3-L7】. Roles do not include a notion of disabling accounts, and Supabase does not
provide a built‑in is_active flag. According to Supabase support, the recommended way to
suspend a user is to call auth.admin.updateUserById and set a very long ban_duration .
Drivers already have an active boolean column in the database, but this flag is not surfaced in
the UI. Employees and patients currently lack such a column.
High‑Level Plan
Schema changes
Add a disabled boolean column (default false ) and a disabled_at timestamp column to
the employees and patients tables. For drivers, either reuse the existing active boolean or
create a disabled column for clarity; treat active = false as disabled. Optionally add a
disabled_reason text column to store the reason for suspension and a disabled_by column
to capture the admin’s user ID.
Keep business‑specific statuses separate. Do not overload the existing status fields; instead, create a
separate access_state enum with values active and disabled , or use the disabled
boolean. This separation prevents confusion between someone who is "on‑leave" (still able to log in)
and someone who is suspended.
Update row‑level security (RLS) policies to include conditions like disabled = false so that
disabled records cannot view or mutate data. Also ensure that only authorized roles (e.g., owners
and admins) can modify the disabled flag.
Add migrations with IF NOT EXISTS guards to ensure safe re‑runs.
•
•
1
•

1.
2.
3.
4.
5. 1
   Server‑side toggle function
   Create a server‑only helper (e.g., lib/server/toggleUserAccess.ts ) that uses the Supabase
   service role key. This helper should:
   Fetch the record (employee/driver/patient) by ID to determine the current disabled state
   and obtain the linked user_id (the auth.users ID).
   Use supabase.auth.admin.updateUserById to set ban_duration to a long value
   (e.g., "10000h" ) when disabling the user, and "0" when enabling. This effectively bans or
   unbans the account at the authentication level.
   Update the disabled , disabled_at , and (optionally) disabled_reason columns in
   the respective table. When disabling, set disabled = true and disabled_at to new
   Date() . When enabling, set disabled = false and clear disabled_at .
   Ensure this helper runs only on the server using the service role key. Never expose the service role
   key or admin API calls to the client.
   API route or server action
   Expose an API endpoint or server action (e.g., pages/api/users/[id]/toggle-access.ts ) that
   wraps the helper. This route should:
   Validate the current user’s permissions (e.g., require role = owner or admin ).
   Accept parameters identifying the table ( employees , drivers , or patients ) and the
   record ID.
   Call the toggle helper and return a success status or the updated record.
   Because the route runs on the server, it can securely call the Supabase admin API.
   UI changes
   In each list view ( employees-page.tsx , drivers-page.tsx , patients-page.tsx ), add a
   new DropdownMenuItem or button to disable or enable access. The label should depend on the
   disabled flag: “Disable Access” for active records and “Enable Access” for disabled records.
   Show a confirmation dialog before toggling to ensure the admin understands that the user will be
   suspended from signing in.
   After toggling, refresh the data via react-query or useSWR so that the UI reflects the updated
   disabled state. Display the disabled state with a badge (e.g., red background) reading
   “Disabled” or “Deactivated”. Avoid mixing this with the business status (e.g., still display that an
   employee is on‑leave but also that they are disabled).
   Role synchronization considerations
   The employees table currently has a system_role column synced to
   organization_memberships via triggers. Disabling a user should not change system_role ;
6.
7.
8.
9.
10.
11.
12.
13. ◦
    ◦
    ◦
14.
15.
16.
17.
18.
19.
20. 2
    keep the role so that re‑enabling restores original permissions. If desired, you can set
    system_role to NULL on disable and restore it on enable, but you must update triggers
    accordingly.
    Best practices
    Server‑side enforcement: All privilege changes must be executed on the server using the Supabase
    admin API. Do not rely on client‑side flags alone.
    Audit logging: Capture who disabled or enabled a user and when, using disabled_by and
    disabled_at fields. Consider sending notifications or logs.
    Testing: Write unit and integration tests to confirm that disabled users cannot authenticate or
    perform any actions, and that re‑enabled users regain access. Also test RLS policies to ensure that
    disabled records are invisible where appropriate.
    Migration safety: Use IF NOT EXISTS when altering tables or enums. Provide defaults for new
    columns to avoid breaking existing queries.
    Example implementation
    Below is an illustrative helper that toggles a user’s access. This code assumes a Next.js environment with
    environment variables for the Supabase URL and service role key. Adjust imports and types to match the
    project structure.
    // lib/server/toggleUserAccess.ts
    import { createClient } from '@supabase/supabase-js'
    import { Database } from '@/types/supabase'
    // Create an admin client using the service role key; do not expose this to the
    client
    const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
    )
    /\*\*

- Toggle a user’s access by updating the disabled flag and banning/unbanning in
  Auth.
- @param table The table name: 'employees', 'drivers', or 'patients'
- @param recordId The primary key ID of the record to toggle
  \*/
  export async function toggleUserAccess(
  table: 'employees' | 'drivers' | 'patients',
  recordId: string
  ) {

18.
19.
20.
21.
22.
23. 3
    // Fetch the record to get its current state and linked auth user
    const { data: record, error: fetchError } = await supabaseAdmin
    .from(table)
    .select('\*')
    .eq('id', recordId)
    .single()
    if (fetchError || !record) throw fetchError || new Error('Record not found')
    const disabled = !!record.disabled
    const userId: string | null = (record as any).user_id || null
    // Ban or unban the auth user if there is a linked account
    if (userId) {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
    // Use a long ban duration when disabling; 0 hours to lift the ban
    ban_duration: disabled ? '0' : '10000h'
    })
    }
    // Update the table record
    const updates: any = {
    disabled: !disabled,
    disabled_at: disabled ? null : new Date().toISOString()
    }
    const { error: updateError } = await supabaseAdmin
    .from(table)
    .update(updates)
    .eq('id', recordId)
    if (updateError) throw updateError
    return { ...record, ...updates }
    }
    Integrate this helper into an API route or server action that validates admin permissions, calls
    toggleUserAccess , and returns the updated user. Use this endpoint from the client when an admin
    clicks the “Disable Access” or “Enable Access” button.
    By following this plan—adding appropriate database flags, using the Supabase admin API to ban/unban the
    underlying auth user, exposing a secure server‑side toggle function, and updating the UI—developers can
    implement a robust Disable/Enable Access feature that temporarily suspends users without deleting their
    data.
    How can I disable a user in supabase auth database? · supabase · Discussion #26771 · GitHub
    https://github.com/orgs/supabase/discussions/26771
    1
    4

Here’s the detailed prompt for your LLM. It includes schema changes, server‑side logic, API route design, UI updates, and best practices to add a temporary disable/enable access feature for employees, drivers, and clients, with citations from your current codebase:

{{file:file-Vdv4NSTwmwYgxsr28Z36L7}}

**Key supporting citations from the repository:**

- The `Employee` interface currently uses the business status values `"active"`, `"on-leave"`, and `"inactive"`, which are unrelated to authentication.
- The `Driver` interface uses status values `"available"`, `"on-trip"`, and `"offline"`, while the `Patient` interface uses `"approved"`, `"pending"`, `"expired"`, or `"n/a"`—none of these control access.
- Your Supabase `membership_role` enum defines roles such as `owner`, `admin`, `employee`, `driver`, and `patient`; there is no built-in disabled state.
- Supabase’s recommended method for suspending a user is to set a long `ban_duration` through the admin API; soft deletes alone do not prevent login.
