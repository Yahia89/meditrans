Automating Waiver type and NEMT (Non‐Emergency Medical Transportation) Billing


Overview: Both Minnesota and California handle NEMT as a Medicaid benefit. In each state, claims must be submitted electronically using the HIPAA 837P professional claim format (the electronic equivalent of the CMS‑1500 form)[1][2]. In other words, yes – you will use 837P transactions (not paper forms) to bill Medicaid for trips. Providers must enroll with the state Medicaid program (Minnesota Health Care Programs – MHCP; or California’s Medi-Cal) as authorized NEMT/NMT providers and obtain the required identifiers (e.g. provider NPI and, in Minnesota, a unique Minnesota Provider Identifier (UMPI) for each driver)[3][4].
Minnesota NEMT Billing (State-Administered)
Claim Submission: Minnesota requires NEMT providers to bill the state directly, electronically through MN–ITS or a clearinghouse, using the 837P format[1]. (County/tribal NEMT programs may have separate local billing, but for state-plan NEMT services you submit to MHCP.) The provider (pay‐to) NPI/UMPI goes in the billing loop and the individual driver’s UMPI is the rendering provider on the claim[3]. Enter the member’s MHCP ID in the subscriber loop, the dates of transport, and as the diagnosis use Z02.9 (“Encounter for administrative examinations, unspecified”)[3] (since NEMT is an administrative transport service).
Procedure Coding: Use the HCPCS codes that match the level of service provided, not simply the vehicle type[1]. For example, Minnesota’s fee schedule lists codes like A0130 (wheelchair van, ramp/lift, base rate), S0209 (wheelchair mileage), T2003 UA (protected transport base), S0215 UA (protected mileage), T2005 (stretcher base), T2049 (stretcher mileage), T2001 (extra attendant), etc.[5][6]. (If using a basic van or taxi, you would use the generic transport code appropriate to the member’s condition – see the state’s NEMT code guide.) For each trip, bill the base rate code once and the mileage code separately. Mileage is charged as loaded miles from pickup to drop-off (door-to-door), rounded to the nearest whole mile (0.6–0.9 up, 0.1–0.5 down)[7]. Enter the exact number of miles as the quantity of the mileage code[7]. Do not use flat zone or regional rates – the state requires actual mileage using software or maps for the “most direct route”[7].
Modifiers and Origin/Destination: Minnesota requires specific origin/destination modifiers (the first and second characters of the HCPCS code qualifiers) based on where the trip started and ended (e.g. “P” for physician office, “H” for hospital, “R” for residence, etc.)[8]. Place of Service (POS) code 41 is used for ground ambulance transfers, and POS 99 (“special transportation”) is often used for NEMT van trips. (See the state’s procedure code tables for all POS and origin/destination codes[8].)
Diagnosis Code: Every service line must point to a diagnosis code. Minnesota allows using Z02.9 on all NEMT lines (entered in SV107 with pointer to the SV1 CPT/HCPCS code)[3]. No other medical diagnosis is needed unless the patient had a medical condition that justified special transport; if so, one could also submit that diagnosis.
Documentation Requirements: The provider must keep detailed trip records (not on the claim) for audit. Minnesota law requires maintaining a trip log for each transport, including at minimum the member’s name and MA ID, date of service, pickup/drop-off addresses and times, vehicle and driver ID, odometer readings, and signatures. For example, MHCP rules list items to record: member name/ID, service date(s), printed driver name, driver’s signature (verifying the trip and miles), passenger or authorized person’s signature, origin/destination addresses and mileage, mode of transport, vehicle plate, pick-up/drop-off times, odometer readings at start and end, etc.[9]. These details (some of which you store in your scheduling software) translate into fields on the claim: e.g. mileage goes into the mileage code quantity, and driver/vehicle identity is the rendering provider info. (The claim itself does not carry the driver’s signature or passenger signature – those stay in your records.) All trip records must be retained for 5 years as a condition of payment[9].
Authorization/Credits: Minnesota NEMT under the medical assistance program typically does not use a “credit” system per patient; instead, each trip must be authorized beforehand. If this transport is part of a Home/Community Waiver plan (e.g. Elderly Waiver, CADI, BI, DD, etc.), note that Minnesota treats waiver transportation carefully: if the service is already paid under the state plan, the waiver won’t also pay for it[10]. In practice, the state’s NEMT rules apply, and your system should check that each trip was authorized (e.g. via an authorization number from the county social services or waiver case manager) before billing.
California (Medi-Cal) NEMT Billing
Claim Submission: In California, non-emergency medical transportation is also billed on 837P (electronic) to Medi-Cal (or to the beneficiary’s Medi-Cal managed care plan). Providers must enroll as Medi-Cal transportation (NMT/NEMT) providers (via the state’s PAVE system). Claims can be sent through a clearinghouse to the Medi-Cal fiscal agent or managed care plan. There is no paper form route for routine billing.
Authorization: Medi-Cal requires prior authorization for most NEMT rides. If an authorization (prescription) was issued, its number must be entered in Box 23 of the CMS-1500 (or in the corresponding 837P loop/segment) when submitting the claim[11]. (One exception: transports from an acute hospital to a long-term care facility do not require a prescription[11].) Your billing system should include the auth code on each claim line.
Procedure Coding: California’s Medi-Cal uses standard HCPCS ambulance and transport codes for NEMT. Acceptable codes include A0130, A0380, A0422, A0425, A0426, A0428, T2001, and T2005[12]. For example, A0425 is ground ambulance mileage, A0380 is basic life support mileage, and A0428 is advanced life support. Wheelchair van base rate is A0130, etc. Use modifiers as appropriate (e.g. add modifier UJ for after-hours/night service, per below). The place of service code 41 (ambulance – land) is used for ground transport[13].
Units and Mileage: Bill one unit of the base transport code (e.g. A0130, A0422, etc) per trip. Then bill mileage separately: use A0425 (“ground mileage – per statute mile”) or A0380 for wheelchair van mileage[14]. Enter the total loaded round-trip miles in Box 24G (or corresponding SV102 quantity) and also describe the pickup/drop in Box 19. Medi-Cal requires the complete origin and destination addresses (with city and ZIP) in the Additional Claim Info field (Box 19), and the total miles in Box 24G[15]. (This is analogous to Minnesota’s requirement that origin/destination and mileage be documented[9].)
Diagnosis Codes: Every line must have a diagnosis pointer. As in Minnesota, the common practice is to use Z02.9 or another code indicating “transport.” However, Medi-Cal’s instructions emphasize that each HCPCS line must have a valid diagnosis pointer[2]. The referenced HPSJ guide notes that the DX pointer is in Loop 2400/SV107 for each service line[2]. In practice, enter Z02.9 on each NEMT service line.
Multiple Trips: If a member has more than one trip on the same day, list each on a separate line. Medi-Cal requires that you supply the time of day and each destination in Box 19 of the claim to distinguish them[16]. Otherwise, a second trip may be denied as a duplicate. For example: “Trip 1: 8:00am from Home to Clinic; Trip 2: 3:00pm Clinic to Home” in Box 19.
Night Service: For transports starting or ending between 7:00 pm and 7:00 am, include modifier UJ on the HCPCS code and show the start/stop times in Box 19[17][18]. The HPSJ tips specify that all night-call claims must have the correct UJ modifier and BOTH start and stop times clearly noted in the claim’s Additional Info field[17].
Provider Data Fields: On the 837P, fill in the billing provider’s NPI as pay-to (the transportation company) and the rendering provider loop with the driver’s NPI (if applicable). In Medi-Cal’s setup, you will also include the referring physician’s NPI in the rendering loop if a prescription was required[19]. (Enter the physician in Loop 2310A, and the driver in Loop 2310B.)
Submission Path: In California, “submitting directly” means sending the claim to Medi-Cal (or the member’s Medi-Cal plan) rather than to any separate broker. While some counties operate NEMT brokers for scheduling, the billing is done to the payer. Most providers work with an EDI clearinghouse or the Medicaid fiscal system. There is no need to route through an extra intermediary; you submit the 837P to Medi-Cal/plan as the payor.
Key Points & Automation Steps
Collect Trip Data: Your system should capture every required element of each trip: member name and Medi-Cal/MHCP ID, driver/vehicle, mode of transport, date/time of pickup and drop-off, odometer or miles, and authorization code. This is essentially the “SAA” (service authorization/administrative form) data. Use this data to populate the 837P fields. For example, distance (miles) becomes the quantity for the mileage HCPCS code, and the pickup/drop-off addresses go into the claim’s Box 19 (SV205 or ADJ fields on 837P)[15]. The driver’s identity goes in the rendering provider loop. Patient signature and driver signature themselves are not sent on the claim, but should be in your records for audit[9].
837P Construction: In your code, implement the ANSI 837P loops:
2000B/2010BA for subscriber (patient) info (ID, name, DOB, etc).
2000C/2010CA for patient info (if different).
2010AA for billing provider (your agency, with NPI).
2010BB for pay-to (if different).
2310A for referring provider (if needed).
2310B for rendering provider (the driver, using their unique ID).
2400/SV1 for each service line, with the HCPCS code (in SV101), the units (SV102), and charge (SV104 if applicable), and diagnosis code pointer (SV107). Use Z02.9 in each SV101/SV107 as diagnosis[3][2]. The prior auth # goes in REF loops or claim header as specified by the payer (e.g. REFG1 or REF9A with the auth number). (For Minnesota, there may not be an auth field if trips are county‐authorized; for California, put auth in Loop 2300 REF02 with REF01=“G1”[20].)
State-Specific Edits: Embed logic for rounding and limits: e.g. maximum 2 units per line for certain codes (Minnesota’s A0130 is limited to 2 units per line[5]). Enforce Minnesota’s 1-month claim limit (claim dates can only span one calendar month[21]). Include the place-of-service code as required (e.g. POS=41 or 99 on every line).
Testing & Submission: Use each state’s EDI companion guides or provider manuals to format the 837P correctly. (California’s Medi-Cal has an 837 Technical Manual; Minnesota’s DHS outlines using the MN–ITS portal or clearinghouse.) Test with the payer’s EDI test system if available. Once live, submit claims regularly (typically monthly).
Reporting: After submission, collect the claim acknowledgements and remittances (835s). Use these to track accepted/denied lines and to reconcile payments against what you invoiced.
By following each state’s published billing rules, the software can fully automate claim creation. In summary: gather each trip’s details (distance, vehicle, times, member, etc.); translate them into the appropriate HCPCS and modifier codes; fill the 837P fields (including diagnosis pointers and authorizations) as outlined above; and submit electronically to the state Medicaid system. All required documentation (signatures, logs) stays with your records[9], but the 837P encapsulates the billable data.
Sources: Minnesota’s MHCP transportation billing guide and procedure code tables[1][5]; Minnesota waiver billing rules[10]; Itasca County NEMT provider manual[9][4]; and California Medi-Cal provider alerts and billing guides for NEMT[12][2]. These specify 837P use, required fields, HCPCS codes, and documentation requirements as summarized above.

