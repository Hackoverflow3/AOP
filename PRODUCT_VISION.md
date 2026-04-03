# AOP — Product Vision
_Autonomous Office Protocol_
_Last updated: 2026-04-02_

---

## What is AOP?

AOP is an autonomous AI-powered project delivery system that simulates a real software team working inside a 3D interactive office. You describe a task. Four AI agents — each with a distinct personality and role — take it through a structured workflow across five rooms, producing real artifacts, real code, and real decisions. You sit beside them at every step and approve or reject before anything moves forward.

It is not a chatbot. It is not a dashboard. It is a living, breathing office you can walk into.

---

## The Core Experience

### What the user does
1. Lands on the home page — sees the 3D office from an overhead view, agents moving around
2. Types a task: "Build me a SaaS landing page with a waitlist"
3. Clicks "Launch Session"
4. Watches the office come alive — agents walk into the first room
5. **Clicks on a room** — camera smoothly flies into the room
6. User is now sitting at the table beside the agents, looking at the screen/board on the wall
7. Agents discuss, plan, write — it all appears live on the board
8. When a step is ready, a prompt appears: **"Approve this plan?"** — user reads it and clicks Approve or Reject
9. If rejected, user adds a note and agents revise
10. Approved — agents move to the next room, user follows or watches from above
11. At the end, the Demo Room runs the actual code. User watches it execute live on the screen
12. All artifacts (spec, code, tests, report) are downloadable from the room doors

---

## The Office

### Visual style
- Real GLB-based 3D environment — not procedural geometry
- Glass walls with transparency — you can see into every room from the corridor
- Polished concrete floors with subtle reflections
- Warm overhead lighting per room with accent colours
- Each room has a distinct identity and colour palette
- The office feels like a modern tech startup — dark, clean, focused

### Layout
```
┌─────────────┬─────────────┐
│   WAR ROOM  │  IDEATION   │
│      A      │   HIVE  B   │
│  (purple)   │   (blue)    │
├─────────────┼─────────────┤
│  THE FORGE  │ OBSERVATORY │
│      C      │      D      │
│   (teal)    │   (amber)   │
└──────┬──────┴─────────────┘
       │   DEMO ROOM E       │
       │      (gold)         │
       └────────────────────┘
```

### Camera modes
1. **Overview mode** — camera at (0, 30, 22), looking down at the whole office. Agents visible, rooms lit, glass walls let you see inside.
2. **Room mode** — click on any room. Camera smoothly transitions (1.5s cinematic tween) into the room. You are now sitting at the table, eye-level, looking at the board/screen on the wall. Agents are seated around you.
3. **Exit** — press Escape or click a "← Office" button to fly back to overview.

---

## The Rooms

### Room A — War Room (purple)
**Purpose:** Strategic alignment. Director and Catalyst challenge the task brief, define scope, identify risks, agree on what success looks like.

**What happens:**
- Director opens with a blunt assessment of the task
- Catalyst challenges every assumption
- They debate until they agree on a mission statement and constraints
- Output: a signed-off mission brief

**In-room view:**
- Hexagonal table, 2 agents seated
- Wall-mounted screen showing the task brief, live edits as they debate
- User approval gate: "Approve mission brief?"

---

### Room B — Ideation Hive (blue)
**Purpose:** All four agents brainstorm approaches. Multiple solutions proposed, debated, scored.

**What happens:**
- All 4 agents at the table
- Architect proposes architecture options
- Dev calls out complexity and technical debt
- Catalyst pokes holes in each option
- Director moderates and selects the approach
- Output: a selected approach with rationale

**In-room view:**
- Circular table, 4 agents seated
- Board covered in sticky-note-style idea cards (rendered live as agents speak)
- User approval gate: "Approve chosen approach?"

---

### Room C — The Forge (teal)
**Purpose:** Architect writes the technical spec. Dev writes the actual code skeleton. Both reviewed and corrected.

**What happens:**
- Architect writes a detailed JSON spec (data models, API shape, component tree)
- Dev reviews it and corrects it
- Dev writes real working code files based on the spec
- Architect reviews the code
- Output: spec.json + code skeleton files

**In-room view:**
- Two-person desk setup
- Dual screens — left screen shows the spec being written live, right screen shows the code
- User approval gate: "Approve spec and code skeleton?"

---

### Room D — Observatory (amber)
**Purpose:** Director reviews everything produced so far and writes the session log. Risk assessment. Go/no-go for Demo Room.

**What happens:**
- Director alone, reviewing all artifacts
- Writes a narrative session log
- Identifies blockers or risks
- Makes a go/no-go call for Room E
- Output: session_log.md

