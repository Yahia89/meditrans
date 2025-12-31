# Future Transportation CRM - Enhancement Specification

## ✅ Implementation Status: COMPLETE

This document outlines the data model enhancements for Drivers, Patients, Trip Types, and Vehicle Types. A key feature is the **automatic driver matching** system that pairs drivers with patients based on vehicle type compatibility.

---

## 1. DRIVERS (Enhanced Profile)

### Personal Information

| Field        | Type | Required | Description                |
| ------------ | ---- | -------- | -------------------------- |
| Full Name    | text | ✓        | Driver's full legal name   |
| ID Number    | text | ✓        | Driver's ID/License number |
| Email        | text | ✓        | Contact email              |
| Phone Number | text | ✓        | Contact phone              |
| Address      | text | ✓        | Full street address        |
| County       | text | ✓        | County of residence        |

### Vehicle Information

| Field            | Type | Required | Description                            |
| ---------------- | ---- | -------- | -------------------------------------- |
| **Vehicle Type** | enum | ✓        | Vehicle capability (see Vehicle Types) |
| Make             | text | ✓        | Vehicle manufacturer (e.g., Toyota)    |
| Model            | text | ✓        | Vehicle model (e.g., Sienna)           |
| Vehicle Color    | text | ✓        | Color of vehicle                       |
| License Plate #  | text | ✓        | Plate number                           |

### Compliance & Documentation

| Field                     | Type | Required | Description                        |
| ------------------------- | ---- | -------- | ---------------------------------- |
| DOT Medical #             | text | ✓        | DOT Medical card number            |
| DOT Medical Expiration    | date | ✓        | Expiration date of DOT medical     |
| Insurance Company Name    | text | ✓        | Name of insurance provider         |
| Insurance Policy #        | text | ✓        | Policy number                      |
| Insurance Start Date      | date | ✓        | Policy start date                  |
| Insurance Expiration Date | date | ✓        | Policy expiration date             |
| Inspection Date           | date | ✓        | Last vehicle inspection date       |
| Driver Record Issue Date  | date | ✓        | Certified driver record issue date |
| Driver Record Expiration  | date | ✓        | Certified driver record expiration |

---

## 2. VEHICLE TYPES (Driver Capability)

These types are assigned to **drivers** based on the vehicle they operate. When assigning trips, drivers are matched to patients based on vehicle capability.

| Vehicle Type        | Description                              | Can Serve                                          |
| ------------------- | ---------------------------------------- | -------------------------------------------------- |
| `common_carrier`    | Standard sedan/car                       | Ambulatory patients only                           |
| `folded_wheelchair` | Vehicle with folded wheelchair transport | Ambulatory, Folded Wheelchair patients             |
| `wheelchair`        | Full wheelchair-accessible vehicle       | Ambulatory, Folded Wheelchair, Wheelchair patients |
| `van`               | Large accessible van                     | All patient types                                  |

### Matching Logic

When assigning a trip, the system should:

1. Check the patient's **Vehicle Type Need**
2. Filter available drivers to those whose **Vehicle Type** can accommodate the patient
3. Prioritize the **best match** (e.g., a `wheelchair` driver is a better match for a wheelchair patient than a `van` driver, but both are valid)

**Priority Order** (highest match first):

- Exact match → Higher priority
- Capable but over-equipped → Lower priority

---

## 3. TRIP TYPES (Purpose of Trip)

Replace the current trip types with this expanded list:

| Trip Type              | Description                       |
| ---------------------- | --------------------------------- |
| `work`                 | Transportation to/from employment |
| `school`               | Transportation to/from education  |
| `pleasure`             | Personal/leisure trips            |
| `dentist`              | Dental appointments               |
| `hospital_appointment` | Hospital visits/appointments      |
| `clinic`               | Medical clinic visits             |
| `other`                | Other purposes (requires notes)   |

**Note**: This replaces the current types: `Ambulatory`, `Wheelchair`, `Stretcher`, `Bariatric`

---

## 4. PATIENTS (Enhanced Profile)

### Basic Information

| Field               | Type | Required | Description              |
| ------------------- | ---- | -------- | ------------------------ |
| Full Name           | text | ✓        | Patient's full name      |
| Date of Birth (DOB) | date | ✓        | Patient's date of birth  |
| Phone Number        | text | ✓        | Contact phone            |
| Address             | text | ✓        | Full address             |
| County              | text | ✓        | County of residence      |
| Email               | text |          | Contact email (optional) |

### Service & Referral Information