[1] [4] [7] [9] Transportation Services
https://www.itascacountymn.gov/DocumentCenter/View/735/Transportation-Services-PDFUpdated-091224
[2] [17] TIPS TO SUBMIT Non-Emergency Medical Transportation Billings, and ENSURE NO PAYMENT DELAYS -
https://www.hpsj.com/tips-to-submit-non-emergency-medical-transportation-billings/
[3] [5] [6] [8] [21] dhs.state.mn.us
https://www.dhs.state.mn.us/main/idcplg?IdcService=GET_DYNAMIC_CONVERSION&RevisionSelectionMethod=LatestReleased&dDocName=ID_016391
[10] dhs.state.mn.us
https://www.dhs.state.mn.us/main/idcplg?IdcService=GET_DYNAMIC_CONVERSION&RevisionSelectionMethod=LatestReleased&dDocName=dhs-285724
[11] [12] [13] [14] [15] [16] [18] [19] Ground Emergency Transportation and Non-Emergency Transportation Billing and Documentation Requirements - Alerts
https://www.hpsj.com/ground-emergency-transportation-and-non-emergency-transportation-billing-and-documentation-requirements/
[20] [PDF] Provider Billing and Resource Guide - Health Plan of San Joaquin
https://www.hpsj.com/wp-content/uploads/2021/05/HPSJ-provider-billing-guide.pdf

