import * as THREE from "three";
import type { GrowthZone } from "./types";

export type WorldHotspot = { id: string; position: [number, number, number] };
export type WorldObstacle = { x: number; z: number; radius: number };

export interface GrowthWorldBuild {
  obstacles: WorldObstacle[];
  spawn: [number, number, number];
}

const MAT = {
  wood: new THREE.MeshStandardMaterial({ color: 0x8d5a34, roughness: .82 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x5f3a24, roughness: .9 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xe9d5ae, roughness: .94 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xb8aa90, roughness: .95 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x79bad4, roughness: .72 }),
  green: new THREE.MeshStandardMaterial({ color: 0x659d55, roughness: .9 }),
  darkGreen: new THREE.MeshStandardMaterial({ color: 0x477b43, roughness: .92 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a840, roughness: .48, metalness: .22 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0xf2e9d6, roughness: 1 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc46b62, roughness: .86 }),
};

function box(scene: THREE.Scene, size: [number, number, number], position: [number, number, number], material = MAT.wood) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addTree(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16 * scale, .22 * scale, 1.15 * scale, 8), MAT.darkWood);
  trunk.position.set(x, .58 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);
  for (const [dx, dy, dz, radius] of [[0,1.52,0,.65],[-.34,1.35,.06,.48],[.34,1.38,-.04,.5]] as Array<[number,number,number,number]>) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * scale, 1), MAT.green);
    crown.position.set(x + dx * scale, dy * scale, z + dz * scale);
    crown.castShadow = true;
    scene.add(crown);
  }
}

function addHouse(scene: THREE.Scene, x: number, z: number, roofColor = 0x9b654c, chapel = false) {
  const wall = box(scene, [2.5, 1.8, 2.2], [x, .9, z], MAT.plaster);
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: .88 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.1, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, 2.25, z);
  roof.castShadow = true;
  scene.add(roof);
  box(scene, [.65, 1.2, .08], [x, .62, z + 1.14], MAT.darkWood);
  box(scene, [.55, .55, .09], [x - .72, 1.15, z + 1.14], MAT.blue);
  if (chapel) {
    box(scene, [.12, .85, .12], [x, 3.25, z], MAT.darkWood);
    box(scene, [.58, .12, .12], [x, 3.36, z], MAT.darkWood);
  }
  return wall;
}

function addFence(scene: THREE.Scene, x: number, z: number, length: number, rotate = 0) {
  const group = new THREE.Group();
  for (let index = 0; index <= length; index += 1) box(group as unknown as THREE.Scene, [.12, .75, .12], [index * .62 - length * .31, .38, 0], MAT.cloth);
  box(group as unknown as THREE.Scene, [length * .62 + .18, .1, .1], [0, .28, 0], MAT.cloth);
  box(group as unknown as THREE.Scene, [length * .62 + .18, .1, .1], [0, .58, 0], MAT.cloth);
  group.position.set(x, 0, z);
  group.rotation.y = rotate;
  scene.add(group);
}

function addFlowers(scene: THREE.Scene, centerX: number, centerZ: number, count = 18) {
  const stemGeometry = new THREE.CylinderGeometry(.018, .022, .16, 5);
  const petalGeometry = new THREE.SphereGeometry(.055, 5, 4);
  const stem = new THREE.InstancedMesh(stemGeometry, MAT.darkGreen, count);
  const petals = new THREE.InstancedMesh(petalGeometry, new THREE.MeshStandardMaterial({ color: 0xd77fa0 }), count);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399;
    const radius = .18 + (index % 6) * .11;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    dummy.position.set(x, .08, z); dummy.updateMatrix(); stem.setMatrixAt(index, dummy.matrix);
    dummy.position.set(x, .18, z); dummy.scale.setScalar(index % 3 === 0 ? 1.2 : 1); dummy.updateMatrix(); petals.setMatrixAt(index, dummy.matrix);
  }
  scene.add(stem, petals);
}

function addNpc(scene: THREE.Scene, x: number, z: number, color: number, facing = 0) {
  const group = new THREE.Group();
  const tunic = new THREE.Mesh(new THREE.CylinderGeometry(.28, .38, .72, 10), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  tunic.position.y = .58;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.27, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8ba91, roughness: .8 }));
  head.position.y = 1.2;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.29, 10, 7, 0, Math.PI * 2, 0, Math.PI * .58), MAT.darkWood);
  hair.position.y = 1.32;
  group.add(tunic, head, hair);
  group.position.set(x, 0, z);
  group.rotation.y = facing;
  group.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  scene.add(group);
}

