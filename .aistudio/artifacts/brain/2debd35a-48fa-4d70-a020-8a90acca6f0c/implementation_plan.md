# Morfo — Reliability, Backup Recovery & Customization Upgrade

This plan addresses all identified core logic bugs, offline asset vulnerabilities, Android backup selection issues, and browser-wipe data loss risks in **Morfo**, while introducing Dark Mode, customizable color themes, accessibility font scaling, and flexible List/Grid view toggles.

## User Review & Critical Decisions

> [!IMPORTANT]
> This revised plan adds dedicated solutions for the two critical data-loss and Android restore issues you reported, alongside all previously selected improvements.

- **Confirmed Decision 1 (Fixing Android Grayed-Out Backup Files)**:
  - **Root Cause**: Android's native file picker (`DocumentsUI`) often assigns `application/octet-stream` or unknown MIME types to `.json` files downloaded from WhatsApp, Gmail, or file managers, causing `<input accept=".json,application/json,text/plain">` to gray them out so they cannot be tapped.
  - **Solution**: Remove the restrictive `accept` filter on the file input so **all files are selectable on Android**, validate the JSON structure in JavaScript after selection with clear error messages, support importing both `.json` and `.txt` backup files, and add a **"Paste Backup Text"** fallback option in case a user copies backup content directly from a message.
- **Confirmed Decision 2 (Protecting Against Browser Data Wipes)**:
  - **Root Cause**: Clearing browser site data wipes IndexedDB (`MinistryDB` and `MinistryBackupsDB`). If a user hasn't saved an external copy to their phone's storage or WhatsApp, their records are lost. Also, after a browser wipe, users are forced into the `SetupWizard` with no direct button to restore their backup.
  - **Solution**:
    1. **Browser Persistent Storage (`navigator.storage.persist()`)**: Request persistent storage permission on startup so the OS/browser never auto-evicts IndexedDB data under low disk space.
    2. **Restore Button Directly on Welcome Screen (`SetupWizard`)**: Add a prominent **"Restore from Backup"** button right on the initial setup screen so users who cleared their browser data can immediately restore their records in one step.
    3. **Smart Off-Device Backup Guard & 1-Tap Share (`navigator.share`)**: Track how many edits have occurred since the last external backup; display a non-intrusive status banner when changes aren't backed up off-device, and add a **1-Tap "Share / Save Backup"** action (using the mobile Web Share API so publishers can send the backup file straight to their own WhatsApp chat, Google Drive, or Downloads folder).
- **Confirmed Decision 3 (Core Bug Fixes & Data Integrity)**: Fix recurring study exception date math (`customDates`), synchronize monthly Bible course counts with active recurring studies, make calendar agenda items clickable, add edit/delete controls (plus optional next-visit scheduling) to follow-up visit history, replace external CDN map pins with offline-ready inline SVG markers, replace native `alert`/`confirm` dialogs with custom modals, and expose the 7-day internal daily snapshots (`MinistryBackupsDB`) in Settings.
- **Confirmed Decision 4 (Personalization & Accessibility)**: Add a full Dark Mode toggle (`light` / `dark`), four curated accent color themes (**Burnt Orange**, **Ocean Blue**, **Forest Green**, **Royal Purple**), a base text-size accessibility slider (`Small`, `Normal`, `Large`, `Extra Large`), and a **List vs. Card Grid** view toggle on the Interested Persons screen.

---

## 1. Overview & Core Concept

- **What It Does**: Evolves **Morfo** into a resilient, offline-dependable, and personalized field ministry organizer. Publishers can track interested persons, return visits, recurring Bible courses, territory map pins, and monthly hour reports with bulletproof backup/restore workflows on Android and iOS.
- **Target Audience / Persona**: Field ministry publishers operating across mobile and desktop devices—often outdoors in bright daylight or evening hours, and frequently sharing or restoring backups via WhatsApp or local Android Downloads.
- **Key Value**:
  - **Frictionless Android Recovery**: Backup files are never grayed out in Android's file picker, and users can restore right from the initial Welcome screen after clearing browser data.
  - **Proactive Off-Device Backup Protection**: Persistent storage API lock + unbacked-up change tracking + 1-tap native sharing to WhatsApp/Drive ensures publishers always have an external safety net before clearing browser cache.
  - **Seamless Daily Workflow**: Clickable agenda cards, editable/deletable return visit timeline entries, automatic next-visit date updates when logging a follow-up, and accurate monthly Bible course synchronization.
  - **True Offline & Accessibility Support**: Inline SVG map pins render without internet access, and adjustable font sizes, Dark Mode, and color themes make the app comfortable for all ages and lighting conditions.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Onboarding & Post-Wipe Recovery (`SetupWizard`)**:
   - When opening the app with an empty database (first time or after clearing browser data), the Welcome card offers both **"Start Fresh (Enter Name)"** and a prominent **"Already have a backup? Restore Data"** button (supporting file pick or pasted backup text).
