import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import * as THREE from "three";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { INITIAL_GROWTH_PROFILE } from "./growthEngine";
import { loadGrowthPlayerGlb, type LoadedGrowthPlayer } from "./loadGrowthGlb";
import { useLocalGrowth } from "./useLocalGrowth";
import type { GrowthActivityType, GrowthZone } from "./types";
import "./growth-adventure.css";

const ZONES: Record<GrowthZone, { name: string; subtitle: string; sky: number; ground: number; accent: string }> = {
  home: { name: "말씀의 집", subtitle: "말씀을 배우고 지혜를 얻어요", sky: 0x9fdcff, ground: 0x72a857, accent: "#6b8f55" },
  road: { name: "평안의 길", subtitle: "사랑과 격려로 평화를 나누는 길", sky: 0x91d4ff, ground: 0x68a559, accent: "#527b63" },
  wilderness: { name: "광야", subtitle: "말씀으로 시험과 유혹을 이겨내요", sky: 0xf2ad62, ground: 0xc98b4c, accent: "#8a5c36" },
  village: { name: "회복의 마을", subtitle: "사랑을 실천하고 함께 회복해요", sky: 0xa7dfff, ground: 0x79a95e, accent: "#6a8c67" },
};

type Hotspot = { id: string; label: string; emoji: string; position: [number, number, number]; type: GrowthActivityType; title: string };

const HOTSPOTS: Record<GrowthZone, Hotspot[]> = {
  home: [
    { id: "read", label: "말씀 읽기", emoji: "📖", position: [-3, 0.65, -1], type: "scripture_read", title: "말씀의 집에서 말씀 읽기" },
    { id: "pray", label: "기도하기", emoji: "🙏", position: [3, 0.65, -1], type: "prayer", title: "말씀의 집에서 기도하기" },
    { id: "meal", label: "영혼의 양식 먹기", emoji: "🥖", position: [0, 0.65, 3], type: "scripture_read", title: "영혼의 양식 한 끼" },
  ],
  road: [
    { id: "greet", label: "인사하기", emoji: "👋", position: [-2.5, 0.65, -2], type: "service_mission", title: "마을 친구에게 먼저 인사하기" },
    { id: "encourage", label: "격려하기", emoji: "💛", position: [2.6, 0.65, -1], type: "service_mission", title: "낙심한 친구 격려하기" },
    { id: "help", label: "도와주기", emoji: "🤝", position: [0.5, 0.65, 3.2], type: "service_mission", title: "이웃의 일을 함께 돕기" },
  ],
  wilderness: [
    { id: "proclaim", label: "말씀 선포", emoji: "📖", position: [0, 0.65, -4], type: "wilderness_victory", title: "말씀으로 유혹을 이겨내기" },
    { id: "shield", label: "믿음으로 방어", emoji: "🛡️", position: [-3.5, 0.65, -1], type: "wilderness_victory", title: "믿음의 방패로 두려움을 막기" },
    { id: "pray", label: "기도하기", emoji: "🙏", position: [3.5, 0.65, -1], type: "prayer", title: "광야에서 하나님께 기도하기" },
  ],
  village: [
    { id: "comfort", label: "위로하기", emoji: "💗", position: [-2.8, 0.65, -2], type: "service_mission", title: "지친 이웃을 위로하기" },
    { id: "pray", label: "함께 기도", emoji: "🙏", position: [2.8, 0.65, -2], type: "service_mission", title: "이웃과 함께 기도하기" },
    { id: "serve", label: "도움 나누기", emoji: "🤲", position: [0, 0.65, 3], type: "service_mission", title: "회복의 마을 섬김 미션" },
  ],
};

function dateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function disposeObject(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material.dispose());
  });
}

