/**
 * Three.js 3D synthetic pitch animation
 * Renders a top-down 3D pitch with player avatars and offside line
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

const TEAM_A_COLOR = 0x38bdf8; // sky blue — attacking
const TEAM_B_COLOR = 0xf97316; // orange — defending
const PITCH_GREEN = 0x1a4a2e;
const PITCH_STRIPE = 0x1e5234;
const LINE_WHITE = 0xffffff;
const BALL_WHITE = 0xf5f5f0;
const OFFSIDE_RED = 0xef4444;
const ONSIDE_GREEN = 0x22c55e;
const UNCERTAIN_YELLOW = 0xf59e0b;

export default function PitchAnimation({ players, ball, offsideLineX, verdict, isAnimating }: PitchAnimationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    animFrame: number;
    clock: THREE.Clock;
    playerMeshes: THREE.Mesh[];
    ballMesh: THREE.Mesh | null;
    offsideLine: THREE.Mesh | null;
    scanLine: THREE.Mesh | null;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const W = mountRef.current.clientWidth || 680;
    const H = mountRef.current.clientHeight || 400;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1410);
    scene.fog = new THREE.Fog(0x0a1410, 30, 80);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 18, 10);
    camera.lookAt(0, 0, -1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0x1a4a2e, 1.2);
    scene.add(ambient);

    const spot1 = new THREE.SpotLight(0xffffff, 2.5);
    spot1.position.set(-8, 18, 4);
    spot1.castShadow = true;
    spot1.shadow.mapSize.width = 1024;
    spot1.shadow.mapSize.height = 1024;
    spot1.angle = Math.PI / 5;
    spot1.penumbra = 0.4;
    scene.add(spot1);

    const spot2 = new THREE.SpotLight(0xffffff, 2.5);
    spot2.position.set(8, 18, 4);
    spot2.castShadow = true;
    spot2.angle = Math.PI / 5;
    spot2.penumbra = 0.4;
    scene.add(spot2);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(0, 4, -10);
    scene.add(rimLight);

    // Pitch dimensions (world space): 20 x 12 units
    const PITCH_W = 20;
    const PITCH_D = 12;

    // Pitch base
    const pitchGeo = new THREE.PlaneGeometry(PITCH_W, PITCH_D, 8, 5);
    const pitchMat = new THREE.MeshLambertMaterial({ color: PITCH_GREEN });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.receiveShadow = true;
    scene.add(pitchMesh);

    // Pitch stripes
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        const sGeo = new THREE.PlaneGeometry(PITCH_W / 8, PITCH_D);
        const sMat = new THREE.MeshLambertMaterial({ color: PITCH_STRIPE });
        const sm = new THREE.Mesh(sGeo, sMat);
        sm.rotation.x = -Math.PI / 2;
        sm.position.set(-PITCH_W / 2 + (i + 0.5) * (PITCH_W / 8), 0.001, 0);
        scene.add(sm);
      }
    }

    // Pitch lines helper
    const lineMat = new THREE.MeshBasicMaterial({ color: LINE_WHITE, transparent: true, opacity: 0.7 });
    
    function addLine(x1: number, z1: number, x2: number, z2: number, yOffset = 0.01) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.sqrt(dx * dx + dz * dz);
      const geo = new THREE.PlaneGeometry(length, 0.06);
      const m = new THREE.Mesh(geo, lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x1 + x2) / 2, yOffset, (z1 + z2) / 2);
      m.rotation.z = Math.atan2(dz, dx);
      // Re-apply x rotation after z
      m.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      scene.add(m);
    }

    // Boundary
    addLine(-PITCH_W / 2, -PITCH_D / 2, PITCH_W / 2, -PITCH_D / 2);
    addLine(-PITCH_W / 2, PITCH_D / 2, PITCH_W / 2, PITCH_D / 2);
    addLine(-PITCH_W / 2, -PITCH_D / 2, -PITCH_W / 2, PITCH_D / 2);
    addLine(PITCH_W / 2, -PITCH_D / 2, PITCH_W / 2, PITCH_D / 2);
    // Centre line
    addLine(0, -PITCH_D / 2, 0, PITCH_D / 2);

    // Centre circle
    const circleGeo = new THREE.RingGeometry(PITCH_D * 0.15 - 0.04, PITCH_D * 0.15 + 0.04, 40);
    const circleMesh = new THREE.Mesh(circleGeo, new THREE.MeshBasicMaterial({ color: LINE_WHITE, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    circleMesh.rotation.x = -Math.PI / 2;
    circleMesh.position.y = 0.01;
    scene.add(circleMesh);

    // Penalty boxes
    const boxW = PITCH_W * 0.12;
    const boxD = PITCH_D * 0.55;
    function addBox(cx: number) {
      const dir = cx > 0 ? 1 : -1;
      addLine(cx, -boxD / 2, cx + dir * boxW, -boxD / 2);
      addLine(cx, boxD / 2, cx + dir * boxW, boxD / 2);
      addLine(cx + dir * boxW, -boxD / 2, cx + dir * boxW, boxD / 2);
    }
    addBox(-PITCH_W / 2);
    addBox(PITCH_W / 2);

    // Offside line (starts invisible, animates in)
    const olX = (offsideLineX - 0.5) * PITCH_W;
    const verdictColor = verdict === "OFFSIDE" ? OFFSIDE_RED : verdict === "ONSIDE" ? ONSIDE_GREEN : UNCERTAIN_YELLOW;
    const olGeo = new THREE.PlaneGeometry(0.12, PITCH_D);
    const olMat = new THREE.MeshBasicMaterial({ color: verdictColor, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const offsideLine = new THREE.Mesh(olGeo, olMat);
    offsideLine.rotation.x = -Math.PI / 2;
    offsideLine.position.set(olX, 0.02, 0);
    scene.add(offsideLine);

    // Glow plane under offside line
    const glowGeo = new THREE.PlaneGeometry(0.6, PITCH_D);
    const glowMat = new THREE.MeshBasicMaterial({ color: verdictColor, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const glowPlane = new THREE.Mesh(glowGeo, glowMat);
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.set(olX, 0.015, 0);
    scene.add(glowPlane);

    // Scan line (vertical beam effect)
    const scanGeo = new THREE.PlaneGeometry(0.3, PITCH_D);
    const scanMat = new THREE.MeshBasicMaterial({ color: verdictColor, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const scanLine = new THREE.Mesh(scanGeo, scanMat);
    scanLine.rotation.x = -Math.PI / 2;
    scanLine.position.set(olX, 0.03, 0);
    scene.add(scanLine);

    // Player avatars
    const playerMeshes: THREE.Mesh[] = [];

    for (const p of players) {
      const px = (p.x - 0.5) * PITCH_W;
      const pz = (p.y - 0.5) * PITCH_D;

      const color = p.team === "attacking" ? TEAM_A_COLOR : TEAM_B_COLOR;
      const isKey = p.isAttacking || p.isSecondLastDefender;

      // Body cylinder
      const bodyGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.8, 8);
      const bodyMat = new THREE.MeshLambertMaterial({ color, emissive: isKey ? color : 0x000000, emissiveIntensity: isKey ? 0.3 : 0 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.position.set(px, 0.4, pz);
      scene.add(body);
      playerMeshes.push(body);

      // Head sphere
      const headGeo = new THREE.SphereGeometry(0.14, 8, 8);
      const headMat = new THREE.MeshLambertMaterial({ color: 0xe8c99a });
      const head = new THREE.Mesh(headGeo, headMat);
      head.castShadow = true;
      head.position.set(px, 1.0, pz);
      scene.add(head);
      playerMeshes.push(head);

      // Shadow disk
      const diskGeo = new THREE.CircleGeometry(0.22, 12);
      const diskMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
      const disk = new THREE.Mesh(diskGeo, diskMat);
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(px, 0.005, pz);
      scene.add(disk);

      // Key player indicator ring
      if (isKey) {
        const ringGeo = new THREE.RingGeometry(0.28, 0.34, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(px, 0.008, pz);
        scene.add(ring);
        playerMeshes.push(ring);
      }
    }

    // Ball
    let ballMesh: THREE.Mesh | null = null;
    if (ball) {
      const bx = (ball.x - 0.5) * PITCH_W;
      const bz = (ball.y - 0.5) * PITCH_D;
      const ballGeo = new THREE.SphereGeometry(0.13, 12, 12);
      const ballMat = new THREE.MeshLambertMaterial({ color: BALL_WHITE, emissive: 0xffffff, emissiveIntensity: 0.15 });
      ballMesh = new THREE.Mesh(ballGeo, ballMat);
      ballMesh.castShadow = true;
      ballMesh.position.set(bx, 0.2, bz);
      scene.add(ballMesh);
    }

    const clock = new THREE.Clock();
    let animFrame = 0;
    let phase = 0; // 0 = intro, 1 = scan, 2 = reveal

    function animate() {
      animFrame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Gentle camera orbit
      const orbitSpeed = 0.1;
      camera.position.x = Math.sin(elapsed * orbitSpeed) * 3;
      camera.position.y = 18 + Math.sin(elapsed * 0.05) * 1;
      camera.position.z = 10 + Math.cos(elapsed * orbitSpeed) * 2;
      camera.lookAt(0, 0, -1);

      // Player bob animation
      playerMeshes.forEach((m, i) => {
        if (m.geometry instanceof THREE.CylinderGeometry) {
          m.position.y = 0.4 + Math.sin(elapsed * 1.5 + i * 0.8) * 0.02;
        }
      });

      // Ball float
      if (ballMesh) {
        ballMesh.position.y = 0.2 + Math.sin(elapsed * 2.5) * 0.05;
        ballMesh.rotation.y = elapsed * 1.2;
      }

      // Offside line reveal after 1.5s
      if (elapsed > 1.5) {
        const t = Math.min((elapsed - 1.5) / 1.2, 1);
        (olMat as THREE.MeshBasicMaterial).opacity = t * 0.9;
        (glowMat as THREE.MeshBasicMaterial).opacity = t * 0.15;

        // Pulse the glow
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3);
        (glowMat as THREE.MeshBasicMaterial).opacity = t * (0.1 + pulse * 0.08);
      }

      // Scan beam sweeps at 1.8–2.8s
      if (elapsed > 1.8 && elapsed < 3.5) {
        const t = (elapsed - 1.8) / 1.7;
        (scanMat as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.7;
      } else {
        (scanMat as THREE.MeshBasicMaterial).opacity = 0;
      }

      renderer.render(scene, camera);
    }
    animate();

    sceneRef.current = { renderer, scene, camera, animFrame, clock, playerMeshes, ballMesh, offsideLine, scanLine };

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrame);
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [players, ball, offsideLineX, verdict]);

  return (
    <div
      ref={mountRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height: "380px", background: "#0a1410" }}
    />
  );
}
