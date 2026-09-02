# RakshaSetu — Codex Project Context

## Project
RakshaSetu is a disaster-management platform connecting:
- Citizens
- Operators
- Rescue teams

The system allows citizens to report emergencies and operators to
coordinate response and rescue resources.

## Tech Stack
- Next.js
- TypeScript
- App Router
- Supabase
- Tailwind CSS

## Main Flow

Citizen
→ Next.js frontend
→ Next.js API
→ Supabase
→ Operator dashboard
→ Rescue/resource allocation

## Existing Incident System

The project already has an incident reporting system.

IMPORTANT:
- SMS reports must use the existing `incidents` table.
- Do NOT create a separate SMS incident table.
- Do NOT break the existing APP/web incident reporting flow.
- Reuse existing incident types, severity values, schema and utilities
  wherever possible.

## Existing Incident Sources

The project supports multiple report sources, including:

- APP
- SMS
- IVR
- OFFICIAL
- MANUAL

SMS incidents should use:

source: "SMS"

## Existing SMS Fallback

The project already contains an SMS webhook:

src/app/api/sms/incoming/route.ts

Related files:

src/lib/sms.ts
src/config/city.ts

The existing SMS endpoint:
- receives incoming SMS
- authenticates using SMS_WEBHOOK_SECRET
- parses the SMS using parseSms()
- attempts to identify the citizen using their phone number
- creates an incident in Supabase
- marks the incident source as SMS
- returns an incident number and acknowledgement message

## Current Location Handling

The existing SMS implementation can accept:

- latitude
- longitude
- location_text

If latitude/longitude are not supplied, it currently falls back to:

DEFAULT_REPORT_LOCATION

This must NOT become the permanent nationwide location solution.

## Current SMS Goal

We are improving the existing SMS fallback so that it can work
reliably across India.

The citizen should NOT be required to know their PIN code.

The system should support progressively collecting location information
through SMS when exact location is unavailable.

The final system should provide the operator with the most useful
location information available and clearly distinguish approximate
location from confirmed location.

## Development Rules

1. Inspect existing code before modifying it.
2. Prefer minimal changes.
3. Do not rewrite working systems unnecessarily.
4. Do not refactor unrelated code.
5. Do not create duplicate functionality.
6. Preserve existing APP/web reporting.
7. Preserve existing Supabase schema unless a schema change is
   genuinely required.
8. Reuse existing utilities and types.
9. Test changes after implementation.
10. Do not assume a phone number automatically provides GPS coordinates.
11. Do not hardcode RakshaSetu to Rourkela.
12. Keep the architecture extensible to locations across India.

## Current Task

SMS connectivity fallback.

First inspect the existing SMS implementation and determine:
- current SMS format
- current parsing behavior
- current location behavior
- existing incident creation behavior
- minimum changes required for India-wide location support

DO NOT modify code until the proposed changes have been reviewed.