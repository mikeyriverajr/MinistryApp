# Morfo — Automatic Cloud Backup, Optional Partner Sync & Flapping Butterfly Splash

This plan upgrades **Morfo** with **Automatic Firebase Cloud Backup**, **Optional Pioneer Partner / Spouse Sharing** (configured in **Ajustes**, with independent toggles for each partner to show or hide the other person's schedule and map pins), and a **3D Animated Flapping Morpho Butterfly Splash Screen**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Firebase has been provisioned (`gen-lang-client-0766777124`), and all of your requirements—including making Partner Sharing 100% optional in **Ajustes** and allowing each partner to independently toggle whether they see the other person's data—are built into the architecture below.

- **Decision 1 (Automatic Cloud Backup + Offline-First Local DB)**:
  - **How it works**: Local `IndexedDB` (`Dexie`) remains the primary engine so the app opens instantly even with zero cell signal in rural territories.
  - When a user signs in with their Google account (either on the **Welcome / Setup screen** or in **Ajustes**), **Morfo** automatically backs up their entire database (visits, Bible courses, follow-ups, and hours) to their private Firebase Cloud Vault whenever a change is made, and restores it automatically if browser data is ever wiped or on a new phone.
  - **Ultra-Low Quota Design**: We store each publisher's personal backup in a single compact document (`userVaults/{uid}`) and their shared schedule/pins in a single partner document (`partnerShares/{shareCode}`). This uses only **1–2 reads on startup** and **1 write per change**, keeping usage under **0.05%** of Firebase's 50,000 free daily reads.
- **Decision 2 (Optional Partner Sharing in Ajustes + Independent Visibility Toggles)**:
  - Partner sharing is **completely optional** and lives in a dedicated **"Compañero / Cónyuge de Predicación" (*Pioneer Partner*)** section inside **Ajustes (`Settings`)**.
  - **Linking**: Partner A taps **"Generate Partner Code"** (e.g., `MORFO-842`) and shares it with Partner B, who enters the code in their **Ajustes**. Either partner can unlink at any time.
  - **Independent Visibility Toggle**: Each partner has their own **"Ver datos de mi compañero" (*Show partner's data*)** master switch in **Ajustes** (plus quick filter pills in **Agenda** and **Mapa**). If a husband turns the toggle ON while driving to his wife's studies, he sees her map pins and schedule; if he turns it OFF during his own personal study or ministry, her pins and agenda items are completely hidden on his phone without affecting her phone.
- **Decision 3 (Live Schedule Conflict Alert & Partner Map Navigation)**:
  - When **"Show partner's data"** is enabled:
    - **At the Door (`VisitForm` & `PersonRecord`)**: Selecting a Next Visit date/time or recurring Bible Course day/time automatically checks your partner's schedule and displays a non-blocking **Schedule Conflict Banner** if your partner already has a study or visit within 60 minutes of that time.
    - **Agenda (`CalendarView`)**: Displays your partner's scheduled visits/courses with a distinct badge (`Compañero: [Nombre]`) in read-only mode so you never accidentally overwrite their notes.
    - **Territory Map (`MapView`)**: Displays your partner's pins with a distinct marker style and a **"Navigate"** button so you can drive directly to their Bible course or return visit from your phone.
- **Decision 4 (3D Animated Flapping Morpho Butterfly Splash Screen)**:
  - Creates a multi-part vector **Morpho Butterfly Component** with hinged left and right wings that flap smoothly in 3D perspective (`rotateY` + gentle vertical float).
  - Shows a graceful `1.4s` animated splash overlay when the app launches, and also features the live flapping butterfly on the **Setup / Welcome screen** and header logo.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Eliminates data loss when clearing browser data by automatically syncing to Firebase Cloud when signed in, while keeping manual file export/restore as an offline fallback.
  2. Lets married couples or pioneering partners optionally link their apps in **Ajustes**, detect scheduling conflicts at the door, and navigate to each other's Bible studies on the map—with an independent toggle to show or hide partner data anytime.
  3. Brings the **Morfo** brand to life with a 3D flapping butterfly splash animation.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Animated Flapping Butterfly Launch**:
   - Upon opening **Morfo**, a smooth splash screen displays the orange Morpho butterfly flapping its wings in 3D space above the **Morfo** wordmark, then softly fades into the Dashboard.
2. **1-Tap Google Sign-In for Automatic Cloud Backup (`SetupWizard` & `Settings`)**:
   - On the **Welcome Screen** (if browser data was wiped) or in **Ajustes**, tapping **"Conectar con Google (Respaldo Automático en la Nube)"** signs the user in.
   - If a cloud backup already exists for their Google account, Morfo immediately offers to restore all their records in one tap.
   - Once connected, a green **"Respaldo en la nube activo (Sincronizado)"** badge appears in **Ajustes**, and the "Unsaved Changes" warning banner is automatically satisfied whenever cloud sync completes.
3. **Optional Partner Setup & Visibility Toggle (`Settings` -> `CalendarView` / `MapView` / `VisitForm`)**:
   - In **Ajustes**, under **"Compañero de Predicación (Opcional)"**:
     - You can copy/share your **6-character Partner Code** or enter your partner's code to link.
     - Once linked, you see **"Conectado con [Nombre]"** and a prominent switch: **"Mostrar agenda y mapa de [Nombre] en mi app"** (`ON` / `OFF`).
   - When switched **ON**:
     - **Mapa** and **Agenda** include a quick filter bar: **`Todos` | `Solo míos` | `De [Compañero]`**.
     - **Nuevo/Editar Registro (`VisitForm`)** warns you immediately if a chosen day & time overlaps with your partner's schedule.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Local IndexedDB (Dexie — Offline First)                  │
│   • userProfile, visits, timeEntries, monthlyStats                         │
└──────────────┬──────────────────────────────────────────────┬──────────────┘
               │ Automatic Background Sync                    │ Partner Sync
               ▼ (1 Doc per User)                             ▼ (1 Doc per Code)
┌─────────────────────────────────────────┐  ┌───────────────────────────────┐
│   Firestore: /userVaults/{userId}       │  │ Firestore: /partnerShares/{id}│
│   • Strictly private (isOwner only)     │  │ • Sanitized schedule & GPS    │
│   • Full automatic backup of visits,    │  │   pins (NO personal hours)    │
│     studies, follow-ups & hours         │  │ • Accessible by owner or      │
│   • Auto-restores if browser is wiped   │  │   linked partner UID          │
└─────────────────────────────────────────┘  └───────────────┬───────────────┘
                                                             │
                                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 Partner Visibility & Conflict Engine (React)               │
│   • Settings Toggle: showPartnerData (ON / OFF per device)                 │
│   • VisitForm & PersonRecord: Real-time 60-min overlap conflict detector   │
│   • MapView & CalendarView: Read-only partner pins + Google Maps navigation│
└────────────────────────────────────────────────────────────────────────────┘
```

### Security & Privacy (`firestore.rules` & `firebase-blueprint.json`)
- **`/userVaults/{userId}`**: Strictly locked to `request.auth.uid == userId` with verified email and strict schema/size validation. Nobody else—not even a linked partner—can read your private vault or your monthly hours report.
- **`/partnerShares/{shareCode}`**: Contains only the publisher's display name and their sanitized list of visits/studies (schedule times, GPS coordinates, house description, and study status) so the partner's phone can check schedule conflicts and navigate on the map.