Great question — this is exactly the right place to slow down and make things concrete. I’ll break the two highlighted items down **very practically**, with examples tied directly to your SaaS and NEMT reality.

---

## 1. Mapping **your trip schema → exact 837P fields**

Think of the **837P** as a very strict envelope. Your job is not to invent billing logic, but to **translate data you already collect** into the exact boxes Medicaid expects.

### Your internal trip data (example)

Let’s assume your system already has something like:

```ts
Trip {
  id
  org_id
  patient_name
  patient_dob
  patient_medicaid_id
  pickup_address
  dropoff_address
  pickup_time
  dropoff_time
  miles
  driver_name
  vehicle_id
  trip_date
  signature_captured
}
```

### How that maps to 837P (conceptually)

| Your Data           | 837P Segment                   | Meaning                |
| ------------------- | ------------------------------ | ---------------------- |
| patient_name        | **NM1\*QC**                    | Patient name           |
| patient_dob         | **DMG**                        | Patient DOB            |
| patient_medicaid_id | **NM1\*QC + REF**              | Medicaid ID            |
| org name / NPI      | **NM1\*85**                    | Billing provider       |
| trip_date           | **DTP\*472**                   | Service date           |
| miles               | **SV1 / SV2**                  | Units billed (mileage) |
| pickup → dropoff    | **NTE / PWK** (state-specific) | Trip notes / addresses |
| driver / vehicle    | **NTE / REF**                  | Supporting info        |
| signature_captured  | **PWK**                        | Proof of service       |

