---
name: run_page_3d_office
description: Cinematic 3D office on run page — architecture, agent names, room layout, SSE wiring, post-processing, known type quirks (Room E, 'The Dev' vs 'Dev')
type: project
---

The `/app/run/[id]/page.tsx` contains a full cinematic Three.js 3D office scene (rebuilt April 2026).

**Architecture:**
- Left 70%: Three.js canvas (useRef + useEffect + rAF loop)
- Right 30%: Scrolling agent message feed panel (unchanged from prior version)
- Post-processing: EffectComposer → RenderPass → UnrealBloomPass (strength 0.8, radius 0.4, threshold 0.3) → OutputPass
- Imported from `three/addons/postprocessing/...` (resolves via package.json exports map to `three/examples/jsm/...`)

**Renderer config:**
- antialias, powerPreference: 'high-performance'
- shadowMap enabled, PCFSoftShadowMap
- toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.2
- outputColorSpace: SRGBColorSpace

**Camera:** position (0, 22, 14), lookAt (0, 0, 2) — fixed isometric top-down angle

**Rooms (5 + lobby):** A(-8,-6), B(8,-6), C(-8,6), D(8,6), E(0,14), LOBBY(0,0)
- Each room has: full-height walls (2.8 units), glass partition panel, LED ceiling strips, conference table with chairs + laptops, corner pillars
- Per-room accent PointLight — lerps to intensity 3 when active, 0.6 when done, 0.1 when idle

**Agents (4 humanoid figures):**
- Director: skin #C68642, hair #1a1a1a, PURPLE shirt
- Architect: skin #F1C27D, hair #D4A853, AMBER shirt
- Dev: skin #8D5524, hair #0a0a0a, TEAL shirt
- Catalyst: skin #FDBCB4, hair #8B0000, RED-ORANGE shirt
- Each has: feet, legs (trousers), torso (shirt), shoulders, arms, hands, neck, head, hair cap, eyes, aura PointLight, floating name label sprite, thought dot

**Agent names in 3D layer use**: Director, Architect, Dev, Catalyst
- SSE can emit 'The Dev' — message handler normalizes it: `lastEvent.agent === 'The Dev' ? 'Dev' : lastEvent.agent`
- `utils.ts` AGENT_COLORS maps 'The Dev' — local `FEED_AGENT_COLORS` covers both for the message panel

**Room IDs**: A, B, C, D, E — lib/types.ts only types RoomId as A-D; Room E handled as `string` throughout with `as any` on completedRooms.has()

**SSE wiring** (second `useEffect` watching `events` array):
- `room_enter` → move room's agents (lerp speed 0.03), camera shake, set activeRoomRef
- `room_done` → brief scale pulse on agents in that room, mark roomDoneRef, clear activeRoomRef
- `message` → show thought dot above speaking agent for 2s (thoughtTimer countdown in rAF)
- `session_done` → agents walk to lobby spread, 2s delayed celebration pulse

**Movement system**: `targetPositionsRef` (Map<string, Vector3>) + `walkingRef` Set. rAF lerps at 0.03. Walk bob: `Math.abs(Math.sin(t * 8)) * 0.08`. Idle: sin oscillation amplitude 0.01.

**Decorative props**: lobby desk + monitor, 2 plants (near rooms A/B), server rack (east side) with emissive status dots, corridor floor marking strips.

**Why rebuilt:** Original scene used basic colored boxes/cylinders. New scene uses PBR materials, full room walls, post-processing bloom, humanoid agents with per-agent appearance.

**How to apply:** If adding new rooms or agents, update ROOM_AGENTS, ROOM_POSITIONS, ROOM_DIMS, ROOM_COLORS, ROOM_LABELS, and AGENT_DEFS constants at top of page.tsx.
