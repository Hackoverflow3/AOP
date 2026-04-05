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
const ROOM_ACCENT_RGBA012: Record<string, string> = {
  A: 'rgba(123,79,212,0.12)', B: 'rgba(79,123,212,0.12)',
  C: 'rgba(28,200,160,0.12)', D: 'rgba(245,166,35,0.12)', E: 'rgba(255,215,0,0.12)',
}

// Proper RoomId type — replaces `as any` casts
type RoomId = 'A' | 'B' | 'C' | 'D' | 'E'

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
  bobPhase: number   // phase offset so agents don't idle-breathe in sync
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

// ─── canvas texture helpers ───────────────────────────────────────────────────

function makeWoodFloorTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 512
  const ctx = c.getContext('2d')!
  const plankColors = ['#3a2514', '#442c18', '#32200f', '#3e2818']
  const plankH = 52
  for (let y = 0; y < 512; y += plankH) {
    const ci = Math.floor(y / plankH) % plankColors.length
    ctx.fillStyle = plankColors[ci]
    ctx.fillRect(0, y, 512, plankH - 1)
    // Grain lines
    ctx.strokeStyle = 'rgba(10,4,0,0.18)'
    ctx.lineWidth = 0.6
    for (let g = 0; g < 6; g++) {
      ctx.beginPath()
      let gx = 0
      ctx.moveTo(0, y + g * (plankH / 6))
      for (; gx < 512; gx += 24) ctx.lineTo(gx, y + g * (plankH / 6) + (Math.random() - 0.5) * 2.5)
      ctx.stroke()
    }
    // Plank joint lines (staggered per row)
    ctx.strokeStyle = 'rgba(8,3,0,0.5)'
    ctx.lineWidth = 1
    const offset = (Math.floor(y / plankH) % 2) * 192
    for (let x = offset; x < 512; x += 192) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + plankH - 1); ctx.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 2.5)
  return tex
}

function makeCeilingTileTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e8e4da'
  ctx.fillRect(0, 0, 256, 256)
  // T-grid suspension system
  ctx.strokeStyle = 'rgba(148,143,132,0.65)'
  ctx.lineWidth = 2.5
  for (const v of [0, 64, 128, 192, 256]) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, 256); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(256, v); ctx.stroke()
  }
  // Acoustic perforations per tile
  ctx.fillStyle = 'rgba(160,155,145,0.4)'
  for (let tx = 0; tx < 4; tx++) {
    for (let ty = 0; ty < 4; ty++) {
      for (let i = 0; i < 18; i++) {
        ctx.beginPath()
        ctx.arc(tx * 64 + 5 + Math.random() * 54, ty * 64 + 5 + Math.random() * 54, 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 3)
  return tex
}

function makeStoneTileTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#181b20'
  ctx.fillRect(0, 0, 512, 512)
  // Marble veins
  ctx.strokeStyle = 'rgba(55,60,72,0.45)'
  ctx.lineWidth = 1
  for (let v = 0; v < 4; v++) {
    ctx.beginPath()
    ctx.moveTo(Math.random() * 512, 0)
    for (let sy = 0; sy < 512; sy += 32) ctx.lineTo(Math.random() * 512, sy)
    ctx.stroke()
  }
  // Large format tile grid
  ctx.strokeStyle = 'rgba(30,33,42,0.95)'
  ctx.lineWidth = 2
  for (const v of [0, 128, 256, 384, 512]) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(512, v); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(7, 7)
  return tex
}

function makeWallTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#282b35'
  ctx.fillRect(0, 0, 256, 256)
  // Subtle painted texture streaks
  ctx.strokeStyle = 'rgba(255,255,255,0.022)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 28; i++) {
    const y = Math.random() * 256
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + (Math.random() - 0.5) * 16); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  return tex
}

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

  // ── Room floor (dark walnut wood parquet) ──
  const woodTex = makeWoodFloorTex()
  const floorMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.5,
    metalness: 0.0,
  })
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(dims.w, dims.d), floorMat)
  roomFloor.rotation.x = -Math.PI / 2
  roomFloor.position.set(pos.x, 0.002, pos.z)
  roomFloor.receiveShadow = true
  scene.add(roomFloor)

  // ── Ceiling panel (acoustic tile) ──
  const ceilTex = makeCeilingTileTex()
  const ceilMat = new THREE.MeshStandardMaterial({
    map: ceilTex,
    roughness: 0.95,
    metalness: 0,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.05,
  })
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(dims.w, dims.d), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.set(pos.x, wallH, pos.z)
  scene.add(ceil)

  // ── Walls (dark modern office — textured charcoal) ──
  const wallTex = makeWallTex()
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.88,
    metalness: 0,
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
    color: new THREE.Color(0xd8e8f8),
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.85,
    transparent: true,
    opacity: 0.22,
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
    color: 0x1c1e24,
    roughness: 0.35,
    metalness: 0.55,
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
    color: 0x2e1c0c,
    roughness: 0.38,
    metalness: 0.04,
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
    color: 0x4a2e18,
    roughness: 0.04,
    metalness: 0.28,
    transparent: true,
    opacity: 0.88,
  })
  const gloss = new THREE.Mesh(new THREE.BoxGeometry(tableW - 0.05, 0.008, tableD - 0.05), glossMat)
  gloss.position.set(pos.x, 0.705, pos.z)
  scene.add(gloss)

  // Table legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.3, metalness: 0.7 })
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
    color: 0x1a1c22,
    roughness: 0.78,
    metalness: 0.08,
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

  // ── Ceiling LED panel fixtures (2 wide bars) ──
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xfff8f0),
    emissiveIntensity: 1.3,
    roughness: 0.15,
  })
  const fixture1 = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.6, 0.03, 0.22), fixtureMat)
  fixture1.position.set(pos.x, wallH - 0.02, pos.z - dims.d * 0.2)
  scene.add(fixture1)
  const fixture2 = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.6, 0.03, 0.22), fixtureMat)
  fixture2.position.set(pos.x, wallH - 0.02, pos.z + dims.d * 0.2)
  scene.add(fixture2)

  // Warm overhead fill from ceiling fixtures
  const ceilLight = new THREE.PointLight(0xfff6e8, 1.2, dims.w * 1.9)
  ceilLight.position.set(pos.x, wallH - 0.08, pos.z)
  scene.add(ceilLight)

  // ── Per-room accent point light (subtle, for color identity) ──
  const accentLight = new THREE.PointLight(color, 0.22, 14)
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
  // Lobby desk — dark walnut reception desk
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.32, metalness: 0.04 })
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.4), deskMat)
  desk.position.set(0, 0.62, 0)
  desk.castShadow = true
  desk.receiveShadow = true
  scene.add(desk)

  // Desk legs
  const legM = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.3, metalness: 0.7 })
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
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pulse RAF IDs (room_done agent pulse — need cleanup on unmount)
  const pulseFramesRef = useRef<Set<number>>(new Set())

  // Error banner dismiss state
  const [errorDismissed, setErrorDismissed] = useState(false)

  // Room transition flash overlay (#47)
  const [roomFlash, setRoomFlash] = useState<{ roomId: string; name: string } | null>(null)
  const roomFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Download ZIP in-flight state (#50)
  const [zipDownloading, setZipDownloading] = useState(false)

  // Session done toast (#63)
  const [showDoneToast, setShowDoneToast] = useState(false)

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

  // ── beforeunload warning when session is running (#48) ────────────────────────
  useEffect(() => {
    if (status !== 'running') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [status])

  // ── session done toast (#63) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isDone) return
    setShowDoneToast(true)
    const t = setTimeout(() => setShowDoneToast(false), 6000)
    return () => clearTimeout(t)
  }, [isDone])

  // ── Board canvas — per-agent decision summary ─────────────────────────────
  function updateBoardCanvas(roomId: string) {
    const canvas = boardCanvasesRef.current.get(roomId)
    const texture = boardTexturesRef.current.get(roomId)
    if (!canvas || !texture) return

    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const accent = ROOM_ACCENT_CSS[roomId] ?? '#7B7CF8'
    const allMsgs = roomMessagesRef.current.get(roomId) ?? []

    // Build per-agent last message map (their final position/decision)
    const agentLastMsg = new Map<string, string>()
    for (const msg of allMsgs) {
      agentLastMsg.set(msg.agent, msg.content)
    }

    // Background
    ctx.fillStyle = '#06080f'
    ctx.fillRect(0, 0, W, H)

    // Header bar
    ctx.fillStyle = accent + '22'
    ctx.fillRect(0, 0, W, 50)
    ctx.fillStyle = accent
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(ROOM_NAMES_EXT[roomId] ?? roomId, 16, 32)
    ctx.fillStyle = 'rgba(200,196,240,0.45)'
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('DECISIONS', W - 16, 32)
    ctx.textAlign = 'left'

    // Separator
    ctx.strokeStyle = accent + '44'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(W, 50); ctx.stroke()

    if (agentLastMsg.size === 0) {
      ctx.fillStyle = 'rgba(180,176,240,0.3)'
      ctx.font = '13px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for agents...', W / 2, H / 2)
      ctx.textAlign = 'left'
      texture.needsUpdate = true
      return
    }

    // Per-agent decision cards
    const cardH = Math.min(Math.floor((H - 58) / agentLastMsg.size) - 6, 110)
    let y = 58

    for (const [agent, content] of agentLastMsg) {
      const agentColor = FEED_AGENT_COLORS[agent] ?? '#C8C4E4'

      // Card background
      ctx.fillStyle = agentColor + '12'
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(10, y, W - 20, cardH, 6)
      } else {
        ctx.rect(10, y, W - 20, cardH)
      }
      ctx.fill()

      // Left accent bar
      ctx.fillStyle = agentColor
      ctx.fillRect(10, y, 3, cardH)

      // Agent name
      ctx.fillStyle = agentColor
      ctx.font = 'bold 12px monospace'
      ctx.fillText(agent.toUpperCase(), 20, y + 17)

      // Content — word-wrapped, max available lines
      ctx.fillStyle = 'rgba(220,216,255,0.85)'
      ctx.font = '11px monospace'
      const maxWidth = W - 40
      const lineH = 14
      const maxLines = Math.floor((cardH - 26) / lineH)
      const words = content.replace(/\n/g, ' ').split(' ')
      let line = ''
      let lineCount = 0
      let ty = y + 30

      for (const word of words) {
        if (lineCount >= maxLines) break
        const test = line + word + ' '
        if (ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line.trimEnd(), 20, ty)
          ty += lineH
          line = word + ' '
          lineCount++
        } else {
          line = test
        }
      }
      if (lineCount < maxLines && line.trim()) {
        ctx.fillText(line.trimEnd(), 20, ty)
      }

      y += cardH + 6
      if (y > H - cardH) break
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
    renderer.toneMappingExposure = 1.35
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

    // ── Global floor (polished dark stone tiles — corridor & lobby) ──────────
    const stoneTex = makeStoneTileTex()
    const globalFloorMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.22,
      metalness: 0.1,
      envMapIntensity: 1.0,
    })
    const globalFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), globalFloorMat)
    globalFloor.rotation.x = -Math.PI / 2
    globalFloor.position.y = 0
    globalFloor.receiveShadow = true
    scene.add(globalFloor)

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
            const n = clip.name.toLowerCase()
            if (n.includes('idle') || n.includes('breath') || n.includes('stand')) {
              idleAction = mixer.clipAction(clip)
            } else if (n.includes('walk') || n.includes('run') || n.includes('stride')) {
              walkAction = mixer.clipAction(clip)
            }
          })

          // If no explicit idle found, use first clip as idle
          if (!idleAction && animations.length > 0) {
            idleAction = mixer.clipAction(animations[0])
          }
          // Only assign walkAction if it's a DIFFERENT clip from idle
          // (never fall back to using idle as walk — that causes twitching)
          if (!walkAction && animations.length > 1) {
            // Pick the clip that isn't the idle
            const nonIdle = animations.find((c) => mixer.clipAction(c) !== idleAction)
            if (nonIdle) walkAction = mixer.clipAction(nonIdle)
          }

          // Start idle animation looping at natural speed
          if (idleAction) {
            (idleAction as THREE.AnimationAction).setEffectiveTimeScale(1.0).play()
          }

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
            bobPhase: idx * (Math.PI / 2), // 90° apart — 4 agents breathe out of phase
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

    // 1. Hemisphere — warm interior ceiling, dark ground bounce
    const hemi = new THREE.HemisphereLight(0xffe8c8, 0x181820, 0.55)
    scene.add(hemi)

    // 2. Ambient fill — warm white eliminates pure-black shadows
    scene.add(new THREE.AmbientLight(0xfff4e8, 0.7))

    // 3. Main top-down directional — casts soft shadows
    const keyLight = new THREE.DirectionalLight(0xfff8f0, 0.45)
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

    // 4. Warm fill from south — softens agent backs
    const fillLight = new THREE.DirectionalLight(0xffe4b8, 0.3)
    fillLight.position.set(-8, 6, 14)
    scene.add(fillLight)

    // 5. Lobby overhead — warm neutral white
    const lobbyLight = new THREE.PointLight(0xfff0d8, 0.85, 22)
    lobbyLight.position.set(0, 5, 0)
    scene.add(lobbyLight)

    // ── Animate loop ──────────────────────────────────────────────────────────
    let t = 0
    let destroyed = false

    function tick() {
      if (destroyed) return
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

        // Flat distance only (ignore y so bob doesn't affect arrival check)
        const dx = target.x - pos.x
        const dz = target.z - pos.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist > 0.04) {
          // ── Walking ──

          // Constant-speed movement, delta-time aware
          // Ease in over first 0.6 units, ease out in last 0.5 units
          const WALK_SPEED = 2.0 // world units / second
          const speedScale = dist < 0.5
            ? THREE.MathUtils.smoothstep(dist, 0, 0.5)
            : 1.0
          const step = Math.min(WALK_SPEED * speedScale * delta, dist)
          const invDist = 1 / dist
          pos.x += dx * invDist * step
          pos.z += dz * invDist * step

          // Natural footstep vertical bob — smooth sine, no Math.abs
          // ~1.6 steps/sec at human walking pace
          pos.y = Math.sin(t * 10.0 + data.bobPhase) * 0.022

          // Smooth rotation to face travel direction — shortest-angle lerp
          if (dist > 0.12) {
            const targetAngle = Math.atan2(dx, dz)
            let dAngle = targetAngle - data.group.rotation.y
            // Clamp to [-π, π] to always spin the short way
            while (dAngle > Math.PI) dAngle -= Math.PI * 2
            while (dAngle < -Math.PI) dAngle += Math.PI * 2
            data.group.rotation.y += dAngle * Math.min(1, 9 * delta)
          }

          // No rotation.x tilt — Mixamo pivot is at hip, forward tilt looks broken

          // Transition to walk animation
          if (!data.isMoving) {
            data.isMoving = true
            if (data.walkAction && data.walkAction !== data.idleAction) {
              data.currentAction?.fadeOut(0.18)
              data.walkAction.reset().setEffectiveTimeScale(1.0).fadeIn(0.18).play()
              data.currentAction = data.walkAction
            }
            // When there's no separate walk clip, keep idle animation at natural
            // speed — the position movement already conveys walking clearly
          }

          walkingRef.current.add(name)

        } else if (data.isMoving) {
          // ── Arrived — settle at exact target, return to idle ──
          data.isMoving = false
          pos.x = target.x
          pos.z = target.z
          pos.y = 0
          walkingRef.current.delete(name)

          if (data.walkAction && data.walkAction !== data.idleAction) {
            data.currentAction?.fadeOut(0.25)
            data.idleAction?.reset().setEffectiveTimeScale(1.0).fadeIn(0.25).play()
            data.currentAction = data.idleAction
          } else if (data.currentAction) {
            data.currentAction.setEffectiveTimeScale(1.0)
          }

        } else {
          // ── Standing idle — gentle breathing bob, unique phase per agent ──
          pos.y = Math.sin(t * 1.4 + data.bobPhase) * 0.007
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
            // Always keep transparent=true to avoid shader recompile on toggle
            mat.transparent = true
            if (targetOpacity < 1) {
              mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, targetOpacity, 0.1)
            } else if (mat.opacity < 0.99) {
              mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1, 0.1)
            } else {
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
      destroyed = true
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      el.removeEventListener('click', handleClick)
      pulseFramesRef.current.forEach((id) => cancelAnimationFrame(id))
      pulseFramesRef.current.clear()
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current)
      if (roomFlashTimeoutRef.current) clearTimeout(roomFlashTimeoutRef.current)

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

      // Room transition flash overlay (#47)
      if (roomFlashTimeoutRef.current) clearTimeout(roomFlashTimeoutRef.current)
      setRoomFlash({ roomId, name: ROOM_NAMES_EXT[roomId] ?? roomId })
      roomFlashTimeoutRef.current = setTimeout(() => setRoomFlash(null), 1800)

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
        let pulseId: number
        const pulseFn = () => {
          pulseT += 0.016
          const prog = pulseT / 0.4
          pulseFramesRef.current.delete(pulseId)
          if (prog >= 1) {
            data.group.scale.setScalar(1)
            return
          }
          const s = 1 + Math.sin(prog * Math.PI) * 0.15
          data.group.scale.setScalar(s)
          pulseId = requestAnimationFrame(pulseFn)
          pulseFramesRef.current.add(pulseId)
        }
        pulseId = requestAnimationFrame(pulseFn)
        pulseFramesRef.current.add(pulseId)
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
      celebrationTimeoutRef.current = setTimeout(() => {
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
            href="/dashboard"
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

      {/* ── session done toast (#63) ── */}
      {showDoneToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(28,200,160,0.18)', border: '1px solid rgba(28,200,160,0.45)',
          borderRadius: 10, padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 10,
          zIndex: 100, animation: 'fadeIn 0.3s ease-out',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1CC8A0' }}>Session complete</span>
          <a
            href={`${BACKEND_URL}/artifacts/${params.id}/zip`}
            download
            style={{
              fontSize: 12, color: '#1CC8A0', textDecoration: 'none',
              border: '1px solid rgba(28,200,160,0.4)', borderRadius: 6,
              padding: '4px 12px', fontWeight: 600, marginLeft: 4,
            }}
          >
            Download ZIP
          </a>
          <button
            onClick={() => setShowDoneToast(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(28,200,160,0.6)', cursor: 'pointer', fontSize: 16 }}
          >×</button>
        </div>
      )}

      {/* ── error banner ── */}
      {errorMessage && !errorDismissed && (
        <div
          style={{
            background: 'rgba(232,93,64,0.14)',
            border: '1px solid rgba(232,93,64,0.35)',
            borderRadius: 8,
            padding: '10px 16px',
            margin: '10px 16px 0',
            fontSize: 13,
            color: '#E85D40',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>Error: {errorMessage}</span>
          <button
            onClick={() => setErrorDismissed(true)}
            style={{
              background: 'none', border: 'none', color: '#E85D40',
              cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── main layout — 3D canvas full width ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        <div
          style={{
            flex: 1,
            position: 'relative',
            background: '#070912',
            overflow: 'hidden',
          }}
        >
          <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

          {/* Centered loading overlay until all 3D models are ready (#40, #46, #58) */}
          {modelsLoaded < AGENT_DEFS.length && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(7,9,18,0.82)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              zIndex: 20, pointerEvents: 'none',
            }}>
              {/* Spinner ring */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '2.5px solid rgba(139,124,248,0.18)',
                borderTopColor: '#8B7CF8',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#8B7CF8', fontWeight: 700 }}>
                  Loading 3D models ({modelsLoaded}/{AGENT_DEFS.length})
                </div>
                <div style={{ fontSize: 11, color: '#44406A', marginTop: 4 }}>
                  Preparing office scene…
                </div>
              </div>
              {/* Progress dots */}
              <div style={{ display: 'flex', gap: 6 }}>
                {AGENT_DEFS.map((_, i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: i < modelsLoaded ? '#8B7CF8' : 'rgba(139,124,248,0.2)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
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
              const isDoneRoom = completedRooms.has(roomId as RoomId)
              const color = ROOM_ACCENT_CSS[roomId] ?? '#7B6EE8'
              const ROOM_DESC: Record<string, string> = {
                A: 'Strategic alignment', B: 'Brainstorming',
                C: 'Architecture & code', D: 'Review', E: 'Live demo',
              }
              return (
                <div
                  key={roomId}
                  title={`Room ${roomId} — ${ROOM_DESC[roomId] ?? ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: isActive ? `${color}18` : 'transparent',
                    borderRadius: 5,
                    padding: isActive ? '3px 7px 3px 5px' : '1px 0',
                    border: isActive ? `1px solid ${color}44` : '1px solid transparent',
                    transition: 'all 0.3s',
                  }}
                >
                  <div style={{
                    width: isDoneRoom ? 8 : 6, height: isDoneRoom ? 8 : 6,
                    borderRadius: isDoneRoom ? '50%' : 1,
                    background: isDoneRoom ? '#1CC8A0' : color,
                    boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 6, color: '#fff', fontWeight: 900,
                    flexShrink: 0,
                  }}>
                    {isDoneRoom ? '✓' : ''}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 9,
                      color: isActive ? color : isDoneRoom ? '#1CC8A0' : 'rgba(180,176,220,0.55)',
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '.04em', textTransform: 'uppercase',
                    }}>
                      {roomId} · {roomName}
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 8, color: `${color}99`, letterSpacing: '.02em' }}>
                        {ROOM_DESC[roomId]}
                      </div>
                    )}
                  </div>
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

          {/* Error dim overlay — scene looks dead when session fails (#45) */}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(7,9,18,0.65)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              zIndex: 25,
            }}>
              <div style={{ fontSize: 28, opacity: 0.4 }}>⚠</div>
              <div style={{ fontSize: 14, color: '#E85D40', fontWeight: 700 }}>Session failed</div>
              <a href="/dashboard" style={{
                fontSize: 12, color: '#8B7CF8', textDecoration: 'none',
                border: '1px solid rgba(139,124,248,0.3)', borderRadius: 7,
                padding: '7px 18px', fontWeight: 600,
              }}>
                ← Back to Dashboard
              </a>
            </div>
          )}

          {/* Room transition flash (#47) */}
          {roomFlash && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 30,
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <div style={{
                background: 'rgba(10,12,22,0.78)',
                border: `1px solid ${ROOM_ACCENT_CSS[roomFlash.roomId] ?? '#8B7CF8'}44`,
                borderRadius: 12,
                padding: '14px 32px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                  color: ROOM_ACCENT_CSS[roomFlash.roomId] ?? '#8B7CF8',
                  fontWeight: 700, marginBottom: 4,
                }}>
                  Entering
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 800, color: '#EAE8F8',
                  letterSpacing: '-.01em',
                }}>
                  → {roomFlash.name.toUpperCase()}
                </div>
              </div>
            </div>
          )}
          {/* Artifacts overlay — bottom-right, appears as rooms complete */}
          {Object.keys(readyArtifacts).length > 0 && (
            <div style={{
              position: 'absolute', bottom: 52, right: 16,
              display: 'flex', flexDirection: 'column', gap: 5,
              zIndex: 20, pointerEvents: 'auto',
              animation: 'fadeIn 0.3s ease-out',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: '#44406A', textAlign: 'right',
                marginBottom: 2,
              }}>
                Artifacts
              </div>
              {Object.entries(readyArtifacts).map(([roomId, filename]) => (
                <div key={roomId} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: 9, color: ROOM_ACCENT_CSS[roomId] ?? '#8B7CF8',
                    fontWeight: 700, letterSpacing: '.06em',
                  }}>
                    {ROOM_NAMES_EXT[roomId] ?? roomId}
                  </span>
                  <DownloadButton
                    filename={filename}
                    sessionId={params.id}
                    roomId={roomId as RoomId}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
