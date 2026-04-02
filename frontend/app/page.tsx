"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { createSession } from "@/lib/api";

// ─── palette ──────────────────────────────────────────────────────────────────
// bg: deep slate blue-gray — dark but not black
const BG_HEX = 0x08090f;
const BG_CSS = "#08090F";

const AGENTS = [
  {
    id: "director",
    label: "Director",
    color: 0x8b7cf8,
    cssColor: "#8B7CF8",
    skin: 0xdfa070,
    hair: 0x2a1000,
    pos: { x: 0, z: -1.85 },
    messages: [
      "Scope locked.",
      "4 rooms. Protocol.",
      "Moving to Room B.",
      "No deviations.",
      "Deadline is now.",
    ],
  },
  {
    id: "dev",
    label: "The Dev",
    color: 0xf5a623,
    cssColor: "#F5A623",
    skin: 0xcc8850,
    hair: 0x3d1a00,
    pos: { x: 0, z: 1.9 },
    messages: [
      "base_agent.py done",
      "Groq + Ollama wired.",
      "90 tok/s on M4.",
      "Forge is ready.",
      "SSE stream live.",
    ],
  },
  {
    id: "catalyst",
    label: "Catalyst",
    color: 0xf06050,
    cssColor: "#F06050",
    skin: 0xf0c8a0,
    hair: 0x1a0500,
    pos: { x: -2.75, z: 0 },
    messages: [
      "What if Groq limits?",
      "Fallback chain!",
      "Edge case found.",
      "Rate limit caught.",
      "Who reviews this?",
    ],
  },
  {
    id: "architect",
    label: "Architect",
    color: 0x20d0a0,
    cssColor: "#20D0A0",
    skin: 0xc88050,
    hair: 0x080f08,
    pos: { x: 2.75, z: 0 },
    messages: [
      "State machine done.",
      "40 lines. Clean.",
      "Dict transitions.",
      "Extensible by design.",
      "Room C locked.",
    ],
  },
];

