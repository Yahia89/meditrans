# RBAC and Real-time Presence Implementation Summary

## Overview

Successfully implemented a comprehensive RBAC hierarchy with real-time user presence tracking for the organization management system.

## Key Features Implemented

### 1. Enhanced RBAC Hierarchy

**Hierarchy**: Owner > Admin > Dispatch > Employee > Driver

#### Role Permissions:

- **Owner**: Full privileges across the entire organization
- **Admin**: Everything except deleting the owner and changing organization name
- **Dispatch** (NEW):
  - Can view drivers and patients
  - Can create, assign, and manage trips
  - Cannot manage employees or billing
- **Employee**: Limited view access (dashboard, patients, drivers, employees, files)
- **Driver**: Most restricted (view assigned trips, update trip status)

### 2. Real-time User Presence Tracking

Implemented live presence status for all organization members:

- **Online** (green, pulsing): User is actively signed in and active
- **Away** (amber): User is signed in but inactive for 2+ minutes
- **Offline** (gray): User is not signed in

#### Technical Implementation:

- Database columns: `presence_status`, `last_active_at` on `organization_memberships`
- Automatic heartbeat every 30 seconds
- Activity detection via mouse, keyboard, scroll, and touch events
- Automatic away detection after 2 minutes of inactivity
- Graceful offline handling on page unload
- Real-time updates via Supabase subscriptions

### 3. Pending Invite System

Enhanced invitation flow with clear visual feedback:

- Beautiful banner showing pending invites at the top of all pages
- One-click accept directly from the banner
- Automatic redirect and context refresh on acceptance
- Clear messaging for users without organization access

## Database Changes

### Migration: `add_user_presence_and_dispatch_role`

```sql
-- Added 'dispatch' to membership_role enum
ALTER TYPE membership_role ADD VALUE 'dispatch';

-- Added presence tracking columns
ALTER TABLE organization_memberships
  ADD COLUMN last_active_at timestamptz,
  ADD COLUMN presence_status text DEFAULT 'offline';

-- Created helper functions
CREATE FUNCTION update_user_presence(...)
CREATE FUNCTION auto_mark_users_away()

-- Enabled real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE organization_memberships;
```

## New Components

### 1. `usePresence.ts` Hook

- Monitors user activity automatically
- Updates presence status in real-time
- Handles visibility changes and page unload
- Throttled activity detection (every 5 seconds)
- Heartbeat interval (every 30 seconds)

### 2. `PresenceIndicator.tsx` Component

- Configurable size (sm, md, lg)
- Optional label display
- Pulsing animation for online status
- Two variants: inline indicator and avatar badge

### 3. `PendingInviteBanner.tsx` Component

- Fetches pending invites on mount
- Inline accept functionality
- Dismissible per-invite
- Automatic refresh on acceptance
- Clear no-access state for users without memberships

### 4. `useOrganizationMembers.ts` Hook

- Fetches organization members with presence data
- Real-time subscription for live updates
- Combines data from memberships, profiles, and employees
- Provides presence count aggregates

## Updated Components

### 1. `employees-page.tsx`

- **Stats Section**: Now shows Online/Away/Offline counts instead of Active/On Leave
- **Employee Cards**: Real-time presence indicators replacing static status badges
- **List View**: Presence indicators in status column
- **Integration**: Uses `useOrganizationMembers` hook with email-based lookup

### 2. `employee-form.tsx`

- Added "Dispatcher" role option in system access dropdown
- Positioned between Admin and Employee in the hierarchy

### 3. `App.tsx`

- Integrated `usePresence()` hook for all authenticated users
- Fixed founder route with proper access control
- Updated role-based restrictions to include dispatch

### 4. `dashboard-page.tsx`

- Added `PendingInviteBanner` at the top of all dashboard pages
- Ensures users see pending invites immediately upon login

### 5. `usePermissions.ts`

- Added `isDispatch` flag
- Added `canManageTrips` helper (dispatch and above)
- Added `canManageUsers` helper (admin and above)
- Added `canViewEmployees` helper (admin and above)
- Updated permission hierarchy to include dispatch

## Type Updates

### `src/lib/supabase.ts`

```typescript
// Updated MembershipRole type
export type MembershipRole =
  | "owner"
  | "admin"
  | "dispatch"
  | "employee"
  | "driver";

// Updated organization_memberships table types
interface Row {
  // ... existing fields
  presence_status: "online" | "away" | "offline";
  last_active_at: string | null;
}
```

## How It Works

### Presence Tracking Flow:

1. User logs in → `usePresence()` hook initializes
2. Hook sets presence to "online" and starts monitoring activity
3. User activity (mouse, keyboard, etc.) → Updates `last_active_at`
4. No activity for 2 minutes → Automatically set to "away"
5. User closes tab/logs out → Set to "offline" via sendBeacon
6. Real-time subscription broadcasts changes to all connected clients

### Invitation Flow:

1. Admin/Owner invites a user via employee form or founder form
2. Invite record created in `org_invites` with role
3. User logs in → `PendingInviteBanner` checks for unaccepted invites
4. User clicks "Accept Invite" → Creates `organization_memberships` record
5. Auth context refreshes → User gains access to organization
6. Dashboard redirects to appropriate landing page based on role

## Benefits

1. **Real-time Collaboration**: See who's online instantly
2. **Clear Role Hierarchy**: Well-defined permissions prevent confusion
3. **Enhanced Security**: Dispatch role provides middle ground between admin and employee
4. **Better UX**: Pending invites are impossible to miss
5. **Accurate Presence**: Automatic away detection prevents false "online" status
6. **Performance**: Throttled updates and efficient real-time subscriptions
7. **Reliability**: Offline handling via sendBeacon ensures status accuracy

## Testing Recommendations

1. **Role Permissions**: Test each role's access to various features
2. **Presence Accuracy**: Test activity detection, away timeout, and offline handling
3. **Invite Flow**: Test invite creation, acceptance, and rejection
4. **Real-time Updates**: Open multiple sessions and verify presence syncs
5. **Edge Cases**: Test rapid tab switching, network disconnects, and browser crashes

## Future Enhancements

- [ ] Add "Do Not Disturb" manual status option
- [ ] Show last seen timestamp for offline users
- [ ] Add presence filters on employees page
- [ ] Export attendance/presence reports
- [ ] Mobile push notifications for role changes
- [ ] Custom role creation for organizations

## Files Changed

**Created:**

- `src/hooks/usePresence.ts`
- `src/hooks/useOrganizationMembers.ts`
- `src/components/ui/presence-indicator.tsx`
- `src/components/ui/pending-invite-banner.tsx`

**Modified:**

- `src/lib/supabase.ts` (types)
- `src/hooks/usePermissions.ts` (dispatch role)
- `src/components/App.tsx` (presence hook, founder route)
- `src/components/dashboard-page.tsx` (pending invite banner)
- `src/components/employees-page.tsx` (presence indicators)
- `src/components/forms/employee-form.tsx` (dispatch option)

**Database:**

- Migration: `add_user_presence_and_dispatch_role.sql`

---

_Implementation completed on 2026-01-14_
