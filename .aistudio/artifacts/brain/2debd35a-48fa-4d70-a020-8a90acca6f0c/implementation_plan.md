# Morfo — Informe Tab Refinements (KPI Alignment, Direct Hour Input & Extended Goals)

This plan refines the **Informe (`ReportView`)** tab and **Dashboard Add Hours Modal** based on your feedback: aligning the **Horas** and **Cursos** KPI cards so their icons, numbers, and labels sit on the exact same horizontal line, removing the timer (*Cronómetro*), making the central hours number tappable so you can type a number directly when desired (alongside *Selección rápida* and the `±0.5` stepper), and adding **`100h`** and **`Custom` (*Personalizada*)** options to the Monthly Goal selector.

## User Review & Critical Decisions

> [!IMPORTANT]
> Your requested adjustments—including fixing the uneven **Horas** and **Cursos** KPI card alignment—are incorporated below.

- **Confirmed Adjustment 1 (Fix Uneven Horas & Cursos KPI Numbers)**:
  - **Root Cause**: The *Cursos* card had an extra row of `-` / `+` buttons stacked at the bottom while both cards used `justify-center`, which pushed the *Horas* number down out of alignment with the *Cursos* number.
  - **Solution**: Place the `-` and `+` buttons inline flanking the *Cursos* number (`[ - ]  3  [ + ]`) and enforce identical vertical structure (`Icon` $\rightarrow$ `3xl Number Row` $\rightarrow$ `Label`) across both cards so the icons, numbers, and labels are 100% level and both cards have the exact same height.
- **Confirmed Adjustment 2 (Remove Cronómetro)**:
  - Remove the built-in timer bar and its state from the **Informe** tab to keep the interface clean and focused.
- **Confirmed Adjustment 3 (Tap Hours to Type + Selección Rápida)**:
  - Keep the **Selección rápida** buttons (`0.5h`, `1h`, `1.5h`, `2h`, `3h`, `4h`) and the `-0.5` / `+0.5` stepper buttons, while making the center hours display an interactive numeric input so you can tap the number at any time to type an exact amount directly.
  - Apply the same tappable hours input + presets to the **Dashboard "Add Hours" modal**.
- **Confirmed Adjustment 4 (`100h` & `Custom` Monthly Goal Options)**:
  - Expand the **Monthly Goal** selector to include **`Sin meta` (`Off`)**, **`15h`**, **`30h`**, **`50h`**, **`100h`**, and **`Personalizada` (`Custom`)** (which reveals a compact number input to save any custom monthly hour target).

---

## 1. Overview & Core Concept

- **What It Does**: Streamlines the **Informe** tab by giving the **Horas** and **Cursos** KPI cards a balanced, level layout, removing the stopwatch clutter, giving publishers both 1-tap presets/steppers *and* direct tap-to-type hour entry, and supporting `15h`, `30h`, `50h`, `100h`, and custom monthly goals.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Symmetrical Horas & Cursos KPI Cards**:
   - Both cards share the exact same 3-row vertical grid:
     - Row 1: Centered Icon (`Clock` / `BookOpen`, `26px`)
     - Row 2: Fixed-height (`h-10`) value row where **Horas** displays the total (`12.5`) and **Cursos** displays `[ - ]  3  [ + ]` on the exact same baseline.
     - Row 3: Label (`Horas` / `Cursos`).
2. **Monthly Goal Selection (`Off` | `15h` | `30h` | `50h` | `100h` | `Custom`)**:
   - Tapping `15h`, `30h`, `50h`, or `100h` immediately sets the monthly goal and updates the progress bar.
   - Tapping **`Personalizada` (`Custom`)** opens an inline numeric input to enter any target (e.g., `70`, `120`) and saves it to `localStorage`.
3. **Hybrid Hour Input (Quick Presets + Stepper + Tap-to-Type)**:
   - Tapping a **Selección rápida** preset (`0.5h`, `1h`, `1.5h`, `2h`, `3h`, `4h`) or `-0.5` / `+0.5` updates the hours without opening the keyboard.
   - Tapping the central hours number focuses the numeric field so the user can type any number directly.

---

## 3. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         InformeView (ReportView)                        │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Monthly Summary & Goal Header                                  │  │
│  │  ┌─────────────────────────────┐ ┌─────────────────────────────┐  │  │
│  │  │            (Clock)          │ │          (BookOpen)         │  │  │
│  │  │             14.5            │ │        [ - ]  3  [ + ]      │  │  │
│  │  │            Horas            │ │           Cursos            │  │  │
│  │  └─────────────────────────────┘ └─────────────────────────────┘  │  │
│  │  • Goal Selector: [Off] [15h] [30h] [50h] [100h] [Custom Input]   │  │
│  │  • 1-Tap "Share / Copy Monthly Report" Action                     │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 2. Inline Visual Monthly Calendar Grid (Mon–Sun)                  │  │
│  │  • Shows Logged Hours ("2.5h") & Credit Hours ("+4c") per Day     │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 3. Selected Day Inspector & Hybrid Hour Logger (No Timer)         │  │
│  │  • Existing Entries for Selected Date with 1-Tap Delete           │  │
│  │  • Quick Presets: [0.5h] [1h] [1.5h] [2h] [3h] [4h]               │  │
│  │  • Hybrid Stepper: [ -0.5 ]  [ Tappable Input ]  [ +0.5 ]         │  │
│  │  • Optional Note + Credit Hours Toggle + Save Button              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```