function addLamp(scene: THREE.Scene, x: number, z: number) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 1.9, 8), new THREE.MeshStandardMaterial({ color: 0x343a3a, metalness: .35, roughness: .5 }));
  pole.position.set(x, .95, z);
  scene.add(pole);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.28, .42, .28), new THREE.MeshStandardMaterial({ color: 0xffd77b, emissive: 0xf2a83a, emissiveIntensity: .8 }));
  lamp.position.set(x, 1.82, z);
  scene.add(lamp);
}

function addFountain(scene: THREE.Scene, x: number, z: number) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, .28, 24), MAT.stone); base.position.set(x, .14, z); scene.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(.88, .88, .08, 24), new THREE.MeshStandardMaterial({ color: 0x70c9df, roughness: .25, metalness: .05 })); water.position.set(x, .31, z); scene.add(water);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, .8, 12), MAT.stone); stem.position.set(x, .68, z); scene.add(stem);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.45, .3, .14, 18), MAT.stone); bowl.position.set(x, 1.08, z); scene.add(bowl);
}

function addCactus(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x4e8652, roughness: .94 });
  const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(.16 * scale, .9 * scale, 4, 8), mat); trunk.position.set(x, .55 * scale, z); scene.add(trunk);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.11 * scale, .45 * scale, 4, 8), mat); arm.rotation.z = Math.PI / 2; arm.position.set(x + .22 * scale, .58 * scale, z); scene.add(arm);
}

function addRock(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.45 * scale, 0), new THREE.MeshStandardMaterial({ color: 0x9c6944, roughness: 1 }));
  rock.scale.y = .68;
  rock.position.set(x, .3 * scale, z);
  rock.rotation.set(.2, x * .31, .1);
  rock.castShadow = true;
  scene.add(rock);
}

function addHotspotMarkers(scene: THREE.Scene, hotspots: WorldHotspot[]) {
  hotspots.forEach((hotspot, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.46, .07, 8, 28), new THREE.MeshStandardMaterial({ color: 0xf6cf63, emissive: 0xf0b62c, emissiveIntensity: .8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(hotspot.position[0], .09, hotspot.position[2]);
    ring.userData.hotspotId = hotspot.id;
    ring.userData.pulseOffset = index * .7;
    scene.add(ring);
  });
}

function buildHome(scene: THREE.Scene, obstacles: WorldObstacle[]) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshStandardMaterial({ color: 0xa87445, roughness: .96 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = .018; floor.receiveShadow = true; scene.add(floor);
  box(scene, [13, 3.8, .18], [0, 1.9, -6.2], MAT.plaster);
  box(scene, [.18, 3.8, 12], [-6.2, 1.9, -.2], MAT.plaster);
  box(scene, [.18, 3.8, 12], [6.2, 1.9, -.2], MAT.plaster);
  box(scene, [2.4, .12, 1.5], [-2.7, .78, -1], MAT.wood);
  box(scene, [.12, 1.2, 1.5], [-3.75, .6, -1], MAT.wood);
  box(scene, [.12, 1.2, 1.5], [-1.65, .6, -1], MAT.wood);
  const bible = box(scene, [.75, .08, .52], [-2.7, .9, -1], new THREE.MeshStandardMaterial({ color: 0x5c3b70, roughness: .8 })); bible.rotation.y = -.08;
  box(scene, [2.2, .42, 1.2], [-4.2, .35, 3.2], new THREE.MeshStandardMaterial({ color: 0x6e8dae, roughness: .9 }));
  box(scene, [2.35, .7, .14], [-4.2, .72, 3.7], MAT.wood);
  box(scene, [1.7, .16, 1.3], [3.45, .1, -1], MAT.cloth);
  box(scene, [.75, 1.5, .12], [3.45, 1.35, -5.98], MAT.darkWood);
  box(scene, [.72, .12, .12], [3.45, 1.48, -5.91], MAT.darkWood);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(.45, .5, .25, 14), new THREE.MeshStandardMaterial({ color: 0xb78246, roughness: .9 })); basket.position.set(0, .14, 3); scene.add(basket);
  for (const [dx,dz] of [[-.18,0],[.12,.08],[.03,-.12]]) { const bread = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 6), new THREE.MeshStandardMaterial({ color: 0xd9a05c })); bread.scale.y=.55; bread.position.set(dx,.36,3+dz); scene.add(bread); }
  obstacles.push({ x:-2.7,z:-1,radius:1.3 }, { x:-4.2,z:3.2,radius:1.25 }, { x:3.45,z:-1,radius:1.1 }, { x:0,z:3,radius:.65 });
}

