'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useSSE } from '@/lib/useSSE'
import { AGENT_COLORS } from '@/lib/utils'
import DownloadButton from '@/components/DownloadButton'
import ApprovalGate from '@/components/ApprovalGate'
import CooldownBanner from '@/components/CooldownBanner'
import { BACKEND_URL } from '@/lib/config'

// ─── constants ────────────────────────────────────────────────────────────────

const ROOM_NAMES_EXT: Record<string, string> = {
  A: 'War Room',
  B: 'Ideation Hive',
  C: 'The Forge',
  D: 'Observatory',
  E: 'Demo Room',
}

const ROOM_LABELS: Record<string, [string, string]> = {
  A: ['WAR ROOM', 'A'],
  B: ['IDEATION HIVE', 'B'],
  C: ['THE FORGE', 'C'],
  D: ['OBSERVATORY', 'D'],
  E: ['DEMO ROOM', 'E'],
}

// Room centers in world (x, z) — lobby is (0, 0)
const ROOM_POSITIONS: Record<string, { x: number; z: number }> = {
  A: { x: -8, z: -6 },
  B: { x: 8, z: -6 },
  C: { x: -8, z: 6 },
  D: { x: 8, z: 6 },
  E: { x: 0, z: 14 },
  LOBBY: { x: 0, z: 0 },
}

// Room accent colors (hex numbers for Three.js)
const ROOM_COLORS: Record<string, number> = {
  A: 0x7b4fd4, // deep purple
  B: 0x4f7bd4, // electric blue
  C: 0x1cc8a0, // teal
  D: 0xf5a623, // amber
  E: 0xffd700, // gold
}

// Room dimensions (width, depth)
const ROOM_DIMS: Record<string, { w: number; d: number }> = {
  A: { w: 9, d: 7 },
  B: { w: 9, d: 7 },
  C: { w: 9, d: 7 },
  D: { w: 9, d: 7 },
  E: { w: 10, d: 7 },
}

// Which agents occupy each room
const ROOM_AGENTS: Record<string, string[]> = {
  A: ['Director', 'Catalyst'],
  B: ['Director', 'Architect', 'Dev', 'Catalyst'],
  C: ['Architect', 'Dev'],
  D: ['Director'],
  E: ['Director', 'Architect', 'Dev', 'Catalyst'],
}

// Agent definitions — GLB model path + accent color per spec
const AGENT_DEFS = [
  { name: 'Director',  model: '/models/director.glb',  color: 0x8b7cf8, cssColor: '#8B7CF8' },
  { name: 'Architect', model: '/models/architect.glb', color: 0x1cc8a0, cssColor: '#1CC8A0' },
  { name: 'Dev',       model: '/models/dev.glb',       color: 0xf5a623, cssColor: '#F5A623' },
  { name: 'Catalyst',  model: '/models/catalyst.glb',  color: 0xe85d40, cssColor: '#E85D40' },
]

// Agent color lookup for the message feed panel
const FEED_AGENT_COLORS: Record<string, string> = {
  Director: '#8B7CF8',
  Architect: '#1CC8A0',
  Dev: '#F5A623',
  'The Dev': '#F5A623',
  Catalyst: '#E85D40',
  ...AGENT_COLORS,
}

const FALLBACK_COLOR = '#7B6EE8'

const ROOM_ORDER = ['A', 'B', 'C', 'D', 'E']

// Per-room inside camera anchors — position + lookAt when user enters a room
const ROOM_CAM_IN: Record<string, { pos: [number,number,number]; look: [number,number,number] }> = {
  A: { pos: [-8,  1.6, -2.0], look: [-8,  1.4, -9.5] },
  B: { pos: [ 8,  1.6, -2.0], look: [ 8,  1.4, -9.5] },
  C: { pos: [-8,  1.6,  9.5], look: [-8,  1.4,  2.5] },
  D: { pos: [ 8,  1.6,  9.5], look: [ 8,  1.4,  2.5] },
  E: { pos: [ 0,  1.6, 18.5], look: [ 0,  1.4, 10.5] },
}

// Pre-computed CSS accent colors per room (avoid new THREE.Color in render)
const ROOM_ACCENT_CSS: Record<string, string> = {
  A: '#7B4FD4', B: '#4F7BD4', C: '#1CC8A0', D: '#F5A623', E: '#FFD700',
}

// ─── canvas sprite helpers ────────────────────────────────────────────────────

function makeTextSprite(
  line1: string,
  line2: string,
  color: string = '#ffffff',
  bgAlpha: number = 0.0,
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 80
  const ctx = canvas.getContext('2d')!

  if (bgAlpha > 0) {
    ctx.fillStyle = `rgba(10,12,20,${bgAlpha})`
    ctx.roundRect(0, 0, 256, 80, 8)
    ctx.fill()
  }

  ctx.textAlign = 'center'

  if (line2) {
    ctx.font = 'bold 36px monospace'
    ctx.fillStyle = color
    ctx.globalAlpha = 0.95
    ctx.fillText(line2, 128, 52)
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = 'rgba(200,196,240,0.85)'
    ctx.globalAlpha = 0.85
    ctx.fillText(line1, 128, 22)
  } else {
    ctx.font = 'bold 16px sans-serif'
    ctx.globalAlpha = 0.95
    ctx.fillStyle = color
    ctx.fillText(line1, 128, 48)
  }

  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(3.2, 1.0, 1)
  return sprite
}

function makeAgentLabel(name: string, cssColor: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 40
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 192, 40)
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = cssColor
  ctx.globalAlpha = 0.9
  ctx.fillText(name, 96, 26)

  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.8, 0.45, 1)
  return sprite
}

// ─── GLB agent data types ─────────────────────────────────────────────────────

interface AgentMeshData {
  group: THREE.Group
  mixer: THREE.AnimationMixer
  idleAction: THREE.AnimationAction | null
  walkAction: THREE.AnimationAction | null
  currentAction: THREE.AnimationAction | null
  targetPos: THREE.Vector3
  isMoving: boolean
  thoughtDot: THREE.Mesh
  thoughtTimer: number
}

// ─── thought dot helper ───────────────────────────────────────────────────────

function makeThoughtDot(color: number): THREE.Mesh {
  const accentColor = new THREE.Color(color)
  const dotMat = new THREE.MeshStandardMaterial({
    color,
    emissive: accentColor.clone(),
    emissiveIntensity: 1.0,
    roughness: 0.2,
  })
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), dotMat)
  dot.position.set(0, 2.4, 0) // above head of Mixamo character at scale 0.012
  dot.visible = false
  return dot
}

// ─── UNUSED legacy block removed — buildAgent() replaced by GLTFLoader calls ─

// (buildAgent procedural geometry removed — agents now loaded via GLTFLoader)

// ─── room geometry builder ────────────────────────────────────────────────────

interface RoomRefs {
  floorMat: THREE.MeshStandardMaterial
  accentLight: THREE.PointLight
  targetIntensity: number
  boardCanvas: HTMLCanvasElement
  boardTexture: THREE.CanvasTexture
  floorMesh: THREE.Mesh
}