**In-room view:**
- Single desk with multiple monitors showing all artifacts
- Director speaking into a recording/log
- User approval gate: "Approve session log and proceed to Demo Room?"

---

### Room E — Demo Room (gold) ⭐
**Purpose:** The flagship moment. Dev runs the actual generated code. Agents watch the output on the big screen. Director narrates. If it fails, loop back to Room C.

**What happens:**
- All 4 agents in the room, seated in an audience-style layout
- Code from Room C executes live
- Output (logs, results, errors) streams onto the big presentation screen
- Agents comment on what they see
- Director narrates the result to camera
- If execution fails: agents discuss why, Director decides whether to loop back
- Output: execution_result.md + final_report.md

**In-room view:**
- Large presentation screen on the north wall
- Agents seated in audience rows, facing the screen
- User is also facing the screen
- User approval gate: "Accept final output?" or "Send back to Forge?"

---

## The Four Agents

### Director — purple (#8B7CF8)
**Personality:** Terse. Decisive. Never explains himself twice. Cuts through noise. If you need three paragraphs to say something, he'll say it in one sentence and move on. Does not tolerate ambiguity.

**Role:** Strategic decisions, synthesis, final calls, session narration.

**Verbal tics:** Short sentences. "No." "Done." "Next." "That's the wrong question." Never says "I think" — only "It is" or "It isn't."

---

### Architect — teal (#1CC8A0)
**Personality:** Refuses ambiguity. Demands precision. Gets visibly irritated by underspecified requirements. Will not write a line of spec until every assumption is named explicitly. Elegant solutions only.

**Role:** Technical specification, system design, data modelling, API shape.

**Verbal tics:** "Define that term." "That's undefined behaviour." "The spec says nothing about this." Draws diagrams in text. Uses exact types.

---

### Dev — amber (#F5A623)
**Personality:** Blunt and practical. Cuts through theory with implementation reality. Doesn't care about elegance if it ships. Will say "that won't work" without softening it. Respects working code above all else.

**Role:** Code generation, implementation review, complexity assessment, execution.

**Verbal tics:** "Ship it." "That's over-engineered." "I've seen this bug before." "Works on my machine." Uses code snippets to argue.

---

### Catalyst — red-orange (#E85D40)
**Personality:** Genuinely skeptical. Not cynical — constructively adversarial. Believes every plan has a fatal flaw and their job is to find it before it bites in production. Asks the uncomfortable questions nobody wants to ask.

**Role:** Devil's advocate, risk identification, assumption challenging, quality gate.

**Verbal tics:** "What happens when this fails?" "You're assuming X — why?" "I've heard this before." "Nobody has tested this." "What's the failure mode?"

---

## The Approval System

At the end of every room's work, the session **pauses**. The backend emits an `awaiting_approval` SSE event containing the artifact to be reviewed.

The UI shows:
- The artifact content displayed on the room's screen
- A summary of what was decided
- Two buttons: **✓ Approve** and **✗ Reject**
- If rejected: a text input appears — "Tell agents what to change"
- User submits the rejection note → agents revise → approval prompt reappears

This is not optional. Nothing moves to the next room until the user approves.

---

## The Live Board

Every room has a screen or board on the wall. It is not static.

- As agents speak, their content appears on the board in real-time (streamed)
- The board renders differently per room:
  - War Room: text document (mission brief)
  - Ideation Hive: sticky-note grid (ideas)
  - The Forge: split code editor (spec left, code right)
  - Observatory: document with highlighted sections
  - Demo Room: terminal output / execution log

The board is implemented as a `THREE.CanvasTexture` updated on every SSE message event.

---

## The 3D Environment Requirements

### Assets needed
- Office GLB with: glass-walled rooms, corridor, lobby, furniture
- Or modular GLBs: floor tiles, glass wall panels, desk, chair, monitor, whiteboard
- Agent GLBs: 4 humanoid characters (Mixamo-compatible, already have FBX)

### Materials
- Glass walls: `MeshPhysicalMaterial` — transmission 0.85, roughness 0.05, metalness 0.1
- Floor: polished concrete — roughness 0.35, metalness 0.15, slight reflectivity
- Walls/ceiling: dark `#1c1e30`, subtle emissive accent per room
- Desks: wood `#4a3728`, roughness 0.7
- Screens: emissive `MeshStandardMaterial` updated via CanvasTexture

### Lighting
- `HemisphereLight` — cool sky, warm ground
- Per-room ceiling panel lights (visible mesh + PointLight)
- Accent point lights per room in room colour
- Screen glow (SpotLight aimed at board)
- Active room pulses brighter

