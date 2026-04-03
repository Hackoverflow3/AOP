# Frontend Issues — Catalyst Audit
_Last updated: 2026-04-02_

---

## Critical — Blocking

### 1. Hardcoded `localhost:8000` in 3 places
- **Files:** `lib/useSSE.ts:18`, `components/DownloadButton.tsx:8`, `app/run/[id]/page.tsx:1766`
- **Problem:** Backend URL is hardcoded. App is completely broken in any non-local environment.
- **Fix:** Create `lib/config.ts` exporting `BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'` and use it everywhere.

### 2. SSE connection never retries
- **File:** `lib/useSSE.ts`
- **Problem:** `es.onerror` closes the connection and sets status to `error` with no retry. If backend takes 2+ seconds to start, user sees "Connecting" forever.
- **Fix:** Add exponential backoff retry (up to 3 attempts, 1s / 2s / 4s delays).

### 3. JSON parse errors silently swallowed
- **File:** `lib/useSSE.ts:28`
- **Problem:** `catch { /* ignore parse errors */ }` — invalid JSON or HTML error pages from backend are silently discarded. User sees nothing.
- **Fix:** Log the error and set status to `error` with a descriptive message.

### 4. API calls don't check `res.ok`
- **File:** `lib/api.ts`
- **Problem:** All fetch calls call `.json()` without checking if `res.ok`. A 500 response tries to parse error HTML as JSON and throws a cryptic error.
- **Fix:** Add `if (!res.ok) throw new Error(await res.text())` before every `.json()` call.

### 5. Form stuck in submitting state on redirect failure
- **File:** `app/dashboard/page.tsx`
- **Problem:** If `createSession` succeeds but `router.push()` fails, the form stays `submitting=true` permanently. No retry possible without a full page refresh.
- **Fix:** Wrap redirect in try/catch and reset `submitting` state on failure.

### 6. EventSource ref leaks on rapid mount/unmount
- **File:** `lib/useSSE.ts`
- **Problem:** Cleanup only closes `es` captured in closure. `esRef.current` is never nulled. Rapid mount/unmount can leave stale EventSource instances alive.
- **Fix:** Set `esRef.current = null` in the cleanup return function.

---

## High — Memory Leaks & Race Conditions

### 7. Three.js cleanup race — last tick fires after disposal
- **File:** `app/run/[id]/page.tsx`
- **Problem:** `cancelAnimationFrame` is called but the already-queued final frame can still fire and access disposed Three.js objects, causing WebGL errors.
- **Fix:** Add a `destroyed` boolean flag checked at the top of `tick()`.

### 8. GLB loading has no timeout
- **File:** `app/run/[id]/page.tsx`
- **Problem:** If any GLB file is missing or slow, `gltfLoader.load()` hangs indefinitely. User sees "Loading agents 3/4" forever.
- **Fix:** Add a `setTimeout` (e.g. 15s) per loader that calls the error callback if it fires before the success callback.

### 9. `targetPositionsRef` written before model loads
- **File:** `app/run/[id]/page.tsx`
- **Problem:** `targetPositionsRef` is pre-populated before the GLB loads. If SSE events fire and update positions before the model exists in the scene, the first movement will be broken/jerky.
- **Fix:** In the GLB success callback, snap model position directly to current `targetPositionsRef` value instead of relying on the lerp catching up.

### 10. `setTimeout` in `session_done` fires after unmount
- **File:** `app/run/[id]/page.tsx`
- **Problem:** `setTimeout(() => { celebrationRef.current = ... }, 2000)` captures the ref. If the component unmounts before 2s, the callback still fires and mutates state.
- **Fix:** Store the timeout ID and clear it in the cleanup function.

### 11. `room_done` pulse `requestAnimationFrame` never cleaned up
- **File:** `app/run/[id]/page.tsx`
- **Problem:** When a room finishes, a `pulseFn` is registered via `requestAnimationFrame` for each agent. If the component unmounts while pulsing, these callbacks fire on a dead component.
- **Fix:** Track pulse frame IDs and cancel them in the scene cleanup.

### 12. Events array grows unbounded
- **File:** `lib/useSSE.ts`
- **Problem:** Every SSE event is appended to state: `[...prev, event]`. No cap. A long session accumulates thousands of objects in React state.
- **Fix:** Cap at a reasonable limit (e.g. 500 events) or only keep events needed for derived state.

---

## Medium — Logic Errors

### 13. Thought dot doesn't reliably show for Dev agent
- **File:** `app/run/[id]/page.tsx`
- **Problem:** Code maps `"The Dev" → "Dev"` but agent is registered as `"Dev"` in `AGENT_DEFS`. If backend sends `"Dev"` directly the mapping is a no-op, but if it sends a third variant the dot never appears.
- **Fix:** Normalize all agent names in one place at SSE event ingestion time.

### 14. Empty string fallback on missing `room` field masks bugs
- **File:** `app/run/[id]/page.tsx`
- **Problem:** `ev.room ?? ''` means messages with no room silently display "Room " (empty). Real SSE bugs are invisible.
- **Fix:** Filter out or flag events missing required fields instead of using empty fallbacks.

### 15. `key={idx}` in message list
- **File:** `app/run/[id]/page.tsx`
- **Problem:** React uses array index as key. Any future message deletion or reorder will cause incorrect reconciliation.
- **Fix:** Use a stable unique key — e.g. `${msg.room}-${msg.agent}-${idx}` or add a UUID to each event.

