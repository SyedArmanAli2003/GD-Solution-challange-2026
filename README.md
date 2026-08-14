# ResQNet — Smart Crisis Response Platform

> **Google Solution Challenge 2026** · Built with InsForge (PostgreSQL) · Powered by Multi-Model AI (DeepSeek / Llama)

---

## 🆘 What is ResQNet?

**ResQNet** is a real-time community crisis response and resource-allocation platform designed to bridge the gap between people who need emergency help and the coordinators + volunteers who can deliver it. In disaster-prone or resource-constrained communities, traditional emergency channels are often slow, opaque, or inaccessible. ResQNet solves this by combining:

- A **citizen-facing reporter app** to send structured SOS reports in seconds
- A **coordinator dashboard** powered by Gemini AI to triage, prioritize, and dispatch volunteers
- A **volunteer registry** so field responders can self-register and be matched to incidents automatically
- A **community resources hub** with local helplines and crowd-sourced resource listings

All data is synchronized in real-time via InsForge (PostgreSQL), making the platform resilient and responsive even during fast-moving crises.

---

## 🎯 Problem Statement

Every year, thousands of people in under-served communities face emergencies — floods, medical crises, conflict, displacement — where first responders either don't receive timely information or can't efficiently allocate limited volunteers and resources. Manual coordination (calls, WhatsApp groups, spreadsheets) is error-prone and slow.

**ResQNet solves three root problems:**
1. **Fragmented reporting** — citizens have no structured way to report local crises
2. **Slow triage** — coordinators can't quickly judge severity across multiple incoming reports
3. **Inefficient dispatch** — volunteers are assigned manually without proximity or skill matching

---

## ✨ Key Features

### 🏠 Landing Page (`index.html`)
- Animated dark-mode hero with a live blinking "Crisis Response Network" badge
- Two clear entry points: **"I need help"** (citizen) and **"I'm a coordinator"**
- System status pills (operational · real-time sync · secure login)
- Responsive layout that stacks on mobile

---

### 🔐 Authentication (`auth.html`)
- **Tabbed UI** — Sign In / Create Account on a single page
- **Email/Password sign-in** with Firebase Auth
- **Google OAuth sign-in** via popup — one-click onboarding
- **Forgot password** flow with email reset link
- Account creation stores full profile (name, phone, address, role) to the InsForge `users` table
- Auto-redirect if already signed in
- Friendly inline error messages for all common failure modes

---

### 📡 Reporter Dashboard (`reporter.html`)
The main interface for citizens and field users after sign-in.

#### SOS Button
- Giant hold-to-activate circle button with an animated SVG progress ring
- Hold for **2 seconds** to trigger the report flow — prevents accidental submissions
- On hold: button scales down, progress ring fills

#### GPS & Reverse Geocoding
- Automatically captures GPS coordinates via the browser Geolocation API
- Uses **Nominatim (OpenStreetMap)** to resolve coordinates → a human-readable address
- Falls back gracefully if GPS is denied

#### Voice-to-Text Recording
- In-modal microphone button using the **Web Speech API**
- 15-second countdown with live status updates
- Captured transcript is stored alongside the report for AI triage context

#### Crisis Category Selection
Five incident types, each mapped to a triage level:
| Category | Icon | Default Triage |
|----------|------|---------------|
| Medical | 🏥 | Critical (Level 1) |
| Disaster | 🌊 | Severe (Level 2) |
| Conflict | ⚔️ | Moderate (Level 3) |
| Resource | 📦 | Minor (Level 4) |
| Hospitality | 🏠 | Monitoring (Level 5) |

#### Multi-Model AI Triage
After submission, the Express backend calls our **AI Cascade Engine**, which attempts:
1. **DeepSeek V4 Flash** (via NVIDIA NIM)
2. **Llama 3.3 70b Instruct** (via OpenRouter)
3. **Mistral 7b Instruct** (via OpenRouter)

- Incident type, description, voice transcript, and location are passed
- Returns a structured JSON: `{ level, levelName, color, reasoning, volunteerTypes, estimatedMinutes }`
- The triage result is saved back to InsForge and shown in the success modal
- A **fallback rule engine** activates if all AI models fail (keyword-based heuristics)

#### Incident Feed
- Live Firestore `onSnapshot` listener — no page refresh needed
- Active incidents rendered as cards sorted by severity
- Each card shows: level, time, type, location, description
- "Mark resolved" button on each card updates Firestore status to `resolved`
- Real-time stats: active / deployed / resolved counts in the header

#### Timeline Logging
- Every significant event (report created, triage complete) writes a subcollection entry in `incidents/{id}/timeline`
- Actor, action, details, and server timestamp are recorded

---

### 🎛️ Coordinator Dashboard (`coordinator.html`)