| Field                    | Type | Required | Description                    |
| ------------------------ | ---- | -------- | ------------------------------ |
| Waiver Type              | text |          | Type of waiver (if applicable) |
| Referral By              | text |          | Who referred this patient      |
| Referral Date            | date |          | Date of referral               |
| Referral Expiration Date | date |          | When referral expires          |
| Service Type             | text |          | Type of service required       |

### Case Management

| Field              | Type | Required | Description                 |
| ------------------ | ---- | -------- | --------------------------- |
| Case Manager       | text |          | Assigned case manager name  |
| Case Manager Phone | text |          | Case manager contact number |

### Billing & Credits

| Field           | Type   | Required | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| Monthly Credit  | number |          | Monthly trip credit allowance   |
| Credit Used For | text   |          | What the credit can be used for |

### Transportation Needs

| Field                 | Type | Required | Description                 |
| --------------------- | ---- | -------- | --------------------------- |
| **Vehicle Type Need** | enum | ✓        | Required vehicle capability |
| Notes                 | text |          | Special instructions/notes  |

**Vehicle Type Need Options**:

- `ambulatory` - Can walk, no special vehicle needed
- `folded_wheelchair` - Uses folding wheelchair
- `wheelchair` - Uses full wheelchair
- `stretcher` - Requires stretcher transport (future)

---

## 5. DATABASE MIGRATION PLAN

### New Tables

None - existing tables will be altered.

### Altered Tables

#### `drivers` table

Add columns:

- `id_number` (text)
- `vehicle_type` (enum: common_carrier, folded_wheelchair, wheelchair, van)
- `vehicle_make` (text)
- `vehicle_model` (text)
- `vehicle_color` (text)
- `license_plate` (text)
- `address` (text)
- `county` (text)
- `dot_medical_number` (text)
- `dot_medical_expiration` (date)
- `insurance_company` (text)
- `insurance_policy_number` (text)
- `insurance_start_date` (date)
- `insurance_expiration_date` (date)
- `inspection_date` (date)
- `driver_record_issue_date` (date)
- `driver_record_expiration` (date)

#### `patients` table

Add columns:

- `dob` (date)
- `county` (text)
- `waiver_type` (text)
- `referral_by` (text)
- `referral_date` (date)
- `referral_expiration_date` (date)
- `service_type` (text)
- `case_manager` (text)
- `case_manager_phone` (text)
- `monthly_credit` (numeric)
- `credit_used_for` (text)
- `vehicle_type_need` (enum: ambulatory, folded_wheelchair, wheelchair, stretcher)
- `notes` (text)

#### `trips` table

Modify `trip_type` constraint to allow:

- `work`, `school`, `pleasure`, `dentist`, `hospital_appointment`, `clinic`, `other`

---

## 6. UI COMPONENTS TO UPDATE

1. **Driver Form** (`CreateDriverForm` or equivalent)

   - Add all new fields with proper validation
   - Vehicle type dropdown with 4 options
   - Date pickers for expiration dates

2. **Patient Form** (`CreatePatientForm` or equivalent)

   - Add all new fields
   - Vehicle Type Need dropdown
   - DOB date picker

3. **Trip Form** (`CreateTripForm`)

   - Update Trip Type dropdown with new options
   - **Smart Driver Assignment**: When patient is selected, filter driver dropdown to show only compatible drivers based on vehicle type

4. **Driver List / Details**

   - Display vehicle type badge
   - Show compliance expiration warnings

5. **Patient List / Details**
   - Display vehicle type need badge

---

## 7. SMART MATCHING FEATURE

### Trip Assignment Flow

1. User selects Patient for trip
2. System reads patient's `vehicle_type_need`
3. Driver dropdown filters to show only drivers where:
   - `driver.vehicle_type` can accommodate `patient.vehicle_type_need`
4. Drivers are sorted by best match first
5. Visual indicator shows compatibility level

### Compatibility Matrix

| Patient Need      | Common Carrier | Folded Wheelchair | Wheelchair | Van    |
| ----------------- | -------------- | ----------------- | ---------- | ------ |
| Ambulatory        | ✓ Best         | ✓                 | ✓          | ✓      |
| Folded Wheelchair | ✗              | ✓ Best            | ✓          | ✓      |
| Wheelchair        | ✗              | ✗                 | ✓ Best     | ✓      |
| Stretcher         | ✗              | ✗                 | ✗          | ✓ Best |

---

## Implementation Priority

1. **Database migrations** - Add all new columns
2. **Update Driver form & display** - Most fields
3. **Update Patient form & display** - Most fields
4. **Update Trip Type options** - Quick change
5. **Implement Smart Matching** - Driver filtering logic