2. **Proactive Off-Device Backup & Android Restore (`Settings` & `Dashboard`)**:
   - **1-Tap Share & Download**: In Settings (and the backup reminder modal), users can either **Download Backup File** (to `Downloads`) or **Share Backup** (opens native Android/iOS share sheet to send the `.json` file to WhatsApp "Message Yourself", Google Drive, or Email).
   - **Unbacked-up Changes Indicator**: When new visits or hours are saved, the app increments a local "changes since last external backup" counter. If $\ge 5$ changes accumulate or 7+ days pass with unsaved changes, a gentle banner on the Dashboard prompts a 1-tap backup.
   - **Universal File Picker + Paste Fallback**: Tapping **Import Data** opens the system file selector without restrictive MIME filters so `.json` files in Android Downloads or WhatsApp folders are always selectable. Users can also expand a **"Paste Backup Content"** box if they copied the backup text directly.
   - **Automatic Daily Internal Snapshots**: Lists up to 7 rolling daily snapshots in IndexedDB for instant rollback of accidental edits or deletions within the app.
3. **Dashboard & Agenda Navigation**:
   - Opening the Dashboard shows accurate monthly hours and active Bible courses (automatically carrying over active recurring studies into a new month while preserving manual adjustments).
   - Tapping any visit card in **Today's Visits** or any scheduled event in the **Weekly Agenda (Calendar)** navigates directly to that person's record.
4. **Person Record & Follow-Up History Management**:
   - When logging a **New Visit (Follow-up)**, publishers can optionally set or update the **Next Visit Date** in the same form.
   - Each entry in the **Visit History** timeline includes **Edit** and **Delete** icon actions (minimum $44 \times 44\text{px}$ touch targets) with an inline edit mode and a non-blocking confirmation modal.
   - Changing a recurring Bible course schedule for **"Just the next time"** accurately computes the upcoming occurrence of the original study day, maps it to the new exception date/time, and prunes expired exceptions.
5. **Interested Persons Directory (List vs. Grid View)**:
   - A segmented view toggle in the directory header switches between a **Card View** (detailed notes, house description, and dates) and a **Compact List View** (high-density rows showing name, interest indicator, and next visit date for rapid scanning of large lists).
6. **Settings: Appearance & Accessibility**:
   - **Appearance Panel**: Toggle Dark Mode, select from 4 accent color presets, and adjust the **Text Size Slider** (`92%`, `100%`, `112%`, `125%`) with instant live preview.

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian, high-contrast mobile-first touch interface that scales cleanly to multi-column desktop layouts (`max-w-5xl` container on desktop with responsive 2-column grids where appropriate) while keeping the 15% sticky surface cap on mobile.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Neutral Canvas**: Crisp light slate (`#f8fafc` in Light Mode) and deep carbon slate (`#0f172a` in Dark Mode).
  - **30% Structural Surfaces**: Pure white cards (`#ffffff`) with subtle hairline borders (`#e2e8f0`) in Light Mode; elevated slate surfaces (`#1e293b`) with `#334155` hairline borders in Dark Mode.
  - **10% Dynamic Accent Budget (`--color-primary` & `--color-primary-dark`)**:
    - **Burnt Orange (Default)**: `#e07a5f` / `#c45b42`
    - **Ocean Blue**: `#2563eb` / `#1d4ed8`
    - **Forest Green**: `#059669` / `#047857`
    - **Royal Purple**: `#7c3aed` / `#6d28d9`
- **Typography & Hierarchy**:
  - Clean sans-serif hierarchy with `tabular-nums` applied to all hour counters, dates, coordinates, and monthly statistics.
  - Root `<html>` font-size scaling driven by the accessibility setting (`92%` to `125%`) so all `rem`-based Tailwind typography scales proportionally.
  - Static metadata (dates found, interest labels, course tags) rendered as clean text with `·` separators; no thick left accent borders (`border-l-4` replaced with clean all-around hairline borders and subtle status indicators).