The command-and-control center for verified coordinators, protected by Firebase email/password authentication.

#### Sidebar Navigation
| Panel | Description |
|-------|-------------|
| Live Incidents | Real-time feed sorted by triage severity |
| Volunteers | View, filter, and dispatch volunteers |
| Report a Need | Submit an incident directly from the dashboard |
| History | Browse all past incidents with status filters |
| Insights | Charts, maps, and community analytics |
| Settings | Profile, notifications, triage self-test |

#### Live Incidents Panel
- Fetches all `incidents` ordered by `timestamp` in real-time
- Cards are sorted by AI-assigned triage level (Critical first)
- Each card shows:
  - Color-coded left border matching triage level
  - Triage badge (Level + name) with model badge (G3 / G2.5)
  - Location, description, AI reasoning
  - Assigned volunteer chip (if dispatched)
  - Suggested volunteer buttons ranked by match score

#### AI Triage System (5-Level)
The dashboard's fallback triage engine (`fallbackTriageForType`) auto-assigns levels to stale pending incidents (>5 min without a result):
- **Level 1 — Critical** (red) — Life-threatening, bleeding, cardiac, explosion
- **Level 2 — Severe** (orange) — Major injury, flood, violence
- **Level 3 — Moderate** (yellow) — Conflict, property risk
- **Level 4 — Minor** (green) — Resource shortages
- **Level 5 — Monitoring** (gray) — Support / hospitality needs

#### Smart Volunteer Matching
The **match scoring algorithm** ranks available volunteers per incident using:

```
Score = Skill Match (0-70) + GPS Proximity (0-50) + Urgency Bonus (0-10)
```

- **Skill match**: 70 points if the volunteer's skill aligns with incident type
- **GPS proximity** (Haversine formula):
  - ≤ 2 km → +50 pts
  - ≤ 5 km → +35 pts
  - ≤ 15 km → +20 pts
  - ≤ 30 km → +10 pts
- **Urgency bonus**: +10 pts if triage level is 1 or 2
- Falls back to text-based location matching when GPS coords unavailable

**Dispatch action** — clicking a volunteer button:
1. Updates `incidents/{id}` with volunteer name, skill, `assignedAt`
2. Updates `volunteers/{id}` to `available: false`
3. Writes a `dispatched` timeline entry

#### Auto-Dispatch
Clicking **"Auto-dispatch top matches"** in the Operations panel finds the single highest-scoring unassigned volunteer for each unresolved incident and dispatches them automatically.

#### Insights Panel
- **Incident Type Breakdown** — Chart.js pie chart
- **Severity Distribution** — Bar chart by triage level
- **Most Affected Areas** — Ranked list of location frequency
- **Incidents Over Time** — 7-day trend line chart
- **Incident Heatmap** — Leaflet.js interactive map with clustered markers (color-coded by triage level)
- **Download CSV Report** — One-click export of all incident data

#### History Panel
- Filter by All / Pending / Resolved
- Shows totals for each status
- Live-updated from Firestore

#### Settings Panel
- Display name editor
- Notification preference toggle
- **Triage Self-Test** — Runs 5 deterministic test cases (one per level) and displays pass/fail results for validating the Gemini/fallback pipeline
- Sign Out

#### Right Sidebar Stats
- Today's Active / Deployed / Resolved counts (real-time)
- **Average response time** calculated from `assignedAt` → `resolvedAt` timestamps
- AI Triage Queue counter — incidents awaiting a triage result

---

### 👥 Volunteers (`volunteers.html`)
Public-accessible page (uses Firebase Anonymous Auth to write to Firestore).

#### Register as Volunteer
Form fields:
- Full Name
- Phone Number
- Primary Skill (Medical / Rescue / Supply / Coordination)
- Location (auto-captured via GPS + Nominatim reverse geocode, or manual)
- Currently Available toggle

Volunteer documents saved to Firestore `volunteers` collection with GPS coordinates for proximity matching.

#### Active Volunteers List
- Live Firestore listener — updates without refresh
- Filter buttons: All / Medical / Rescue / Supply
- Each card shows: initials avatar, name, skill, location, availability dot (green = available, orange = busy)

---

### 📦 Resources (`resources.html`)
Community resource directory — also uses Anonymous Auth.

#### Emergency Helplines (Static)
Quick-dial cards for:
- Medical Emergency — **108**
- Police — **100**
- Fire Brigade — **101**
- Disaster Relief NDRF — **1078**
- Local Ambulance (Durgapur) — **0343-2546000**

Each card links to `tel:` for one-tap calling on mobile.

#### Community Resources (Dynamic)
- Live-synced list from Firestore `resources` collection
- "+ Add Resource" button opens a modal form:
  - Name, Type (NGO / Medical / Shelter / Food), Contact, Address
