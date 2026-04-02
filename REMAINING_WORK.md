# AOP — Remaining Work
_Last updated: 2026-04-02_

---

## Priority 1 — Critical (blocks product vision)

### 1. Room E (Demo Room) — Backend missing entirely
- **What:** No `demo_room.py` exists. `runner.py` only loops A–D. The 3D scene already has the room positioned and agents assigned, but nothing will ever enter it.
- **Files:** `backend/app/rooms/demo_room.py` (create), `backend/app/orchestrator/runner.py` (add E to ROOM_ORDER + ROOM_MAP)
- **Complexity:** XL
- **Why:** The Demo Room is the product's defining moment — Dev runs the code, agents watch and comment, Director narrates, loop back to Room C if it fails.

### 2. Room C produces no code skeletons
- **What:** `forge.py` only does 2 turns (Architect writes JSON spec, Dev corrects it). No code is generated. The product vision requires actual working code skeletons alongside the spec.
- **Files:** `backend/app/rooms/forge.py`, `backend/app/prompts/dev.md`
- **Complexity:** M
- **Why:** Without code, Room E has nothing to demo.

### 3. LLM routing is wrong — all rooms use Groq
- **What:** `client.py` routes ALL rooms to Groq. The spec says A/B/D → Ollama (local, free, private), C → Groq (70B reasoning). Ollama client exists but is dead code. Also causes the rate limit hammering we've been fighting.
- **Files:** `backend/app/llm/client.py`, all room files (update `llm_provider` in `create_room_run` calls)
- **Complexity:** S
- **Why:** Routing A/B/D to Ollama eliminates rate limits entirely on 3 of 4 rooms and matches the free/private/local vision.

### 4. SESSION_BRAIN.md doesn't exist
- **What:** Context is passed by naive string concatenation. No token counting, no compression at 80% usage, no living document. Long or complex tasks will hit context limits and die silently.
- **Files:** `backend/app/orchestrator/session_brain.py` (create), `backend/app/orchestrator/runner.py`, all room files
- **Complexity:** L
- **Why:** This is what makes AOP fundamentally different — seamless long sessions without crashes.

### 5. Token/model/cost counter missing from UI
- **What:** The vision promises a persistent live counter showing tokens used, current model, and cost ($0.00). Neither the run page nor the landing page has it.
- **Files:** `frontend/app/run/[id]/page.tsx`, `backend/app/routers/runner.py` (emit token counts in SSE events)
- **Complexity:** M
- **Why:** Core part of the product demo — showing it always reads $0.00 is a talking point.

---

## Priority 2 — Important (core features)

### 6. Agent prompts are thin — no personality
- **What:** All 4 prompts are ~28-line functional checklists. No verbal tics, no emotional reactions, no strong opinions. Agents all sound like generic ChatGPT.
- **Files:** `prompts/director.md`, `prompts/architect.md`, `prompts/dev.md`, `prompts/catalyst.md`
- **Complexity:** M
- **Why:** The product is sold on agent *character*. Director should be terse and decisive. Catalyst should be genuinely skeptical. Architect should refuse ambiguity. Dev should be blunt and practical.

### 7. History bug — synthesis turns see no conversation
- **What:** `hive.py` and `war_room.py` pass `history=[]` to the Director's synthesis turn (we removed history to fix rate limits). The Director now synthesises without seeing what anyone said. The context string includes the prior reply but not the full conversation.
- **Files:** `backend/app/rooms/war_room.py`, `backend/app/rooms/hive.py`
- **Complexity:** S
- **Why:** Synthesis quality is the entire point of these rooms. The Director needs the conversation to write a good manifest/log.

### 8. Session replay not implemented
- **What:** Sessions are stored in SQLite with messages, but the dashboard has no event player, no scrub bar, no ability to re-watch a completed session.
- **Files:** `frontend/app/dashboard/page.tsx`, `backend/app/routers/sessions.py` (add messages endpoint)
- **Complexity:** L
- **Why:** Auditability is a key differentiator — you can see every decision, every rejection, and why.