function buildRoad(scene: THREE.Scene, obstacles: WorldObstacle[]) {
  addHouse(scene,-5,-5.4,0x9d6252,true); addHouse(scene,4.8,-5.1,0x5d86a0,false); addHouse(scene,5.5,4.2,0x9a6f47,false);
  for (const [x,z] of [[-5,2.8],[-4,-2],[4,-1],[5,2],[-2,-5],[2,5]] as Array<[number,number]>) { addTree(scene,x,z,.95); obstacles.push({x,z,radius:.72}); }
  addFence(scene,-4.4,1.2,6,.05); addFence(scene,4.5,.9,6,-.05); addLamp(scene,-2.2,.2); addLamp(scene,2.4,-2.2);
  addFlowers(scene,-3.8,-.3); addFlowers(scene,3.6,2.3); addFlowers(scene,-4.6,4.2);
  addNpc(scene,-2.5,-2,.62?0x806aaf:0x806aaf,.4); addNpc(scene,2.6,-1,0x8a6b48,-.6); addNpc(scene,.5,3.2,0xb16f6f,2.7);
  obstacles.push({x:-5,z:-5.4,radius:1.6},{x:4.8,z:-5.1,radius:1.6},{x:5.5,z:4.2,radius:1.6});
}

function buildWilderness(scene: THREE.Scene, obstacles: WorldObstacle[]) {
  const rockPositions: Array<[number,number,number]> = [[-5,-5,1.3],[-3.5,-1,.8],[4,-3,1.1],[5,3,.9],[-5,4,1],[2.8,5,.7],[0,-6,1.2]];
  rockPositions.forEach(([x,z,s])=>{addRock(scene,x,z,s); obstacles.push({x,z,radius:.45*s});});
  [[-4,1],[4,1],[-2,-4],[5,-5]] .forEach(([x,z])=>{addCactus(scene,x,z,1); obstacles.push({x,z,radius:.35});});
  for (const [x,z,s] of [[-1,-7,1],[1.2,-7.4,1.35],[3,-7,.9]] as Array<[number,number,number]>) {
    const shadow = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(.42*s,1.2*s,8),new THREE.MeshStandardMaterial({color:0x241d24,transparent:true,opacity:.76})); body.position.y=.6*s;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.3*s,8,6),new THREE.MeshStandardMaterial({color:0x1d171d,transparent:true,opacity:.8})); head.position.y=1.35*s;
    shadow.add(body,head); shadow.position.set(x,0,z); scene.add(shadow);
  }
}

function buildVillage(scene: THREE.Scene, obstacles: WorldObstacle[]) {
  addHouse(scene,-5,-5.3,0x9b6451,true); addHouse(scene,4.7,-5.3,0x668ba2,false); addHouse(scene,-5,4.5,0x9a774f,false); addHouse(scene,5,4,0xa36b52,false);
  addFountain(scene,0,-1.2); obstacles.push({x:0,z:-1.2,radius:1.25});
  for (const [x,z] of [[-3,1.8],[3,1.6],[-2,-4],[2,-4],[0,5]] as Array<[number,number]>) { addTree(scene,x,z,.8); obstacles.push({x,z,radius:.62}); }
  addNpc(scene,-2.8,-2,0x8974b5,.5); addNpc(scene,2.8,-2,0x829267,-.5); addNpc(scene,0,3,0xb37c68,3.1);
  addFlowers(scene,-3.8,3); addFlowers(scene,3.8,2.7); addFlowers(scene,0,-3.5,22); addLamp(scene,-2.2,-.2); addLamp(scene,2.2,-.2);
  obstacles.push({x:-5,z:-5.3,radius:1.6},{x:4.7,z:-5.3,radius:1.6},{x:-5,z:4.5,radius:1.6},{x:5,z:4,radius:1.6});
}

export function buildGrowthWorld(scene: THREE.Scene, zone: GrowthZone, hotspots: WorldHotspot[]): GrowthWorldBuild {
  const obstacles: WorldObstacle[] = [];
  if (zone === "home") buildHome(scene, obstacles);
  else if (zone === "road") buildRoad(scene, obstacles);
  else if (zone === "wilderness") buildWilderness(scene, obstacles);
  else buildVillage(scene, obstacles);
  addHotspotMarkers(scene, hotspots);
  return { obstacles, spawn: zone === "home" ? [0,0,4.6] : [0,0,5] };
}

export function canMoveTo(x: number, z: number, obstacles: WorldObstacle[], radius = .32) {
  if (x < -8 || x > 8 || z < -8 || z > 8) return false;
  return !obstacles.some(obstacle => Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + radius);
}
