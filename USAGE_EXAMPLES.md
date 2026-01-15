# Usage Examples: RBAC & Presence System

## For Developers

### 1. Using the Presence Hook

```typescript
import { usePresence } from "@/hooks/usePresence";

function MyComponent() {
  // Simply call the hook - it handles everything automatically
  usePresence();

  // No need to do anything else!
  // User's presence is now being tracked

  return <YourContent />;
}
```

### 2. Displaying Presence Indicators

```typescript
import { PresenceIndicator } from '@/components/ui/presence-indicator';

// Inline with label (recommended for lists)
<PresenceIndicator
  status="online"
  size="md"
  showLabel
/>

// Small dot only (for compact views)
<PresenceIndicator
  status="away"
  size="sm"
  showLabel={false}
/>

// Large with label (for emphasis)
<PresenceIndicator
  status="offline"
  size="lg"
  showLabel
/>
```

### 3. Fetching Organization Members with Presence

```typescript
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";

function EmployeesList() {
  const { members, isLoading, onlineCount, awayCount, offlineCount } =
    useOrganizationMembers();

  if (isLoading) return <Loader />;

  return (
    <div>
      <div>Online: {onlineCount}</div>
      {members.map((member) => (
        <div key={member.id}>
          <span>{member.full_name}</span>
          <PresenceIndicator
            status={member.presence_status}
            size="sm"
            showLabel
          />
        </div>
      ))}
    </div>
  );
}
```

### 4. Checking Permissions

```typescript
import { usePermissions } from "@/hooks/usePermissions";

function SomeFeature() {
  const { can, isDispatch, canManageTrips, canManageUsers } = usePermissions();

  // Check specific action
  if (!can("create_trips")) {
    return <AccessDenied />;
  }

  // Check role flags
  if (isDispatch) {
    return <DispatchDashboard />;
  }

  // Check helper permissions
  if (canManageUsers) {
    return <InviteButton />;
  }

  return <StandardView />;
}
```

### 5. Creating Invites with the Dispatch Role

```typescript
// In employee-form.tsx or any invite creation form
const onSubmit = async (data) => {
  // Create employee record
  const { data: employee } = await supabase
    .from("employees")
    .insert({ ...employeeData })
    .select()
    .single();

  // If system role is assigned, create invite
  if (data.system_role !== "none") {
    const { data: invite } = await supabase
      .from("org_invites")
      .insert({
        org_id: currentOrganization.id,
        email: data.email,
        role: data.system_role, // Can be 'dispatch'
        invited_by: user.id,
      })
      .select()
      .single();

    // Invite is ready to be accepted!
  }
};
```

## For End Users

### 1. Accepting an Organization Invite

**Scenario**: You've been invited to join an organization as a Dispatcher.

1. **Log in** to your account
2. You'll see a **banner at the top** of the dashboard:
   ```
   📧 You're invited to join Acme Transport
       Role: Dispatcher
                              [Accept Invite →]
   ```
3. Click **"Accept Invite"**
4. Banner disappears and you're **automatically redirected**
5. You now have **Dispatcher access** to the organization

### 2. Understanding Your Presence Status

Your status is **automatically** updated based on your activity:

- **🟢 Online (pulsing green)**: You're actively using the app
- **🟠 Away (amber)**: You haven't moved your mouse/keyboard for 2+ minutes
- **⚫ Offline (gray)**: You're logged out or closed the app

**Note**: You don't need to do anything - it's all automatic!

### 3. Viewing Team Presence (Admins)

**As an Admin or Owner**:

1. Go to **Employees** page
2. See real-time stats at the top:
   ```
   Total: 15 | 🟢 Online: 8 | 🟠 Away: 3 | ⚫ Offline: 4
   ```
3. Each employee card shows their **live presence** status
4. Status updates **automatically** when team members become active/inactive

### 4. Dispatcher Workflow

**What you can do as a Dispatcher**:

✅ **View Drivers**

- See all drivers in the organization
- Check their availability and location
- View their trip history

✅ **View Patients**

- Access patient database
- See patient details and medical info
- Check service eligibility

✅ **Manage Trips**

- Create new trip requests
- Assign trips to drivers
- Update trip status
- Monitor trip progress

❌ **What you cannot do**:

- Manage employees (view/edit/delete)
- Access billing settings
- Change organization settings
- Invite other users

