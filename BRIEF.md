# PsychGraphs — Project Brief

## What It Is
A subscription app for school psychologists built in **Expo / React Native** with **TypeScript** and **Firebase**.

- **GitHub:** github.com/tandyandrew-creator/SASapp
- **Auth:** Login/signup built and working

## Business Model
$20/year for full access to all tools.

## Design Direction
Clean, professional, modern, high-tech. Light and white UI — think Polaris/clinical aesthetic. Inspired by [ladataviz.com](https://ladataviz.com). Bell curve visualization built with react-native-svg.

---

## Design System

No third-party UI libraries — pure React Native StyleSheet.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#F8F9FB` | Screen backgrounds |
| Surface | `#FFFFFF` | Cards, inputs, sheets |
| Border | `#E5E8EE` | All borders |
| Text primary | `#1A1D23` | Headings, body |
| Text secondary | `#6B7280` | Labels, subtitles |
| Text muted | `#9CA3AF` | Placeholders, hints |
| Accent blue | `#3B6FEB` | Buttons, active states |
| Accent light | `#EEF3FD` | Icon backgrounds, highlights |
| Danger red | `#DC2626` | Destructive actions |

- Bottom sheet modals for all form entry
- SafeAreaView + StatusBar on every screen
- KeyboardAvoidingView on all screens with inputs

## Score Types Supported
Standard Score, Scaled Score, T-Score, Z-Score, Percentile, Category (Possibly)

---

## Current Features

### Due Date Calculator
- Saves at the user level: `users/{userId}/calculators/dueDateCalculator`
- Auto-saves on every change (500 ms debounce); loads on screen mount to pre-populate all fields
- Supports Calendar Days and School Days modes
- Calendar Days mode counts weekends toward the timeline
- School Days mode silently skips weekends (not shown in excluded date log)
- 10 excluded date ranges (preset labels fixed; 4 user-editable "Other" slots)
- 14 excluded single dates (preset holiday labels fixed; 5 user-editable slots)
- Excluded date log shows only entries from excluded ranges and single dates with their labels

### Score Converter
- Stateless tool — no Firebase reads or writes
- Supports Standard Score, Scaled Score, T-Score, Z-Score, and Percentile
- All five score types are fully bidirectional — changing any one instantly updates all others
- Live mini bell curve at top of screen with color-coded classification zones
- Classification label (e.g. "Average") updates live in the matching zone color
- Sliders + text inputs for every score type

### Bell Curve Graph
- Saves at the user level: `users/{userId}/calculators/bellCurveGraph`
- Auto-saves on every change (500 ms debounce); loads on screen mount
- Fixed 850×600 SVG canvas, horizontally scrollable on narrow screens
- Up to 12 score entries; each with label, score value, score type, and user-selected color
- All 5 score types supported with normalization to Standard Score for plotting
- Per-score color selection: 12-color palette (red, orange, yellow, green, teal, blue, indigo, violet, pink, black, gray, white)
- Marker shapes cycle per score: square, circle, triangle
- Score labels rotate vertically above each line
- User-defined vertical category divider lines (up to 8): each has a score value, score type, and left-region label
- Rightmost region has its own label field
- Per-region shading toggle with color chooser — only shaded regions are filled (20% opacity)
- Default: Average region (SS 90–110) shaded in blue
- 4-row x-axis: Standard Score / Scaled Score / T+Z combined / Percentile
- Category region labels displayed below the x-axis
- Editable chart title

---

## Completed Screens

| File | Description |
|------|-------------|
| `LoginScreen.tsx` | Firebase email/password auth |
| `SignUpScreen.tsx` | Firebase user registration with full profile fields (name, phone, SMS consent, school, district, role) |
| `DashboardScreen.tsx` | Quick Tools cards, My Cases table, Add Case modal with Firestore write, Sign Out, user greeting |
| `DueDateCalculatorScreen.tsx` | Due date calculator with calendar/school days toggle, excluded date ranges, auto-save to Firestore |
| `ScoreConverterScreen.tsx` | Stateless bidirectional score converter with live mini bell curve |
| `BellCurveGraphScreen.tsx` | 12-score bell curve graph; supports standalone mode and eval-connected mode (reads from EvaluationScreen) |
| `StudentDetailScreen.tsx` | Evaluation list per student, archive toggle, Add Evaluation bottom sheet modal |
| `EvaluationScreen.tsx` | Editable eval fields (type, date, notes), measures list with add/delete, View Graph button |

---

## Roadmap

### Phase 1 — MVP
- [x] Due Date Calculator (auto-save, calendar/school days modes, excluded date ranges)
- [x] Score Converter (stateless, bidirectional, live mini bell curve)
- [x] Quick Bell Curve — standalone graph accessible from Dashboard; also accepts eval data
- [x] Dashboard with My Cases list, Quick Tools section, Add Case modal
- [x] Student Detail screen — evaluation list with archive toggle
- [x] Evaluation entry screen — type, date, notes, measures list
- [x] Measures entry — add/delete measures with score type per measure
- [x] Graph connected to real student data — bell curve launches from evaluation with pre-populated scores

### Phase 2
- [ ] 60-score horizontal profile graph (category + score entries, MOE support)
- [ ] 10-score scatter bell curve (floating dots against curve)

### Phase 3
- [ ] Performance Over Time graph (auto-generated from saved assessment history)
- [ ] Graph export as PNG (for pasting into Word or Google Docs reports)

---

## Tech Stack
- Expo / React Native
- TypeScript
- Firebase (Auth + Firestore)
- react-native-svg (bell curve visualization)

---

## Current Status
- Firebase Auth (login, signup) complete and working
- Firestore read/write confirmed working
- Firestore security rules updated to allow authenticated access to `students` and `evaluations` collections
- Dashboard screen complete with Quick Tools section and My Cases list
- Student cases save to Firestore and appear in the list
- Sign Out button working in header
- User first name displayed in header greeting
- App runs in Expo Go and Safari browser via `npx expo start`
