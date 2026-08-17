import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GrowthProfile } from "./types";

type Mood = "joyful" | "peaceful" | "hungry" | "resting" | "brave";

type Props = {
  profile: GrowthProfile;
  mood: Mood;
};

const COLORS = {
  skin: 0xf2b98f,
  skinWarm: 0xe7a77f,
  hair: 0x5c351e,
  hairLight: 0x76472b,
  tunic: 0xfff1d6,
  blue: 0x6daed2,
  blueDark: 0x3e7ba2,
  brown: 0x74472d,
  leather: 0x8c5c3d,
  silver: 0xcbd5df,
  gold: 0xf4c14d,
  glow: 0xffe58a,
  white: 0xffffff,
};

function mat(color: number, roughness = 0.72, metalness = 0.02, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name?: string) {
  const result = new THREE.Mesh(geometry, material);
  if (name) result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addRoundedHair(group: THREE.Group) {
  const hairMaterial = mat(COLORS.hair, 0.86);
  const crown = mesh(new THREE.SphereGeometry(0.49, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.72), hairMaterial, "hair-crown");
  crown.position.set(0, 2.12, -0.02);
  crown.scale.set(1.05, 0.76, 0.98);
  group.add(crown);

  const curls = [
    [-0.34, 2.22, 0.31, 0.19], [-0.12, 2.31, 0.36, 0.2], [0.12, 2.3, 0.34, 0.2], [0.33, 2.18, 0.29, 0.18],
    [-0.43, 2.03, 0.19, 0.17], [0.43, 2.03, 0.18, 0.17], [-0.23, 2.36, 0.08, 0.14], [0.23, 2.36, 0.08, 0.14],
  ] as const;
  for (const [x, y, z, radius] of curls) {
    const curl = mesh(new THREE.SphereGeometry(radius, 16, 12), mat(COLORS.hairLight, 0.9), "hair-curl");
    curl.position.set(x, y, z);
    curl.scale.set(1.25, 0.8, 0.9);
    group.add(curl);
  }
}

function addFace(group: THREE.Group, mood: Mood) {
  const eyeMaterial = mat(0x3a2418, 0.25);
  const whiteMaterial = mat(COLORS.white, 0.32);
  const faceZ = 0.47;
  const sleepy = mood === "peaceful" || mood === "resting";

  for (const side of [-1, 1]) {
    if (sleepy) {
      const lid = mesh(new THREE.TorusGeometry(0.075, 0.011, 8, 20, Math.PI), mat(0x4b2b1b, 0.7));
      lid.position.set(side * 0.17, 1.99, faceZ + 0.025);
      lid.rotation.set(Math.PI / 2, 0, side < 0 ? Math.PI : 0);
      group.add(lid);
    } else {
      const eyeWhite = mesh(new THREE.SphereGeometry(0.096, 16, 12), whiteMaterial, "eye-white");
      eyeWhite.position.set(side * 0.17, 2.0, faceZ);
      eyeWhite.scale.set(0.83, 1.08, 0.36);
      group.add(eyeWhite);
      const pupil = mesh(new THREE.SphereGeometry(0.054, 16, 12), eyeMaterial, "pupil");
      pupil.position.set(side * 0.17, 1.997, faceZ + 0.073);
      pupil.scale.z = 0.45;
      group.add(pupil);
      const sparkle = mesh(new THREE.SphereGeometry(0.014, 8, 6), whiteMaterial);
      sparkle.position.set(side * 0.15, 2.026, faceZ + 0.105);
      group.add(sparkle);
    }
  }

  const nose = mesh(new THREE.SphereGeometry(0.048, 12, 8), mat(COLORS.skinWarm, 0.8));
  nose.position.set(0, 1.88, faceZ + 0.06);
  nose.scale.set(0.8, 0.72, 0.7);
  group.add(nose);

  const mouthColor = mood === "hungry" ? 0x9b5a53 : 0x9b3f3f;
  const mouthArc = mood === "hungry" ? Math.PI : Math.PI;
  const mouth = mesh(new THREE.TorusGeometry(mood === "brave" ? 0.085 : 0.11, 0.015, 8, 24, mouthArc), mat(mouthColor, 0.55));
  mouth.position.set(0, mood === "hungry" ? 1.77 : 1.75, faceZ + 0.085);
  mouth.rotation.set(Math.PI / 2, 0, mood === "hungry" ? Math.PI : 0);
  mouth.scale.y = mood === "brave" ? 0.65 : 1;
  group.add(mouth);

  for (const side of [-1, 1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(0xf08f87, 0.9));
    cheek.position.set(side * 0.3, 1.82, faceZ + 0.025);
    cheek.scale.set(1.25, 0.55, 0.18);
    group.add(cheek);
  }
}

function addBody(group: THREE.Group) {
  const skin = mat(COLORS.skin, 0.8);
  const tunic = mat(COLORS.tunic, 0.88);
  const blue = mat(COLORS.blue, 0.78);
  const leather = mat(COLORS.leather, 0.84);

  const head = mesh(new THREE.SphereGeometry(0.48, 28, 22), skin, "head");
  head.position.set(0, 1.93, 0.03);
  head.scale.set(0.98, 1.05, 0.94);
  group.add(head);

  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.095, 12, 8), skin, "ear");
    ear.position.set(side * 0.47, 1.93, 0.01);
    ear.scale.set(0.65, 0.9, 0.55);
    group.add(ear);
  }

  const torso = mesh(new THREE.CapsuleGeometry(0.32, 0.54, 8, 18), tunic, "tunic");
  torso.position.set(0, 1.08, 0);
  torso.scale.set(1.05, 1.02, 0.72);
  group.add(torso);

  const skirt = mesh(new THREE.CylinderGeometry(0.33, 0.43, 0.48, 24), tunic, "tunic-skirt");
  skirt.position.set(0, 0.72, 0);
  skirt.scale.z = 0.78;
  group.add(skirt);

  const sash = mesh(new THREE.TorusGeometry(0.355, 0.035, 10, 32), blue, "sash");
  sash.position.set(0, 0.91, 0);
  sash.rotation.x = Math.PI / 2;
  sash.scale.z = 0.72;
  group.add(sash);
  const sashTail = mesh(new THREE.BoxGeometry(0.11, 0.34, 0.035), blue, "sash-tail");
  sashTail.position.set(0.18, 0.69, 0.24);
  sashTail.rotation.z = -0.09;
  group.add(sashTail);

  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.085, 0.38, 6, 12), skin, "arm");
    arm.position.set(side * 0.39, 1.12, 0);
    arm.rotation.z = side * -0.09;
    group.add(arm);

    const sleeve = mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.2, 16), tunic, "sleeve");
    sleeve.position.set(side * 0.35, 1.35, 0);
    sleeve.rotation.z = side * -0.1;
    group.add(sleeve);

    const leg = mesh(new THREE.CapsuleGeometry(0.1, 0.3, 6, 12), skin, "leg");
    leg.position.set(side * 0.17, 0.27, 0);
    group.add(leg);

    const sandalSole = mesh(new THREE.BoxGeometry(0.22, 0.07, 0.38), leather, "sandal");
    sandalSole.position.set(side * 0.17, 0.055, 0.055);
    sandalSole.rotation.y = side * 0.02;
    group.add(sandalSole);
    const sandalBand = mesh(new THREE.TorusGeometry(0.105, 0.025, 8, 20, Math.PI), leather, "sandal-band");
    sandalBand.position.set(side * 0.17, 0.12, 0.12);
    sandalBand.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    group.add(sandalBand);
  }
}

