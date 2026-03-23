/**
 * VAR-style 3D pitch animation
 * Players rendered as proper humanoid figures
 * Passer, attacker, and second-last defender clearly highlighted
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PlayerDetection, BallDetection } from "@shared/schema";

interface PitchAnimationProps {
  players: PlayerDetection[];
  ball: BallDetection | null;
  offsideLineX: number;
  verdict: "OFFSIDE" | "ONSIDE" | "UNCERTAIN";
  isAnimating: boolean;
}

const TEAM_A_JERSEY = 0x38bdf8;  // sky blue — attacking
const TEAM_B_JERSEY = 0xf97316;  // orange — defending
const SKIN = 0xe8c49a;
const BOOT = 0x1a1a1a;
const BALL_COLOR = 0xf5f5f0;
const PITCH_GREEN = 0x1a4a2e;
const PITCH_STRIPE = 0x1e5535;
const LINE_WHITE = 0xffffff;
const PASSER_GLOW = 0xfbbf24;    // gold — passer highlight
const OFFSIDE_RED = 0xef4444;
const ONSIDE_GREEN = 0x22c55e;
const UNCERTAIN_AMBER = 0xf59e0b;

// Build a humanoid player figure group
function createPlayer(
  team: "attacking" | "defending" | "unknown",
  role: "passer" | "attacker" | "defender" | "normal"
): THREE.Group {
  const group = new THREE.Group();
  const jerseyColor = team === "attacking" ? TEAM_A_JERSEY : TEAM_B_JERSEY;
  const isKey = role !== "normal";

  const jerseyMat = new THREE.MeshLambertMaterial({ color: jerseyColor });
  const shortsMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const skinMat = new THREE.MeshLambertMaterial({ color: SKIN });
  const bootMat = new THREE.MeshLambertMaterial({ color: BOOT });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x2d1a0e });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.16), jerseyMat);
  torso.position.y = 0.62;
  torso.castShadow = true;
  group.add(torso);

  // Shorts
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.16), shortsMat);
  shorts.position.y = 0.36;
  shorts.castShadow = true;
  group.add(shorts);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
  head.position.y = 0.94;
  head.castShadow = true;
  group.add(head);

  // Hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 0.94;
  group.add(hair);

  // Left arm
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.32, 6), jerseyMat);
  lArm.position.set(-0.19, 0.62, 0);
  lArm.rotation.z = 0.35;
  lArm.castShadow = true;
  group.add(lArm);

  // Right arm
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.32, 6), jerseyMat);
  rArm.position.set(0.19, 0.62, 0);
  rArm.rotation.z = -0.35;
  rArm.castShadow = true;
  group.add(rArm);

  // Left leg
  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.36, 7), skinMat);
  lLeg.position.set(-0.08, 0.17, 0);
  lLeg.castShadow = true;
  group.add(lLeg);

  // Right leg (slightly kicked out for passer)
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.36, 7), skinMat);
  rLeg.position.set(0.08, 0.17, 0);
  if (role === "passer") rLeg.rotation.x = -0.5; // kicking motion
  rLeg.castShadow = true;
  group.add(rLeg);

  // Left boot
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.18), bootMat);
  lBoot.position.set(-0.08, 0.0, 0.04);
  group.add(lBoot);

  // Right boot
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.18), bootMat);
  rBoot.position.set(0.08, 0.0, 0.04);
  group.add(rBoot);

  // Number on back (key players only) — small plane
  if (isKey) {
    const numColors: Record<string, number> = {
      passer: PASSER_GLOW,
      attacker: 0xffffff,
      defender: 0xffffff,
      normal: 0xffffff,
    };
    const numMat = new THREE.MeshBasicMaterial({ color: numColors[role] });
    const numPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), numMat);
    numPlane.position.set(0, 0.65, -0.09);
    group.add(numPlane);
  }

  // Shadow disk on ground
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  group.add(shadow);

  return group;
}

// Role indicator ring on ground
function createRoleRing(color: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.28, 0.36, 32);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  return ring;
}

// Floating label above player
function createLabel(color: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(0.35, 0.14);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.y = 1.4;
  return plane;
}

export default function PitchAnimation({ players, ball, offsideLineX, verdict }: PitchAnimationProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth || 680;
    const H = 420;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080f0c);
    scene.fog = new THREE.Fog(0x080f0c, 28, 65);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 10, 9);
    camera.lookAt(0, 0, -1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x334433, 1.4));

    const spot1 = new THREE.SpotLight(0xffffff, 3);
    spot1.position.set(-7, 16, 3);
    spot1.castShadow = true;
    spot1.shadow.mapSize.set(1024, 1024);
    spot1.angle = Math.PI / 5;
    spot1.penumbra = 0.5;
    scene.add(spot1);

    const spot2 = new THREE.SpotLight(0xffffff, 3);
    spot2.position.set(7, 16, 3);
    spot2.castShadow = true;
    spot2.angle = Math.PI / 5;
    spot2.penumbra = 0.5;
    scene.add(spot2);

    scene.add(new THREE.DirectionalLight(0x38bdf8, 0.3));

    // Pitch — 20 x 12
    const PW = 20, PD = 12;

    // Stripes
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.PlaneGeometry(PW / 8, PD);
      const mat = new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? PITCH_GREEN : PITCH_STRIPE });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(-PW / 2 + (i + 0.5) * (PW / 8), 0, 0);
      m.receiveShadow = true;
      scene.add(m);
    }

    // Pitch lines
    const lMat = new THREE.MeshBasicMaterial({ color: LINE_WHITE, transparent: true, opacity: 0.65 });
    function addLine(x1: number, z1: number, x2: number, z2: number) {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const geo = new THREE.PlaneGeometry(len, 0.06);
      const m = new THREE.Mesh(geo, lMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
      m.rotation.z = Math.atan2(dz, dx);
      scene.add(m);
    }
    addLine(-PW/2, -PD/2, PW/2, -PD/2);
    addLine(-PW/2,  PD/2, PW/2,  PD/2);
    addLine(-PW/2, -PD/2, -PW/2, PD/2);
    addLine( PW/2, -PD/2,  PW/2, PD/2);
    addLine(0, -PD/2, 0, PD/2);

    const circleGeo = new THREE.RingGeometry(PD * 0.14, PD * 0.15, 40);
    const circleMesh = new THREE.Mesh(circleGeo, new THREE.MeshBasicMaterial({ color: LINE_WHITE, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    circleMesh.rotation.x = -Math.PI / 2;
    circleMesh.position.y = 0.01;
    scene.add(circleMesh);

    // Offside line
    const verdictColor = verdict === "OFFSIDE" ? OFFSIDE_RED : verdict === "ONSIDE" ? ONSIDE_GREEN : UNCERTAIN_AMBER;
    const olX = (offsideLineX - 0.5) * PW;
    const olGeo = new THREE.PlaneGeometry(0.1, PD);
    const olMat = new THREE.MeshBasicMaterial({ color: verdictColor, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const olMesh = new THREE.Mesh(olGeo, olMat);
    olMesh.rotation.x = -Math.PI / 2;
    olMesh.position.set(olX, 0.015, 0);
    scene.add(olMesh);

    // Glow under offside line
    const glowGeo = new THREE.PlaneGeometry(0.6, PD);
    const glowMat = new THREE.MeshBasicMaterial({ color: verdictColor, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.set(olX, 0.012, 0);
    scene.add(glowMesh);

    // Players
    const playerGroups: THREE.Group[] = [];
    const rings: THREE.Mesh[] = [];

    for (const p of players) {
      const px = (p.x - 0.5) * PW;
      const pz = (p.y - 0.5) * PD;

      const role: "passer" | "attacker" | "defender" | "normal" =
        p.isPasser ? "passer" :
        p.isAttacking ? "attacker" :
        p.isSecondLastDefender ? "defender" : "normal";

      const figure = createPlayer(p.team, role);
      figure.position.set(px, 0, pz);
      scene.add(figure);
      playerGroups.push(figure);

      // Role rings
      if (role === "passer") {
        const ring = createRoleRing(PASSER_GLOW);
        ring.position.set(px, 0, pz);
        scene.add(ring);
        rings.push(ring);
      } else if (role === "attacker") {
        const ring = createRoleRing(TEAM_A_JERSEY);
        ring.position.set(px, 0, pz);
        scene.add(ring);
        rings.push(ring);
      } else if (role === "defender") {
        const ring = createRoleRing(LINE_WHITE);
        ring.position.set(px, 0, pz);
        scene.add(ring);
        rings.push(ring);
      }
    }

    // Ball
    let ballMesh: THREE.Mesh | null = null;
    if (ball) {
      const bx = (ball.x - 0.5) * PW;
      const bz = (ball.y - 0.5) * PD;
      const bGeo = new THREE.SphereGeometry(0.14, 14, 14);
      const bMat = new THREE.MeshLambertMaterial({ color: BALL_COLOR, emissive: 0xffffff, emissiveIntensity: 0.1 });
      ballMes