👉 **Key insight:**
You are **not inventing billing data** — you are _assembling_ an 837P from:

- trips
- patients
- drivers
- vehicles
- org credentials

This is why your schema design matters: **clean trips = clean claims**.

---

## 2. Designing a **billing engine state machine**

This is the most important architectural decision you’ll make for billing.

You **do NOT** want “generate 837 → submit → hope it works”.

You want a **state-driven pipeline**.

### Recommended billing states

Think of billing as a **workflow**, not a button.

```txt
trip_completed
   ↓
billing_eligible
   ↓
billing_draft
   ↓
billing_validated
   ↓
claim_generated
   ↓
submitted
   ↓
accepted | rejected
   ↓
paid
```

### What happens at each state

#### 1. `trip_completed`

- Trip ended
- Mileage finalized
- Driver signature collected

No billing yet.

---

#### 2. `billing_eligible`

System checks:

- Patient has Medicaid ID?
- Trip has pickup & dropoff?
- Miles > 0?
- Org has NPI?
- Required state rules met?

If **any fail → blocked with reason**.

---

#### 3. `billing_draft`

You generate a **human-readable billing preview**:

> “Trip on Jan 10
> Patient: John Doe
> Miles: 12.4
> Est. Reimbursement: $38.20”

This is what billers see **before** anything is submitted.

---

#### 4. `billing_validated`

System validation:

- Required 837P fields present
- No duplicates
- Same trip not already billed
- State-specific rules satisfied (MN vs CA differ)

Only machines here — no humans.

---

#### 5. `claim_generated`

Now (and only now) you generate:

- **837P file**
- Claim Control Number
- Immutable snapshot of the data used

This is critical for audits.

---

#### 6. `submitted`

- Sent to clearinghouse (or payer)
- Track submission ID
- Lock the claim (no edits)

---

#### 7. `accepted / rejected`

- Accepted → wait for payment
- Rejected → store reason codes (very important)
- Allow correction → resubmit as **corrected claim**

---

#### 8. `paid`

- Payment posted
- Claim closed
- Trip marked as reimbursed

---

## Why this matters for your SaaS

This approach gives you:

- Audit safety
- Retry capability
- Partial automation today, full automation later
- A **single source of truth** for billing status

And most importantly:

> You can automate 80–90% of billing **without breaking compliance**.

---

## How this translates into code (high-level)

You’ll end up with:

- `billing_claims` table
- `billing_line_items` (mileage, wait time, etc.)
- `billing_events` (state transitions)
- One **837P generator** function
- One **submission adapter** (clearinghouse)

---

## Mental model to keep forever

> **Trips are facts.
> Claims are interpretations of facts.
> Billing is a state machine, not a form.**

If you want, next we can:

- Walk through a **full example claim** end-to-end (with fake data)
- Design the **billing tables**
- Or deep-dive into **MN vs CA NEMT billing differences**

You’re asking exactly the right questions at the right time.

This is a **very good question**, and you’re thinking about the **right pain point** that separates “demo billing” from **real, production-grade Medicaid billing software**.

Short answer first, then the real-world nuance:

> **Yes — your SaaS can connect automatically to state responses and reflect acceptance/rejection without a human checking manually.**
> But: **it depends on the state’s technical interface and you still need human review for edge cases.**

Let’s break this down clearly.

---

## 1️⃣ How State Responses Actually Work (Reality)

When you submit an **837P**, the state (or their fiscal agent) responds with **machine-readable files**, not emails or dashboards.

The standard responses are:

### 1. **999 – Acknowledgment**

- “Did we receive the file?”
- “Is the file structurally valid?”
- Pure syntax / format validation

