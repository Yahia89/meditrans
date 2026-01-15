# Presence Tracking - Updated Implementation

## Issues Fixed

### 1. ✅ Accurate Presence Counts

**Problem**: Stats showed counts from ALL organization members, not just employees on the page  
**Solution**: Recalculated counts based on actual employees being displayed

```typescript
// NOW: Calculate from employees list
const { onlineCount, awayCount, offlineCount } = useMemo(() => {
  let online = 0,
    away = 0,
    offline = 0;

  employees.forEach((employee) => {
    const member = memberPresenceMap.get(employee.email?.toLowerCase() || "");
    const status = member?.presence_status || "offline";

    if (status === "online") online++;
    else if (status === "away") away++;
    else offline++;
  });

  return { onlineCount: online, awayCount: away, offlineCount: offline };
}, [employees, memberPresenceMap]);
```

### 2. ✅ No Double Counting

**Problem**: User worried about being counted twice if logged in from multiple devices  
**Solution**: Already handled - `organization_memberships` stores presence per USER, not per device. One user = one status, regardless of devices.

**How it works**:

- User logs in on computer → `presence_status = "online"`
- User also logs in on phone → SAME user, SAME status field
- Both devices update the SAME `presence_status` field
- Count remains 1 ✅

### 3. ✅ Current User Sees Their Own Status

**Problem**: Viewer should see their own real-time status  
**Solution**: Already working - the employee list fetches ALL employees including the current user. Their presence is shown just like everyone else's.

### 4. ✅ Status Filter

**New Feature**: Filter employees by presence status

```typescript
// Status filter state
const [statusFilter, setStatusFilter] = useState<
  "all" | "online" | "away" | "offline"
>("all");

// Filter logic
const filteredEmployees = employees.filter((employee) => {
  // ... search filters ...

  // Presence status filter
  if (statusFilter !== "all") {
    const member = memberPresenceMap.get(employee.email?.toLowerCase() || "");
    const presenceStatus = member?.presence_status || "offline";
    if (presenceStatus !== statusFilter) {
      return false;
    }
  }

  return searchMatch;
});
```

## New UI Features

### Status Filter Dropdown

```
┌─────────────────────┐
│ All Status       ▼  │
├─────────────────────┤
│ All Status          │ ← Show everyone
│ 🟢 Online Only      │ ← Show only online users
│ 🟠 Away Only        │ ← Show only away users
│ ⚫ Offline Only     │ ← Show only offline users
└─────────────────────┘
```

### Results Indicator

Shows current filter results:

```
Showing 8 of 15 employees (filtered by status)
└─ When status filter is active

Showing 15 of 15 employees
└─ When no filter is active

3 employees selected
└─ When multi-select is active
```

## Database Schema

### employees table (updated)

```sql
CREATE TABLE employees (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  full_name text NOT NULL,
  email text,
  phone text,
  role text,
  department text,
  hire_date date,
  status text DEFAULT 'active',
  user_id uuid REFERENCES auth.users(id), -- 🆕 Links to system user
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### organization_memberships table

```sql
CREATE TABLE organization_memberships (
  id uuid PRIMARY KEY,
  org_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES auth.users(id),
  role membership_role NOT NULL,
  is_primary boolean DEFAULT false,
  presence_status text DEFAULT 'offline', -- 🆕 online/away/offline
  last_active_at timestamptz,            -- 🆕 Last activity timestamp
  created_at timestamptz DEFAULT now()
);
```

## How It All Works Together

### 1. Employee Record Creation

```
Admin creates employee record
  ↓
Employee form saves to `employees` table (user_id = null initially)
  ↓
If system role assigned → create `org_invites` record
```

### 2. Invite Acceptance

```
User receives invite email
  ↓
Clicks accept link
  ↓
Creates `organization_memberships` record (with user_id)
  ↓
Links employee record: UPDATE employees SET user_id = user.id
  ↓
Now employee is linked to system user ✅
```

### 3. Real-time Presence

```
User logs in
  ↓
usePresence() hook activates
  ↓
Sets presence_status = 'online' in organization_memberships
  ↓
Monitors activity (mouse, keyboard, etc.)
  ↓
If inactive 2+ min → presence_status = 'away'
  ↓
On logout → presence_status = 'offline'
```

### 4. Display on Employees Page

```
Fetch employees table
  ↓
Fetch organization_memberships with presence data
  ↓
Match by email or user_id
  ↓
Create memberPresenceMap for quick lookup
  ↓
For each employee card:
  - Look up presence in memberPresenceMap
  - Display real-time indicator (🟢🟠⚫)
  - Calculate accurate counts
```

## Usage Examples

### For Admins

1. **View all employees**: Navigate to Employees page
2. **See who's online**: Check the stats banner (Online: 8, Away: 2, Offline: 5)
3. **Filter by status**: Use the "All Status" dropdown
4. **Find online employees**: Select "🟢 Online Only"

### For Developers

```typescript
// Get an employee's presence status
const employee = employees[0];
const member = memberPresenceMap.get(employee.email?.toLowerCase() || "");
const presenceStatus = member?.presence_status || "offline";

// Display presence indicator
<PresenceIndicator status={presenceStatus} size="md" showLabel />;
```

## Performance Considerations

### Efficient Lookups

- **memberPresenceMap** uses email as key for O(1) lookups
- **useMemo** prevents unnecessary recalculations
- **Real-time subscriptions** only update changed records

### Scalability

- Works efficiently with 100+ employees
- Counts calculated once per render
- Filter applied client-side for instant results

## Testing Scenarios

### Test 1: Accurate Counts

1. Have 10 employees total
2. 3 users online, 2 away, 5 offline
3. Verify stats show: Online: 3, Away: 2, Offline: 5 ✅

### Test 2: No Double Counting

1. Log in as User A on computer (shows online)
2. Log in as User A on phone (still shows online)
3. Verify count stays at 1, not 2 ✅

### Test 3: Status Filter

1. Select "🟢 Online Only"
2. Verify only online employees shown
3. Verify count shows "Showing X of Y employees (filtered by status)" ✅

### Test 4: Real-time Updates

1. Open Employees page in Browser A
2. Log in as employee in Browser B
3. Verify Browser A shows employee going Online within 30 seconds ✅

## Migration Applied

```sql
-- Migration: add_user_id_to_employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_user ON employees(org_id, user_id);
```

---

_Updated: 2026-01-14_