### 16. Material `transparent` flag toggled every frame
- **File:** `app/run/[id]/page.tsx`
- **Problem:** The proximity fade code sets `mat.transparent = true/false` every frame. Toggling this flag forces Three.js to recompile the shader on each change, tanking performance.
- **Fix:** Set `transparent = true` once on load and only animate `opacity`.

### 17. Room geometry not disposed before clearing `roomRefsMap`
- **File:** `app/run/[id]/page.tsx`
- **Problem:** `roomRefsMap.current.clear()` removes references to room lights and materials without calling `.dispose()` on them first. GPU memory leaks.
- **Fix:** Iterate over `roomRefsMap` and dispose lights/materials before clearing.

### 18. Failed GLB load leaves agent unregistered
- **File:** `app/run/[id]/page.tsx`
- **Problem:** The GLB error callback increments the counter but doesn't add the agent to `agentMeshesRef`. Room positioning logic still tries to move it, throwing silent errors.
- **Fix:** Insert a null sentinel into `agentMeshesRef` and guard all agent lookups against null.

### 19. Celebration scale not reset if user navigates away
- **File:** `app/run/[id]/page.tsx`
- **Problem:** If user navigates away while celebration is running, agent scales are left modified. On return (if component remounts), agents are weirdly scaled.
- **Fix:** Reset all agent scales to 1 in the scene cleanup function.

### 20. `as any` casts defeat TypeScript safety
- **File:** `app/run/[id]/page.tsx`
- **Problem:** `completedRooms.has(roomId as any)` and `roomId={roomId as any}` bypass type checking. Invalid room IDs can slip through unnoticed.
- **Fix:** Define a proper `RoomId` type (`'A' | 'B' | 'C' | 'D' | 'E'`) and use it everywhere.

### 21. `FEED_AGENT_COLORS` brittle — any backend name variant wrong
- **File:** `app/run/[id]/page.tsx`
- **Problem:** Agent name → color mapping hardcodes specific strings. Any variant sent by the backend (e.g. `"the_dev"`, `"developer"`) falls back to `FALLBACK_COLOR`.
- **Fix:** Normalize agent names on SSE ingestion using a single mapping function.

### 22. `new THREE.Color()` created on every render
- **File:** `app/run/[id]/page.tsx`
- **Problem:** The feed header creates `new THREE.Color(ROOM_COLORS[activeRoom])` on every React render to derive CSS strings. Three.js objects are expensive to construct.
- **Fix:** Pre-compute CSS color strings from `ROOM_COLORS` once at module level.

### 23. Dashboard error doesn't clear on resubmit
- **File:** `app/dashboard/page.tsx`
- **Problem:** `formError` is set in catch but never cleared on a new submission attempt. Old errors linger.
- **Fix:** Set `formError = null` at the top of the submit handler before the try block.

---

## Low — UI / UX / Configuration

### 24. No real loading feedback while GLB models load
- **File:** `app/run/[id]/page.tsx`
- **Problem:** Loading indicator is a tiny corner pill with a count. The 3D canvas is blank. Users have no idea if the page is working or broken.
- **Fix:** Show a proper centered loading state over the 3D canvas until all models are loaded.

### 25. Error banner never dismisses — no close button
- **File:** `app/run/[id]/page.tsx`
- **Problem:** SSE `error` event shows a banner that stays forever. No auto-dismiss, no close button.
- **Fix:** Add a close (×) button and optionally auto-dismiss after 8s.

### 26. Sign-in modal does nothing
- **File:** `app/page.tsx`
- **Problem:** "Sign In" button opens a modal with email/password fields but the "Continue" button has no handler. Completely misleading.
- **Fix:** Either remove the modal entirely or add a placeholder message ("Auth coming soon").

### 27. Inputs not disabled during form submission
- **File:** `app/page.tsx`, `app/dashboard/page.tsx`
- **Problem:** Submit button disables on submit but input fields stay editable. User can modify the form mid-flight.
- **Fix:** Disable all form inputs when `submitting === true`.

### 28. No `.env.local` / environment variable support
- **Files:** All API call locations
- **Problem:** No `NEXT_PUBLIC_BACKEND_URL` env var. Moving to production requires a code change.
- **Fix:** Create `.env.local.example` and read backend URL from `process.env.NEXT_PUBLIC_BACKEND_URL`.

### 29. `OfficeMap.tsx` is dead code
- **File:** `components/OfficeMap.tsx`
- **Problem:** Stub component that renders nothing. May be imported somewhere unnecessarily.
- **Fix:** Delete or implement.

### 30. Settings and Artifacts pages are broken stubs
- **Files:** `app/settings/page.tsx`, `app/artifacts/page.tsx`
- **Problem:** Both are reachable via navigation but render nothing useful. Users think the app is broken.
- **Fix:** Either implement them or show a clear "Coming soon" message with navigation back to dashboard.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 6 |
| High | 6 |
| Medium | 11 |
| Low | 7 |
| **Total** | **30** |

## Recommended Fix Order

1. Hardcoded URLs → env var (`NEXT_PUBLIC_BACKEND_URL`) — unblocks all environments
2. `res.ok` checks in `api.ts` — stops silent failures
3. SSE retry logic — stops stuck "Connecting" state
4. `destroyed` flag in tick loop — stops WebGL errors on unmount
5. GLB timeout — stops infinite loading spinner
6. Clear `setTimeout` and `requestAnimationFrame` on unmount — memory leaks
7. `transparent` flag toggling fix — performance
8. `RoomId` type + remove `as any` — type safety
9. UI polish (error banner close, loading state, disabled inputs)