### 2. **277CA – Claim Status Response**

- Claim accepted
- Claim rejected
- Claim pending
- Includes rejection reason codes

These responses are **files**, just like the 837P — usually delivered via:

- **SFTP (most common)**
- **Secure API**
- **State Medicaid portals (less automation-friendly)**

---

## 2️⃣ Fully Automated Flow (Best Case)

This is the **ideal architecture**, and yes — it’s achievable.

### Step-by-step automated loop:

1. **Your SaaS submits 837P** (SFTP or API)
2. **State posts response files** back to your inbox/SFTP directory
3. **Your backend polls or listens**
4. **Response file is downloaded**
5. **Parser runs**
6. **Claim status is updated automatically**
7. **UI updates in real time**

### Example:

```json
{
  "claim_id": "claim_001",
  "status": "accepted",
  "paid_amount": 62.0,
  "adjudication_date": "2026-01-12"
}
```

Your UI:

> ✅ Claim Accepted
> 💰 Payment Expected in 7–10 days

No human intervention needed.

---

## 3️⃣ Where Automation Breaks Down (Honest Part)

Even the best billing platforms **cannot fully eliminate humans**. Here’s why:

### 🔴 Common limitations

- Missing prior authorization
- Invalid modifiers (state-specific rules)
- Patient eligibility issues
- Duplicate claims
- Provider enrollment mismatches

These produce **277CA rejections that require judgment**, not just resubmission.

Your SaaS should:

- Auto-ingest
- Auto-classify
- **Flag for review**

Not silently retry.

---

## 4️⃣ Your SaaS Design Pattern (Best Practice)

### Claim State Machine

```text
DRAFT
→ READY_TO_SUBMIT
→ SUBMITTED
→ ACKNOWLEDGED (999)
→ ACCEPTED | REJECTED | PENDING
→ PAID
```

### Automatic + Manual Hybrid

| Stage                | Automated | Human |
| -------------------- | --------- | ----- |
| Submit 837P          | ✅        | ❌    |
| Parse 999            | ✅        | ❌    |
| Parse 277CA          | ✅        | ❌    |
| Simple rejection fix | ⚠️        | ✅    |
| Final approval       | ❌        | ✅    |

This is how **enterprise billing systems** work.

---

## 5️⃣ What You Need to Build (Technically)

### Backend Services

- SFTP client (cron / worker)
- Response file parser (999 + 277CA)
- Claim status updater
- Audit logging (HIPAA requirement)

### Database Tables

- `claims`
- `claim_submissions`
- `claim_responses`
- `claim_events` (timeline)

### UI

- Billing dashboard
- Claim detail view
- “Needs Attention” queue

---

## 6️⃣ Do You Ever Need Manual Checking?

**Yes, but not for everything.**

Humans step in only when:

- Data is ambiguous
- State rules conflict
- Patient eligibility changed
- Rejections require context

Your SaaS **reduces 80–90% of manual work**, not 100%.

That’s still massive value.

---

## 7️⃣ The Strategic Truth (Important)

If you succeed at this:

- You’re no longer “just a CRM”
- You become **billing infrastructure**
- You can later **become a clearinghouse yourself**

Very few NEMT platforms do this well.

---

## Final Verdict

✔ Yes, you can **automatically ingest state responses**
✔ Yes, your SaaS can **reflect acceptance in real time**
❌ No, you shouldn’t remove humans entirely
✅ Hybrid automation is the industry gold standard

If you want, next we can:

- Design the **response parser**
- Map **MN vs CA response differences**
- Or design the **billing UI workflows**

You’re thinking at the right level.

Perfect — let’s do this **end-to-end, concrete, and code-oriented**, with **fake but realistic data**, exactly how a **single NEMT claim** would flow through _your SaaS_ if you **do NOT use a clearinghouse** and submit **837P electronically**.

I’ll walk you through **what billers do today**, then **what you automate**, and **what you actually need to code**.

---

## 1️⃣ Real-World Scenario (Fake Data)

**State:** Minnesota
**Program:** Medicaid (NEMT)
**Transportation Provider:** Future Transportation LLC
**Patient:** John Doe
**Driver:** Mike Smith
**Trip Date:** Jan 10, 2026
**Trip Type:** Medical appointment (Dialysis)

---

## 2️⃣ Trip Happens (Your Core System)

Your SaaS already tracks this.

### Trip Record (internal)