function buildRoom(
  scene: THREE.Scene,
  roomId: string,
): RoomRefs {
  const pos = ROOM_POSITIONS[roomId]
  const dims = ROOM_DIMS[roomId]
  const color = ROOM_COLORS[roomId]
  const accentColor = new THREE.Color(color)
  const wallH = 2.8
  const wallThick = 0.18

  // ── Room floor tile (polished concrete — visible from overhead) ──
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1e2238,
    roughness: 0.38,
    metalness: 0.18,
    emissive: accentColor.clone().multiplyScalar(0.025),
  })
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(dims.w, dims.d), floorMat)
  roomFloor.rotation.x = -Math.PI / 2
  roomFloor.position.set(pos.x, 0.002, pos.z)
  roomFloor.receiveShadow = true
  scene.add(roomFloor)

  // ── Ceiling panel ──
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x181a2a,
    roughness: 0.85,
    metalness: 0,
    emissive: accentColor.clone().multiplyScalar(0.04),
  })
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(dims.w, dims.d), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.set(pos.x, wallH, pos.z)
  scene.add(ceil)

  // ── Walls (dark but readable) ──
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e30,
    roughness: 0.85,
    metalness: 0,
    emissive: accentColor.clone().multiplyScalar(0.018),
  })

  // North wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w, wallH, wallThick),
    wallMat.clone(),
  )
  northWall.position.set(pos.x, wallH / 2, pos.z - dims.d / 2)
  northWall.receiveShadow = true
  northWall.castShadow = true
  scene.add(northWall)

  // South wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w, wallH, wallThick),
    wallMat.clone(),
  )
  southWall.position.set(pos.x, wallH / 2, pos.z + dims.d / 2)
  southWall.receiveShadow = true
  southWall.castShadow = true
  scene.add(southWall)

  // East wall (with glass panel cutout effect via transparent overlay)
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, wallH, dims.d),
    wallMat.clone(),
  )
  eastWall.position.set(pos.x + dims.w / 2, wallH / 2, pos.z)
  eastWall.receiveShadow = true
  eastWall.castShadow = true
  scene.add(eastWall)

  // West wall
  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, wallH, dims.d),
    wallMat.clone(),
  )
  westWall.position.set(pos.x - dims.w / 2, wallH / 2, pos.z)
  westWall.receiveShadow = true
  westWall.castShadow = true
  scene.add(westWall)

  // ── Glass partition panels (inner south-facing wall, partial) ──
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: accentColor.clone().multiplyScalar(0.3),
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.7,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  })

  // Glass panel on south side (lower half) — lobby-facing
  const glassPanel = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w * 0.55, wallH * 0.55, 0.04),
    glassMat,
  )
  glassPanel.position.set(pos.x, wallH * 0.28, pos.z + dims.d / 2 - 0.08)
  scene.add(glassPanel)

  // ── Recessed LED strip on ceiling perimeter ──
  const ledMat = new THREE.MeshStandardMaterial({
    color: accentColor.clone(),
    emissive: accentColor.clone(),
    emissiveIntensity: 1.4,
    roughness: 0.15,
  })
  // North + South LED strips
  ;[pos.z - dims.d / 2 + 0.15, pos.z + dims.d / 2 - 0.15].forEach((zOff) => {
    const led = new THREE.Mesh(new THREE.BoxGeometry(dims.w - 0.4, 0.04, 0.06), ledMat.clone())
    led.position.set(pos.x, wallH - 0.08, zOff)
    scene.add(led)
  })
  // East + West LED strips
  ;[pos.x - dims.w / 2 + 0.15, pos.x + dims.w / 2 - 0.15].forEach((xOff) => {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, dims.d - 0.4), ledMat.clone())
    led.position.set(xOff, wallH - 0.08, pos.z)
    scene.add(led)
  })

  // ── Corner pillars ──
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x252840,
    roughness: 0.65,
    metalness: 0.1,
    emissive: accentColor.clone().multiplyScalar(0.12),
  })
  ;[
    [pos.x - dims.w / 2, pos.z - dims.d / 2],
    [pos.x + dims.w / 2, pos.z - dims.d / 2],
    [pos.x - dims.w / 2, pos.z + dims.d / 2],
    [pos.x + dims.w / 2, pos.z + dims.d / 2],
  ].forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, wallH, 0.28),
      pillarMat.clone(),
    )
    pillar.position.set(px, wallH / 2, pz)
    pillar.castShadow = true
    scene.add(pillar)
  })

  // ── Conference table ──
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.72,
    metalness: 0.08,
  })
  const tableW = dims.w * 0.5
  const tableD = dims.d * 0.35
  const table = new THREE.Mesh(new THREE.BoxGeometry(tableW, 0.1, tableD), tableMat)
  table.position.set(pos.x, 0.65, pos.z)
  table.castShadow = true
  table.receiveShadow = true
  scene.add(table)

  // Table gloss surface
  const glossMat = new THREE.MeshStandardMaterial({
    color: 0x6a4d38,
    roughness: 0.1,
    metalness: 0.25,
    transparent: true,
    opacity: 0.7,
  })
  const gloss = new THREE.Mesh(new THREE.BoxGeometry(tableW - 0.05, 0.008, tableD - 0.05), glossMat)
  gloss.position.set(pos.x, 0.705, pos.z)
  scene.add(gloss)

  // Table legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e1008, roughness: 0.85 })
  const legOffsets = [
    [-tableW * 0.42, -tableD * 0.42],
    [tableW * 0.42, -tableD * 0.42],
    [-tableW * 0.42, tableD * 0.42],
    [tableW * 0.42, tableD * 0.42],
  ]
  legOffsets.forEach(([ox, oz]) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.06, 0.64, 8),
      legMat,
    )
    leg.position.set(pos.x + ox, 0.32, pos.z + oz)
    leg.castShadow = true
    scene.add(leg)
  })

  // ── Chairs around the table ──
  const chairMat = new THREE.MeshStandardMaterial({
    color: 0x222238,
    roughness: 0.7,
    metalness: 0.15,
    emissive: accentColor.clone().multiplyScalar(0.04),
  })
  const chairPositions = [
    { x: pos.x - tableW * 0.55, z: pos.z, ry: Math.PI / 2 },
    { x: pos.x + tableW * 0.55, z: pos.z, ry: -Math.PI / 2 },
    { x: pos.x, z: pos.z - tableD * 0.72, ry: 0 },
    { x: pos.x, z: pos.z + tableD * 0.72, ry: Math.PI },
  ]
  chairPositions.forEach(({ x: cx, z: cz, ry }) => {
    const chairGroup = new THREE.Group()
    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), chairMat)
    seat.position.y = 0.42
    chairGroup.add(seat)
    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.05), chairMat)
    back.position.set(0, 0.66, -0.2)
    chairGroup.add(back)
    // Legs
    ;[
      [-0.17, -0.17],
      [0.17, -0.17],
      [-0.17, 0.17],
      [0.17, 0.17],
    ].forEach(([lx, lz]) => {
      const cleg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6),
        chairMat,
      )
      cleg.position.set(lx, 0.21, lz)
      chairGroup.add(cleg)
    })
    chairGroup.position.set(cx, 0, cz)
    chairGroup.rotation.y = ry
    chairGroup.castShadow = true
    scene.add(chairGroup)
  })

  // ── Laptops on table ──
  const laptopMat = new THREE.MeshStandardMaterial({
    color: 0x1a1030,
    roughness: 0.4,
    metalness: 0.6,
  })
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x080524,
    emissive: accentColor.clone().multiplyScalar(0.7),
    emissiveIntensity: 0.9,
    roughness: 0.15,
  })
  ;[
    [pos.x - tableW * 0.22, pos.z - tableD * 0.1],
    [pos.x + tableW * 0.22, pos.z + tableD * 0.1],
  ].forEach(([lx, lz]) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.35), laptopMat)
    base.position.set(lx, 0.71, lz)
    scene.add(base)
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.015), screenMat)
    screen.position.set(lx, 0.87, lz - 0.16)
    screen.rotation.x = 0.32
    scene.add(screen)
  })

  // ── Room label sprite ──
  const [label1, label2] = ROOM_LABELS[roomId]
  const sprite = makeTextSprite(label1, label2, `#${new THREE.Color(color).getHexString()}`, 0.55)
  sprite.position.set(pos.x, 4.0, pos.z)
  scene.add(sprite)

  // ── Ceiling light fixture (visible panel + warm point light) ──
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.9,
    roughness: 0.3,
  })
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.4, 0.05, 0.18), fixtureMat)
  fixture.position.set(pos.x, wallH - 0.04, pos.z)
  scene.add(fixture)

  // Warm overhead fill from ceiling fixture
  const ceilLight = new THREE.PointLight(0xd8d0ff, 0.5, dims.w * 1.4)
  ceilLight.position.set(pos.x, wallH - 0.1, pos.z)
  scene.add(ceilLight)

  // ── Per-room accent point light (starts at moderate intensity) ──
  const accentLight = new THREE.PointLight(color, 0.4, 16)
  accentLight.position.set(pos.x, 2.2, pos.z)
  accentLight.castShadow = false
  scene.add(accentLight)

  // ── Live content board (north wall) ──
  const boardCanvas = document.createElement('canvas')
  boardCanvas.width = 1024
  boardCanvas.height = 512
  const bctx = boardCanvas.getContext('2d')!
  bctx.fillStyle = '#06080f'
  bctx.fillRect(0, 0, 1024, 512)
  bctx.fillStyle = accentColor.clone().getStyle()
  bctx.font = 'bold 20px monospace'
  bctx.fillText(ROOM_LABELS[roomId]?.[0] ?? roomId, 16, 40)
  bctx.fillStyle = 'rgba(180,176,240,0.5)'
  bctx.font = '15px monospace'
  bctx.fillText('Waiting for session to start...', 16, 70)

  const boardTex = new THREE.CanvasTexture(boardCanvas)
  const boardMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    roughness: 0.12,
    metalness: 0.0,
    emissive: accentColor.clone().multiplyScalar(0.04),
  })
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w * 0.78, 2.0, 0.05),
    boardMat,
  )
  boardMesh.position.set(pos.x, 1.65, pos.z - dims.d / 2 + 0.08)
  scene.add(boardMesh)

  // Board glow light
  const boardLight = new THREE.PointLight(color, 0.3, 6)
  boardLight.position.set(pos.x, 2.0, pos.z - dims.d / 2 + 0.5)
  scene.add(boardLight)

  return { floorMat, accentLight, targetIntensity: 0.4, boardCanvas, boardTexture: boardTex, floorMesh: roomFloor }
}