function addTree(scene: THREE.Scene, x: number, z: number) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, 1.15, 8), new THREE.MeshStandardMaterial({ color: 0x765037 }));
  trunk.position.set(x, .58, z);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(.72, 12, 10), new THREE.MeshStandardMaterial({ color: 0x5f9c52 }));
  crown.position.set(x, 1.55, z);
  scene.add(trunk, crown);
}

function addHouse(scene: THREE.Scene, x: number, z: number, church = false) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.6, 2), new THREE.MeshStandardMaterial({ color: 0xe7d1a9 }));
  wall.position.set(x, .8, z);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.72, 1.05, 4), new THREE.MeshStandardMaterial({ color: church ? 0x9e5b48 : 0x668ca2 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, 2.05, z);
  scene.add(wall, roof);
  if (church) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(.12, .75, .12), new THREE.MeshStandardMaterial({ color: 0x72543b }));
    const h = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .12), new THREE.MeshStandardMaterial({ color: 0x72543b }));
    v.position.set(x, 3, z); h.position.set(x, 3.08, z);
    scene.add(v, h);
  }
}

function createPlayer() {
  const group = new THREE.Group();
  group.name = "BibleFriendProceduralFallback";
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c7a1 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf3ead7 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x71b5c8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x51301f });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.38, .52, 1.05, 14), cloth); body.position.y = .92;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(.44, .055, 8, 24), blue); sash.rotation.x = Math.PI / 2; sash.position.y = .82;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.46, 18, 14), skin); head.position.y = 1.72;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.49, 14, 10, 0, Math.PI * 2, 0, Math.PI * .58), hair); hairCap.position.y = 1.9;
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .62, 8), skin); leg1.position.set(-.19, .22, 0);
  const leg2 = leg1.clone(); leg2.position.x = .19;
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .08, 20), new THREE.MeshStandardMaterial({ color: 0x8a5b34, metalness: .1 }));
  shield.rotation.x = Math.PI / 2; shield.position.set(0, 1.0, .48);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(.09, .52, .06), new THREE.MeshStandardMaterial({ color: 0xe1b55d })); crossV.position.set(0, 1, .54);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(.35, .09, .06), new THREE.MeshStandardMaterial({ color: 0xe1b55d })); crossH.position.set(0, 1.04, .54);
  group.add(body, sash, head, hairCap, leg1, leg2, shield, crossV, crossH);
  return group;
}

function buildZone(scene: THREE.Scene, zone: GrowthZone, hotspots: Hotspot[]) {
  if (zone === "wilderness") {
    for (let i = 0; i < 12; i += 1) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.35 + (i % 3) * .1), new THREE.MeshStandardMaterial({ color: 0x9b6540 }));
      rock.position.set(-6 + (i * 1.1) % 12, .3, -5 + ((i * 2.3) % 10)); scene.add(rock);
    }
  } else {
    for (const [x, z] of [[-6,-4],[-5,3],[5,-3],[6,2],[-3,5],[3,5]] as Array<[number, number]>) addTree(scene, x, z);
    addHouse(scene, -5, -6, true); addHouse(scene, 5, -5, false);
  }
  if (zone === "home") addHouse(scene, 0, -6, true);
  if (zone === "village") { addHouse(scene, 0, -6, true); addHouse(scene, -3.4, -5, false); addHouse(scene, 3.5, -5.4, false); }

  hotspots.forEach(hotspot => {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(.34, .48, .1, 16), new THREE.MeshStandardMaterial({ color: 0xf4ce6a, emissive: 0x5a421b, emissiveIntensity: .15 }));
    marker.position.set(...hotspot.position); marker.position.y = .08;
    marker.userData.hotspotId = hotspot.id;
    scene.add(marker);
  });
}

