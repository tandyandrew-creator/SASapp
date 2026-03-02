# PsychGraphs — Project Brief

## What It Is
A subscription app for school psychologists built in **Expo / React Native** with **TypeScript** and **Firebase**.

- **GitHub:** github.com/tandyandrew-creator/SASapp
- **Auth:** Login/signup built and working

## Business Model
$20/year for full access to all tools.

## Design Direction
Clean, professional, modern, high-tech. Light and white UI — think Polaris/clinical aesthetic. Inspired by [ladataviz.com](https://ladataviz.com). Bell curve visualization built in D3.

## Score Types Supported
Standard Score, Scaled Score, T-Score, Z-Score, Percentile, Category (Possibly)

---

## Roadmap

### Phase 1 — MVP
- [-] Due Date Calculator — in progress
  - Saves at the user level (not student level): `users/{userId}/calculators/dueDateCalculator`
  - Auto-saves on every change (500 ms debounce); loads on screen mount to pre-populate all fields
  - Supports Calendar Days and School Days modes
  - Calendar Days mode counts weekends
  - School Days mode silently skips weekends (not shown in excluded date log)
  - Excluded date log shows only explicitly excluded date ranges and single dates
- [ ] 10-score bell curve graph (vertical colored lines, all score types)

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
- D3 (bell curve visualization)

---

## Current Status
- Auth (login/signup) complete
- Due Date Calculator: in progress (screen built, auto-save wired, date pickers implemented)
