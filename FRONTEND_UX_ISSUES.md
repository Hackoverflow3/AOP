# Frontend UX Issues — Catalyst Audit
_Last updated: 2026-04-02_

---

## Critical

### 1. Settings & Artifacts pages are dead ends
**UX Category:** Navigation dead-end  
**User experience:** User clicks "Settings" or "Artifacts" in the nav and sees a page with a single TODO comment. No back link. No guidance. They feel the app is broken.  
**Fix:** Either remove the nav links entirely or show a clear "Coming soon" message with a link back to dashboard.

### 2. Sign-in modal does nothing
**UX Category:** Broken interaction  
**User experience:** User clicks "Sign in" → modal opens → fills email + password → clicks "Continue" → nothing happens. No spinner, no error, no feedback. They click again. Still nothing.  
**Fix:** Remove the modal entirely. The landing page copy already says "No login required."

### 3. Sign-in copy contradicts the value prop
**UX Category:** Mental model violation  
**User experience:** Nav shows "Sign in." Footer says "No login required · Runs locally." These two things directly contradict each other. First-time users are confused about whether they need an account.  
**Fix:** Remove the sign-in UI. Resolve the contradiction.

### 4. Hardcoded `localhost:8000` means silent failures outside local dev
**UX Category:** Fragility + silent failure  
**User experience:** On any non-local deployment, SSE connects to `localhost:8000` and fails silently. User sees "Connecting…" forever. Downloads click and nothing downloads. No error is shown.  
**Fix:** `NEXT_PUBLIC_BACKEND_URL` env var.

---

## High

### 5. Backend error handling feels broken, not informative
**UX Category:** Error feedback  
**User experience:** Session breaks mid-run. A small error banner appears at the top. The 3D scene keeps animating normally. Agents stop moving but the lights still pulse. User has no idea if the session is still running or dead. No retry button.  
**Fix:** When status = `error`, dim the 3D scene, show a prominent centred error state with a "Try again" button.

### 6. 3D scene is blank for 3–5 seconds on load
**UX Category:** Loading state / timing  
**User experience:** User starts a session and lands on `/run/[id]`. The office renders but agents are invisible (GLB models loading). Message feed says "Connecting to session…" Nothing happens for several seconds. Then agents pop in. Pacing feels broken.  
**Fix:** Show placeholder discs or silhouettes at agent positions immediately. Make the loading indicator prominent, not a tiny corner pill.

### 7. Room transitions have no clear visual story
**UX Category:** Feedback / timing  
**User experience:** A camera shake happens (~0.35s, barely noticeable). Agents slide to new positions. The room label changes in the top-left legend. That's it. User has no idea a major phase transition just happened.  
**Fix:** Flash the active room name as a brief centred overlay ("→ THE FORGE"), pulse the room's floor, and make the message feed header update more dramatically.

### 8. Session abandonment has no warning
**UX Category:** Navigation / destructive action  
**User experience:** User starts a session, decides to leave, clicks the AOP logo. Navigates away. Session keeps running on the backend forever. No confirmation dialog. No way to come back and see what happened.  
**Fix:** `beforeunload` event listener when `status === 'running'`. Warn the user and offer to stay.

### 9. Dashboard error message is vague
**UX Category:** Error copy  
**User experience:** Session creation fails. User sees: "Failed to create session. Is the backend running?" They don't know if the backend is down, their API key is wrong, or they entered bad data.  
**Fix:** Show the actual error from the server response and link to troubleshooting steps.

### 10. "Download All ZIP" gives no feedback
**UX Category:** Feedback  
**User experience:** Session complete. User clicks "Download All ZIP." Button doesn't change. No spinner, no "Preparing…" message. If ZIP generation takes a few seconds, user clicks again, gets duplicate downloads.  
**Fix:** Disable button + show "Preparing ZIP…" text while the request is in-flight.

---

## Medium

### 11. Message feed doesn't group by room
**UX Category:** Information hierarchy  
**User experience:** 20 messages from multiple rooms are mixed together. The only room indicator is a tiny gray "Room A" label at the far right of each message. User loses track of which phase they're in.  
**Fix:** Add a prominent room divider row in the feed whenever the active room changes.

### 12. Artifact downloads have no success feedback
**UX Category:** Feedback  
**User experience:** User clicks a download link in the artifacts strip. Download starts silently. No checkmark, no toast, no indication it worked.  
**Fix:** Brief "↓ Downloading…" state or a toast confirmation.

### 13. Error banner doesn't auto-dismiss and has no close button
**UX Category:** Error state  
**User experience:** Error appears and stays forever. No × to dismiss it. If it's a transient error, user is stuck with the banner cluttering the UI permanently.  
**Fix:** Add a close button. Auto-dismiss after 8s for non-fatal errors.