export default function GrowthAdventure3D() {
  const zone = useMemo<GrowthZone>(() => {
    const candidate = window.location.pathname.split("/").filter(Boolean).at(-1);
    return candidate === "road" || candidate === "wilderness" || candidate === "village" || candidate === "home" ? candidate : "home";
  }, []);
  const config = ZONES[zone];
  const hotspots = HOTSPOTS[zone];
  const { user } = useAuth();
  const localGrowth = useLocalGrowth();
  const profileQuery = trpc.growth.profile.useQuery(undefined, { enabled: Boolean(user) });
  const profile = user ? (profileQuery.data?.profile ?? INITIAL_GROWTH_PROFILE) : localGrowth.profile;
  const equipmentSignature = profile.equipped.map(id => `${id}:${profile.equipmentTiers[id]}`).sort().join("|");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const movement = useRef({ x: 0, z: 0 });
  const lastHotspot = useRef<string | null>(null);
  const [nearby, setNearby] = useState<Hotspot | null>(null);
  const [message, setMessage] = useState(config.subtitle);
  const [missionCount, setMissionCount] = useState(0);
  const [assetMode, setAssetMode] = useState<"loading" | "generated" | "procedural">("loading");

  const claim = trpc.growth.claimActivity.useMutation({ onSuccess: result => { setMessage(result.message); void profileQuery.refetch(); } });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let generatedPlayer: LoadedGrowthPlayer | null = null;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(config.sky); scene.fog = new THREE.Fog(config.sky, 12, 28);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 60); camera.position.set(0, 5.4, 7.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7)); renderer.shadowMap.enabled = true; mount.appendChild(renderer.domElement);
    const hemi = new THREE.HemisphereLight(0xfff5dc, 0x4d6d42, 2.2); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.4); sun.position.set(5, 10, 4); sun.castShadow = true; scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: config.ground, roughness: .92 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 28), new THREE.MeshStandardMaterial({ color: zone === "wilderness" ? 0xd7a35e : 0xdac58e, roughness: 1 })); path.rotation.x = -Math.PI / 2; path.position.y = .012; scene.add(path);
    let player = createPlayer(); player.position.set(0, 0, 5); scene.add(player);
    setAssetMode("loading");
    const profileSnapshot = {
      ...profile,
      equipmentTiers: { ...profile.equipmentTiers },
      equipped: [...profile.equipped],
      unlockedZones: [...profile.unlockedZones],
    };
    void loadGrowthPlayerGlb(profileSnapshot).then(loaded => {
      if (disposed) {
        loaded?.dispose();
        return;
      }
      if (!loaded) {
        setAssetMode("procedural");
        return;
      }
      loaded.root.position.copy(player.position);
      loaded.root.rotation.copy(player.rotation);
      scene.add(loaded.root);
      scene.remove(player);
      disposeObject(player);
      player = loaded.root;
      generatedPlayer = loaded;
      setAssetMode("generated");
      setMessage("✨ AI-3D 성경 친구 모델을 불러왔어요!");
    }).catch(() => {
      if (!disposed) setAssetMode("procedural");
    });
    buildZone(scene, zone, hotspots);

    const resize = () => { const w = mount.clientWidth; const h = mount.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(mount); resize();
    let raf = 0; let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(.04, (now - previous) / 1000); previous = now;
      generatedPlayer?.update(dt);
      const dir = movement.current;
      const length = Math.hypot(dir.x, dir.z);
      if (length > .01) {
        const nx = dir.x / length; const nz = dir.z / length;
        player.position.x = THREE.MathUtils.clamp(player.position.x + nx * 3.2 * dt, -8, 8);
        player.position.z = THREE.MathUtils.clamp(player.position.z + nz * 3.2 * dt, -8, 8);
        player.rotation.y = Math.atan2(nx, nz);
      }
      const targetCamera = new THREE.Vector3(player.position.x, 5.2, player.position.z + 7.2); camera.position.lerp(targetCamera, .075); camera.lookAt(player.position.x, 1.1, player.position.z - 1.1);
      let closest: Hotspot | null = null; let distance = Infinity;
      for (const h of hotspots) {
        const d = Math.hypot(player.position.x - h.position[0], player.position.z - h.position[2]);
        if (d < distance) { distance = d; closest = h; }
      }
      const candidate: Hotspot | null = distance < 2 ? closest : null;
      if ((candidate?.id ?? null) !== lastHotspot.current) { lastHotspot.current = candidate?.id ?? null; setNearby(candidate); }
      renderer.render(scene, camera); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      generatedPlayer?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse(object => {
        if (generatedPlayer?.root === object || generatedPlayer?.root.getObjectById(object.id)) return;
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    };
  }, [config.ground, config.sky, equipmentSignature, hotspots, zone]);

  const move = (x: number, z: number) => { movement.current = { x, z }; };
  const stop = () => { movement.current = { x: 0, z: 0 }; };
  const interact = () => {
    if (!nearby) { setMessage("반짝이는 장소 가까이 가면 상호작용할 수 있어요."); return; }
    setMissionCount(count => Math.min(3, count + 1));
    if (user) {
      claim.mutate({ type: nearby.type as "scripture_read" | "prayer" | "service_mission" | "wilderness_victory", sourceId: `rpg:${dateKey()}:${zone}:${nearby.id}`, title: nearby.title });
      return;
    }
    const result = localGrowth.claim({ type: nearby.type, sourceId: `rpg:${dateKey()}:${zone}:${nearby.id}`, title: nearby.title });
    setMessage(`${nearby.emoji} ${result.message} · 이 기기에 저장했어요.`);
  };

  return (
    <main className={`growth-rpg growth-rpg-${zone}`} style={{ "--zone-accent": config.accent } as React.CSSProperties}>
      <div className="growth-rpg-canvas" ref={mountRef} />
      <header className="growth-rpg-hud">
        <Link href="/growth-game" className="growth-rpg-back">‹ 성장</Link>
        <div><strong>{config.name}</strong><small>{config.subtitle}</small></div>
        <div className="growth-rpg-currency">⭐ {profile.soulPoints}</div>
      </header>
      <div className={`growth-rpg-asset-badge ${assetMode}`} aria-live="polite">
        {assetMode === "generated" ? "AI-3D GLB" : assetMode === "loading" ? "3D 모델 확인 중" : "3D PREVIEW"}
      </div>
      <aside className="growth-rpg-side"><button>📜<span>퀘스트</span></button><button>🎒<span>가방</span></button><button>📖<span>말씀</span></button></aside>
      <div className="growth-rpg-message" role="status">{message}</div>
      {nearby && <button className="growth-rpg-interact" onClick={interact}><span>{nearby.emoji}</span><b>{nearby.label}</b><small>가까이 왔어요 · 눌러서 행동</small></button>}
      <div className="growth-rpg-joystick" aria-label="이동 방향키">
        <button className="up" onPointerDown={() => move(0,-1)} onPointerUp={stop} onPointerCancel={stop}>▲</button>
        <button className="left" onPointerDown={() => move(-1,0)} onPointerUp={stop} onPointerCancel={stop}>◀</button>
        <button className="right" onPointerDown={() => move(1,0)} onPointerUp={stop} onPointerCancel={stop}>▶</button>
        <button className="down" onPointerDown={() => move(0,1)} onPointerUp={stop} onPointerCancel={stop}>▼</button>
      </div>
      <div className="growth-rpg-actions"><button onClick={interact}>🖐️</button><button onClick={() => setMessage("🛡️ 믿음의 방패를 들었어요.")}>🛡️</button><button onClick={() => setMessage("⚔️ 암송한 말씀을 떠올려 진리를 선포해요.")}>⚔️</button></div>
      <section className="growth-rpg-mission"><b>오늘의 미션</b><span>{missionCount}/3</span><div><span style={{ width: `${(missionCount / 3) * 100}%` }} /></div><small>지역 안의 믿음 행동을 3번 실천해요.</small></section>
    </main>
  );
}