function equipmentMaterial(tier: number) {
  if (tier >= 5) return mat(COLORS.gold, 0.28, 0.72, COLORS.glow, 0.32);
  if (tier >= 3) return mat(COLORS.gold, 0.34, 0.58);
  if (tier >= 2) return mat(COLORS.silver, 0.32, 0.62);
  return mat(COLORS.brown, 0.72, 0.06);
}

function addShield(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const radius = 0.26 + tier * 0.018;
  const shield = mesh(new THREE.CylinderGeometry(radius, radius, 0.07, tier >= 4 ? 8 : 32), equipmentMaterial(tier), "shield_faith");
  shield.position.set(-0.49, 0.9, 0.18);
  shield.rotation.z = Math.PI / 2;
  shield.rotation.y = Math.PI / 2;
  group.add(shield);
  const crossMaterial = mat(tier >= 3 ? COLORS.blueDark : COLORS.gold, 0.35, 0.35, tier >= 5 ? COLORS.glow : 0x000000, tier >= 5 ? 0.55 : 0);
  const v = mesh(new THREE.BoxGeometry(0.055, radius * 1.22, 0.035), crossMaterial);
  const h = mesh(new THREE.BoxGeometry(radius * 0.78, 0.055, 0.035), crossMaterial);
  v.position.set(-0.525, 0.9, 0.18);
  h.position.set(-0.525, 0.94, 0.18);
  v.rotation.y = h.rotation.y = Math.PI / 2;
  group.add(v, h);
}