### 5. Common Scenarios

#### Scenario: "I don't see the Employees page"

**Reason**: You're a Dispatcher, Employee, or Driver. Only Admins and Owners can access Employees.

**Solution**: Contact your Admin if you need employee information.

---

#### Scenario: "My status shows Offline but I'm online"

**Reason**: You might have multiple tabs open, or experienced a network issue.

**Solution**:

1. Refresh the page
2. Move your mouse/type something
3. Status should update to Online within 30 seconds

---

#### Scenario: "I accepted an invite but don't see any data"

**Reason**: Your organization might not have data yet, or your role has limited access.

**Solution**:

1. Check what role you were assigned (visible in account settings)
2. Contact your administrator to verify your permissions
3. If you're a Driver, you'll only see trips assigned to you

---

#### Scenario: "I want to invite someone as a Dispatcher"

**Steps** (Admin/Owner only):

1. Go to **Employees** page
2. Click **"Add Employee"**
3. Fill in employee details
4. In **Step 3: System Access**:
   - Select **"Dispatcher"** from dropdown
5. Save the form
6. Copy the invite link shown in the success message
7. Send the link to the new dispatcher

---

## Advanced Usage

### 1. Manually Updating Presence (Developers)

```typescript
import { usePresence } from "@/hooks/usePresence";

function MyComponent() {
  const { setOnline, setAway, setOffline } = usePresence();

  // Usually not needed, but available if you need manual control
  const handleManualAway = () => {
    setAway();
  };

  return <button onClick={handleManualAway}>Set as Away</button>;
}
```

### 2. Filtering Members by Presence

```typescript
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";

function OnlineEmployees() {
  const { members } = useOrganizationMembers();

  const onlineMembers = useMemo(
    () => members.filter((m) => m.presence_status === "online"),
    [members]
  );

  return (
    <div>
      <h3>Currently Online ({onlineMembers.length})</h3>
      {onlineMembers.map((member) => (
        <div key={member.id}>{member.full_name}</div>
      ))}
    </div>
  );
}
```

### 3. Permission-based Rendering

```typescript
import { usePermissions } from "@/hooks/usePermissions";

function ConditionalFeatures() {
  const { can, isDispatch, canManageTrips } = usePermissions();

  return (
    <div>
      {/* Show only to users who can create trips */}
      {can("create_trips") && <CreateTripButton />}

      {/* Show only to dispatchers and above */}
      {isDispatch && <DispatcherDashboard />}

      {/* Show only to users who can manage trips */}
      {canManageTrips && <TripManagementPanel />}
    </div>
  );
}
```

### 4. Custom Presence Display

```typescript
function CustomPresenceCard({ member }: { member: OrganizationMember }) {
  const getPresenceText = (status: string) => {
    switch (status) {
      case "online":
        return "Available now";
      case "away":
        return "Be back soon";
      case "offline":
        return member.last_active_at
          ? `Last seen ${formatDistanceToNow(new Date(member.last_active_at))}`
          : "Not available";
    }
  };

  return (
    <div>
      <h3>{member.full_name}</h3>
      <PresenceIndicator status={member.presence_status} size="sm" />
      <p>{getPresenceText(member.presence_status)}</p>
    </div>
  );
}
```

## Troubleshooting

### Issue: Presence not updating in real-time

**Check**:

1. Is Supabase Realtime enabled for `organization_memberships`?
2. Are there any console errors?
3. Try refreshing the page

**Fix**:

```sql
-- Run this SQL in Supabase if realtime isn't working
ALTER PUBLICATION supabase_realtime ADD TABLE organization_memberships;
```

### Issue: User stuck in "Away" status

**Cause**: Activity detection might not be working

**Fix**:

1. Refresh the page
2. Check browser console for errors
3. Ensure user has granted necessary permissions

### Issue: Dispatch role not showing in dropdown

**Check**: Verify the migration ran successfully:

```sql
SELECT enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'membership_role';
```

Should return: owner, admin, dispatch, employee, driver, patient

---

## Best Practices

1. **Always check permissions** before rendering sensitive components
2. **Use presence indicators** instead of static status badges
3. **Leverage helper functions** (`canManageTrips`, etc.) for cleaner code
4. **Test with multiple roles** to ensure proper access control
5. **Monitor presence accuracy** in production to ensure system health

---

_Usage Guide - 2026-01-14_
