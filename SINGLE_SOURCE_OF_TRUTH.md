# Single Source of Truth - RBAC Role Implementation

## Problem Statement

Previously, the system had **two conflicting sources** for employee roles:

1. `employees.role` - Free-text field (could be anything like "Operations Manager")
2. `organization_memberships.role` - RBAC role (owner, admin, dispatch, employee, driver)

This created confusion and potential for data inconsistency.

## Solution: Single Source of Truth

### ✅ RBAC Role = The Only Truth

**`organization_memberships.role`** is now the **single source of truth** for all system roles.

```
┌─────────────────────────────────────────────┐
│  Single Source of Truth: RBAC Roles         │
├─────────────────────────────────────────────┤
│  Table: organization_memberships            │
│  Column: role                               │
│  Values: owner | admin | dispatch | employee│
└─────────────────────────────────────────────┘
```

## Changes Made

### 1. Employee Form Simplified ✅

**Removed Fields:**

- ❌ "Role / Position" field - No longer needed
- ❌ "Driver" option from System Access - Drivers managed separately

**Kept Fields:**

- ✅ Department
- ✅ Hire Date
- ✅ System Access (owner, admin, dispatch, employee only)

**Why:**

- System Access already defines the RBAC role
- Inviting someone with a role creates the `organization_memberships` record
- No need for redundant role field

### 2. Employees Page Updated ✅

**Before:**

```tsx
// Showed employee.position (could be anything)
<span>{employee.position}</span>
```

**After:**

```tsx
// Shows actual RBAC role from organization_memberships
<RoleBadge employee={employee} memberPresenceMap={memberPresenceMap} />
```

**Display:**

- Fetches role from `organization_memberships` via email lookup
- Shows colored badge (Owner, Admin, Dispatch, Employee)
- "No Access" if employee hasn't accepted invite yet

### 3. Employee Details Page Updated ✅

**Before:**

```tsx
// Showed employee.role field
<p>{employee.role || "Not specified"}</p>
```

**After:**

```tsx
// Fetches and shows RBAC role from organization_memberships
<RoleBadge rbacRole={memberRole} />
```

**Changes:**

- Added query to fetch `organization_memberships.role` by email
- Label changed from "Role / Position" to "System Role"
- Displays actual system access level

## Role Colors

```
🟣 Owner      → Purple (bg-purple-100 text-purple-700)
🔵 Admin      → Blue (bg-blue-100 text-blue-700)
🟡 Dispatch   → Indigo (bg-indigo-100 text-indigo-700)
🟢 Employee   → Emerald (bg-emerald-100 text-emerald-700)
⚪ No Access  → Gray (bg-slate-100 text-slate-600)
```

## Data Flow

### Adding an Employee with System Access

```
1. Fill Employee Form
   ├─ Name, Email, Phone
   ├─ Department, Hire Date
   └─ System Access: "Admin"

2. On Submit
   ├─ Create `employees` record (no role field used)
   └─ Create `org_invites` with role="admin"

3. Employee Accepts Invite
   └─ Create `organization_memberships` record
       └─ role = "admin" ← SINGLE SOURCE OF TRUTH

4. Display on Employees Page
   └─ Fetch member by email from organization_memberships
       └─ Show role badge: "Admin" (blue)
```

### Employee Without System Access

```
1. Fill Employee Form
   └─ System Access: "No System Access"

2. On Submit
   └─ Create `employees` record only
       └─ No org_invites created

3. Display on Employees Page
   └─ No matching organization_memberships found
       └─ Show: "No Access" (gray)
```

## Database Schema

### employees ✅

```sql
CREATE TABLE employees (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  full_name text NOT NULL,
  email text,
  phone text,
  department text,
  hire_date date,
  user_id uuid REFERENCES auth.users(id),
  -- role field deprecated/unused
  created_at timestamptz DEFAULT now()
);
```

### organization_memberships ✅ (Source of Truth)

```sql
CREATE TABLE organization_memberships (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES auth.users(id),
  email text NOT NULL,
  role membership_role NOT NULL, -- ← SINGLE SOURCE OF TRUTH
  is_primary boolean DEFAULT false,
  presence_status text DEFAULT 'offline',
  last_active_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- role enum
CREATE TYPE membership_role AS ENUM (
  'owner',
  'admin',
  'dispatch',
  'employee',
  'driver'
);
```

## Benefits

### 1. **No Confusion** ✅

- One place to check: `organization_memberships.role`
- No conflicting data between tables
- Clear what someone's actual permissions are

### 2. **Easier Maintenance** ✅

- Single field to update
- No sync issues between tables
- Simpler queries

### 3. **Better UX** ✅

- Consistent role display everywhere
- Clear visual hierarchy with colors
- Immediate understanding of access levels

### 4. **Separation of Concerns** ✅

- **Employees** = People working for organization (HR data)
- **Drivers** = Specific type of user (managed separately)
- **System Access** = What they can do in the system (RBAC)

## Migration Path

### For Existing Data

If you have existing employees with the old `role` field:

```sql
-- No migration needed!
-- The old role field is simply ignored
-- Display comes from organization_memberships only

-- Employees without organization_memberships will show "No Access"
-- Which is correct - they don't have system access yet
```

## Testing Scenarios

### Test 1: Add Employee with System Access

1. Create employee with role="Admin"
2. ✅ Invite created
3. ✅ Accept invite
4. ✅ Employees page shows "Admin" badge (blue)
5. ✅ Details page shows "System Role: Admin"

### Test 2: Add Employee without System Access

1. Create employee with role="No System Access"
2. ✅ No invite created
3. ✅ Employees page shows "No Access" badge (gray)
4. ✅ Details page shows "System Role: No Access"

### Test 3: Driver Management

1. Try to create employee as "Driver"
2. ✅ Option not available
3. ✅ Must use Drivers page instead

### Test 4: View Existing Employee

1. Open employee details
2. ✅ Shows actual RBAC role from organization_memberships
3. ✅ Not the old deprecated role field

## Future Improvements

### Optional: Remove `role` field from `employees` table

```sql
ALTER TABLE employees DROP COLUMN role;
```

This is optional since the field is now simply ignored. Keeping it doesn't hurt, but removing it enforces the single source of truth at the schema level.

---

**Result:** Clean, consistent, single source of truth for all role data! 🎯