- Submitted resources appear instantly for all users

---

### 📋 History (`history.html`)
Standalone incident history viewer (also accessible from the reporter sidebar).

---

### 👤 Account Settings (`account.html`)
Profile management page for signed-in users.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ResQNet Web App                       │
│  index.html → auth.html → reporter.html / coordinator.html  │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────▼─────────────────┐
          │     Express.js API Server        │
          │  (Triage, Dispatch & Static)     │
          └────────────────┬─────────────────┘
                           │
          ┌────────────────▼─────────────────┐
          │        InsForge Backend          │
          │  ┌──────────────────────────────┐ │
          │  │  Authentication (JWT)        │ │
          │  │  (Email/Password + Google)   │ │
          │  └──────────────────────────────┘ │
          │  ┌──────────────────────────────┐ │
          │  │  PostgreSQL (RLS policies)   │ │
          │  │  ├── incidents               │ │
          │  │  ├── incident_timeline       │ │
          │  │  ├── volunteers              │ │
          │  │  ├── resources               │ │
          │  │  └── users                   │ │
          │  └──────────────────────────────┘ │
          └────────────────┬─────────────────┘
                           │
          ┌────────────────▼─────────────────┐
          │         External APIs             │
          │  ├── NVIDIA NIM (DeepSeek V4)     │
          │  ├── OpenRouter (Llama / Mistral) │
          │  ├── Nominatim (Reverse Geocode)  │
          │  ├── Leaflet.js (Incident Map)    │
          │  └── Web Speech API (Voice Input) │
          └──────────────────────────────────┘
```

### Firestore Collections

| Collection | Description |
|-----------|-------------|
| `incidents` | All incident reports with triage data |
| `incidents/{id}/timeline` | Chronological audit log per incident |
| `volunteers` | Registered field volunteers with skills + GPS |
| `resources` | Community-submitted emergency resources |
| `users` | Reporter profiles created on sign-up |

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES Modules) |
| Typography | Google Fonts — Inter |
| Auth | Firebase Authentication (Email/Password, Google OAuth, Anonymous) |
| Database | Firebase Cloud Firestore (real-time listeners) |
| AI Triage | Google Gemini API (2.5 Flash → 1.5 Flash fallback) |
| Maps | Leaflet.js + OpenStreetMap tiles |
| Charts | Chart.js (pie, bar, line) |
| Geocoding | Nominatim / OpenStreetMap Reverse Geocoding |
| Voice | Web Speech API (browser-native) |
| Deployment | Docker · Google Cloud Run |
| Version Control | Git / GitHub |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (for a local dev server — optional)
- A Firebase project with Firestore and Authentication enabled
- A Gemini API key (from [Google AI Studio](https://aistudio.google.com))

### 1. Clone the Repository
```bash
git clone https://github.com/SyedArmanAli2003/GD-Solution-challange-2026.git
cd GD-Solution-challange-2026
```

### 2. Configure Firebase
Copy the example config and fill in your credentials:
```bash
cp config.example.js config.js
```

Edit `config.js`:
```js
const CONFIG = {
  GEMINI_API_KEY: "your-gemini-api-key-here"
};
```

> **Note:** The Firebase config is currently embedded inline in each HTML file. Update the `firebaseConfig` objects in `reporter.html`, `coordinator.html`, `volunteers.html`, `resources.html`, and `auth.html` with your own Firebase project credentials.

### 3. Firebase Setup
In your Firebase Console:
1. Enable **Authentication** → Sign-in methods: Email/Password, Google, Anonymous
2. Enable **Cloud Firestore** in production mode
3. Apply the Firestore security rules from `firestore.rules`

### 4. Run Locally
You need a local HTTP server (not `file://`) for Firebase and mic APIs to work:
```bash
# Using Python
python -m http.server 4173

# Using Node.js http-server
npx http-server -p 4173

# Then open:
# http://localhost:4173/index.html
```

### 5. Demo Credentials
The coordinator dashboard includes demo credentials in the login modal:
```
Email:    resqnet.coordinator@gmail.com
Password: resqnet2026
```

---

## 🐳 Docker Deployment

Build and run the container locally:
```bash
docker build -t resqnet .
docker run -p 8080:8080 resqnet
```

