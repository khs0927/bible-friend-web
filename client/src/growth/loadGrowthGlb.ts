import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GROWTH_3D_ASSETS, GROWTH_3D_ATTACH_POINTS, equippedGlbUrls } from "./assetManifest";
import type { GrowthProfile } from "./types";

const loader = new GLTFLoader();

async function exists(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function prepareModel(root: THREE.Object3D, targetHeight?: number) {
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  if (targetHeight) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > .001) root.scale.multiplyScalar(targetHeight / size.y);
    const fitted = new THREE.Box3().setFromObject(root);
    const center = fitted.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= fitted.min.y;
  }
  return root;
}

async function loadScene(url: string) {
  if (!(await exists(url))) return null;
  try {
    const gltf = await loader.loadAsync(url);
    return { scene: gltf.scene, animations: gltf.animations };
  } catch {
    return null;
  }
}

export interface LoadedGrowthPlayer {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

export async function loadGrowthPlayerGlb(profile: GrowthProfile): Promise<LoadedGrowthPlayer | null> {
  const character = await loadScene(GROWTH_3D_ASSETS.character.base);
  if (!character) return null;

  const root = new THREE.Group();
  root.name = "BibleFriendGeneratedPlayer";
  const characterRoot = prepareModel(character.scene, 2.25);
  root.add(characterRoot);

  for (const asset of equippedGlbUrls(profile)) {
    const loaded = await loadScene(asset.url);
    if (!loaded) continue;
    const equipment = prepareModel(loaded.scene);
    equipment.name = `equipment:${asset.id}:lv${asset.tier}`;
    const attachName = GROWTH_3D_ATTACH_POINTS[asset.id];
    const attachPoint = characterRoot.getObjectByName(attachName);
    (attachPoint ?? characterRoot).add(equipment);
  }

  const mixer = character.animations.length ? new THREE.AnimationMixer(characterRoot) : null;
  if (mixer) {
    const idle = character.animations.find(clip => /idle/i.test(clip.name)) ?? character.animations[0];
    if (idle) mixer.clipAction(idle).play();
  }

  return {
    root,
    mixer,
    update: deltaSeconds => mixer?.update(deltaSeconds),
    dispose: () => {
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        });
      });
    },
  };
}
