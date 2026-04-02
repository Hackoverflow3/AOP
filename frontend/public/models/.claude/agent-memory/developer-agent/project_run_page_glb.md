---
name: run_page_glb_agents
description: Run page agent rendering uses GLTFLoader for Mixamo GLB models; key interface shape, animation system, and loading architecture
type: project
---

`/app/run/[id]/page.tsx` loads 4 Mixamo GLB characters from `/public/models/{director,architect,dev,catalyst}.glb` via `GLTFLoader` (no Draco compression).

**AgentMeshData interface** (as of 2026-04-02):
- `group` — THREE.Group (the gltf.scene root)
- `mixer` — THREE.AnimationMixer driven by `clock.getDelta()` in the rAF loop
- `idleAction`, `walkAction`, `currentAction` — THREE.AnimationAction | null
- `targetPos` — THREE.Vector3 (synced from `targetPositionsRef` each frame)
- `isMoving` — boolean for idle/walk transition guard
- `thoughtDot` — THREE.Mesh added to model group (visible=false by default)
- `thoughtTimer` — number, decremented by delta each frame

**Scale**: `model.scale.set(0.012, 0.012, 0.012)` — Mixamo exported at 1 unit = 1 cm; at 0.012 a 170 cm character is ~2 world units tall.

**Label/dot heights**: label sprite at y=2.3, thought dot at y=2.4 (both added as children of the model group so they move with it).

**Loading overlay**: `useState(modelsLoaded)` + `modelsLoadedRef` (ref mirror for rAF closure) drives a 4-step progress bar overlay that disappears when all models load.

**Animation name heuristic**: clips containing "idle"/"breathing" → idleAction; "walk"/"run" → walkAction. Falls back to animations[0] for both if no match.

**SSE wiring** writes to `targetPositionsRef` (not `agentMeshesRef.targetPos` directly). The tick loop copies `targetPositionsRef → agentData.targetPos` each frame. This means SSE can fire before a model finishes loading safely.

**Why:** replaced procedural humanoid geometry (buildAgent) to show real Mixamo characters with embedded skeletal animations.

**How to apply:** if tweaking agent visuals or animation transitions, all changes belong in the `gltfLoader.load` callback (per-agent setup) or the agent update block inside `tick()`.
