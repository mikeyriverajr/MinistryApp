# Recommended Improvements & Upgrades for Ministry Organizer

This document outlines proposed upgrades and new features for the Ministry Organizer application. The focus is on enhancing collaboration, increasing user customization, and providing general architectural improvements while maintaining a local-first, privacy-focused approach.

## 1. Partner Agenda Sharing (Live & Async)

### The Goal
Allow two publishers (e.g., a married couple) to view each other's schedules to avoid conflicts. The solution must be "live" but should **not** require the developer to maintain or pay for a traditional backend database (like Firebase or Supabase).

### The Proposed Architecture: Encrypted JSON Bins
Because pure WebRTC requires both users to have the app open simultaneously (which isn't practical for checking a schedule on the go), we recommend using a free, lightweight "JSON Bin" service (like JSONBin.io, GitHub Gists via API, or a free MQTT broker).

1. **Local-First, Cloud-Relayed:** The primary database (Dexie) remains entirely local.
2. **End-to-End Encryption (E2EE):** Before data leaves Publisher A's device, the app encrypts the schedule data using a secret PIN.
3. **Anonymized Payload:** The app only uploads necessary scheduling data (e.g., Date, Time, Type of Visit). It can omit sensitive PII (names, exact coordinates, notes) to ensure privacy.
4. **Relay:** The encrypted JSON is uploaded to a free JSON bin URL.
5. **Consumption:** Publisher B's app fetches the JSON from that URL, decrypts it locally using the shared PIN, and overlays it on their calendar.

### User Experience (UX) Flow
*   **Linking (Settings Tab):**
    *   Publisher A goes to Settings and clicks "Share My Calendar". The app generates a unique ID and a 4-to-6 digit PIN.
    *   Publisher B goes to Settings, clicks "Add Partner Calendar", and inputs Publisher A's ID and PIN.
*   **Viewing (Agenda/Calendar Tab):**
    *   Publisher B's Agenda view now has a toggle switch: "Show Partner's Schedule".
    *   **Color Coding:** To prevent confusion, the partner's events will be displayed in a distinctly different color (e.g., User's events in Burnt Orange `#e07a5f`, Partner's events in Teal or Slate Blue).
*   **Unlinking (Settings Tab):**
    *   Publisher B can go back to Settings and click "Remove Partner Calendar". This deletes the connection locally and stops fetching the data. It does *not* affect Publisher A's actual data or app.

---

## 2. UI/UX Customizations

Currently, the app has a fixed design (Burnt Orange and Slate Gray). Adding customization options allows publishers to tailor the app to their preferences and accessibility needs.

### Recommended Customization Options:
*   **Color Themes:** Allow users to switch the primary accent color from Burnt Orange to other pleasant presets (e.g., Ocean Blue, Forest Green, or Purple).
*   **Dark Mode:** Implement a full Dark Mode toggle. This is highly requested for apps used outdoors or during evening ministry.
*   **View Toggles (Personas Screen):** Add a toggle to switch the "Interested Persons" list between a compact List View (good for many records) and a Card/Grid View (good for seeing more details at a glance).
*   **Text Size / Accessibility:** Add a slider in Settings to adjust the base text size of the app, aiding older publishers who might struggle with small fonts on mobile screens.
*   **Map Layer Preferences:** Allow users to set their default map layer (e.g., Default to Street View instead of Hybrid) so they don't have to switch it every time they open the map.

---

## 3. General App Upgrades & Future Considerations

While the current app is solid, these additions would further enhance its utility as a ministry tool:

*   **Reporting & Statistics:** Add a monthly summary screen that calculates total time spent on studies, number of new visits added, and visual charts of their activity. This helps publishers track their monthly goals.
*   **Offline Territory Maps:** Currently, Leaflet relies on an active internet connection to fetch map tiles. Implementing a feature to cache a specific bounding box (their assigned territory) for offline use would make the map functional in areas with poor cellular service.
*   **Security (App Lock):** While deferred for now, a future upgrade could include an App PIN Lock screen upon opening the app, ensuring that if the user's phone is unlocked and handed to someone else, the sensitive PII (notes, addresses) remains protected.
*   **Bulk Actions:** Allow users to select multiple visits at once on the Personas screen to update their status, change interest levels, or delete them in bulk.
