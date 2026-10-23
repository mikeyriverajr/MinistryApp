# Morfo Cloud Code Explanation & WhatsApp Self-Messaging

Make the publisher's unique **Morfo Cloud Code (`MORFO-XXXXXX`)** unmistakably clear and safe to keep by explaining its dual role (automatic cloud backup key + partner schedule link) and providing a one-tap **Enviar por WhatsApp** action both when Cloud Sync is activated and permanently inside **Ajustes**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Both design preferences have been confirmed and incorporated into this plan:

- **Confirmed Placement**: Display a celebratory **Código Morfo** modal immediately when Cloud Sync is activated, **and** keep the explanation + WhatsApp button permanently accessible inside **Ajustes** (`Respaldo Automático en la Nube` and `Sincronización con Compañero`).
- **Confirmed WhatsApp Behavior**: Tapping **Guardar / Enviar por WhatsApp** opens WhatsApp directly (`https://api.whatsapp.com/send?text=...`) with a pre-filled message containing their `MORFO-XXXXXX` code and brief instructions so the pioneer can tap their own **"Tú (You)"** chat to save it or forward it directly to their spouse/partner.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Clearly explains in plain Spanish and English *why* the `MORFO-XXXXXX` code is important: it serves as the publisher's **personal cloud recovery key** (to restore all visits, Bible studies, and hours on a new phone) and as their **partner sharing code** (so their spouse or pioneering partner can view their schedule and study locations).
  2. Pops up a dedicated **"¡Guarda tu Código Morfo!"** modal the moment the user activates Cloud Sync for the first time, encouraging them to send it to their own WhatsApp chat right away.
  3. Displays a prominent **Código Morfo** badge inside the Cloud Backup card in **Ajustes** with quick actions to **Copiar código** and **Enviar a mi WhatsApp**.
- **Target Audience / Persona**: Pioneers and publishers using Morfo on Android PWAs and mobile browsers who want zero-friction cloud backups without risking losing their recovery code if they switch or reset phones.
- **Key Value**: Eliminates the single biggest risk of passwordless Cloud Code sync—forgetting the `MORFO-XXXXXX` code—by storing it safely in the user's own WhatsApp chat history in two taps.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **First-Time Activation Modal**:
     - User taps **Activar Nube y Sincronización** in **Ajustes**.
     - Once connected, a clean modal appears displaying their `MORFO-XXXXXX` code in large monospace type, a clear 2-bullet explanation of what the code does (Cloud Backup Recovery + Partner Sync), and a primary green **Guardar en mi WhatsApp** button alongside a **Copiar código** button.
  2. **Permanent Access in Ajustes**:
     - Inside the **Respaldo Automático en la Nube** section of **Ajustes**, the user's `MORFO-XXXXXX` code is prominently displayed with a short reminder (*"Tu llave personal de respaldo y código de compañero. Guárdalo en un lugar seguro."*) and one-tap **WhatsApp** and **Copiar** buttons.
  3. **WhatsApp Pre-Filled Message**:
     - Tapping the WhatsApp button opens WhatsApp with a clear, well-formatted message:
       > 🦋 *Mi Código Morfo de Respaldo y Sincronización:*
       > *MORFO-XXXXXX*
       > 
       > Guarda este mensaje en tu chat personal ("Tú"). Te servirá para restaurar todas tus revisitas, cursos bíblicos y horas en cualquier teléfono nuevo, o para vincular tu horario con tu compañero(a) de predicación.
- **Visual Identity & Theme**:
  - Follows Mobile & Touch-First ergonomics ($\ge 44\text{px}$ touch targets, `rounded-2xl` surface cards, crisp tabular/monospace typography for the code, and official WhatsApp emerald accent `#25D366` / `bg-emerald-600` for the WhatsApp action button).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Universal WhatsApp Deep Link (`https://api.whatsapp.com/send?text=...`)**
  - *Chosen Approach*: Trigger WhatsApp's universal share URL using an anchor link (`target="_blank" rel="noopener noreferrer"`) so it works reliably inside Android installed PWAs as well as mobile browsers without being blocked by iframe/popup restrictions.
  - *Why*: `window.open` can be blocked by Android standalone WebAPK containers, whereas an explicit user tap on an external deep-link or top-level navigation reliably launches the native WhatsApp app on Android and iOS.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Ajustes (Settings.tsx)                        │
├──────────────────────────────────────────────────────────────────────┤
│  1. Respaldo Automático en la Nube                                   │
│     ├─ Prominent Código Morfo Card (MORFO-XXXXXX)                    │
│     ├─ Explanation of Dual Purpose (Cloud Vault + Partner Schedule)  │
│     └─ Actions: [Guardar en WhatsApp]  [Copiar Código]               │
│                                                                      │
│  2. Modal: ¡Guarda tu Código Morfo! (Shown on Cloud Activation)      │
│     ├─ Explains why saving the code matters                          │
│     ├─ Highlights MORFO-XXXXXX                                       │
│     └─ Primary CTA: [Enviar a mi WhatsApp] / Secondary: [Ya lo guardé]│
└──────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `showMorfoCodeModal` state in `Settings.tsx`: Opens automatically when `handleConnectGoogle` completes (unless an existing cloud vault restore modal takes precedence, in which case the user can also view it right after).
  - `buildWhatsAppCodeUrl(code, language)` helper: Generates the URL-encoded WhatsApp deep link in Spanish or English matching the active app language.
  - Bilingual translations (`es` and `en`) added to `i18n.ts` for the explanation copy, modal titles, WhatsApp button labels, and pre-filled WhatsApp message text.
