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
| `firstName` | string | |
| `lastName` | string | |
| `email` | string | |
| `phone` | string | |
| `smsConsent` | boolean | 2FA text consent |
| `school` | string | Optional |
| `district` | string | Optional |
| `role` | string | e.g. "School Psychologist" |
| `roleCustom` | string | Only populated if role is "Other" |
| `createdAt` | timestamp | serverTimestamp() on create |

---

### 📁 `students`
Stores student records. Document ID = auto-generated. Linked to a user via `userId`.

| Field | Type | Notes |
|-------|------|-------|
| `firstName` | string | |
| `lastName` | string | |
| `studentId` | string | Optional internal ID |
| `notes` | string | Optional |
| `userId` | string | Reference to `users` document ID |
| `createdAt` | timestamp | serverTimestamp() on create |

#### 📁 `students/{studentId}/evaluations` (subcollection)
Stores individual evaluations for a student. Document ID = auto-generated.

| Field | Type | Notes |
|-------|------|-------|
| `evalType` | string | `"Initial"` \| `"Triennial"` \| `"Other"` |
| `customEvalType` | string | Custom label when evalType is "Other" |
| `evalDate` | string | Date of evaluation (YYYY-MM-DD) |
| `measures` | array | Array of measure objects (see below) |
| `notes` | string | Optional evaluation notes |
| `isArchived` | boolean | Soft-delete flag; archived evals hidden by default |
| `createdAt` | timestamp | serverTimestamp() on create |

**`measures` array item structure:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique measure ID (e.g. `m${Date.now()}`) |
| `name` | string | Assessment name (e.g. "WISC-V: Vocabulary") |
| `score` | number | Score value |
| `scoreType` | string | `"standard"` \| `"scaled"` \| `"tscore"` \| `"zscore"` \| `"percentile"` |

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

##### Document: `bellCurveGraph`

Path: `users/{userId}/calculators/bellCurveGraph`

Auto-saved with a 500 ms debounce on every input change. Loaded on screen mount to pre-populate all fields.

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Editable chart title displayed above the graph |
| `entries` | array | Up to 12 score entry objects (see below) |
| `categoryLines` | array | Up to 8 vertical divider line objects (see below) |
| `rightmostCategoryLabel` | string | Label for the region to the right of the last category line |
| `rightmostShade` | boolean | Whether the rightmost region is shaded |
| `rightmostShadeColor` | string | Hex color for the rightmost region shade |
| `scoreColors` | array | Redundant array of hex strings, one per entry — mirrors `entries[n].color` |
| `updatedAt` | timestamp | Firestore server timestamp, updated on every save |

**`entries` array item structure** (up to 12 items):

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique entry ID (e.g. "e1", `e${Date.now()}`) |
| `label` | string | Display label for the score line (shown rotated above the line) |
| `score` | string | Score value as entered by the user (parsed to number for plotting) |
| `scoreType` | string | `"SS"` \| `"Scaled"` \| `"T"` \| `"Z"` \| `"Pct"` |
| `color` | string | Hex color selected by the user (e.g. `"#E53E3E"`) |

> **Note:** Marker shape (square, circle, triangle) is not stored — it is derived at render time from the entry's index position (`idx % 3`). Score lines are drawn as vertical colored lines; the marker sits at the intersection with the bell curve.

**`categoryLines` array item structure** (up to 8 items):

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique line ID (e.g. "cl1", `cl${Date.now()}`) |
| `score` | string | Score value as entered by the user (parsed and normalized to SS for x-position) |
| `scoreType` | string | `"SS"` \| `"Scaled"` \| `"T"` \| `"Z"` \| `"Pct"` |
| `leftLabel` | string | Name of the category region to the **left** of this line (e.g. "Average") |
| `shade` | boolean | Whether the region to the left of this line is shaded on the graph |
| `shadeColor` | string | Hex color for the shaded region (rendered at 20% opacity) |

Default `categoryLines` pre-populated on first open:

| score | scoreType | leftLabel | shade | shadeColor |
|-------|-----------|-----------|-------|------------|
| 70 | SS | Extremely Below | false | #3182CE |
| 80 | SS | Well Below | false | #3182CE |
| 90 | SS | Below Average | false | #3182CE |
| 110 | SS | Average | true | #3182CE |
| 120 | SS | Above Average | false | #3182CE |
| 130 | SS | Well Above | false | #3182CE |

> **Region shading:** Each region's shade is controlled independently via a toggle and color picker per row. Multiple regions can be shaded simultaneously. Shading is drawn at 20% opacity. The rightmost region (beyond the last line) has its own `rightmostShade` / `rightmostShadeColor` fields at the document level.

> **Score normalization:** All score types are normalized to Standard Score (mean=100, sd=15) for x-axis placement. SS: identity; Scaled: `((sc−10)/3)×15+100`; T: `((t−50)/10)×15+100`; Z: `z×15+100`; Percentile: `inverseCDF(p/100)×15+100`.

---

## Relationships

```
users/{userId}
    ↑
    └── referenced by students/{studentId}.userId
    └── calculators/{calculatorId}          ← per-user tool state
            dueDateCalculator
            bellCurveGraph

students/{studentId}
    └── evaluations/{evaluationId}
```

---

## Tools with no Firestore schema

### Score Converter
The Score Converter is a stateless tool — it requires no Firestore reads or writes. All computation (Standard Score ↔ Scaled Score ↔ T-Score ↔ Z-Score ↔ Percentile) is performed locally in the component using Z-score as the common currency. No document paths or fields apply.

---

## Firestore Security Rules

Current rules deployed to Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /students/{studentId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      match /evaluations/{evaluationId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

---

## Notes & TODOs
- [ ] No subscription/billing fields yet on `users` — will need `subscriptionStatus`, `subscriptionExpiry` for $20/year model
- [ ] `entries[n].score` in `bellCurveGraph` stored as string (TextInput value) — consider normalizing to number on save
- [ ] `evaluations` rules currently allow any authenticated user to read/write any evaluation — should scope to student owner