### Camera system
- Overview: `(0, 30, 22)` → `lookAt(0, 0, 0)`, FOV 42
- Per-room positions defined as named camera anchors inside each room
- Transition: smooth lerp over 1.5s, easeInOut curve
- In-room: eye-level ~(roomX, 1.4, roomZ+2), looking at the board wall

---

## The Tech Stack

### Backend (keep as-is, extend)
- FastAPI + Python async
- SQLite (WAL mode)
- SSE streaming via `asyncio.Queue`
- Groq API (llama-3.1-8b-instant) — Room C only
- Ollama (local) — Rooms A, B, D (free, private)
- Room files: `war_room.py`, `hive.py`, `forge.py`, `observatory.py`, `demo_room.py`
- New: approval queue — backend pauses, waits for HTTP POST `/approve/{session_id}`

### Frontend (rebuild 3D layer)
- Next.js 14 App Router
- Three.js (raw, not React Three Fiber)
- GLTFLoader for office + agent GLBs
- `CanvasTexture` for live board rendering
- GSAP or Three.js lerp for camera transitions
- `useSSE` hook (keep, fix bugs)
- `lib/api.ts` (keep, fix `res.ok` checks)
- New: `useApproval` hook — listens for `awaiting_approval`, manages approve/reject flow

---

## Session Flow (end to end)

```
User types task
      ↓
Session created → navigate to /run/[id]
      ↓
Overview: agents walk into Room A
      ↓
[User clicks Room A — camera flies in]
      ↓
War Room runs → board updates live
      ↓
PAUSE → "Approve mission brief?" → User approves
      ↓
[Camera flies back OR auto-follows to Room B]
      ↓
Ideation Hive runs → board fills with ideas
      ↓
PAUSE → "Approve chosen approach?" → User approves
      ↓
The Forge runs → spec + code appear on dual screens
      ↓
PAUSE → "Approve spec and code?" → User approves/rejects with notes
      ↓
Observatory runs → Director writes session log
      ↓
PAUSE → "Proceed to Demo Room?" → User approves
      ↓
Demo Room runs → code executes → output streams on big screen
      ↓
PAUSE → "Accept final output?" or "Send back to Forge?"
      ↓
Session complete → artifacts downloadable at each room door
```

---

## What "Done" Looks Like

A user with zero technical knowledge can:
1. Type a real software task
2. Watch 4 AI agents work through it in a 3D office
3. Enter each room and sit beside the agents
4. Read everything on the board in real-time
5. Approve or push back at each step
6. Walk out of the session with a spec, code skeleton, and execution result
7. Download everything in one ZIP

The counter always reads **$0.00** for most sessions (Ollama for A/B/D).
The agents feel like real personalities, not generic chatbots.
The office looks like a place you'd want to work in.

---

## What Exists Today vs What's Needed

| Feature | Status |
|---------|--------|
| Backend SSE streaming | ✅ Works |
| Room logic (A/B/C/D) | ✅ Works |
| SQLite + artifacts | ✅ Works |
| Agent system | ✅ Works |
| 3D scene (procedural) | ⚠️ Placeholder |
| Real GLB office environment | ❌ Not started |
| Click-to-enter rooms | ❌ Not started |
| In-room camera anchor | ❌ Not started |
| Camera transition tween | ❌ Not started |
| Live board / CanvasTexture | ❌ Not started |
| Approval gate system | ❌ Not started |
| Room E backend | ❌ Not started |
| Room C code generation | ❌ Incomplete |
| Agent prompt personalities | ❌ Thin |
| Ollama routing (A/B/D) | ❌ All on Groq |
| SESSION_BRAIN context mgmt | ❌ Not started |
| Token/cost counter | ❌ Not started |
| Session replay | ❌ Not started |
| Settings page | ❌ Stub |
| Artifacts page | ❌ Stub |

---

## Build Order (recommended)

1. **Source the office GLB** — foundation of everything visual
2. **Camera system** — overview ↔ room transitions
3. **In-room view** — per-room camera anchors, agents seated
4. **Live board** — CanvasTexture updated via SSE
5. **Approval gate** — backend pause + frontend Approve/Reject UI
6. **Room E backend** — `demo_room.py` + code execution
7. **Room C code generation** — real code output
8. **Agent personalities** — rewrite all 4 prompts
9. **Ollama routing** — A/B/D local, C on Groq
10. **SESSION_BRAIN** — context management
11. **Token/cost counter**
12. **Session replay**
13. **Settings + Artifacts pages**
14. **Polish pass** — onboarding, animations, sounds