- **Interactive Feedback & Motion**:
  - All native `window.alert` and `window.confirm` calls replaced with accessible custom confirmation modals and `react-hot-toast` notifications.
  - Touch hitboxes $\ge 44 \times 44\text{px}$ across navigation tabs, timeline edit/delete buttons, and map controls.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removing `accept` MIME Restrictions on File Input for Android Compatibility**
  - *Chosen Approach*: Omit the `accept` attribute on `<input type="file" />` (defaulting to all file types) and perform client-side JSON validation (`file.text()` $\rightarrow$ verify `formatName === 'dexie'` or valid table structure before calling `importDatabase`).
  - *Why*: Android's SAF file picker frequently disables `.json` files when `accept=".json,application/json"` is specified because messaging apps and browsers tag downloaded `.json` files as `application/octet-stream` or vendor-specific types. Validating in JS guarantees the user can tap any backup file on any Android version while still preventing invalid files from corrupting the database.
- **Decision 2: Layered Defense Against Browser Data Wipes**
  - *Chosen Approach*: Combine `navigator.storage.persist()` (prevents automatic OS storage eviction), unbacked-up change tracking (`pendingBackupChanges`), native Web Share API export (`navigator.share` with `.json` file attachment), and direct restore on `SetupWizard`.
  - *Why*: While no web app can block a user from manually clearing site data in browser settings, prompting a 1-tap share to WhatsApp/Downloads after meaningful edits ensures an off-device copy exists, and putting a Restore button on the initial Setup screen makes recovery effortless if a wipe occurs.
- **Decision 3: CSS Custom Properties for Dynamic Theme & Dark Mode**
  - *Chosen Approach*: Define `--color-primary` and `--color-primary-dark` on `:root` updated via `SettingsContext`, and toggle a `.dark` class on `<html>` with semantic surface classes.
  - *Why*: Allows instant, zero-flash theme switching across all components, buttons, datepickers, and active states.
- **Decision 4: Inline SVG DivIcons for Leaflet Map Markers**
  - *Chosen Approach*: Replace external GitHub/CDN PNG marker URLs with custom Leaflet `L.divIcon` SVG pins colored by interest level (`Alto`, `Medio`, `Bajo`, and `User Location`).
  - *Why*: Eliminates external network dependencies so territory maps and pins render reliably when offline.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        App Shell & Context Layer                        │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │   SettingsContext   │  │   LanguageContext    │  │ Backup &       │  │
│  │ • timeFormat        │  │ • language ('es'|'en')│  │ Storage Guard  │  │
│  │ • themeColor        │  │ • Complete i18n keys │  │ • storage.     │  │
│  │ • darkMode          │  └──────────────────────┘  │   persist()    │  │
│  │ • fontScale         │                            │ • Web Share API│  │
│  │ • personsViewMode   │                            │ • JSON/Text    │  │
│  └──────────┬──────────┘                            │   Validator    │  │
└─────────────┼───────────────────────────────────────┴───────┬────────┘  │
              │                                               │           │
              ▼                                               ▼           │
