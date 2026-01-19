# Dispatcher Role Permissions Update

## Summary

This document outlines the permissions for the **Dispatch** role in the system. Dispatchers are focused on trip operations and have view-only access to supporting data.

## Permission Matrix

| Feature            | Owner   | Admin   | Dispatch     | Employee | Driver           |
| ------------------ | ------- | ------- | ------------ | -------- | ---------------- |
| **Dashboard**      | ✅ Full | ✅ Full | ✅ Full      | ✅ Full  | ❌ No            |
| **Trips**          | ✅ Full | ✅ Full | ✅ Full      | ❌ View  | ✅ Assigned Only |
| **Patients**       | ✅ Full | ✅ Full | 👁️ View Only | 👁️ View  | ❌ No            |
| **Drivers**        | ✅ Full | ✅ Full | 👁️ View Only | 👁️ View  | ❌ No            |
| **Employees**      | ✅ Full | ✅ Full | ❌ Hidden    | 👁️ View  | ❌ No            |
| **Upload**         | ✅ Full | ✅ Full | ❌ Hidden    | ✅ Yes   | ❌ No            |
| **Billing**        | ✅ Full | ✅ Full | ❌ Hidden    | ❌ No    | ❌ No            |
| **Medicaid**       | ✅ Full | ✅ Full | ❌ Hidden    | ❌ No    | ❌ No            |
| **Notifications**  | ✅ Full | ✅ Full | ❌ Hidden    | ❌ No    | ❌ No            |
| **Client Credits** | ✅ Full | ✅ Full | ❌ Hidden    | ❌ No    | ❌ No            |

## Detailed Permissions

### 1. Dashboard ✅

- **Access**: Full access to dashboard with all statistics
- **Same as Admin**: Dispatchers see the same dashboard data as admins
- **Why**: Dispatchers need operational overview to manage trips effectively

### 2. Trips ✅ Full Access

Dispatchers have **complete trip management** capabilities:

- View all trips
- Create new trips
- Edit existing trips
- Assign drivers to trips
- Update trip status
- Delete trips
- Complete trips

**Why**: Trips are the core function of a dispatcher.

### 3. Patients 👁️ View Only

- **Can**: View patient list, view patient details
- **Cannot**: Add new patients, edit patients, delete patients
- **UI**: "Add Client" button hidden, edit/delete actions hidden

**Why**: Dispatchers need to see patient info for trip coordination but shouldn't modify patient records.

### 4. Drivers 👁️ View Only

- **Can**: View driver list, view driver details, see availability
- **Cannot**: Add new drivers, edit drivers, delete drivers
- **UI**: "Add Driver" button hidden, edit/delete actions hidden

**Why**: Dispatchers need to see driver info for trip assignment but shouldn't manage driver records.

### 5. Employees ❌ Hidden

- **Access**: No access at all
- **Sidebar**: Employees link not visible
- **Route**: Auto-redirects to dashboard if accessed directly
- **Why**: Employee management is HR/Admin function, not dispatch-related

### 6. Upload ❌ Hidden

- **Access**: No access
- **Sidebar**: Upload link not visible
- **Route**: Auto-redirects to dashboard if accessed directly
- **Why**: Bulk data upload is an admin function

### 7. Billing ❌ Hidden

- **User Menu**: Billing option not shown
- **Route**: Not accessible
- **Why**: Financial operations are admin/owner only

### 8. Medicaid Billing ❌ Hidden

- **Sidebar**: Not visible
- **Route**: Not accessible
- **Why**: Medical billing is admin/owner only

### 9. Notifications ❌ Hidden

- **User Menu**: Notifications option not shown
- **Route**: Not accessible
- **Why**: System notifications are admin/owner only

### 10. Account Settings 📝 Limited

- **Name**: Cannot change own name (displays "Contact an administrator")
- **Phone**: Can update own phone number
- **Email**: Cannot change (system identity, same for everyone)
- **Password**: Section removed for all users

## Code Changes

### `src/hooks/usePermissions.ts`

```typescript
// New granular permission flags
const canEditPatients = isAdmin; // Dispatch can only view
const canEditDrivers = isAdmin; // Dispatch can only view
const canEditOwnName = isAdmin; // Dispatch cannot change name
const canUploadFiles = isAdmin; // No upload access
const canViewBilling = isAdmin; // No billing access
const canViewMedicaid = isAdmin; // No medicaid access
const canViewNotifications = isAdmin; // No notifications access
const canViewEmployees = isAdmin; // Employees page hidden
```