function addSword(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const bladeMaterial = tier >= 4 ? mat(0xa8dcff, 0.22, 0.65, tier >= 5 ? 0xffe69b : 0x6cc5ff, tier >= 5 ? 0.7 : 0.18) : equipmentMaterial(Math.max(2, tier));
  const blade = mesh(new THREE.BoxGeometry(0.075, 0.52 + tier * 0.035, 0.035), bladeMaterial, "sword_spirit");
  blade.position.set(0.51, 0.99, 0.13);
  blade.rotation.z = -0.28;
  group.add(blade);
  const guard = mesh(new THREE.BoxGeometry(0.29, 0.055, 0.07), mat(COLORS.gold, 0.35, 0.55));
  guard.position.set(0.42, 0.69, 0.13);
  guard.rotation.z = -0.28;
  group.add(guard);
  const handle = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12), mat(COLORS.leather, 0.8));
  handle.position.set(0.38, 0.57, 0.13);
  handle.rotation.z = -0.28;
  group.add(handle);
}

function addHelmet(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const helmet = mesh(new THREE.SphereGeometry(0.49 + tier * 0.006, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), equipmentMaterial(tier), "helmet_salvation");
  helmet.position.set(0, 2.12, 0);
  helmet.scale.set(1.02, 0.83, 1.02);
  group.add(helmet);
  if (tier >= 3) {
    const crest = mesh(new THREE.BoxGeometry(0.07, 0.24 + tier * 0.025, 0.04), mat(COLORS.gold, 0.32, 0.58, tier >= 5 ? COLORS.glow : 0, tier >= 5 ? 0.4 : 0));
    crest.position.set(0, 2.35, 0.1);
    group.add(crest);
  }
}

function addCrown(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const crownMaterial = equipmentMaterial(Math.max(3, tier));
  const band = mesh(new THREE.TorusGeometry(0.35, 0.045, 8, 28), crownMaterial, "crown");
  band.position.set(0, 2.48, 0);
  band.rotation.x = Math.PI / 2;
  band.scale.z = 0.86;
  group.add(band);
  const points = Math.min(5, 2 + tier);
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const gem = mesh(new THREE.ConeGeometry(0.055, 0.16 + tier * 0.015, 5), crownMaterial);
    gem.position.set(Math.cos(angle) * 0.29, 2.58, Math.sin(angle) * 0.25);
    group.add(gem);
  }
}

function addBreastplate(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const chest = mesh(new THREE.SphereGeometry(0.33, 20, 12), equipmentMaterial(tier), "breastplate_righteousness");
  chest.position.set(0, 1.25, 0.12);
  chest.scale.set(1.03, 0.86, 0.32 + tier * 0.018);
  group.add(chest);
}

function addBelt(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const belt = mesh(new THREE.TorusGeometry(0.37, 0.035 + tier * 0.005, 10, 32), equipmentMaterial(tier), "belt_truth");
  belt.position.set(0, 0.95, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.z = 0.72;
  group.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.12 + tier * 0.012, 0.11, 0.04), mat(tier >= 3 ? COLORS.blueDark : COLORS.gold, 0.38, 0.42));
  buckle.position.set(0, 0.95, 0.265);
  group.add(buckle);
}

function addShoes(group: THREE.Group, tier: number) {
  if (tier <= 0) return;
  const material = equipmentMaterial(tier);
  for (const side of [-1, 1]) {
    const greave = mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.3 + tier * 0.025, 14), material, "shoes_peace");
    greave.position.set(side * 0.17, 0.28, 0);
    group.add(greave);
    if (tier >= 4) {
      const wing = mesh(new THREE.ConeGeometry(0.07, 0.2, 5), mat(COLORS.gold, 0.3, 0.55, tier >= 5 ? COLORS.glow : 0, tier >= 5 ? 0.45 : 0));
      wing.position.set(side * 0.31, 0.25, 0.02);
      wing.rotation.z = side * 0.55;
      group.add(wing);
    }
  }
}

