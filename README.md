# Anvay — National Disaster Saviour

> **"We convert fragmented disaster reports into prioritized, actionable rescue assignments in real time."**

Anvay is a district-level **decision-support system** for disaster response. It fuses citizen reports, official weather warnings, and live resource inventory into a single geospatial situation picture — then uses a transparent multi-factor **allocation engine** to recommend *which* rescue team should respond to *which* incident first.

**SIH Problem Statement:** PS-05 — Real-Time Disaster Early-Warning & Resource Coordination Platform

> 🗺️ **Demo district:** Rourkela, Odisha (Koel river flood scenario). District-specific data lives in `src/config/city.ts` + `supabase/seed.sql` — edit both to redeploy for any other district.
operator1@gov.in : Password - operator@1
> citizen1@gmail.com : Password - citizen@1
> rescue1@gov.in : Password - rescue@1
> shelter1@gov.in : Password - shelter@1
---

## ⚠️ The One-Line Positioning (read this first)

Anvay is **not another alert app**. India already has SACHET/NDMA for warning dissemination. We are the **operational coordination layer that comes after the warning**: incoming incident → AI-assisted triage → confidence scoring → optimal resource assignment → live reassignment when conditions change.

---

## How Anvay Is Different From Existing Platforms

| Capability | SACHET / NDMA | IMD Portals | Ushahidi | GDACS | **Anvay** |
|---|:---:|:---:|:---:|:---:|:---:|
| Official geo-targeted alerts | ✅ | ✅ | ❌ | ✅ | ✅ (consumes IMD feed) |
| Citizen report submission | Limited | ❌ | ✅ | ❌ | ✅ App + PWA + **SMS fallback** |
| Live operational map | ✅ | ✅ | ✅ | ✅ | ✅ Realtime (<1s) |
| **Resource inventory (teams/shelters/stock)** | ❌ | ❌ | Partial | ❌ | ✅ |
| **Multi-factor allocation engine** | ❌ | ❌ | ❌ | ❌ | ✅ Core feature |
| **Dynamic reassignment on failure** | ❌ | ❌ | ❌ | ❌ | ✅ |
| Report confidence / duplicate clustering | ❌ | ❌ | ❌ | ❌ | ✅ |
| Connectivity fallback (SMS channel) | ✅ SMS out | ❌ | ✅ | ❌ | ✅ SMS in → same pipeline |

### What makes our approach defensible in a Q&A

1. **We don't compete with SACHET.** They answer *"what is going to happen?"* We answer *"it's happening — which team goes where, right now?"*
2. **Citizen reporting alone isn't innovation** (Ushahidi does it). Our innovation starts *after* the report arrives: AI classification → confidence scoring → duplicate clustering → scored allocation.
3. **Nearest-team-only dispatch is naive.** A boat 2 km away without medical capability loses to an ambulance boat 5 km away when 3 elderly people are trapped. Our engine weighs severity, ETA, capability match, availability and capacity with configurable weights — and shows its reasoning for every recommendation.
4. **The system is a decision-support tool, not autonomous dispatch.** Operators confirm every assignment; the engine explains itself ("RT-002 is 2.8 km away (~6 min ETA); has all required capabilities (BOAT, MEDICAL)").

### The three technical differentiators

- **Allocation Engine** — transparent weighted scoring:
  `Score = 40% Severity + 20% ETA + 20% Capability + 10% Availability + 10% Capacity`
  (weights stored in DB, switchable between Balanced / Severity-First / Speed-First profiles)
- **Confidence-aware incidents** — official alerts ≈ 0.95 trust, a single unverified app report ≈ 0.50, but 5 citizens reporting the same spot within 30 min auto-cluster into one ≥0.80-confidence incident
- **Live reassignment** — flip any team to UNAVAILABLE mid-mission and the system interrupts the assignment and immediately recommends the best replacement

---

## 🏗️ Architecture

```
Citizen PWA (/report)      Field Team (/team)      Shelter Mgr (/shelter-manage)
        │                        │                        │
        └────────────┬───────────┴────────────────────────┘
                     ▼
        Next.js API routes (allocation, assignments,
        simulation, SMS webhook, classify, alert sync)
                     ▼
┌─────────────────────────────────────────────┐
│              Supabase (Postgres)            │
│  RLS policies · triggers · PostGIS ·        │
│  Auth · Realtime (postgres_changes)         │
└─────────────────────────────────────────────┘
                     ▼
        Operator Dashboard (/dashboard/map)
   Leaflet live map · allocation UI · heatmap ·
   IMD banner · simulation controls · stats bar
                     ▲
   External: Gemini API (classification, optional)
             IMD API (warnings, optional w/ fallback)
             OSRM    (road routing, free, no key)
```

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind 4 | One deployable, server components + client realtime |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | Managed, free tier, zero WebSocket infra needed |
| Maps | Leaflet + React-Leaflet + OSM tiles | Free, no API key, plugin ecosystem |
| Routing | OSRM public server | Free road routing, graceful straight-line fallback |
| AI | Google Gemini 2.0 Flash | Free tier; deterministic rule-based fallback if unavailable |
| Tests | Node built-in test runner (`node:test`) | Zero dependencies |

### Key source map

```
src/
├── lib/
│   ├── allocation.ts        # ⭐ Allocation engine (pure functions, unit-tested)
│   ├── classifier.ts        # Gemini classification + rule-based fallback
│   ├── confidence.ts        # Confidence scoring model
│   ├── sms.ts               # "SOS FLOOD ward 12 bridge 5 people" parser
│   ├── imd.ts               # IMD sync w/ labelled fallback data
│   ├── simulation.ts        # Scripted disaster scenario engine
│   ├── auth.ts              # API-route session guards (incl. optional/guest auth)
│   ├── roleRouting.ts       # post-login routing per role
│   └── supabase/            # browser/server clients
├── app/
│   ├── api/
│   │   ├── incidents/       # CRUD + intelligence pipeline
│   │   ├── assignments/     # allocate (top-3) / create / status flow
│   │   ├── resources/[id]   # status flips + AUTO-REALLOCATION
│   │   ├── sms/incoming     # connectivity-fallback webhook
│   │   ├── classify/        # AI preview endpoint
│   │   ├── alerts/sync      # IMD pull (15-min cadence)
│   │   └── simulation       # start / stop / reset
│   ├── (dashboard)/dashboard/
│   │   ├── map/             # ⭐ Ops console (golden demo)
│   │   ├── incidents/       # incident triage table
│   │   ├── assignments/     # assignment board + status flow
│   │   ├── resources/       # fleet & team status management
│   │   ├── shelters/        # shelter occupancy & stock
│   │   └── simulation/      # scripted disaster scenario controls
│   ├── report/              # citizen 3-step PWA wizard (+ anonymous reports)
│   ├── team/                # field team mission view
│   └── shelter-manage/      # shelter occupancy view
supabase/migrations/         # 0001 schema · 0002 storage · 0003 clustering · … · 0009 delete policies
supabase/seed.sql            # Rourkela flood demo dataset (idempotent)