### `src/App.tsx`

```typescript
// Dispatch role restrictions
dispatch: [
  "founder",
  "employees",      // Hidden
  "upload",         // Hidden
  "review_import",  // Hidden
  "billing",        // Hidden
  "notifications",  // Hidden
  "medicaid-billing", // Hidden
],
```

### `src/components/app-sidebar.tsx`

```typescript
// Filter nav items based on permissions
navItems = navItems.filter((item) => {
  if (item.url === "employees" && !canViewEmployees) return false;
  if (item.url === "upload" && !canUploadFiles) return false;
  return true;
});
```

### `src/components/nav-user.tsx`

```typescript
// Hide billing and notifications for dispatchers
{canViewBilling && (
  <DropdownMenuItem onClick={() => setPage("billing")}>
    Billing
  </DropdownMenuItem>
)}
{canViewNotifications && (
  <DropdownMenuItem onClick={() => setPage("notifications")}>
    Notifications
  </DropdownMenuItem>
)}
```

### `src/components/patients-page.tsx`

```typescript
const { canEditPatients } = usePermissions();
const canManagePatients = canEditPatients;

// "Add Client" button only shows if canManagePatients
{canManagePatients && <Button>Add Client</Button>}
```

### `src/components/drivers-page.tsx`

```typescript
const { canEditDrivers } = usePermissions();
const canManageDrivers = canEditDrivers;

// "Add Driver" button only shows if canManageDrivers
{canManageDrivers && <Button>Add Driver</Button>}
```

### `src/components/trips/TripDetails.tsx`

```typescript
const { canManageTrips } = usePermissions();
const canManage = canManageTrips;

// Edit, Delete, Cancel, and status change buttons visible for dispatchers
{canManage && (
  <>
    <Button onClick={() => onEdit(tripId)}>Edit</Button>
    <Button onClick={() => setIsDeleteDialogOpen(true)}>Delete</Button>
  </>
)}
```

### `src/components/account-page.tsx`

```typescript
const { canEditOwnName } = usePermissions();

// Name field disabled for dispatchers
<Input disabled={!canEditOwnName} />

// Password section removed entirely for all users
```

## Testing Checklist

### As Dispatcher:

1. **Dashboard** ✅
   - [ ] Can see dashboard with all statistics
   - [ ] All cards and charts load correctly

2. **Trips** ✅
   - [ ] Can view all trips
   - [ ] "Add Trip" button visible
   - [ ] Can create new trip
   - [ ] Can edit trip
   - [ ] Can assign driver
   - [ ] Can delete trip

3. **Patients** 👁️
   - [ ] Can view patient list
   - [ ] "Add Client" button NOT visible
   - [ ] Can click to view patient details
   - [ ] Edit/Delete actions NOT visible in dropdown

4. **Drivers** 👁️
   - [ ] Can view driver list
   - [ ] "Add Driver" button NOT visible
   - [ ] Can click to view driver details
   - [ ] Edit/Delete actions NOT visible in dropdown

5. **Sidebar** ❌
   - [ ] "Employees" link NOT visible
   - [ ] "Upload" link NOT visible
   - [ ] "Medicaid Billing" link NOT visible
   - [ ] "Client Credits" link NOT visible

6. **User Menu** ❌
   - [ ] "Billing" option NOT visible
   - [ ] "Notifications" option NOT visible
   - [ ] "Account" option IS visible

7. **Account Settings** 📝
   - [ ] Name field is disabled
   - [ ] Helper text says "Contact an administrator"
   - [ ] Phone field is editable
   - [ ] Password section NOT visible

8. **Direct URL Access** ❌
   - [ ] /employees redirects to dashboard
   - [ ] /upload redirects to dashboard
   - [ ] /billing redirects to dashboard
   - [ ] /notifications redirects to dashboard
   - [ ] /medicaid-billing redirects to dashboard

## Benefits

1. **Focused Role**: Dispatchers can focus on trip operations
2. **Data Integrity**: Patient/driver records protected from accidental changes
3. **Clean UI**: Only relevant options shown, reducing cognitive load
4. **Security**: Sensitive features (billing, medicaid) properly restricted
5. **Maintainability**: Granular permission flags make future changes easy

---

**Implementation Date**: January 2026
**Last Updated**: January 19, 2026