// ─── decorative props ─────────────────────────────────────────────────────────

function addDecorativeProps(scene: THREE.Scene) {
  // Lobby desk
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x2a1a06, roughness: 0.7 })
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.4), deskMat)
  desk.position.set(0, 0.62, 0)
  desk.castShadow = true
  desk.receiveShadow = true
  scene.add(desk)

  // Desk legs
  const legM = new THREE.MeshStandardMaterial({ color: 0x1a0e00, roughness: 0.8 })
  ;[
    [-1.35, -0.6],
    [1.35, -0.6],
    [-1.35, 0.6],
    [1.35, 0.6],
  ].forEach(([ox, oz]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.62, 8), legM)
    l.position.set(ox, 0.31, oz)
    l.castShadow = true
    scene.add(l)
  })

  // Lobby monitor
  const monitorBaseMat = new THREE.MeshStandardMaterial({
    color: 0x181828,
    roughness: 0.5,
    metalness: 0.3,
  })
  const monBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.3), monitorBaseMat)
  monBase.position.set(0, 0.67, -0.1)
  scene.add(monBase)
  const monStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8),
    monitorBaseMat,
  )
  monStem.position.set(0, 0.79, -0.1)
  scene.add(monStem)
  const monScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.36, 0.015),
    new THREE.MeshStandardMaterial({
      color: 0x080620,
      emissive: 0x5a4aec,
      emissiveIntensity: 1.1,
      roughness: 0.15,
    }),
  )
  monScreen.position.set(0, 1.0, -0.1)
  scene.add(monScreen)

  // Plant — cone on cylinder pot
  const potMat = new THREE.MeshStandardMaterial({ color: 0x3d2418, roughness: 0.8 })
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x1a4a1a,
    roughness: 0.7,
    emissive: 0x082208,
    emissiveIntensity: 0.2,
  })
  ;[
    [-12, -8],
    [12, -8],
  ].forEach(([px, pz]) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 10), potMat)
    pot.position.set(px, 0.175, pz)
    scene.add(pot)
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8), leafMat)
    leaf.position.set(px, 0.7, pz)
    scene.add(leaf)
    const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), leafMat)
    leaf2.position.set(px + 0.12, 0.9, pz)
    scene.add(leaf2)
  })

  // Server rack (between rooms, near east side)
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.4, metalness: 0.5 })
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.5), rackMat)
  rack.position.set(14, 0.9, 0)
  rack.castShadow = true
  scene.add(rack)
  // Emissive dots on server rack
  ;[0.3, 0.0, -0.3, -0.6].forEach((yOff, i) => {
    const dotColors = [0x1cc8a0, 0xf5a623, 0x4f7bd4, 0x7b4fd4]
    const d = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshStandardMaterial({
        color: dotColors[i],
        emissive: new THREE.Color(dotColors[i]),
        emissiveIntensity: 1.0,
      }),
    )
    d.position.set(14.22, 0.9 + yOff, -0.12)
    scene.add(d)
  })

  // Corridor floor markings (emissive strips between rooms)
  const markMat = new THREE.MeshStandardMaterial({
    color: 0x2a2c48,
    emissive: new THREE.Color(0x2a2c48),
    emissiveIntensity: 1.0,
    roughness: 0.8,
  })
  // Horizontal corridor strip between rows
  const hStrip = new THREE.Mesh(new THREE.BoxGeometry(28, 0.005, 0.08), markMat)
  hStrip.position.set(0, 0.003, 0)
  scene.add(hStrip)
  // Vertical corridor strip
  const vStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 24), markMat)
  vStrip.position.set(0, 0.003, 4)
  scene.add(vStrip)
}

// ─── per-room agent spread positions ─────────────────────────────────────────

function getAgentPositionsInRoom(
  roomId: string,
  agentNames: string[],
): Record<string, { x: number; z: number }> {
  const center = ROOM_POSITIONS[roomId]
  const result: Record<string, { x: number; z: number }> = {}

  if (agentNames.length === 1) {
    result[agentNames[0]] = { x: center.x, z: center.z }
  } else if (agentNames.length === 2) {
    result[agentNames[0]] = { x: center.x - 1.0, z: center.z }
    result[agentNames[1]] = { x: center.x + 1.0, z: center.z }
  } else if (agentNames.length === 3) {
    result[agentNames[0]] = { x: center.x - 0.9, z: center.z - 0.5 }
    result[agentNames[1]] = { x: center.x + 0.9, z: center.z - 0.5 }
    result[agentNames[2]] = { x: center.x, z: center.z + 0.8 }
  } else {
    result[agentNames[0]] = { x: center.x - 0.8, z: center.z - 0.7 }
    result[agentNames[1]] = { x: center.x + 0.8, z: center.z - 0.7 }
    result[agentNames[2]] = { x: center.x - 0.8, z: center.z + 0.7 }
    result[agentNames[3]] = { x: center.x + 0.8, z: center.z + 0.7 }
  }

  return result
}

// ─── main page component ───────────────────────────────────────────────────────