// ─── thought cloud ────────────────────────────────────────────────────────────
function Cloud({
  x,
  y,
  visible,
  text,
  cssColor,
  label,
  delay,
}: {
  x: number;
  y: number;
  visible: boolean;
  text: string;
  cssColor: string;
  label: string;
  delay: number;
}) {
  const [display, setDisplay] = useState(text);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    if (text === display) return;
    setFade(true);
    const t = setTimeout(() => {
      setDisplay(text);
      setFade(false);
    }, 340);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div
      style={{
        position: "absolute",
        left: x - 56,
        top: y - 64,
        width: 112,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity .28s",
        animation: `cf 3.2s ease-in-out ${delay}s infinite`,
      }}
    >
      <div
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.96)",
          borderRadius: 10,
          padding: "7px 9px",
          width: 112,
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 34,
            height: 12,
            background: "rgba(255,255,255,0.96)",
            borderRadius: "50%",
            boxShadow:
              "-15px 2px 0 -2px rgba(255,255,255,0.96), 15px 2px 0 -2px rgba(255,255,255,0.96)",
          }}
        />
        <span
          style={{
            fontSize: 9.5,
            lineHeight: 1.5,
            color: "#1A1050",
            fontWeight: 600,
            display: "block",
            opacity: fade ? 0 : 1,
            transition: "opacity .34s",
            minHeight: 14,
          }}
        >
          {display}
        </span>
        <div
          style={{
            position: "absolute",
            bottom: -11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 5,
            height: 5,
            background: "rgba(255,255,255,0.7)",
            borderRadius: "50%",
            boxShadow:
              "0 8px 0 -1px rgba(255,255,255,0.5), 0 15px 0 -2px rgba(255,255,255,0.3)",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: cssColor,
          marginTop: 20,
          opacity: 0.95,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── human agent ─────────────────────────────────────────────────────────────
function buildHuman(scene: THREE.Scene, ag: (typeof AGENTS)[0]) {
  const g = new THREE.Group();
  g.position.set(ag.pos.x, 0, ag.pos.z);
  const acc = new THREE.Color(ag.color);
  const skinM = new THREE.MeshStandardMaterial({
    color: ag.skin,
    roughness: 0.65,
    metalness: 0,
  });
  const shrtM = new THREE.MeshStandardMaterial({
    color: ag.color,
    roughness: 0.55,
    emissive: acc.clone().multiplyScalar(0.15),
  });
  const hairM = new THREE.MeshStandardMaterial({
    color: ag.hair,
    roughness: 0.9,
  });
  const eyeM = new THREE.MeshStandardMaterial({
    color: 0x080818,
    roughness: 1,
  });
  const earM = new THREE.MeshStandardMaterial({
    color: ag.skin,
    roughness: 0.7,
  });

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.2), shrtM);
  torso.position.y = 0.52;
  torso.castShadow = true;
  g.add(torso);
  // shoulders
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.22), shrtM);
  sh.position.y = 0.72;
  g.add(sh);
  // arms
  const la = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.05, 0.3, 8),
    shrtM,
  );
  la.position.set(-0.28, 0.58, 0);
  la.rotation.z = 0.35;
  g.add(la);
  const ra = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.05, 0.3, 8),
    shrtM,
  );
  ra.position.set(0.28, 0.58, 0);
  ra.rotation.z = -0.35;
  g.add(ra);
  // hands
  const hg = new THREE.SphereGeometry(0.055, 10, 10);
  const lh = new THREE.Mesh(hg, skinM);
  lh.position.set(-0.35, 0.45, 0);
  g.add(lh);
  const rh = new THREE.Mesh(hg, skinM);
  rh.position.set(0.35, 0.45, 0);
  g.add(rh);
  // neck
  const nk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.07, 0.12, 10),
    skinM,
  );
  nk.position.y = 0.77;
  g.add(nk);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 22), skinM);
  head.scale.set(1, 1.12, 1);
  head.position.y = 1.01;
  head.castShadow = true;
  g.add(head);
  // hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairM,
  );
  hair.position.y = 1.01;
  g.add(hair);
  // eyes
  const eg = new THREE.SphereGeometry(0.028, 8, 8);
  const le = new THREE.Mesh(eg, eyeM);
  le.position.set(-0.075, 1.04, 0.17);
  g.add(le);
  const re = new THREE.Mesh(eg, eyeM);
  re.position.set(0.075, 1.04, 0.17);
  g.add(re);
  // ears
  const earg = new THREE.SphereGeometry(0.03, 8, 8);
  const ll = new THREE.Mesh(earg, earM);
  ll.position.set(-0.2, 1.01, 0);
  g.add(ll);
  const rl = new THREE.Mesh(earg, earM);
  rl.position.set(0.2, 1.01, 0);
  g.add(rl);
  // colored aura
  const aura = new THREE.PointLight(ag.color, 0.6, 2.8);
  aura.position.set(0, 1.4, 0);
  g.add(aura);

  scene.add(g);
  return { group: g, head, aura };
}

// ─── modal ────────────────────────────────────────────────────────────────────
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#252838",
          border: "1px solid rgba(139,124,248,.25)",
          borderRadius: 14,
          padding: "26px 26px 22px",
          width: 310,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#EAE8F8" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(139,124,248,.3)",
  borderRadius: 8,
  color: "#EAE8F8",
  fontSize: 13,
  outline: "none",
};