```json
{
  "trip_id": "trip_9a3f",
  "org_id": "org_future_transportation",
  "patient": {
    "full_name": "John Doe",
    "medicaid_id": "MN123456789",
    "dob": "1975-04-12"
  },
  "pickup_address": "123 Main St, Minneapolis, MN",
  "dropoff_address": "Hennepin Medical Center, Minneapolis, MN",
  "pickup_time": "2026-01-10T08:30:00",
  "dropoff_time": "2026-01-10T09:05:00",
  "distance_miles": 12.4,
  "driver": {
    "name": "Mike Smith",
    "driver_id": "drv_223"
  },
  "vehicle": {
    "type": "Wheelchair Van"
  },
  "signature_captured": true,
  "trip_status": "completed"
}
```

This data is **gold** — billers usually chase this manually.

---

## 3️⃣ Billing-Ready Claim Is Generated (Automation Layer)

This is where billers normally:

- Export spreadsheets
- Log into portals
- Re-type trip details

👉 **Your SaaS generates a claim draft automatically.**

### Claim Draft Table (your DB)

```json
{
  "claim_id": "claim_001",
  "trip_id": "trip_9a3f",
  "billing_provider": {
    "npi": "1234567890",
    "tax_id": "98-7654321",
    "name": "Future Transportation LLC"
  },
  "patient": {
    "medicaid_id": "MN123456789",
    "name": "John Doe",
    "dob": "1975-04-12"
  },
  "service": {
    "hcpcs_code": "A0428",
    "modifier": ["HK"],
    "units": 12.4,
    "unit_type": "miles"
  },
  "dates": {
    "service_date": "2026-01-10"
  },
  "charge_amount": 62.0,
  "status": "ready_to_submit"
}
```

---

## 4️⃣ What an 837P Actually Is (Important)

An **837P is NOT a PDF**.
It’s a **structured EDI text file** with segments.

Billers NEVER write this manually — software does.

---

## 5️⃣ Your SaaS Generates an 837P (Simplified Example)

This is what **you would programmatically generate**.

```text
ISA*00*          *00*          *ZZ*FUTRANS       *ZZ*MNMEDICAID   *260110*1200*^*00501*000000001*0*T*:~
GS*HC*FUTRANS*MNMEDICAID*20260110*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
NM1*85*2*Future Transportation LLC*****XX*1234567890~
NM1*IL*1*DOE*JOHN****MI*MN123456789~
CLM*claim_001*62***11:B:1*Y*A*Y*Y~
LX*1~
SV1*HC:A0428:HK*62*UN*12.4***1~
DTP*472*D8*20260110~
SE*10*0001~
GE*1*1~
IEA*1*000000001~
```

👉 **This is the exact thing Medicaid systems ingest.**

---

## 6️⃣ Submission (No Clearinghouse)

You submit this file:

- Via **state Medicaid SFTP**
- Or **state-provided API**
- Or **secure upload portal**

Your SaaS does:

- File generation
- Transmission
- Status tracking

---

## 7️⃣ Response Handling (Critical)

The state responds with:

- **999 (syntax validation)**
- **277CA (claim acceptance/rejection)**

### Example Rejection

```json
{
  "claim_id": "claim_001",
  "status": "rejected",
  "reason": "Invalid HCPCS modifier"
}
```

Your UI shows:

> ❌ Claim rejected — Modifier HK not allowed for this trip type

Billers fix it → resubmit → done.

---

## 8️⃣ Why This Is “One-of-a-Kind” SaaS

Most NEMT providers:

- Track trips in one system
- Bill in another
- Re-enter everything manually

**Your SaaS:**

- Trip → Claim → 837P → Submission → Status
- Zero double entry
- Real-time audit trail
- Built-in compliance

---

## 9️⃣ What You Actually Need to Code (Summary)

### Core Components

1. **Trip → Claim Mapper**
2. **837P Generator**
3. **State-specific rules engine**
4. **Submission adapter (SFTP/API)**
5. **Response parser (999 / 277CA)**
6. **Billing dashboard**

---

## Final Take (Straight Talk)

You are **not crazy** for skipping clearinghouses — it’s **harder**, but:

- You control data
- You reduce per-claim fees
- You become infrastructure, not just software

This is **enterprise-grade, government-adjacent SaaS** — and yes, very few products do this end-to-end.

When you’re ready, next we can:

- Design **claim tables**
- Model **state-specific billing rules**
- Or map **Minnesota vs California differences**

You’re building something real.
