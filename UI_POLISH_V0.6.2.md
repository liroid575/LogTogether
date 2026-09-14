# LogTogether UI Polish v0.6.2

This patch focuses on the last round of small usability fixes before moving on.

## What changed

### 1) iPhone date input overflow fix
- Applied a dedicated `.date-input` style for the **supplement date** and **hike date** fields.
- Reduced the effective date input font size slightly on mobile and constrained the native picker so it stays inside the card border more reliably.

### 2) Bottom-nav Water icon size
- Increased the **Water** tab icon size so it visually matches the other bottom-bar icons better.

### 3) History calendar activity markers
- Replaced the old single generic activity dot with a **multi-marker system**.
- Each history calendar day can now show:
  - **Colored dots** for workout categories done that day
  - **▲ triangle** if a hike was logged that day
  - **Blue day styling** when the daily calorie target was reached
- Added a short helper legend under the calendar.

### 4) Weekly supplement summary dropdown/card
- Added a new **This week’s supplement summary** section on the Water page.
- It includes:
  - Weekly total counts
  - Number of days used
  - Per-supplement totals
  - A filter dropdown to inspect one supplement at a time
  - Daily breakdown when a specific supplement is selected

### 5) Move calorie formula off the homepage
- Removed the long calorie calculation explanation from the homepage.
- Added a dedicated **How we calculate calories** section under **Settings**.
- The homepage keeps only a short note that calories are estimates.

### 6) Simple exercise visual cues
- Added very simple **stick-figure style exercise icons**.
- Because native iPhone/browser `<select>` menus do **not** reliably support inline SVG/icon rendering inside individual options, this patch uses a more dependable approach:
  - A **live preview card** under the exercise dropdown
  - Small exercise icons on active workout cards
  - Small exercise icons in workout history entries

## Files included
- `public/styles.css`
- `public/sw.js`
- `src/main.ts`
- `UI_POLISH_V0.6.2.md`

## Validation
- Type-checked with:

```bash
npx tsc --noEmit --target es2022 --module es2022 --lib es2022,dom,dom.iterable --skipLibCheck src/main.ts src/core/*.ts src/services/*.ts
```