┌──────────────────────────────────────────────────┐  ┌───────────────────┐
│              Core Application Views              │  │ Local IndexedDB   │
│                                                  │  │                   │
│  ┌──────────────┐  ┌──────────────────────────┐  │  │ ┌───────────────┐ │
│  │ SetupWizard  │  │        Dashboard         │  │  │ │  MinistryDB   │ │
│  │ • New Profile│  │ • KPI Cards & Synced     │  │  │ │ • userProfile │ │
│  │ • Direct     │  │   Bible Course Count     │  │◄─┼─┤ • visits      │ │
│  │   Backup     │  │ • Smart Unsaved-Changes  │  │  │ │ • timeEntries │ │
│  │   Restore    │  │   Backup Banner          │  │  │ │ • monthlyStats│ │
│  └──────────────┘  └────────────┬─────────────┘  │  │ └───────────────┘ │
│                                 │                │  │                   │
│  ┌──────────────┐  ┌────────────▼─────────────┐  │  │ ┌───────────────┐ │
│  │ CalendarView │  │       PersonRecord       │  │  │ │MinistryBackups│ │
│  │ • Week Strip │─►│ • Exception Schedule Math│  │  │ │ • snapshots   │ │
│  │ • Clickable  │  │ • Follow-Up Edit/Delete  │  │◄─┼─┤   (7-day ring)│ │
│  │   Agenda     │  │ • Next-Visit Auto-Update │  │  │ └───────────────┘ │
│  └──────────────┘  └──────────────────────────┘  │  └───────────────────┘
│                                                  │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │
│  │   MapView    │  │Interested  │  │ Settings │  │
│  │ • Offline SVG│  │  Persons   │  │ • Themes │  │
│  │   Markers    │  │ • List/Grid│  │ • Android│  │
│  └──────────────┘  └────────────┘  │   Restore│  │
│                                    └──────────┘  │
└──────────────────────────────────────────────────┘
```

### Data Model & State

- **`SettingsContext` (Persisted in `localStorage` & synced to DOM `:root`)**:
  - `timeFormat`: `'12h' | '24h'`
  - `darkMode`: `boolean` (toggles `.dark` class on `document.documentElement`)
  - `themeColor`: `'orange' | 'blue' | 'green' | 'purple'` (updates `--color-primary` and `--color-primary-dark` CSS variables)
  - `fontScale`: `'sm' | 'md' | 'lg' | 'xl'` (sets root `fontSize` to `92%`, `100%`, `112%`, `125%`)
  - `personsViewMode`: `'cards' | 'list'`
- **Backup & Persistence Metadata (`localStorage` + `database.ts`)**:
  - `pendingBackupChanges`: Counter incremented whenever visits or time entries are added/updated/deleted; reset to `0` on external export or share.
  - `lastBackupDate`: ISO timestamp of the last external export/share.
  - `storagePersisted`: Boolean status returned by `navigator.storage.persist()`.
  - `validateAndImportDatabase(fileOrJsonString)`: Validates JSON integrity before wiping/importing into Dexie, supporting both `File` objects (any extension/MIME type on Android) and raw pasted JSON strings.
  - `shareDatabaseBackup()`: Generates the backup file and invokes `navigator.share({ files: [file], title: 'Morfo Backup' })` when supported by the mobile browser, falling back to standard file download.
- **`MinistryDB` (`Visit` entity in IndexedDB)**:
  - Preserves existing schema (`v4`) for full backward compatibility with exported JSON backups.
  - `followUpVisits`: Array of `{ id: string, date: Date, notes: string }` with full create, update, and delete support.
  - `customDates`: Array of `{ originalDate: Date, newDate: Date }` normalized to midnight comparisons for `originalDate` and full year-month-day matching across `Dashboard`, `CalendarView`, and `PersonRecord`.
- **`MinistryBackupsDB` (`InternalSnapshot` in IndexedDB)**:
  - Exposes `getAvailableSnapshots()` and `restoreSnapshot(dateStr: string)` helpers so users can view and restore any of the last 7 daily automatic backups, and clears snapshots when "Delete all data" is confirmed.

### Interactive Component & State Mapping

- **`SetupWizard`**:
  - Adds a **"Restore from Backup"** secondary action right below the welcome form so users whose browser data was wiped can select a backup file (or paste backup text) immediately without creating a dummy profile first.
- **`Dashboard`**:
  - Displays a compact **"Unsaved Changes — Tap to Back Up"** banner when `pendingBackupChanges >= 5` (or when the scheduled reminder is due), allowing 1-tap download or WhatsApp/Drive share.
- **`CalendarView`**:
  - Each event row in `combinedSelectedEvents` is wired with `onClick={() => navigate('/person/' + event.id)}`, keyboard accessibility, and hover feedback.
- **`PersonRecord`**:
  - **Add Follow-Up Form**: Includes an optional "Next Visit Date" picker that updates `visit.nextVisitDate` simultaneously when saving the follow-up.
  - **Timeline Items**: Each `FollowUpVisit` card includes Edit (opens inline date + notes editor) and Delete (opens confirmation modal) controls.
  - **Delete Person Modal**: Replaces `window.confirm` with an in-app confirmation modal.
- **`InterestedPersons`**:
  - **View Mode Toggle**: Segmented button group switching between detailed Card Grid (`grid-cols-1 md:grid-cols-2 gap-4`) and compact single-line List Rows.
- **`MapView` & `VisitForm`**:
  - **Offline SVG Markers**: Uses a shared `createSvgMarker(color)` utility generating crisp inline SVG map pins without external image requests.
  - Replaces `alert(...)` with `toast.error(t('locationError'))`.
- **`Settings`**:
  - **Appearance & Accessibility Card**: Interactive controls for Dark Mode switch, 4 color theme swatches, and 4-step font size slider.
  - **External Backup & Restore Card**:
    - Unrestricted file picker (`<input type="file" />` without MIME lockouts) so Android never grays out `.json` files.
    - **Share Backup** button (`navigator.share`) alongside **Export Backup**.
    - **Paste Backup Text** expandable modal/drawer for restoring copied JSON text.
    - Storage protection status badge (`navigator.storage.persist()`).
  - **Automatic Daily Backups Card**: Lists saved snapshots from `backupsDb.snapshots` with date, size, and a one-tap **Restore** action confirmed via modal.
