# Untis Dashboard

Ein modernes Dashboard auf Basis der **WebUntis JSON-RPC API**. Kernfeature ist die
**Lehrer-Live-Suche**: Wo (Raum), mit welcher Klasse und in welchem Gegenstand ist eine
Lehrkraft gerade – oder zu einem gewählten Zeitpunkt – und wie lange dauert die Stunde noch?

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · Tailwind CSS 4 · shadcn/ui (Radix) · SWR

## Features

| Bereich | Was es kann |
| --- | --- |
| **Lehrer-Suche** (`/teachers`) | Autocomplete nach Kürzel oder Name, Live-Status (Raum, Klasse, Gegenstand), sekundengenauer Countdown der Restzeit, Doppelstunden-Erkennung, „danach“-Vorschau, Tagesplan, beliebiger Tag/Uhrzeit |
| **Klassen- & Raumsuche** (`/classes`, `/rooms`) | Dieselbe Live-Ansicht für Klassen („Wo ist die 3AHIT?“) und Räume („Wer ist in E104?“) |
| **Raumfinder** (`/rooms/free`) | Freie Räume jetzt oder zu einem Zeitpunkt, inkl. „frei bis …“, Filter nach Gebäude/Name, belegte Räume mit „belegt bis …“ |
| **Vertretungsplan** (`/substitutions`) | Entfälle, Vertretungen, Raumänderungen für Tag oder Woche, Filter nach Art und Freitextsuche |
| **Dashboard** (`/`) | KPIs (Vertretungen, Entfälle, Raumänderungen, Raum- und Lehrer-Auslastung), Auslastung pro Stunde, anstehende Änderungen, freie Räume, Schnellsuche |
| **UX** | Sidebar (einklappbar, mobil als Sheet), globale Suche mit <kbd>Strg</kbd>+<kbd>K</kbd>, Dark/Light/System-Theme, Skeleton-Loader, Fehlerzustände je Ursache, teilbare URLs (`/teachers?id=12&time=10:15`) |

## Schnellstart

```bash
npm install
cp .env.example .env.local   # Zugangsdaten eintragen – oder UNTIS_MOCK=true für Demo-Daten
npm run dev
```

Dann <http://localhost:3000> öffnen.

**Ohne Zugangsdaten ausprobieren:** `UNTIS_MOCK=true` in `.env.local` setzen. Dann liefert eine
generierte Demo-HTL (34 Lehrkräfte, 16 Klassen, 29 Räume) realistische, kollisionsfreie
Stundenpläne mit täglich wechselnden Entfällen, Vertretungen und Raumänderungen.

## Konfiguration (`.env.local`)

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `UNTIS_SERVER` | ✔ | Host aus der WebUntis-URL, z. B. `mese.webuntis.com` |
| `UNTIS_SCHOOL` | ✔ | Schulname aus der URL (`?school=…`) |
| `UNTIS_USERNAME` | ✔ | WebUntis-Benutzer |
| `UNTIS_PASSWORD` | ✔¹ | Passwort |
| `UNTIS_SECRET` | ✔¹ | Alternativ: App-Secret (Profil → Freigaben → „Anzeigen“), Login per TOTP |
| `UNTIS_MOCK` | | `true` = Demo-Daten statt echter API |
| `UNTIS_TIMEZONE` | | Zeitzone der Schule, Standard `Europe/Vienna` (wichtig, wenn der Server in UTC läuft) |
| `UNTIS_TIMEOUT_MS` | | Timeout pro Untis-Request (Standard 15000) |
| `UNTIS_MAX_CONCURRENCY` | | Max. parallele Requests beim Zusammensetzen der Tagesübersicht (Standard 6) |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | | Aktiviert HTTP-Basic-Auth für die ganze App |

¹ Entweder Passwort oder Secret.

> **Sicherheit:** Zugangsdaten werden ausschließlich serverseitig gelesen (`server-only`), nie an
> den Browser geschickt und `.env*` ist (außer `.env.example`) in `.gitignore`. Sobald das
> Dashboard öffentlich erreichbar ist, unbedingt `DASHBOARD_PASSWORD` setzen – sonst sieht
> jeder mit der URL die Stundenplandaten deiner Schule.

## Berechtigungen in WebUntis

Welche Daten abrufbar sind, hängt von den Rechten des Accounts ab. Die App geht damit robust um:

- **Lehrer-/Raum-Stundenpläne direkt nicht erlaubt?** (`-8509`) → Die App setzt den Tag aus den
  Stundenplänen aller Klassen zusammen und filtert daraus (dedupliziert, parallel, gecacht).
- **`getTeachers` / `getRooms` nicht erlaubt?** → Lehrer- und Raumliste werden aus den
  Stundenplänen der aktuellen Woche abgeleitet.
- **`getSubstitutions` nicht erlaubt?** → Der Vertretungsplan wird aus den Stundenplan-Einträgen
  abgeleitet (Hinweis in der UI).

Am besten funktioniert ein eigener Lese-Account mit Rechten auf Lehrer- und Raumstundenpläne.

## Architektur

```
src/
├─ lib/untis/
│  ├─ client.ts      JSON-RPC-Client: Login (Passwort oder Secret/TOTP), Session-Cache,
│  │                 geteilter Login bei parallelen Requests, Re-Login bei -8520, Timeouts
│  ├─ source.ts      Datenquellen-Interface + Live-Implementierung (Mapping roher Untis-Daten)
│  ├─ mock.ts        Demo-Datenquelle (deterministisch, gleiche Schnittstelle)
│  ├─ service.ts     Fachlogik: Stammdaten, Tagesaggregation, Live-Status, freie Räume, KPIs,
│  │                 Berechtigungs-Fallbacks, In-Memory-Cache mit Request-Deduplizierung
│  ├─ status.ts      Reine Status-Berechnung – läuft auf Server UND Client (Live-Countdown)
│  ├─ errors.ts      Untis-Fehlercodes → Kategorien (auth/permission/network/…) + HTTP-Status
│  └─ config.ts      Validierung der Umgebungsvariablen
├─ app/api/untis/    Route Handler: status, master, element, rooms, substitutions, stats
├─ app/(dashboard)/  Seiten (statische Shell + Client-Daten via SWR, Live-Refresh jede Minute)
├─ components/untis/ Explorer, Live-Status-Karte, Tagesplan, Raumfinder, Vertretungsplan, …
├─ components/dashboard/ KPI-Kacheln, Auslastungsdiagramm, Dashboard-Ansicht
└─ proxy.ts          Optionale Basic-Auth
```

**Datenfluss:** Browser → `/api/untis/*` (Next.js Route Handler) → Service (Cache) → Untis-Client →
WebUntis. Der Browser spricht nie direkt mit WebUntis.

**Live-Verhalten:** Daten werden jede Minute neu geladen; der Status („im Unterricht“ → „Pause“)
und der Countdown werden zusätzlich jede Sekunde im Browser aus dem Tagesplan neu berechnet, damit
die Anzeige exakt zum Stundenende umschaltet.

### API

| Endpoint | Parameter | Liefert |
| --- | --- | --- |
| `GET /api/untis/status` | – | Verbindungsstatus, Modus (live/demo) |
| `GET /api/untis/master` | – | Lehrkräfte, Klassen, Räume, Gegenstände, Stundenraster |
| `GET /api/untis/element` | `type` (teacher/class/room), `id`, `date?`, `time?` | Live-Status + Tagesplan |
| `GET /api/untis/rooms` | `date?`, `time?` | Freie & belegte Räume |
| `GET /api/untis/substitutions` | `date?`, `range?` (day/week) | Vertretungen |
| `GET /api/untis/stats` | `date?`, `time?` | Dashboard-KPIs |

Fehler kommen einheitlich als `{ "error": { "kind", "message", "code?" } }` mit passendem HTTP-Status.

## Scripts

```bash
npm run dev     # Entwicklungsserver
npm run build   # Produktions-Build
npm run start   # Produktionsserver
npm run lint    # ESLint
```

## Hinweise

- Der In-Memory-Cache lebt pro Server-Instanz. Auf Serverless-Plattformen (z. B. Vercel) ist er
  pro Instanz und nicht dauerhaft – für viele Nutzer lohnt sich ein langlebiger Node-Server
  (`npm run start`, Docker) oder ein externer Cache.
- Der Login per `UNTIS_SECRET` nutzt den internen Endpunkt der WebUntis-App und kann sich ohne
  Ankündigung ändern; Passwort-Login ist der stabilere Weg.