### 9. Room-door download button is in wrong place
- **What:** The vision says a download button appears at the room *door* in the 3D scene the moment a room finishes. Currently it only appears in the text feed panel.
- **Files:** `frontend/app/run/[id]/page.tsx` (3D overlay HTML on canvas)
- **Complexity:** M
- **Why:** This is a signature UX moment — the artifact materialises at the door as agents walk out.

### 10. Artifacts page is a stub
- **What:** `frontend/app/artifacts/page.tsx` literally renders "All session outputs — TODO".
- **Files:** `frontend/app/artifacts/page.tsx`
- **Complexity:** M
- **Why:** Users need a place to browse and re-download all session outputs.

### 11. Inter-room cooldown is silent — 90s dead time
- **What:** The 30s sleep between rooms is invisible to the user. The frontend shows a frozen "Running" status with no indication anything is happening. Across a full session that's 90 seconds of apparent hang.
- **Files:** `backend/app/orchestrator/runner.py` (emit cooldown events), `frontend/app/run/[id]/page.tsx` (render countdown)
- **Complexity:** S
- **Why:** Users will think the app is broken.

---

## Priority 3 — Polish

### 12. Sign-in modal has no handler — misleading
- **What:** The "Sign In" button on the landing page opens a modal with no `onClick` — clicking it does nothing. Should either be removed or connected to something.
- **Files:** `frontend/app/page.tsx`
- **Complexity:** S

### 13. No navigate-away warning during active session
- **What:** If a user accidentally navigates away while a session is running, they lose all progress with no warning.
- **Files:** `frontend/app/run/[id]/page.tsx` (`beforeunload` event listener)
- **Complexity:** S

### 14. Landing page thought bubbles are static pre-written strings
- **What:** Agent thought bubbles on the landing page cycle through hardcoded messages, not real LLM output. Should eventually cycle through sample outputs from past sessions or curated real examples.
- **Files:** `frontend/app/page.tsx`
- **Complexity:** M

### 15. Settings page is unimplemented
- **What:** `frontend/app/settings/page.tsx` exists but is empty.
- **Files:** `frontend/app/settings/page.tsx`
- **Complexity:** M
- **Why:** Users need to configure Groq/Gemini API keys, Ollama URL, preferred models.

### 16. Logo navigates to `/` not `/dashboard`
- **What:** Minor UX — the AOP logo should link to `/dashboard` (sessions list) not the landing page once a user has sessions.
- **Files:** `frontend/app/run/[id]/page.tsx`
- **Complexity:** XS

### 17. 3D has no reduced-motion support
- **What:** The camera orbit and agent animations will play regardless of the user's OS reduced-motion preference.
- **Files:** `frontend/app/run/[id]/page.tsx`, `frontend/app/page.tsx`
- **Complexity:** S

---

## Recommended Build Order

1. **Fix LLM routing** (P1 #3) — 30 min, eliminates rate limits on A/B/D immediately
2. **Fix history bug** (P2 #7) — 20 min, instant quality improvement on every session
3. **Rewrite agent prompts** (P2 #6) — 1–2 hrs, makes every session immediately more impressive
4. **Add cooldown feedback** (P2 #11) — 30 min, stops users thinking the app is broken
5. **Room C code skeletons** (P1 #2) — 2 hrs, unlocks Room E
6. **SESSION_BRAIN.md** (P1 #4) — 3–4 hrs, enables long sessions reliably
7. **Room E Demo Room** (P1 #1) — full day, the flagship feature
8. **Token/cost counter** (P1 #5) — 2 hrs, key demo talking point
9. **Session replay** (P2 #8) — 3 hrs, auditability differentiator
10. **Room-door downloads** (P2 #9) — 2 hrs, signature UX moment
11. **Artifacts page** (P2 #10) — 1 hr
12. **Settings page** (P3 #15) — 2 hrs
13. Everything else in P3 — polish pass
