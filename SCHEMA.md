# PsychGraphs — Firestore Schema

## Overview
Two top-level collections: `users` and `students`.
Students have one subcollection: `evaluations`.

---

## Collections

### 📁 `users`
Stores registered user (psychologist) profiles. Document ID = Firebase Auth UID.

| Field | Type | Notes |
|-------|------|-------|
| `allowSMS` | boolean | SMS notification preference |
| `district` | string | School district name |
| `email` | string | User email address |
| `firstName` | string | |
| `lastName` | string | |
| `phone` | string | Phone number |
| `role` | string | e.g. "Administrator" |
| `school` | string | School name/code |

---

### 📁 `students`
Stores student records. Document ID = auto-generated. Linked to a user via `userId`.

| Field | Type | Notes |
|-------|------|-------|
| `createdAt` | timestamp | When record was created |
| `studentCode` | string | Internal student code (e.g. "SM8") |
| `studentDob` | string | Date of birth (YYYY-MM-DD) |
| `studentFirstName` | string | |
| `studentLastName` | string | |
| `studentNotes` | string | Optional notes |
| `userId` | string | Reference to `users` document ID |

#### 📁 `students/{studentId}/evaluations` (subcollection)
Stores individual evaluations for a student. Document ID = auto-generated.

| Field | Type | Notes |
|-------|------|-------|
| `createdAt` | string | ISO timestamp (e.g. "2025-04-05T04:57:09.965Z") |
| `customEvalType` | string | Custom label if evalType is custom |
| `evalDate` | string | Date of evaluation (YYYY-MM-DD) |
| `evalType` | string | e.g. "Triennial", "Initial" |
| `measures` | array | Array of measure objects (see below) |
| `notes` | string | Optional evaluation notes |

**`measures` array item structure:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique measure ID (e.g. "m1", "m2") |
| `name` | string | Assessment name (e.g. "WISC-V: Vocabulary") |
| `score` | number | Raw score value |

---

#### 📁 `users/{userId}/calculators` (subcollection)

Stores per-user calculator state. Each document is a named calculator (upserted on every save).

---

##### Document: `dueDateCalculator`

Path: `users/{userId}/calculators/dueDateCalculator`

Auto-saved with a 500 ms debounce on every input change. Loaded on screen mount to pre-populate all fields.

| Field | Type | Notes |
|-------|------|-------|
| `consentDate` | string | YYYY-MM-DD |
| `timelineDays` | number | e.g. 15, 30, 60 |
| `timelineType` | string | `"calendar"` or `"school"` |
| `excludedRanges` | array | Objects: `{ label: string, startDate: string, endDate: string }`. Preset labels are fixed; "Other Range 1–4" labels are user-editable |
| `excludedSingleDates` | array | Objects: `{ label: string, date: string }`. Preset labels are fixed; "Other Day 1–5" labels are user-editable |
| `calculatedDueDate` | string | YYYY-MM-DD, stored for reference |
| `updatedAt` | timestamp | Firestore server timestamp, updated on every save |

Preset `excludedRanges` labels (fixed): Summer Break (Previous), Fall Break, Thanksgiving Break, Winter Break, Spring Break, Summer Break (Next). Editable: Other Range 1–4.

Preset `excludedSingleDates` labels (fixed): Independence Day, Labor Day, Veterans Day, Dr. MLK Day, Lincoln Day, Washington Day, Cesar Chavez Day, Memorial Day, Juneteenth. Editable: Other Day 1–5.

> **Note:** In Calendar Days mode, weekends are counted toward the timeline. In School Days mode, weekends are silently skipped — they do not appear in the excluded date log. The excluded date log shows only entries from `excludedRanges` and `excludedSingleDates` with their respective labels.

---

## Relationships

```
users/{userId}
    ↑
    └── referenced by students/{studentId}.userId
    └── calculators/{calculatorId}          ← per-user tool state

students/{studentId}
    └── evaluations/{evaluationId}
```

---

## Notes & TODOs
- [ ] No subscription/billing fields yet on `users` — will need `subscriptionStatus`, `subscriptionExpiry` for $20/year model
- [ ] `studentDob` stored as string — consider converting to timestamp for age calculations
- [ ] `measures` score field currently stores raw number — will need `scoreType` field (Standard Score, Scaled Score, T-Score, Z-Score, Percentile, Category) for bell curve graphing (Phase 1)
- [ ] Score type fields needed on `measures` for Phase 1 bell curve visualization