// ─── page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  const [clouds, setClouds] = useState(
    AGENTS.map(() => ({ x: 0, y: 0, visible: false })),
  );
  const [texts, setTexts] = useState(AGENTS.map((a) => a.messages[0]));
  const [msgIdx, setMsgIdx] = useState(AGENTS.map(() => 0));
  const [showContact, setShowContact] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const router = useRouter();

  async function handleStartSession() {
    if (!title.trim() || !task.trim() || submitting) return;
    setSubmitting(true);
    setSessionError("");
    try {
      const session = await createSession(title.trim(), task.trim());
      if (!session?.id) {
        setSessionError("Backend error — could not create session. Is the server running?");
        return;
      }
      router.push(`/run/${session.id}`);
    } catch (e: any) {
      setSessionError("Could not reach the backend. Make sure the server is running on port 8000.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(BG_HEX, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_HEX);
    scene.fog = new THREE.Fog(BG_HEX, 16, 28);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 7, 11);
    camera.lookAt(0, 0.5, 0);

    let W = el.clientWidth,
      H = el.clientHeight || 340;
    const handleResize = () => {
      W = el.clientWidth;
      H = el.clientHeight || 340;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);

    // ── floor grid — subtle, visible ──
    scene.add(new THREE.GridHelper(24, 32, 0x2e3150, 0x242740));

    // ── floor ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshStandardMaterial({ color: 0x1c1f2e, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── brown walnut table ──
    const tableGeo = new THREE.BoxGeometry(4.8, 0.11, 2.8);
    const tableMesh = new THREE.Mesh(
      tableGeo,
      new THREE.MeshStandardMaterial({
        color: 0x7b3f1a,
        roughness: 0.42,
        metalness: 0.06,
      }),
    );
    tableMesh.position.y = 0.055;
    tableMesh.castShadow = true;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // gloss sheen on table surface
    const sheen = new THREE.Mesh(
      new THREE.BoxGeometry(4.76, 0.006, 2.76),
      new THREE.MeshStandardMaterial({
        color: 0xa0582a,
        roughness: 0.12,
        metalness: 0.18,
        transparent: true,
        opacity: 0.55,
      }),
    );
    sheen.position.y = 0.113;
    scene.add(sheen);

    // table edge highlight
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xc47840,
      transparent: true,
      opacity: 0.55,
    });
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(tableGeo),
      edgeMat,
    );
    edgeLines.position.copy(tableMesh.position);
    scene.add(edgeLines);

    // table legs
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x3a1a06,
      roughness: 0.85,
    });
    [
      [-2.1, -1.2],
      [-2.1, 1.2],
      [2.1, -1.2],
      [2.1, 1.2],
    ].forEach(([x, z]) => {
      const l = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.92, 8),
        legMat,
      );
      l.position.set(x, -0.36, z);
      l.castShadow = true;
      scene.add(l);
    });

    // laptops
    [
      [-1.1, -0.65],
      [1.1, 0.65],
    ].forEach(([x, z]) => {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.022, 0.38),
        new THREE.MeshStandardMaterial({
          color: 0x1a1030,
          roughness: 0.4,
          metalness: 0.6,
        }),
      );
      base.position.set(x, 0.122, z);
      scene.add(base);
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.34, 0.016),
        new THREE.MeshStandardMaterial({
          color: 0x0e0828,
          emissive: 0x7b6cf8,
          emissiveIntensity: 0.4,
          roughness: 0.2,
        }),
      );
      screen.position.set(x, 0.31, z - 0.17);
      screen.rotation.x = 0.3;
      scene.add(screen);
    });

    // mug
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.05, 0.11, 12),
      new THREE.MeshStandardMaterial({
        color: 0x7b6cf8,
        roughness: 0.6,
        emissive: 0x4030c0,
        emissiveIntensity: 0.3,
      }),
    );
    mug.position.set(-1.55, 0.117, 0.52);
    scene.add(mug);

    // ── agents ──
    const humans = AGENTS.map((ag) => buildHuman(scene, ag));

    // ── LIGHTING ──────────────────────────────────────────────────────────────
    // Strong ambient — ensures no agent goes black
    scene.add(new THREE.AmbientLight(0x606888, 0.35));

    // Key light from upper-front — illuminates faces and table
    const key = new THREE.DirectionalLight(0xffe8cc, 0.55);
    key.position.set(2, 8, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    // Fill from left side
    const fill = new THREE.DirectionalLight(0xaab4ff, 0.25);
    fill.position.set(-7, 4, 2);
    scene.add(fill);

    // Warm under-bounce off table surface
    const bounce = new THREE.PointLight(0xff7733, 1.0, 4);
    bounce.position.set(0, 0.7, 0);
    scene.add(bounce);

    // Back rim light — separates agents from bg
    const rim = new THREE.DirectionalLight(0x6070cc, 0.3);
    rim.position.set(0, 4, -9);
    scene.add(rim);

    // Overhead soft purple
    const top = new THREE.PointLight(0x6050cc, 0.4, 8);
    top.position.set(0, 7, 0);
    scene.add(top);

    // ── animate ──────────────────────────────────────────────────────────────
    let ang = -0.4,
      t = 0;
    const cdData = AGENTS.map(() => ({ x: 0, y: 0, v: false }));
    const newClouds = AGENTS.map(() => ({ x: 0, y: 0, visible: false }));

    function tick() {
      frameRef.current = requestAnimationFrame(tick);
      t += 0.016;
      ang += 0.0036;

      camera.position.x = Math.sin(ang) * 11;
      camera.position.z = Math.cos(ang) * 11;
      camera.position.y = 7 + Math.sin(t * 0.26) * 0.45;
      camera.lookAt(0, 0.5, 0);

      humans.forEach(({ group, aura }, i) => {
        group.position.y = Math.sin(t + i * 1.55) * 0.025;
        aura.intensity = 0.45 + Math.sin(t * 1.8 + i * 0.7) * 0.15;
        const dx = -AGENTS[i].pos.x,
          dz = -AGENTS[i].pos.z;
        group.rotation.y = Math.atan2(dx, dz) + Math.sin(t * 0.4 + i) * 0.08;
      });

      edgeMat.opacity = 0.45 + Math.sin(t * 0.7) * 0.12;
      renderer.render(scene, camera);

      let changed = false;
      humans.forEach(({ head }, i) => {
        const wp = new THREE.Vector3();
        wp.setFromMatrixPosition(head.matrixWorld);
        wp.y += 0.85;
        wp.project(camera);
        if (wp.z > 1) {
          if (newClouds[i].visible) {
            newClouds[i].visible = false;
            changed = true;
          }
          return;
        }
        const nx = Math.round((wp.x * 0.5 + 0.5) * W);
        const ny = Math.round((-wp.y * 0.5 + 0.5) * H);
        if (nx !== cdData[i].x || ny !== cdData[i].y || !cdData[i].v) {
          newClouds[i] = { x: nx, y: ny, visible: true };
          cdData[i] = { x: nx, y: ny, v: true };
          changed = true;
        }
      });
      if (changed) setClouds([...newClouds]);
    }
    tick();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // text cycling
  useEffect(() => {
    const cleanups = AGENTS.map((ag, i) => {
      const startDelay = [1200, 1900, 700, 2500][i];
      const interval = [2800, 3600, 4300, 3100][i];
      let timer: ReturnType<typeof setTimeout>;
      const run = () => {
        timer = setTimeout(() => {
          setTexts((prev) => {
            const n = [...prev];
            n[i] = ag.messages[(msgIdx[i] + 1) % ag.messages.length];
            return n;
          });
          setMsgIdx((prev) => {
            const n = [...prev];
            n[i] = (n[i] + 1) % ag.messages.length;
            return n;
          });
          run();
        }, interval);
      };
      const s = setTimeout(run, startDelay);
      return () => {
        clearTimeout(s);
        clearTimeout(timer);
      };
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <>
      <style>{`@keyframes cf{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>

      <div
        style={{
          background: BG_CSS,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── nav ── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            height: 52,
            padding: "0 24px",
            background: "rgba(22,25,40,0.96)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(139,124,248,.15)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#8B7CF8",
                boxShadow: "0 0 8px rgba(139,124,248,.7)",
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#EAE8F8",
                letterSpacing: ".1em",
              }}
            >
              AOP
            </span>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setShowContact(true)}
              style={{
                fontSize: 12,
                color: "#7068A8",
                padding: "5px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderRadius: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C8C4F0")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#7068A8")}
            >
              Contact
            </button>
            <button
              onClick={() => setShowSignIn(true)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                padding: "6px 18px",
                background: "#6C4FF5",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(108,79,245,.4)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = ".88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Sign in
            </button>
          </div>
        </nav>

        {/* ── hero ── */}
        <div style={{ textAlign: "center", padding: "24px 20px 10px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".18em",
              color: "#8B7CF8",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Autonomous Office Protocol
          </div>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(22px,3vw,34px)",
              fontWeight: 300,
              color: "#EAE8F8",
              letterSpacing: "-.02em",
              lineHeight: 1.2,
            }}
          >
            <strong style={{ fontWeight: 800, color: "#fff" }}>
              AI agents.
            </strong>{" "}
            Real decisions.
          </h1>
          <p style={{ fontSize: 12, color: "#6860A0", marginTop: 7 }}>
            Four specialists · Four rooms · One complete deliverable
          </p>
        </div>

        {/* ── 3D ── */}
        <div style={{ position: "relative", flex: 1, minHeight: 340 }}>
          <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            {AGENTS.map((ag, i) => (
              <Cloud
                key={ag.id}
                x={clouds[i].x}
                y={clouds[i].y}
                visible={clouds[i].visible}
                text={texts[i]}
                cssColor={ag.cssColor}
                label={ag.label}
                delay={i * 0.65}
              />
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div
          style={{
            padding: "14px 20px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
            borderTop: "1px solid rgba(139,124,248,.12)",
            background: "rgba(22,25,40,0.8)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
              maxWidth: 500,
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title — e.g. Q4 pricing strategy"
              style={{
                width: "100%",
                height: 42,
                padding: "0 14px",
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(139,124,248,.28)",
                borderRadius: 9,
                color: "#EAE8F8",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(139,124,248,.65)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(139,124,248,.28)")
              }
            />
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe your task — e.g. build a SaaS pricing strategy with competitor analysis and a recommendation..."
                rows={3}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(139,124,248,.28)",
                  borderRadius: 9,
                  color: "#EAE8F8",
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "rgba(139,124,248,.65)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(139,124,248,.28)")
                }
              />
              <button
                onClick={handleStartSession}
                disabled={submitting || !title.trim() || !task.trim()}
                style={{
                  alignSelf: "flex-end",
                  height: 42,
                  padding: "0 22px",
                  background: "#6C4FF5",
                  border: "none",
                  borderRadius: 9,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor:
                    submitting || !title.trim() || !task.trim()
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    submitting || !title.trim() || !task.trim() ? 0.5 : 1,
                  boxShadow: "0 2px 10px rgba(108,79,245,.35)",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!submitting && title.trim() && task.trim())
                    e.currentTarget.style.opacity = ".88";
                }}
                onMouseLeave={(e) => {
                  if (!submitting && title.trim() && task.trim())
                    e.currentTarget.style.opacity = "1";
                }}
              >
                {submitting ? "Starting..." : "Start session →"}
              </button>
            </div>
            {sessionError && (
              <p style={{ color: "#FF6B6B", fontSize: 12, marginTop: 8 }}>
                ⚠ {sessionError}
              </p>
            )}
          </div>
          <span style={{ fontSize: 11, color: "#44406A" }}>
            Free · Runs locally · No login required
          </span>
        </div>

        {/* modals */}
        {showContact && (
          <Modal title="Contact" onClose={() => setShowContact(false)}>
            <p style={{ fontSize: 13, color: "#9088C0", lineHeight: 1.7 }}>
              Questions, feedback, or collaboration?
            </p>
            <a
              href="mailto:hello@aop.dev"
              style={{
                fontSize: 13,
                color: "#8B7CF8",
                marginTop: 12,
                display: "block",
                fontWeight: 600,
              }}
            >
              hello@aop.dev
            </a>
          </Modal>
        )}
        {showSignIn && (
          <Modal title="Sign in" onClose={() => setShowSignIn(false)}>
            <input placeholder="Email" style={iStyle} />
            <input
              placeholder="Password"
              type="password"
              style={{ ...iStyle, marginTop: 8 }}
            />
            <button
              style={{
                width: "100%",
                height: 40,
                marginTop: 12,
                background: "#6C4FF5",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Continue →
            </button>
            <p style={{ fontSize: 11, color: "#60588A", marginTop: 12 }}>
              No account yet? Sessions run locally without one.
            </p>
          </Modal>
        )}
      </div>
    </>
  );
}