function buildMascot(profile: GrowthProfile, mood: Mood) {
  const group = new THREE.Group();
  group.name = "BibleFriendMascot";
  addBody(group);
  addRoundedHair(group);
  addFace(group, mood);

  const equipped = new Set(profile.equipped);
  const tiers = profile.equipmentTiers;
  if (equipped.has("belt_truth")) addBelt(group, tiers.belt_truth);
  if (equipped.has("breastplate_righteousness")) addBreastplate(group, tiers.breastplate_righteousness);
  if (equipped.has("shoes_peace")) addShoes(group, tiers.shoes_peace);
  if (equipped.has("shield_faith")) addShield(group, tiers.shield_faith);
  if (equipped.has("helmet_salvation")) addHelmet(group, tiers.helmet_salvation);
  if (equipped.has("sword_spirit")) addSword(group, tiers.sword_spirit);
  if (equipped.has("crown")) addCrown(group, tiers.crown);

  group.position.y = -0.15;
  return group;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

export default function BibleFriend3D({ profile, mood }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setFailed(false);

    let renderer: THREE.WebGLRenderer | null = null;
    let mascot: THREE.Group | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let controls: OrbitControls | null = null;
    let cancelled = false;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xfff8e9);
      scene.fog = new THREE.Fog(0xfff8e9, 5.5, 10);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 1.45, 6.15);
      camera.lookAt(0, 1.2, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.setAttribute("aria-label", "장비를 착용한 3D 성경 친구 캐릭터");
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      host.replaceChildren(renderer.domElement);

      const hemi = new THREE.HemisphereLight(0xfff5dc, 0x8094b0, 2.1);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(3.5, 6, 4.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9ed6ff, 1.4);
      fill.position.set(-4, 2.5, 2);
      scene.add(fill);
      const rim = new THREE.PointLight(0xffd978, 14, 7, 2);
      rim.position.set(0, 2.8, -2.2);
      scene.add(rim);

      const floor = mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.12, 48), mat(0xe7c792, 0.92), "room-rug");
      floor.position.set(0, -0.11, 0);
      floor.receiveShadow = true;
      scene.add(floor);
      const innerRug = mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.015, 48), mat(0xf7e1b8, 0.92), "room-rug-inner");
      innerRug.position.set(0, -0.035, 0);
      scene.add(innerRug);

      const backWall = mesh(new THREE.PlaneGeometry(8, 5), mat(0xffefd0, 1), "room-wall");
      backWall.position.set(0, 2.2, -2.35);
      scene.add(backWall);
      const windowFrame = mesh(new THREE.BoxGeometry(1.55, 1.45, 0.09), mat(0xe8c08c, 0.86), "room-window-frame");
      windowFrame.position.set(-2.15, 2.1, -2.23);
      scene.add(windowFrame);
      const windowSky = mesh(new THREE.PlaneGeometry(1.32, 1.21), mat(0xaedfff, 0.92), "room-window-sky");
      windowSky.position.set(-2.15, 2.1, -2.17);
      scene.add(windowSky);

      mascot = buildMascot(profile, mood);
      scene.add(mascot);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 4.9;
      controls.maxDistance = 7.2;
      controls.minPolarAngle = Math.PI * 0.33;
      controls.maxPolarAngle = Math.PI * 0.58;
      controls.target.set(0, 1.25, 0);
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotateSpeed = 0.55;

      const resize = () => {
        if (!renderer || !host) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        if (cancelled || !renderer || !mascot) return;
        const elapsed = clock.getElapsedTime();
        if (mood === "joyful") mascot.position.y = -0.15 + Math.sin(elapsed * 2.1) * 0.035;
        if (mood === "brave") mascot.rotation.z = Math.sin(elapsed * 1.6) * 0.012;
        if (mood === "resting") mascot.rotation.z = Math.sin(elapsed * 0.7) * 0.018;
        controls?.update();
        renderer.render(scene, camera);
      });
    } catch (error) {
      console.warn("[Growth3D] WebGL scene failed; using 2D fallback", error);
      setFailed(true);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      controls?.dispose();
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        renderer.domElement.remove();
      }
      if (mascot) disposeObject(mascot);
    };
  }, [profile.equipped, profile.equipmentTiers, mood]);

  if (failed) return <div className="growth-3d-fallback" aria-live="polite">3D 장면을 준비하지 못해 2D 친구로 보여드려요.</div>;
  return <div ref={hostRef} className="growth-3d-stage" data-testid="growth-3d-stage" />;
}