export default function RunPage({ params }: { params: { id: string } }) {
  const { events, status } = useSSE(params.id)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Three.js refs
  const mountRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())

  // Agent mesh map: name -> AgentMeshData (populated async by GLTFLoader)
  const agentMeshesRef = useRef<Map<string, AgentMeshData>>(new Map())

  // Target positions for smooth lerp movement (kept separate for SSE wiring)
  const targetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map())

  // Walking state (kept for legacy SSE wiring compatibility)
  const walkingRef = useRef<Set<string>>(new Set())

  // Room refs
  const roomRefsMap = useRef<Map<string, RoomRefs>>(new Map())
  const roomDoneRef = useRef<Set<string>>(new Set())
  const activeRoomRef = useRef<string | null>(null)

  // Camera shake
  const cameraShakeRef = useRef({ active: false, t: 0, intensity: 0 })
  const baseCameraPos = { x: 0, y: 30, z: 22 }

  // Camera state machine
  type CamMode = 'overview' | 'transitioning' | 'in_room'
  const camModeRef = useRef<CamMode>('overview')
  const camTweenRef = useRef({
    t: 0, duration: 1.5,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromLook: new THREE.Vector3(0, 0, 0),
    toLook: new THREE.Vector3(0, 0, 0),
    toMode: 'overview' as CamMode,
  })
  const activeRoomViewRef = useRef<string | null>(null)

  // Live board canvases
  const boardCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const boardTexturesRef = useRef<Map<string, THREE.CanvasTexture>>(new Map())
  const roomMessagesRef = useRef<Map<string, Array<{agent: string, content: string}>>>(new Map())

  // Clickable floor meshes (for room entry click detection)
  const roomFloorMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())

  // Raycaster
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())

  // Cooldown state
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [cooldownNextRoom, setCooldownNextRoom] = useState('')
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Approval gate state
  const [pendingApproval, setPendingApproval] = useState<{
    roomId: string; content: string
  } | null>(null)

  // Which room the user is currently inside (UI state)
  const [inRoomView, setInRoomView] = useState<string | null>(null)

  // Celebration state
  const celebrationRef = useRef({ active: false, t: 0 })

  // Loading overlay — tracks how many of the 4 GLB models have loaded
  const [modelsLoaded, setModelsLoaded] = useState(0)
  const modelsLoadedRef = useRef(0) // ref mirror for use inside rAF closure

  // ── derived state from SSE events ───────────────────────────────────────────

  const activeRoom = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].event === 'room_enter') return events[i].room ?? null
    }
    return null
  }, [events])

  const completedRooms = useMemo(() => {
    const set = new Set<string>()
    for (const ev of events) {
      if (ev.event === 'room_done' && ev.room) set.add(ev.room)
    }
    return set
  }, [events])

  const messages = useMemo(() => {
    return events
      .filter((ev) => ev.event === 'message')
      .map((ev) => ({
        room: ev.room ?? '',
        agent: ev.agent ?? 'Agent',
        content: ev.content ?? '',
      }))
  }, [events])

  const readyArtifacts = useMemo(() => {
    const map: Record<string, string> = {}
    for (const ev of events) {
      if (ev.event === 'artifact_ready' && ev.room) {
        const name = ev.filename ?? ev.artifact
        if (name) map[ev.room] = name
      }
    }
    return map
  }, [events])

  const isDone = useMemo(() => events.some((ev) => ev.event === 'session_done'), [events])

  const errorMessage = useMemo(() => {
    const ev = events.find((e) => e.event === 'error')
    return ev?.content ?? null
  }, [events])

  // ── auto-scroll message list ─────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Board canvas update helpers ───────────────────────────────────────────
  function updateBoardCanvas(roomId: string) {
    const canvas = boardCanvasesRef.current.get(roomId)
    const texture = boardTexturesRef.current.get(roomId)
    if (!canvas || !texture) return

    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const accent = ROOM_ACCENT_CSS[roomId] ?? '#7B7CF8'
    const msgs = roomMessagesRef.current.get(roomId) ?? []

    // Background
    ctx.fillStyle = '#06080f'
    ctx.fillRect(0, 0, W, H)

    // Header bar
    ctx.fillStyle = accent + '33'
    ctx.fillRect(0, 0, W, 46)
    ctx.fillStyle = accent
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(ROOM_NAMES_EXT[roomId] ?? roomId, 16, 31)
    ctx.fillStyle = 'rgba(200,196,240,0.5)'
    ctx.font = '13px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(msgs.length + ' messages', W - 16, 31)
    ctx.textAlign = 'left'

    // Separator
    ctx.strokeStyle = accent + '55'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, 46); ctx.lineTo(W, 46); ctx.stroke()

    // Messages — show last 5
    const recent = msgs.slice(-5)
    let y = 64
    for (const msg of recent) {
      if (y > H - 20) break
      const agentColor = FEED_AGENT_COLORS[msg.agent] ?? '#ffffff'

      // Agent name
      ctx.fillStyle = agentColor
      ctx.font = 'bold 13px monospace'
      ctx.fillText('▸ ' + msg.agent, 14, y)
      y += 17

      // Content — word wrap, max 3 lines
      ctx.fillStyle = 'rgba(218,214,255,0.88)'
      ctx.font = '12px monospace'
      const words = msg.content.replace(/\n/g, ' ').split(' ')
      let line = ''
      let lines = 0
      for (const word of words) {
        if (lines >= 3) break
        const test = line + word + ' '
        if (ctx.measureText(test).width > W - 28) {
          ctx.fillText(line.trimEnd(), 14, y)
          y += 15
          line = word + ' '
          lines++
        } else {
          line = test
        }
      }
      if (lines < 3 && line.trim()) {
        ctx.fillText(line.trimEnd(), 14, y)
        y += 15
      }
      y += 8
    }

    texture.needsUpdate = true
  }

  function renderDemoTerminal(messages: Array<{agent: string, content: string}>) {
    const canvas = boardCanvasesRef.current.get('E')
    const texture = boardTexturesRef.current.get('E')
    if (!canvas || !texture) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height

    ctx.fillStyle = '#000a00'
    ctx.fillRect(0, 0, W, H)

    // Terminal header
    ctx.fillStyle = '#001400'
    ctx.fillRect(0, 0, W, 36)
    ctx.fillStyle = '#00ff41'
    ctx.font = 'bold 14px monospace'
    ctx.fillText('AOP DEMO — EXECUTION LOG', 14, 24)

    // Separator
    ctx.strokeStyle = '#00ff4133'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, 36); ctx.lineTo(W, 36); ctx.stroke()

    let y = 54
    for (const msg of messages.slice(-8)) {
      if (y > H - 16) break
      ctx.fillStyle = '#004d00'
      ctx.font = '11px monospace'
      ctx.fillText('$ ' + msg.agent, 14, y)
      y += 14
      ctx.fillStyle = '#00cc33'
      ctx.font = '11px monospace'
      const lines = msg.content.split('\n').slice(0, 3)
      for (const line of lines) {
        ctx.fillText('  ' + line.slice(0, 120), 14, y)
        y += 14
      }
      y += 6
    }

    // Blinking cursor
    ctx.fillStyle = '#00ff41'
    ctx.fillRect(14, y, 8, 13)

    texture.needsUpdate = true
  }

  // ── Three.js scene setup (runs once on mount) ────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x070912, 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.8
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070912)
    scene.fog = new THREE.FogExp2(0x070912, 0.011)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(42, 1, 1.0, 150)
    camera.position.set(baseCameraPos.x, baseCameraPos.y, baseCameraPos.z)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // ── Resize handling ────────────────────────────────────────────────────────
    let W = el.clientWidth
    let H = el.clientHeight || 600

    const handleResize = () => {
      W = el.clientWidth
      H = el.clientHeight || 600
      renderer.setSize(W, H, false)
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      if (composerRef.current) {
        composerRef.current.setSize(W, H)
      }
    }
    handleResize()
    const ro = new ResizeObserver(handleResize)
    ro.observe(el)

    // ── Post-processing ────────────────────────────────────────────────────────
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(W, H),
      0.55,  // strength — noticeable but not overwhelming
      0.45,  // radius
      0.22,  // threshold — emissive surfaces trigger bloom
    )
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())
    composerRef.current = composer

    // ── Global floor ──────────────────────────────────────────────────────────
    const globalFloorMat = new THREE.MeshStandardMaterial({
      color: 0x151824,
      roughness: 0.45,
      metalness: 0.15,
    })
    const globalFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), globalFloorMat)
    globalFloor.rotation.x = -Math.PI / 2
    globalFloor.position.y = 0
    globalFloor.receiveShadow = true
    scene.add(globalFloor)

    // Grid helper — very subtle
    const grid = new THREE.GridHelper(60, 60, 0x232640, 0x181b30)
    grid.position.y = 0.001
    scene.add(grid)

    // Central lobby glow ring on floor
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x5040a8,
      emissive: new THREE.Color(0x5040a8),
      emissiveIntensity: 0.35,
      roughness: 0.8,
      transparent: true,
      opacity: 0.5,
    })
    const glowCircle = new THREE.Mesh(new THREE.RingGeometry(2.5, 4.5, 48), glowMat)
    glowCircle.rotation.x = -Math.PI / 2
    glowCircle.position.set(0, 0.003, 0)
    scene.add(glowCircle)

    // Inner solid circle
    const innerGlowMat = new THREE.MeshStandardMaterial({
      color: 0x3530a0,
      emissive: new THREE.Color(0x3530a0),
      emissiveIntensity: 0.2,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3,
    })
    const innerCircle = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32), innerGlowMat)
    innerCircle.rotation.x = -Math.PI / 2
    innerCircle.position.set(0, 0.003, 0)
    scene.add(innerCircle)

    // ── Rooms ─────────────────────────────────────────────────────────────────
    const ROOM_IDS = ['A', 'B', 'C', 'D', 'E']
    ROOM_IDS.forEach((roomId) => {
      const refs = buildRoom(scene, roomId)
      roomRefsMap.current.set(roomId, refs)
      boardCanvasesRef.current.set(roomId, refs.boardCanvas)
      boardTexturesRef.current.set(roomId, refs.boardTexture)
      roomFloorMeshesRef.current.set(roomId, refs.floorMesh)
    })

    // ── Decorative props ──────────────────────────────────────────────────────
    addDecorativeProps(scene)

    // ── Room E: presentation screen + stage lighting ──────────────────────────
    {
      const ePos = ROOM_POSITIONS.E
      const gold = new THREE.Color(ROOM_COLORS.E)

      // Large presentation screen on north wall
      const screenFrameMat = new THREE.MeshStandardMaterial({
        color: 0x0a0814,
        roughness: 0.5,
        metalness: 0.6,
      })
      const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.8, 0.08), screenFrameMat)
      screenFrame.position.set(ePos.x, 1.6, ePos.z - ROOM_DIMS.E.d / 2 + 0.12)
      scene.add(screenFrame)

      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x050820,
        emissive: gold.clone().multiplyScalar(0.18),
        emissiveIntensity: 1.0,
        roughness: 0.1,
      })
      const screen = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.4, 0.02), screenMat)
      screen.position.set(ePos.x, 1.6, ePos.z - ROOM_DIMS.E.d / 2 + 0.18)
      scene.add(screen)

      // AOP logo text on the screen (code display lines)
      ;[-0.6, -0.1, 0.4].forEach((yOff, i) => {
        const lineWidths = [4.5, 3.2, 5.0]
        const lineMat = new THREE.MeshStandardMaterial({
          color: gold.clone().multiplyScalar(0.6),
          emissive: gold.clone().multiplyScalar(0.4),
          emissiveIntensity: 0.8,
        })
        const line = new THREE.Mesh(new THREE.BoxGeometry(lineWidths[i], 0.04, 0.01), lineMat)
        line.position.set(ePos.x - 0.5, 1.6 + yOff, ePos.z - ROOM_DIMS.E.d / 2 + 0.2)
        scene.add(line)
      })

      // Spotlight on presentation screen
      const spotLight = new THREE.SpotLight(gold.clone().multiplyScalar(1.2), 2.0, 12, Math.PI * 0.18, 0.4)
      spotLight.position.set(ePos.x, 3.2, ePos.z + 1.5)
      spotLight.target.position.set(ePos.x, 1.5, ePos.z - ROOM_DIMS.E.d / 2 + 0.5)
      scene.add(spotLight)
      scene.add(spotLight.target)

      // Stage podium
      const podiumMat = new THREE.MeshStandardMaterial({
        color: 0x1a1228,
        roughness: 0.6,
        metalness: 0.3,
        emissive: gold.clone().multiplyScalar(0.06),
      })
      const podium = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), podiumMat)
      podium.position.set(ePos.x, 0.4, ePos.z - ROOM_DIMS.E.d * 0.25)
      scene.add(podium)
    }

    // ── Agents — load Mixamo GLB characters asynchronously ───────────────────
    const gltfLoader = new GLTFLoader()
    const lobbyPos = ROOM_POSITIONS.LOBBY

    // Spread offsets so all 4 agents don't stack on exactly the same spot
    const lobbyOffsets = [
      { x: -0.7, z: -0.5 },
      { x:  0.7, z: -0.5 },
      { x: -0.7, z:  0.5 },
      { x:  0.7, z:  0.5 },
    ]

    AGENT_DEFS.forEach((def, idx) => {
      // Pre-register target position so SSE events can set it before the model loads
      const offset = lobbyOffsets[idx] ?? { x: 0, z: 0 }
      targetPositionsRef.current.set(
        def.name,
        new THREE.Vector3(lobbyPos.x + offset.x, 0, lobbyPos.z + offset.z),
      )

      gltfLoader.load(
        def.model,
        (gltf) => {
          const model = gltf.scene

          // Scale down Mixamo characters (exported at 1 unit = 1 cm)
          model.scale.set(0.012, 0.012, 0.012)

          // Enable shadows on every mesh in the rig
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })

          // Place at lobby spread position
          const tgt = targetPositionsRef.current.get(def.name)!
          model.position.set(tgt.x, 0, tgt.z)

          // Floating name label above head
          const label = makeAgentLabel(def.name, def.cssColor)
          label.position.set(0, 2.3, 0) // ~2.3 world units = ~192 cm at scale 0.012
          model.add(label)

          // Thought dot (above label)
          const dot = makeThoughtDot(def.color)
          model.add(dot)

          // Aura point light attached to model
          const aura = new THREE.PointLight(def.color, 0.3, 2.5)
          aura.position.set(0, 1.8, 0)
          model.add(aura)

          scene.add(model)

          // ── Animation mixer ──
          const mixer = new THREE.AnimationMixer(model)
          const animations = gltf.animations
          let idleAction: THREE.AnimationAction | null = null
          let walkAction: THREE.AnimationAction | null = null

          animations.forEach((clip) => {
            const name = clip.name.toLowerCase()
            if (name.includes('idle') || name.includes('breathing')) {
              idleAction = mixer.clipAction(clip)
            } else if (name.includes('walk') || name.includes('run')) {
              walkAction = mixer.clipAction(clip)
            }
          })

          // Fallback: if naming didn't match, use first clip for both
          if (!idleAction && animations.length > 0) {
            idleAction = mixer.clipAction(animations[0])
          }
          if (!walkAction && animations.length > 0) {
            walkAction = mixer.clipAction(animations[0])
          }

          // Start idle animation
          if (idleAction) (idleAction as THREE.AnimationAction).play()

          agentMeshesRef.current.set(def.name, {
            group: model,
            mixer,
            idleAction,
            walkAction,
            currentAction: idleAction,
            targetPos: new THREE.Vector3(tgt.x, 0, tgt.z),
            isMoving: false,
            thoughtDot: dot,
            thoughtTimer: 0,
          })

          // Track loading progress
          modelsLoadedRef.current += 1
          setModelsLoaded(modelsLoadedRef.current)
        },
        undefined, // onProgress — not needed
        (err) => {
          console.error(`Failed to load GLB for ${def.name}:`, err)
          // Still increment counter so the overlay can clear
          modelsLoadedRef.current += 1
          setModelsLoaded(modelsLoadedRef.current)
        },
      )
    })

    // ── Lighting ──────────────────────────────────────────────────────────────

    // 1. Hemisphere light — cool sky, warm ground bounce
    const hemi = new THREE.HemisphereLight(0x3a5080, 0x1a1430, 0.7)
    scene.add(hemi)

    // 2. Ambient fill — reduces pure black shadows
    scene.add(new THREE.AmbientLight(0x202840, 0.8))

    // 3. Main top-down directional — shadows
    const keyLight = new THREE.DirectionalLight(0xd0d8ff, 0.65)
    keyLight.position.set(4, 22, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.camera.near = 1
    keyLight.shadow.camera.far = 55
    keyLight.shadow.camera.left = -32
    keyLight.shadow.camera.right = 32
    keyLight.shadow.camera.top = 32
    keyLight.shadow.camera.bottom = -32
    keyLight.shadow.bias = -0.0002
    scene.add(keyLight)

    // 4. Subtle warm fill from south — prevents flat backs on agents
    const fillLight = new THREE.DirectionalLight(0x8a6a40, 0.22)
    fillLight.position.set(-8, 6, 14)
    scene.add(fillLight)

    // 5. Lobby overhead — purple-white
    const lobbyLight = new THREE.PointLight(0x5a4a80, 1.1, 18)
    lobbyLight.position.set(0, 5, 0)
    scene.add(lobbyLight)

    // ── Animate loop ──────────────────────────────────────────────────────────
    let t = 0

    function tick() {
      frameRef.current = requestAnimationFrame(tick)
      const delta = clockRef.current.getDelta()
      t += delta

      // ── Camera shake ──
      const shake = cameraShakeRef.current
      if (shake.active) {
        shake.t += delta
        const progress = shake.t / 0.35
        if (progress >= 1) {
          shake.active = false
          camera.position.set(baseCameraPos.x, baseCameraPos.y, baseCameraPos.z)
        } else {
          const decay = 1 - progress
          const freq = 28
          camera.position.x = baseCameraPos.x + Math.sin(shake.t * freq) * shake.intensity * decay
          camera.position.y = baseCameraPos.y + Math.cos(shake.t * freq * 1.3) * shake.intensity * 0.4 * decay
          camera.position.z = baseCameraPos.z
        }
        camera.lookAt(0, 0, 0)
      }

      // ── Celebration ──
      const cel = celebrationRef.current
      if (cel.active) {
        cel.t += delta
        const pulse = 1 + Math.sin(cel.t * 8) * 0.12 * Math.max(0, 1 - cel.t / 2.5)
        agentMeshesRef.current.forEach(({ group }) => {
          group.scale.setScalar(pulse)
        })
        if (cel.t > 2.5) {
          cel.active = false
          agentMeshesRef.current.forEach(({ group }) => {
            group.scale.setScalar(1)
          })
        }
      }

      // ── Agent movement + mixer update ──
      agentMeshesRef.current.forEach((data, name) => {
        // Drive the AnimationMixer with real delta time
        data.mixer.update(delta)

        // Sync targetPos from the shared targetPositionsRef (SSE events write there)
        const externalTarget = targetPositionsRef.current.get(name)
        if (externalTarget) {
          data.targetPos.copy(externalTarget)
        }

        const pos = data.group.position
        const target = data.targetPos
        const dist = pos.distanceTo(target)

        if (dist > 0.05) {
          // ── Walking ──
          pos.lerp(target, 0.035)

          // Bobbing up/down to fake footsteps (subtle)
          pos.y = Math.abs(Math.sin(t * 7)) * 0.03

          // Face direction of travel
          const dir = target.clone().sub(pos)
          if (dir.lengthSq() > 0.0001) {
            const angle = Math.atan2(dir.x, dir.z)
            data.group.rotation.y = THREE.MathUtils.lerp(data.group.rotation.y, angle, 0.15)
          }

          // Slight forward tilt while walking
          data.group.rotation.x = THREE.MathUtils.lerp(data.group.rotation.x, -0.08, 0.1)

          // Transition to walk animation (speed up if walk clip available)
          if (!data.isMoving) {
            data.isMoving = true
            if (data.walkAction && data.walkAction !== data.idleAction) {
              data.currentAction?.fadeOut(0.15)
              data.walkAction.reset().setEffectiveTimeScale(1.4).fadeIn(0.15).play()
              data.currentAction = data.walkAction
            } else if (data.currentAction) {
              // Speed up idle animation to fake walking pace
              data.currentAction.setEffectiveTimeScale(2.5)
            }
          }

          walkingRef.current.add(name)
        } else if (data.isMoving) {
          // ── Just stopped — snap to exact target and switch back to idle ──
          data.isMoving = false
          pos.copy(target)
          pos.y = 0
          data.group.rotation.x = 0
          walkingRef.current.delete(name)

          if (data.walkAction && data.walkAction !== data.idleAction) {
            data.currentAction?.fadeOut(0.2)
            data.idleAction?.reset().setEffectiveTimeScale(1).fadeIn(0.2).play()
            data.currentAction = data.idleAction
          } else if (data.currentAction) {
            // Slow back to normal idle speed
            data.currentAction.setEffectiveTimeScale(1)
          }
        } else {
          // Subtle idle breathing bob
          pos.y = Math.sin(t * 1.2) * 0.008
        }

        // Proximity fade — agent fades transparent when too close to camera
        const camPos = camera.position
        const agentDist = camPos.distanceTo(pos)
        const fadeStart = 10, fadeEnd = 5
        const targetOpacity = agentDist < fadeEnd ? 0 :
          agentDist < fadeStart ? (agentDist - fadeEnd) / (fadeStart - fadeEnd) : 1
        data.group.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (mesh.isMesh && mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial
            if (targetOpacity < 1) {
              mat.transparent = true
              mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, targetOpacity, 0.1)
            } else if (mat.opacity < 0.99) {
              mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1, 0.1)
            } else {
              mat.transparent = false
              mat.opacity = 1
            }
          }
        })

        // Thought dot timer countdown
        if (data.thoughtTimer > 0) {
          data.thoughtTimer -= delta
          if (data.thoughtTimer <= 0) {
            data.thoughtDot.visible = false
          }
        }
      })

      // ── Room light intensity lerp ──
      roomRefsMap.current.forEach((refs, roomId) => {
        const isActive = activeRoomRef.current === roomId
        const isDoneRoom = roomDoneRef.current.has(roomId)

        let target: number
        if (isActive) {
          // Active: pulse around intensity 3.8 (brighter, more dramatic)
          target = 3.6 + Math.sin(t * 3) * 0.35
        } else if (isDoneRoom) {
          target = 1.0
        } else {
          target = 0.4
        }

        // Smooth lerp at ~0.06 per frame
        const cur = refs.accentLight.intensity
        refs.accentLight.intensity = cur + (target - cur) * 0.06
      })

      // ── Camera tween (room enter/exit) ──
      if (camModeRef.current === 'transitioning') {
        const tw = camTweenRef.current
        tw.t += delta / tw.duration
        const p = Math.min(tw.t, 1)
        // easeInOutQuad
        const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
        camera.position.lerpVectors(tw.fromPos, tw.toPos, eased)
        const lookNow = tw.fromLook.clone().lerp(tw.toLook, eased)
        camera.lookAt(lookNow)
        if (p >= 1) {
          camModeRef.current = tw.toMode
          camera.position.copy(tw.toPos)
          camera.lookAt(tw.toLook)
        }
      }

      composer.render()
    }

    tick()

    // ── Room click detection ──
    const handleClick = (e: MouseEvent) => {
      if (camModeRef.current !== 'overview') return
      const rect = el.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycasterRef.current.setFromCamera(mouseRef.current, camera)

      const floors = Array.from(roomFloorMeshesRef.current.values())
      const hits = raycasterRef.current.intersectObjects(floors)
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh
        for (const [rid, mesh] of roomFloorMeshesRef.current.entries()) {
          if (mesh === hitMesh) {
            // Trigger camera fly-in
            const anchor = ROOM_CAM_IN[rid]
            if (!anchor) break
            camTweenRef.current = {
              t: 0, duration: 1.5,
              fromPos: camera.position.clone(),
              toPos: new THREE.Vector3(...anchor.pos),
              fromLook: new THREE.Vector3(0, 0, 0),
              toLook: new THREE.Vector3(...anchor.look),
              toMode: 'in_room',
            }
            camModeRef.current = 'transitioning'
            activeRoomViewRef.current = rid
            setInRoomView(rid)
            break
          }
        }
      }
    }
    el.addEventListener('click', handleClick)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      el.removeEventListener('click', handleClick)

      // Dispose all geometries and materials in scene
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material?.dispose()
          }
        }
        if (obj instanceof THREE.Sprite) {
          obj.material?.map?.dispose()
          obj.material?.dispose()
        }
      })

      composer.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)

      // Stop and uncache all animation mixers
      agentMeshesRef.current.forEach(({ mixer }) => {
        mixer.stopAllAction()
        mixer.uncacheRoot(mixer.getRoot())
      })

      rendererRef.current = null
      composerRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      agentMeshesRef.current.clear()
      targetPositionsRef.current.clear()
      walkingRef.current.clear()
      roomRefsMap.current.clear()
      roomDoneRef.current.clear()
      activeRoomRef.current = null
      modelsLoadedRef.current = 0
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current)
      boardCanvasesRef.current.clear()
      boardTexturesRef.current.clear()
      roomMessagesRef.current.clear()
      roomFloorMeshesRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Wire SSE events to 3D scene ──────────────────────────────────────────────
  useEffect(() => {
    if (events.length === 0) return

    const lastEvent = events[events.length - 1]

    if (lastEvent.event === 'room_enter' && lastEvent.room) {
      const roomId = lastEvent.room as string
      activeRoomRef.current = roomId

      // Camera shake on room transition
      cameraShakeRef.current = { active: true, t: 0, intensity: 0.18 }

      // Move assigned agents to room positions
      const agents = ROOM_AGENTS[roomId] ?? []
      const positions = getAgentPositionsInRoom(roomId, agents)
      agents.forEach((agentName) => {
        const pos = positions[agentName]
        if (pos) {
          targetPositionsRef.current.set(agentName, new THREE.Vector3(pos.x, 0, pos.z))
        }
      })
    }

    if (lastEvent.event === 'room_done' && lastEvent.room) {
      const roomId = lastEvent.room as string
      roomDoneRef.current.add(roomId)
      if (activeRoomRef.current === roomId) activeRoomRef.current = null

      // Brief scale pulse on agents in that room
      const agents = ROOM_AGENTS[roomId] ?? []
      agents.forEach((name) => {
        const data = agentMeshesRef.current.get(name)
        if (!data) return
        let pulseT = 0
        const pulseFn = () => {
          pulseT += 0.016
          const prog = pulseT / 0.4
          if (prog >= 1) {
            data.group.scale.setScalar(1)
            return
          }
          const s = 1 + Math.sin(prog * Math.PI) * 0.15
          data.group.scale.setScalar(s)
          requestAnimationFrame(pulseFn)
        }
        requestAnimationFrame(pulseFn)
      })
    }

    if (lastEvent.event === 'message' && lastEvent.agent) {
      // Show thought dot above speaking agent for 2s
      const agentName = lastEvent.agent === 'The Dev' ? 'Dev' : (lastEvent.agent as string)
      const data = agentMeshesRef.current.get(agentName)
      if (data) {
        data.thoughtDot.visible = true
        data.thoughtTimer = 2.0
      }

      // Update that room's live board canvas
      if (lastEvent.room) {
        const roomId = lastEvent.room as string
        const msgs = roomMessagesRef.current.get(roomId) ?? []
        msgs.push({ agent: lastEvent.agent ?? 'Agent', content: lastEvent.content ?? '' })
        roomMessagesRef.current.set(roomId, msgs)
        if (roomId === 'E') {
          renderDemoTerminal(msgs)
        } else {
          updateBoardCanvas(roomId)
        }
      }
    }

    if (lastEvent.event === 'awaiting_approval' && lastEvent.room) {
      setPendingApproval({
        roomId: lastEvent.room as string,
        content: lastEvent.approval_content ?? lastEvent.content ?? '',
      })
    }

    if (lastEvent.event === 'cooldown' && lastEvent.duration) {
      const total = lastEvent.duration as number
      setCooldownLeft(total)
      // Find next room (the one after current active)
      const nextIdx = ROOM_ORDER.indexOf(activeRoomRef.current ?? '') + 1
      setCooldownNextRoom(ROOM_ORDER[nextIdx] ? ROOM_NAMES_EXT[ROOM_ORDER[nextIdx]] : '')
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current)
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownLeft(prev => {
          if (prev <= 1) {
            clearInterval(cooldownIntervalRef.current!)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    if (lastEvent.event === 'session_done') {
      activeRoomRef.current = null

      // Walk all agents back to lobby spread
      AGENT_DEFS.forEach((def, i) => {
        const offsets = [
          { x: -0.7, z: -0.5 },
          { x: 0.7, z: -0.5 },
          { x: -0.7, z: 0.5 },
          { x: 0.7, z: 0.5 },
        ]
        const off = offsets[i] ?? { x: 0, z: 0 }
        targetPositionsRef.current.set(
          def.name,
          new THREE.Vector3(ROOM_POSITIONS.LOBBY.x + off.x, 0, ROOM_POSITIONS.LOBBY.z + off.z),
        )
      })

      // Start celebration after agents walk home
      setTimeout(() => {
        celebrationRef.current = { active: true, t: 0 }
      }, 2000)
    }
  }, [events])

  // ── status bar values ────────────────────────────────────────────────────────
  const statusLabel =
    status === 'connecting'
      ? 'Connecting'
      : status === 'running'
      ? `Room ${activeRoom ?? '…'} — ${ROOM_NAMES_EXT[activeRoom ?? ''] ?? ''}`
      : status === 'done'
      ? 'Done'
      : 'Error'

  return (
    <div
      style={{
        background: '#07090D',
        height: '100vh',
        color: '#EAE8F5',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {/* Approval gate overlay */}
      {pendingApproval && (
        <ApprovalGate
          roomId={pendingApproval.roomId}
          roomName={ROOM_NAMES_EXT[pendingApproval.roomId] ?? pendingApproval.roomId}
          content={pendingApproval.content}
          sessionId={params.id}
          onApproved={() => setPendingApproval(null)}
        />
      )}

      {/* ── top nav ── */}
      <div
        style={{
          borderBottom: '1px solid rgba(123,110,232,0.18)',
          background: 'rgba(18,20,34,0.97)',
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 46,
            padding: '0 20px',
            gap: 14,
          }}
        >
          <a
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#8B7CF8',
                boxShadow: '0 0 8px rgba(139,124,248,.7)',
              }}
            />
            <span
              style={{ fontSize: 13, fontWeight: 800, color: '#EAE8F8', letterSpacing: '.1em' }}
            >
              AOP
            </span>
          </a>

          {/* Status pill */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.06em',
              color:
                status === 'done'
                  ? '#1CC8A0'
                  : status === 'error'
                  ? '#E85D40'
                  : status === 'running'
                  ? '#F5A623'
                  : '#5A5870',
              background:
                status === 'done'
                  ? 'rgba(28,200,160,0.12)'
                  : status === 'error'
                  ? 'rgba(232,93,64,0.12)'
                  : status === 'running'
                  ? 'rgba(245,166,35,0.12)'
                  : 'rgba(90,88,112,0.18)',
              borderRadius: 5,
              padding: '3px 9px',
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </span>

          <span
            style={{
              fontSize: 11,
              color: '#44406A',
              marginLeft: 'auto',
              fontFamily: 'monospace',
            }}
          >
            {params.id.slice(0, 8)}…
          </span>
        </div>
      </div>

      {/* ── error banner ── */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(232,93,64,0.14)',
            border: '1px solid rgba(232,93,64,0.35)',
            borderRadius: 8,
            padding: '10px 20px',
            margin: '10px 16px 0',
            fontSize: 13,
            color: '#E85D40',
            flexShrink: 0,
          }}
        >
          Error: {errorMessage}
        </div>
      )}

      {/* ── main split layout ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT 70%: Three.js 3D office ── */}
        <div
          style={{
            flex: '0 0 70%',
            position: 'relative',
            background: '#070912',
            overflow: 'hidden',
          }}
        >
          <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

          {/* Small non-blocking loading indicator — bottom-right corner */}
          {modelsLoaded < AGENT_DEFS.length && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'rgba(7,9,18,0.85)',
              border: '1px solid rgba(139,124,248,0.3)',
              borderRadius: 8, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
              zIndex: 20, pointerEvents: 'none',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#8B7CF8',
                boxShadow: '0 0 6px #8B7CF8',
                animation: 'pulse 1s infinite',
              }} />
              <span style={{ fontSize: 11, color: '#8B7CF8', fontWeight: 600 }}>
                Loading agents {modelsLoaded}/{AGENT_DEFS.length}
              </span>
            </div>
          )}

          {/* Agent legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              pointerEvents: 'none',
            }}
          >
            {AGENT_DEFS.map((def) => (
              <div key={def.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: def.cssColor,
                    boxShadow: `0 0 6px ${def.cssColor}88`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 10, color: 'rgba(200,196,240,0.7)', fontWeight: 600 }}>
                  {def.name}
                </span>
              </div>
            ))}
          </div>

          {/* Room legend */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              pointerEvents: 'none',
            }}
          >
            {Object.entries(ROOM_NAMES_EXT).map(([roomId, roomName]) => {
              const isActive = activeRoom === roomId
              const isDoneRoom = completedRooms.has(roomId as any)
              const color = `#${new THREE.Color(ROOM_COLORS[roomId]).getHexString()}`
              return (
                <div
                  key={roomId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: isActive ? 1 : isDoneRoom ? 0.7 : 0.4,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 1,
                      background: color,
                      boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9,
                      color: isActive ? color : 'rgba(180,176,220,0.7)',
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {roomId} · {roomName}
                  </span>
                  {isDoneRoom && (
                    <span style={{ fontSize: 9, color: '#1CC8A0' }}>✓</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Exit room button — only visible when inside a room */}
          {inRoomView && (
            <button
              onClick={() => {
                const anchor = { pos: [baseCameraPos.x, baseCameraPos.y, baseCameraPos.z] as [number,number,number], look: [0,0,0] as [number,number,number] }
                if (!cameraRef.current) return
                camTweenRef.current = {
                  t: 0, duration: 1.2,
                  fromPos: cameraRef.current.position.clone(),
                  toPos: new THREE.Vector3(...anchor.pos),
                  fromLook: new THREE.Vector3(...(ROOM_CAM_IN[inRoomView]?.look ?? [0,0,0])),
                  toLook: new THREE.Vector3(0, 0, 0),
                  toMode: 'overview',
                }
                camModeRef.current = 'transitioning'
                activeRoomViewRef.current = null
                setInRoomView(null)
              }}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(13,15,26,0.92)',
                border: '1px solid rgba(139,124,248,0.4)',
                borderRadius: 8, padding: '7px 14px',
                color: '#8B7CF8', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', zIndex: 30,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ← Office Overview
            </button>
          )}

          {/* Click hint — only in overview mode with no room active */}
          {!inRoomView && (
            <div style={{
              position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(13,15,26,0.7)',
              border: '1px solid rgba(139,124,248,0.2)',
              borderRadius: 20, padding: '5px 14px',
              color: 'rgba(180,176,240,0.6)', fontSize: 10, fontWeight: 600,
              pointerEvents: 'none', letterSpacing: '.06em',
            }}>
              CLICK ANY ROOM TO ENTER
            </div>
          )}

          {/* Cooldown banner */}
          {cooldownLeft > 0 && (
            <CooldownBanner secondsLeft={cooldownLeft} nextRoom={cooldownNextRoom} />
          )}
        </div>

        {/* ── RIGHT 30%: message feed ── */}
        <div
          style={{
            flex: '0 0 30%',
            display: 'flex',
            flexDirection: 'column',
            background: '#0D0F1A',
            borderLeft: '1px solid rgba(123,110,232,0.15)',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Feed header */}
          <div
            style={{
              padding: '12px 16px 10px',
              borderBottom: '1px solid rgba(123,110,232,0.12)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#5A5870',
              }}
            >
              Agent Feed
            </span>
            {activeRoom && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: `#${new THREE.Color(ROOM_COLORS[activeRoom] ?? 0x7b6ee8).getHexString()}`,
                  background: `rgba(${new THREE.Color(ROOM_COLORS[activeRoom] ?? 0x7b6ee8).r * 255 | 0},${new THREE.Color(ROOM_COLORS[activeRoom] ?? 0x7b6ee8).g * 255 | 0},${new THREE.Color(ROOM_COLORS[activeRoom] ?? 0x7b6ee8).b * 255 | 0},0.12)`,
                  borderRadius: 4,
                  padding: '2px 7px',
                  letterSpacing: '.04em',
                }}
              >
                Room {activeRoom} — {ROOM_NAMES_EXT[activeRoom]}
              </span>
            )}
          </div>

          {/* Artifacts strip */}
          {Object.keys(readyArtifacts).length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                borderBottom: '1px solid rgba(123,110,232,0.10)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: '#44406A',
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }}
              >
                Artifacts
              </span>
              {Object.entries(readyArtifacts).map(([roomId, filename]) => (
                <div key={roomId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#8B7CF8',
                      fontWeight: 600,
                      minWidth: 16,
                    }}
                  >
                    {roomId}
                  </span>
                  <DownloadButton
                    filename={filename}
                    sessionId={params.id}
                    roomId={roomId as any}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 14px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  color: '#44406A',
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 40,
                  lineHeight: 1.7,
                }}
              >
                {status === 'connecting'
                  ? 'Connecting to session…'
                  : 'Waiting for agents to speak…'}
              </div>
            )}

            {messages.map((msg, idx) => {
              const agentColor = FEED_AGENT_COLORS[msg.agent] ?? FALLBACK_COLOR
              return (
                <div
                  key={idx}
                  style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  {/* Agent header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: agentColor,
                        boxShadow: `0 0 5px ${agentColor}88`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: agentColor,
                        letterSpacing: '.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {msg.agent}
                    </span>
                    {msg.room && (
                      <span style={{ fontSize: 9, color: '#44406A', marginLeft: 'auto' }}>
                        Room {msg.room}
                      </span>
                    )}
                  </div>
                  {/* Message bubble */}
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `0.5px solid ${agentColor}28`,
                      borderRadius: '0 8px 8px 8px',
                      padding: '8px 10px',
                      fontSize: 12,
                      color: '#C8C4E4',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              )
            })}

            <div ref={bottomRef} />
          </div>

          {/* Download all footer */}
          {isDone && (
            <div
              style={{
                borderTop: '1px solid rgba(123,110,232,0.14)',
                padding: '12px 16px',
                background: 'rgba(18,20,34,0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, color: '#1CC8A0', fontWeight: 600 }}>
                Session complete
              </span>
              <a
                href={`${BACKEND_URL}/artifacts/${params.id}/zip`}
                download
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(28,200,160,0.15)',
                  border: '0.5px solid rgba(28,200,160,0.45)',
                  borderRadius: 7,
                  padding: '6px 14px',
                  color: '#1CC8A0',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Download All ZIP
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
