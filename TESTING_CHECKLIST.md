# Testing Checklist: RBAC & Presence Implementation

## ✅ Pre-Deployment Checklist

### Database Migration

- [ ] Migration `add_user_presence_and_dispatch_role` ran successfully
- [ ] `dispatch` role added to `membership_role` enum
- [ ] `presence_status` and `last_active_at` columns exist on `organization_memberships`
- [ ] Functions `update_user_presence` and `auto_mark_users_away` created
- [ ] Realtime enabled for `organization_memberships` table

### Build & Deployment

- [ ] `npm run build` completes without errors
- [ ] No TypeScript compilation errors
- [ ] All lint warnings addressed or documented
- [ ] Environment variables configured (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

---

## 🧪 Functional Testing

### 1. Dispatch Role Creation & Permissions

#### Test 1.1: Create Dispatcher via Employee Form

- [ ] As Admin/Owner, navigate to Employees page
- [ ] Click "Add Employee"
- [ ] Fill in employee details
- [ ] In Step 3, select "Dispatcher" role
- [ ] Save successfully
- [ ] Verify invite created in `org_invites` table
- [ ] Copy invite URL shown in success message

#### Test 1.2: Dispatcher Permissions

- [ ] Accept invite as the new dispatcher
- [ ] Navigate to **Drivers** page → Should work ✅
- [ ] Navigate to **Patients** page → Should work ✅
- [ ] Navigate to **Trips** page → Should work ✅
- [ ] Try to navigate to **Employees** page → Should be blocked ❌
- [ ] Try to navigate to **Billing** page → Should be blocked ❌
- [ ] Verify sidebar doesn't show restricted pages

#### Test 1.3: Trip Management

- [ ] As Dispatcher, click "Create Trip" button
- [ ] Fill in trip details successfully → Should work ✅
- [ ] Assign trip to a driver → Should work ✅
- [ ] Try to delete employee → Should be blocked ❌

### 2. Real-time Presence Tracking

#### Test 2.1: Online Status

- [ ] Log in as any user
- [ ] Open Employees page (if you have access)
- [ ] Verify your own card shows "🟢 Online" with pulsing dot
- [ ] Open same account in another browser tab
- [ ] Verify both show "Online" status

#### Test 2.2: Activity Detection

- [ ] Move mouse on page → Remains "Online" ✅
- [ ] Type in search box → Remains "Online" ✅
- [ ] Scroll the page → Remains "Online" ✅
- [ ] Leave page idle for 2+ minutes → Changes to "🟠 Away" ✅
- [ ] Move mouse again → Returns to "🟢 Online" ✅

#### Test 2.3: Away Status

- [ ] Leave browser idle for 2 minutes
- [ ] Verify status changes to "Away"
- [ ] In another browser, verify the status reflects "Away"
- [ ] Return to first browser, move mouse
- [ ] Verify status returns to "Online" in both browsers

#### Test 2.4: Offline Status

- [ ] Close browser tab/window completely
- [ ] In another browser, refresh Employees page
- [ ] Verify user shows "⚫ Offline" status
- [ ] Log back in
- [ ] Verify status returns to "🟢 Online"

#### Test 2.5: Real-time Sync

- [ ] Open Employees page in Browser A (as Admin)
- [ ] Open same page in Browser B (as Admin)
- [ ] In Browser A, move mouse (become active)
- [ ] Verify Browser B reflects change within ~30 seconds
- [ ] Leave Browser A idle for 2+ minutes
- [ ] Verify Browser B shows "Away" status

### 3. Pending Invite Banner

#### Test 3.1: Banner Display

- [ ] Create invite for new user email
- [ ] Log in with that email (sign up if needed)
- [ ] Verify banner appears at top of dashboard
- [ ] Banner should show:
  - [ ] Organization name ✅
  - [ ] Role being offered ✅
  - [ ] "Accept Invite" button ✅
  - [ ] Dismiss (X) button ✅

#### Test 3.2: Accept Invite

- [ ] Click "Accept Invite" button
- [ ] Verify button shows loading state
- [ ] Wait for acceptance to complete
- [ ] Verify banner disappears
- [ ] Verify you now have access to organization
- [ ] Check `organization_memberships` table for new record
- [ ] Check `org_invites` table - `accepted_at` should be set

#### Test 3.3: Multiple Invites

- [ ] Create 2 invites for same email (different orgs)
- [ ] Log in as that user
- [ ] Verify both invites show in separate banners
- [ ] Accept first invite
- [ ] Verify first banner disappears
- [ ] Verify second banner remains
- [ ] Accept second invite
- [ ] Verify all banners gone

#### Test 3.4: Dismiss Invite

- [ ] Have a pending invite
- [ ] Click X button on banner
- [ ] Verify banner disappears
- [ ] Refresh page
- [ ] Verify banner reappears (dismiss is session-only)

### 4. RBAC Hierarchy

#### Test 4.1: Owner Privileges

- [ ] Owner can access all pages ✅
- [ ] Owner can invite users ✅
- [ ] Owner can delete employees ✅
- [ ] Owner can change organization settings ✅
- [ ] Owner can access billing ✅

#### Test 4.2: Admin Privileges

- [ ] Admin can access all pages except Founder ✅
- [ ] Admin can invite users ✅
- [ ] Admin can manage employees ✅
- [ ] Admin can access billing ✅
- [ ] Admin CANNOT delete owner ❌
- [ ] Admin CANNOT change org name ❌
- [ ] Admin CANNOT access founder page ❌

#### Test 4.3: Dispatch Privileges

- [ ] Dispatch can view Dashboard ✅
- [ ] Dispatch can view Drivers ✅
- [ ] Dispatch can view Patients ✅
- [ ] Dispatch can view Trips ✅
- [ ] Dispatch can create trips ✅
- [ ] Dispatch can assign trips ✅
- [ ] Dispatch CANNOT view Employees ❌
- [ ] Dispatch CANNOT access Billing ❌
- [ ] Dispatch CANNOT manage users ❌

#### Test 4.4: Employee Privileges

- [ ] Employee can view Dashboard ✅
- [ ] Employee can view Patients ✅
- [ ] Employee can view Drivers ✅
- [ ] Employee can view Employees ✅
- [ ] Employee can upload files ✅
- [ ] Employee CANNOT create trips ❌
- [ ] Employee CANNOT manage users ❌

#### Test 4.5: Driver Privileges

- [ ] Driver can view Trips page ✅
- [ ] Driver can see only assigned trips ✅
- [ ] Driver can update trip status ✅
- [ ] Driver CANNOT view Drivers page ❌
- [ ] Driver CANNOT view Patients page ❌
- [ ] Driver CANNOT create trips ❌

### 5. Employee Page Stats

#### Test 5.1: Presence Stats Display

- [ ] Navigate to Employees page
- [ ] Verify stats section shows:
  - [ ] Total Employees count
  - [ ] 🟢 Online Now count
  - [ ] 🟠 Away count
  - [ ] ⚫ Offline count
  - [ ] Departments count
- [ ] Verify counts are accurate

#### Test 5.2: Real-time Stats Updates

- [ ] Have multiple users with different presence states
- [ ] Verify stats reflect actual counts
- [ ] Have user go from Online → Away
- [ ] Verify stats update (Online -1, Away +1)
- [ ] Have user go Offline
- [ ] Verify stats update (Away -1, Offline +1)

---

## 🔍 Edge Cases & Error Handling

### Edge Case 1: Network Disconnection

- [ ] Be logged in with Online status
- [ ] Disconnect network
- [ ] Reconnect after 1 minute
- [ ] Verify presence recovers correctly
- [ ] Check for console errors

### Edge Case 2: Multiple Tabs

- [ ] Open app in 3 tabs simultaneously
- [ ] Close 2 tabs
- [ ] Verify presence doesn't go Offline
- [ ] Close last tab
- [ ] Verify presence goes Offline

### Edge Case 3: Rapid Role Changes

- [ ] Create employee
- [ ] Assign Dispatch role (creates invite)
- [ ] Before acceptance, change to Employee role
- [ ] Accept original invite
- [ ] Verify correct role is applied

### Edge Case 4: Expired Invites

- [ ] Create invite
- [ ] Manually set `expires_at` to past date in DB
- [ ] Try to accept invite
- [ ] Verify error is shown
- [ ] Verify invite doesn't appear in banner

### Edge Case 5: Duplicate Organization Member

- [ ] Accept invite for an organization
- [ ] Try to accept same invite again
- [ ] Verify graceful error handling
- [ ] Verify no duplicate memberships created

---

## 📊 Performance Testing

### Performance 1: Presence Update Frequency

- [ ] Monitor network tab
- [ ] Verify heartbeat sends every ~30 seconds
- [ ] Verify activity events are throttled (max 1 every 5 sec)
- [ ] Check payload size is minimal

### Performance 2: Large Member Lists

- [ ] Create organization with 50+ members
- [ ] Navigate to Employees page
- [ ] Verify page loads in reasonable time (<2 seconds)
- [ ] Verify real-time updates don't cause lag
- [ ] Check memory usage remains stable

### Performance 3: Real-time Subscriptions

- [ ] Open 5 tabs with Employees page
- [ ] Update presence in one tab
- [ ] Verify all tabs receive update
- [ ] Check for duplicate notifications
- [ ] Close tabs one by one
- [ ] Verify subscriptions are cleaned up

---

## 🔐 Security Testing

### Security 1: Role-based API Access

- [ ] As Dispatch, try to POST to `/employees` endpoint → Should fail ❌
- [ ] As Employee, try to POST to `/trips` endpoint → Should fail ❌
- [ ] As Driver, try to GET `/employees` endpoint → Should fail ❌
- [ ] Verify all protected endpoints check permissions

### Security 2: Presence Manipulation

- [ ] Try to manually call `update_user_presence` for another user → Should fail ❌
- [ ] Verify RLS policies prevent unauthorized access
- [ ] Check function permissions are correct

### Security 3: Invite Tampering

- [ ] Create invite token
- [ ] Try to change email in acceptance request → Should fail ❌
- [ ] Try to change role in acceptance request → Should fail ❌
- [ ] Verify tokens are validated correctly

---

## 📱 Cross-browser & Mobile Testing

### Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Features to Test on Each:

- [ ] Presence indicator animations
- [ ] Invite banner display
- [ ] Activity detection works
- [ ] Real-time updates work
- [ ] Page navigation works
- [ ] Role restrictions enforced

---

## 📝 Documentation Review

- [ ] IMPLEMENTATION_SUMMARY.md is accurate
- [ ] VISUAL_GUIDE.md reflects actual UI
- [ ] USAGE_EXAMPLES.md code samples work
- [ ] All new components have JSDoc comments
- [ ] README updated with new features (if applicable)

---

## 🚀 Pre-Production Checklist

- [ ] All critical tests passed
- [ ] No console errors in production build
- [ ] Supabase RLS policies configured
- [ ] Realtime enabled and working
- [ ] Migration applied to production DB
- [ ] Backup created before deployment
- [ ] Rollback plan documented
- [ ] Team briefed on new features
- [ ] Support documentation prepared

---

## 📋 Post-Deployment Verification

### Immediate (within 1 hour):

- [ ] Verify app loads without errors
- [ ] Test login flow
- [ ] Check presence tracking works
- [ ] Verify invite system functional

### Short-term (within 24 hours):

- [ ] Monitor error logs
- [ ] Check database query performance
- [ ] Verify real-time subscriptions stable
- [ ] Collect initial user feedback

### Long-term (within 1 week):

- [ ] Analyze presence accuracy
- [ ] Review permission issues (if any)
- [ ] Monitor database growth
- [ ] Gather comprehensive user feedback

---

## 🐛 Known Issues & Workarounds

### Issue 1: Safari sendBeacon Limitations

**Symptom**: Presence might not update to Offline on tab close in older Safari versions  
**Workaround**: Use modern Safari (15+) or alternative browsers

### Issue 2: Presence Lag with Slow Networks

**Symptom**: Presence updates delayed by 30-60 seconds on slow connections  
**Expected**: This is normal due to heartbeat interval  
**No action needed**

---

**Testing completed by**: ******\_\_\_******  
**Date**: ******\_\_\_******  
**Sign-off**: ******\_\_\_******

---

_Testing Guide - 2026-01-14_