### Deploy to Google Cloud Run
```bash
gcloud run deploy resqnet \
  --source . \
  --project resqnet-494415 \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📁 Project Structure

```
GD-Solution-challange-2026/
├── index.html          # Landing page — entry point
├── auth.html           # Sign In / Create Account
├── reporter.html       # Citizen reporter dashboard
├── coordinator.html    # Coordinator command center
├── volunteers.html     # Volunteer registration & listing
├── resources.html      # Emergency helplines & community resources
├── history.html        # Incident history viewer
├── account.html        # User account settings
├── style.css           # Shared design system (CSS variables, components)
├── config.js           # Runtime config (Gemini API key)
├── config.example.js   # Config template for new developers
├── firebaseConfig.js   # Firebase credentials helper
├── auth.js             # Auth helper module
├── coordinator.js      # Coordinator logic (separate module)
├── volunteers.js       # Volunteer management module
├── resources.js        # Resources module
├── history.js          # History module
├── account.js          # Account settings module
├── crew-page.js        # Additional crew utilities
├── firestore.rules     # Firestore security rules
├── firebase.json       # Firebase hosting configuration
├── Dockerfile          # Container build config
├── .dockerignore       # Docker exclusion list
├── .gitignore          # Git exclusion list
└── LICENSE             # MIT License
```

---

## 🔒 Security

- **Coordinator dashboard** is protected by Firebase email/password auth — the app shell is hidden until authentication succeeds
- **Reporter dashboard** requires a valid (non-anonymous) Firebase user
- **Volunteer & Resources pages** use Anonymous Auth for write access, keeping the barrier low for community contributors while preventing unauthenticated direct API calls
- **Firestore rules** (`firestore.rules`) restrict write/read access per collection
- **API keys** are runtime-injected via `config.js` (excluded from version control via `.gitignore`)

---

## 🗺️ User Flows

### Citizen Reporting Flow
```
index.html
  → auth.html (sign in / create account)
    → reporter.html
      → Hold SOS button (2s)
        → Category modal opens
          → GPS captured automatically
          → Optional: record voice note (15s)
          → Select category + optional description
          → Submit
            → Firestore write (incident created)
            → Success modal shown
            → Gemini AI triage runs in background
            → Triage result saved to Firestore
            → Coordinator dashboard updates live
```

### Coordinator Response Flow
```
coordinator.html
  → Login (email/password)
    → Live incidents panel (auto-loads)
      → View AI-triaged incident card
        → Click suggested volunteer → Dispatch
          → Volunteer marked busy
          → Incident marked deployed
          → Timeline entry created
      → Resolve incident → Status updated
      → View Insights → Charts + Heatmap
      → Export CSV → Download report
```

### Volunteer Registration Flow
```
volunteers.html (no login required)
  → Anonymous Firebase session created
    → Fill form (name, phone, skill, location)
    → GPS auto-captured + reverse geocoded
    → Register → Saved to Firestore volunteers collection
    → Appears in coordinator's volunteer pool instantly
```

---

## 📊 Triage Levels Reference

| Level | Name | Color | Typical Scenarios |
|-------|------|-------|-------------------|
| 1 | Critical | 🔴 Red | Cardiac arrest, active bleeding, building collapse, explosion |
| 2 | Severe | 🟠 Orange | Flood, mass injury, riot, severe shortage |
| 3 | Moderate | 🟡 Yellow | Conflict reports, property damage, moderate injuries |
| 4 | Minor | 🟢 Green | Supply shortages, non-urgent resource needs |
| 5 | Monitoring | ⚫ Gray | Hospitality, shelter, general support requests |

---

## 🤖 Gemini AI Integration

ResQNet uses **Google Gemini** for automated incident triage:

**Prompt structure:**
```
You are an emergency triage AI.
Analyze this crisis and return ONLY valid JSON.

Type: {Medical/Disaster/Conflict/Resource/Hospitality}
Description: {user text}
Voice: {speech-to-text transcript}
Location: {reverse-geocoded address}

Return: { level, levelName, color, reasoning, volunteerTypes, estimatedMinutes }
```

**Model cascade:**
1. `gemini-2.5-flash` (primary)
2. `gemini-1.5-flash` (secondary fallback)
3. Rule-based keyword engine (final fallback)

This cascade ensures **zero downtime** for triage even under API quota limits.

---

## 🌍 Google Solution Challenge Alignment

ResQNet addresses **UN Sustainable Development Goals**:

| SDG | How ResQNet helps |
|-----|-----------------|
| **SDG 3** — Good Health & Well-being | Faster medical emergency response via AI triage |
| **SDG 11** — Sustainable Cities & Communities | Resilient community crisis coordination |
| **SDG 16** — Peace, Justice & Strong Institutions | Structured conflict reporting and resource allocation |
| **SDG 17** — Partnerships for the Goals | Connecting volunteers, NGOs, and coordinators in one platform |

---

## 👨‍💻 Authors and Contributors

**Syed Arman Ali** · [GitHub](https://github.com/SyedArmanAli2003)
**Aysha Tahoor** [GitHub](https://github.com/AyshaTahoor)
**Krish** [GitHub](https://github.com/krishna2838)


Built for the **Google Solution Challenge 2026**.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