### 14. Room legend opacity is too subtle
**UX Category:** Visual contrast  
**User experience:** Completed rooms dim to 0.7 opacity and inactive rooms are 0.4. On a bright screen the difference is nearly invisible. User can't tell which room is active at a glance.  
**Fix:** Use distinct visual states — different colours, a ✓ check icon, or a coloured background badge.

### 15. No indication of what each room does
**UX Category:** Clarity / affordance  
**User experience:** "War Room," "Ideation Hive," "The Forge" — cool names, zero explanation of what happens inside. User doesn't understand the workflow.  
**Fix:** Add a tooltip or sub-label to each room in the legend: "A · War Room — strategic alignment."

### 16. No pagination or search on the sessions list
**UX Category:** Scalability  
**User experience:** With 50+ sessions, the dashboard is an infinite scroll of cards. No search, no sort, no filter. Can't find an old session easily.  
**Fix:** Add date sort, status filter, and a search input.

### 17. No onboarding for first-time users
**UX Category:** Empty state  
**User experience:** First visit to dashboard: blank sessions list with "No sessions yet — start one above." No explanation of what AOP is, what to type in the task box, or what to expect.  
**Fix:** Add a brief explainer below the form on first visit (collapsed after first session).

### 18. Modal backdrop click destroys unsaved input with no warning
**UX Category:** Destructive action  
**User experience:** User is filling in a form inside a modal and accidentally clicks the backdrop. Modal closes. All input lost. No warning.  
**Fix:** Require explicit close button click, or show "Discard changes?" confirmation if fields have been touched.

---

## Low

### 19. "Loading agents 3/4" copy is confusing
**UX Category:** Copy  
**User experience:** Technically accurate but user doesn't know what "agents" means in this context.  
**Fix:** "Loading 3D models (3/4)"

### 20. Input focus styles have poor contrast
**UX Category:** Visual feedback  
**User experience:** Focus ring changes from `rgba(139,124,248,.28)` → `rgba(139,124,248,.65)`. On a bright monitor the difference is hard to see.  
**Fix:** Use a solid 1px border or a more visible outline.

### 21. "Start Session →" button doesn't hint at what happens next
**UX Category:** Affordance / copy  
**User experience:** User clicks it expecting a form or confirmation step. Instead they're immediately dropped into a full immersive 3D session page. The jump is jarring.  
**Fix:** "Launch Session →" + brief tooltip: "Opens the live 3D office view."

### 22. Artifact filenames are not user-friendly
**UX Category:** Clarity  
**User experience:** Artifacts appear as raw filenames like `artifact_abc123.json`. No description of what the file is.  
**Fix:** Show room name + file type: "Room C — spec.json ↓"

### 23. 3D scene is non-interactive — users try to click agents
**UX Category:** Affordance  
**User experience:** The 3D scene looks interactive. Users hover over agents expecting tooltips. They click rooms expecting to zoom in. Nothing responds. Feels broken.  
**Fix:** Either add hover tooltips on agents (show their last message) or add a clear "View only" label so users know it's a display.

### 24. "Session complete" footer is below the fold
**UX Category:** Visibility  
**User experience:** When session finishes, the "Session complete · Download All ZIP" footer appears at the bottom of the feed panel. If the feed is long and user hasn't scrolled down, they miss it entirely.  
**Fix:** Auto-scroll the feed to the bottom on `session_done`, or show a floating toast: "✓ Session complete — Download ZIP."

---

## Flow-Level Problems

### Landing Page
- Hero text "AI agents. Real decisions." doesn't explain the product to a newcomer.
- The 3D office animation is eye candy with no interactive affordance — users try to click it.
- "Start a Session" form is below the fold on most screens.

### Run Page (`/run/[id]`)
- **Load sequence is disjointed:** 3D renders → no agents → "Connecting…" → agents appear → first message → pacing feels random.
- **90-second inter-room silence:** Between rooms, nothing visually communicates that a cooldown is happening. Looks frozen.
- **Session done:** No celebratory UX moment. Agents walk back to lobby and... nothing. Just a footer appearing below.

### Dashboard
- No sort/filter on sessions list.
- No visual distinction between completed/failed/running sessions at a glance.
- No way to delete a session.

---

## Priority Fix Order

1. Remove sign-in modal + resolve "no login" contradiction
2. Remove or stub properly: Settings + Artifacts dead-end pages
3. Add `beforeunload` warning for active sessions
4. Fix the run page load sequence — show something immediately
5. Make room transitions visible (centred overlay, floor pulse)
6. Add room dividers to the message feed
7. Make error states prominent + add retry
8. Add "session complete" toast / auto-scroll
9. Fix artifact labels and download feedback
10. Onboarding copy on first dashboard visit
