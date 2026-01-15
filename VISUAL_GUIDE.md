# Visual Guide: RBAC & Presence Tracking

## 1. Real-time Presence on Employees Page

### Before:

```
┌─────────────────────────────────────────┐
│ Stats:                                  │
│ Total: 12 | Active: 10 | On Leave: 2   │ ❌ Static status
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ John Doe                                │
│ Dispatcher                              │
│ Status: Active [green badge]            │ ❌ Static, from DB
└─────────────────────────────────────────┘
```

### After:

```
┌─────────────────────────────────────────┐
│ Stats:                                  │
│ Total: 12 | 🟢 Online: 8 | 🟠 Away: 2   │ ✅ Real-time counts
│            | ⚫ Offline: 2                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ John Doe                                │
│ Dispatcher                              │
│ 🟢● Online [pulsing]                    │ ✅ Live presence
└─────────────────────────────────────────┘
```

## 2. Pending Invite Banner

### What Users See:

```
┌────────────────────────────────────────────────────┐
│ 📧  You're invited to join Acme Transport          │
│     Role: Dispatcher                               │
│                                     [Accept Invite →] │
└────────────────────────────────────────────────────┘
↓
[Dashboard content below...]
```

### Features:

- ✅ Appears on all dashboard pages
- ✅ One-click acceptance
- ✅ Auto-refreshes on acceptance
- ✅ Dismissible (per invite)
- ✅ Beautiful gradient design

## 3. Role Hierarchy

```
┌─────────────────────────────────────────┐
│           RBAC Hierarchy                │
├─────────────────────────────────────────┤
│                                         │
│  👑 Owner                               │
│   └─ Full Privileges                   │
│                                         │
│  🔐 Admin                               │
│   └─ Everything except:                │
│       • Delete Owner                   │
│       • Change Org Name                │
│                                         │
│  📋 Dispatch (NEW!)                     │
│   └─ Can:                              │
│       • View Drivers & Patients        │
│       • Create/Assign Trips            │
│       • Manage Trip Status             │
│   └─ Cannot:                           │
│       • Manage Employees               │
│       • Access Billing                 │
│                                         │
│  👤 Employee                            │
│   └─ Limited View Access               │
│                                         │
│  🚗 Driver                              │
│   └─ View Assigned Trips Only          │
│                                         │
└─────────────────────────────────────────┘
```

## 4. Employee Form - System Access

### Dropdown Options:

```
Assign System Role:
┌──────────────────────────────┐
│ No System Access             │
│ Owner (Already Assigned)     │ ← Disabled if exists
│ Administrator                │
│ Dispatcher                   │ ← NEW!
│ Staff / Employee             │
│ Driver                       │
└──────────────────────────────┘

Note: Choosing a role triggers an invitation
email with instant acceptance option.
```

## 5. Presence Indicator Variants

### Inline (with label):

```
🟢● Online     [pulsing green dot + label]
🟠● Away       [static amber dot + label]
⚫● Offline    [static gray dot + label]
```

### Sizes:

```
sm:  🟢 Small (for compact views)
md:  🟢● Medium (default)
lg:  🟢●● Large (for emphasis)
```

## 6. Real-time Features

### Activity Detection:

```
User Action               → Presence Update
─────────────────────────────────────────
Mouse move/click         → Online
Keyboard input           → Online
Scroll                   → Online
Touch (mobile)           → Online
No activity for 2 min    → Away
Tab close/logout         → Offline
```

### Heartbeat System:

```
┌──────────────────────────────────────┐
│ Every 30 seconds:                    │
│ ├─ Check activity timestamp          │
│ ├─ Update presence if changed        │
│ └─ Send heartbeat to server          │
└──────────────────────────────────────┘
```

## 7. Permission Helpers (for developers)

```typescript
const {
  can, // Check specific action
  isOwner, // Owner or super admin
  isAdmin, // Admin or above
  isDispatch, // Dispatch or above
  isEmployee, // Employee or above
  isDriver, // Driver only
  canManageUsers, // Admin+
  canManageTrips, // Dispatch+
  canViewEmployees, // Admin+
} = usePermissions();
```

## 8. Data Flow

### Presence Update Flow:

```
User Activity
    ↓
usePresence Hook
    ↓
update_user_presence(user_id, org_id, status)
    ↓
organization_memberships table updated
    ↓
Supabase Realtime broadcasts change
    ↓
useOrganizationMembers receives update
    ↓
UI reflects new status (all connected clients)
```

### Invite Acceptance Flow:

```
User Logs In
    ↓
PendingInviteBanner checks org_invites
    ↓
Shows unaccepted invites
    ↓
User clicks "Accept"
    ↓
Creates organization_memberships record
    ↓
Marks org_invites.accepted_at
    ↓
Updates user_profiles.default_org_id
    ↓
Auth context refreshes
    ↓
User redirected to dashboard with new role
```

## 9. Color Palette

### Presence Colors:

- **Online**: Emerald (#10b981)
- **Away**: Amber (#f59e0b)
- **Offline**: Slate (#94a3b8)

### Invite Banner:

- **Background**: Gradient from indigo-50 to purple-50
- **Icon**: Gradient from indigo-500 to purple-600
- **Button**: Gradient from indigo-600 to purple-600

## 10. Quick Testing Checklist

- [ ] Create employee with Dispatch role
- [ ] Verify they can access drivers/patients pages
- [ ] Verify they CANNOT access employees page
- [ ] Open employees page in two browsers
- [ ] Move mouse in one → see presence update in other
- [ ] Wait 2 minutes → status changes to Away
- [ ] Close tab → status changes to Offline
- [ ] Create org invite → log in as that user
- [ ] Verify banner appears at top of dashboard
- [ ] Accept invite → verify redirect and access

---

_Implementation Guide - 2026-01-14_
