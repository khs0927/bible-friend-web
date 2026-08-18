import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = "/assets/growth/3d/character/bible-friend-base.glb";

export default function GrowthModelViewer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfff7e9);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    camera.position.set(3.6, 2.8, 5.3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 2.3;
    controls.maxDistance = 9;
    controls.target.set(0, 1.25, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.35;
    controls.enablePan = false;

    const hemi = new THREE.HemisphereLight(0xfff8e8, 0x8ca37b, 2.25);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff0d2, 3.1);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xb9ddff, 1.5);
    fill.position.set(-4, 3, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd69c, 1.2);
    rim.position.set(1, 4, -5);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.9, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: 0xf1dfb8, roughness: 0.92 }),
    );
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(7, 14, 0xc9a96b, 0xe7d7b7);
    grid.position.y = 0;
    grid.material.transparent = true;
    grid.material.opacity = 0.38;
    grid.visible = showGrid;
    scene.add(grid);

    const loader = new GLTFLoader();
    let modelRoot: THREE.Object3D | null = null;

    setStatus("loading");
    loader.load(
      MODEL_URL,
      gltf => {
        if (disposed) return;
        modelRoot = gltf.scene;
        modelRoot.name = "BibleFriendViewerModel";
        modelRoot.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 0.001) modelRoot.scale.multiplyScalar(2.55 / size.y);
        const fitted = new THREE.Box3().setFromObject(modelRoot);
        const center = fitted.getCenter(new THREE.Vector3());
        modelRoot.position.x -= center.x;
        modelRoot.position.z -= center.z;
        modelRoot.position.y -= fitted.min.y;
        scene.add(modelRoot);
        setStatus("ready");
      },
      undefined,
      () => {
        if (!disposed) setStatus("error");
      },
    );

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.autoRotate = autoRotate;
      grid.visible = showGrid;
      controls.update(clock.getDelta());
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [autoRotate, showGrid]);

  return (
    <main style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#fffaf0 0%,#f6efff 100%)", color: "#44365d", paddingBottom: "24px" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px", background: "rgba(255,250,240,.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid #eadcc3" }}>
        <Link href="/growth-game" style={{ color: "#6b4ab6", textDecoration: "none", fontWeight: 900 }}>‹ 성장</Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "10px", letterSpacing: ".22em", color: "#9b75d0", fontWeight: 900 }}>3D MODEL VIEWER</div>
          <div style={{ fontSize: "16px", fontWeight: 950 }}>Bible Friend 베이스 캐릭터</div>
        </div>
        <span style={{ minWidth: "44px", textAlign: "right", fontSize: "12px", fontWeight: 900, color: status === "ready" ? "#4f8b62" : status === "error" ? "#b45555" : "#9b75d0" }}>
          {status === "ready" ? "● LIVE" : status === "error" ? "오류" : "로딩"}
        </span>
      </header>

      <section style={{ padding: "14px" }}>
        <div style={{ position: "relative", height: "min(72dvh, 680px)", minHeight: "480px", borderRadius: "28px", overflow: "hidden", border: "2px solid #edc86e", background: "#fff7e9", boxShadow: "0 18px 48px rgba(89,64,123,.14)" }}>
          <div ref={mountRef} style={{ position: "absolute", inset: 0, touchAction: "none" }} />
          {status === "loading" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", fontWeight: 900, color: "#7a58b0" }}>🌱 GLB 불러오는 중…</div>}
          {status === "error" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: "24px", textAlign: "center", fontWeight: 900, color: "#9d4c4c" }}>GLB를 불러오지 못했습니다.<br />잠시 뒤 새로고침해 주세요.</div>}
          <div style={{ position: "absolute", left: "12px", bottom: "12px", right: "12px", display: "flex", justifyContent: "space-between", gap: "8px", pointerEvents: "none" }}>
            <div style={{ borderRadius: "999px", padding: "8px 11px", background: "rgba(255,255,255,.86)", boxShadow: "0 6px 18px rgba(0,0,0,.08)", fontSize: "11px", fontWeight: 850 }}>☝️ 회전 · 🤏 확대/축소</div>
            <div style={{ borderRadius: "999px", padding: "8px 11px", background: "rgba(255,255,255,.86)", boxShadow: "0 6px 18px rgba(0,0,0,.08)", fontSize: "11px", fontWeight: 850 }}>GLB · 모바일 경량</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
          <button type="button" onClick={() => setAutoRotate(value => !value)} style={{ minHeight: "48px", border: "1px solid #dbcaf5", borderRadius: "16px", background: autoRotate ? "#6f4ad8" : "#fff", color: autoRotate ? "#fff" : "#5b4780", fontWeight: 900 }}>
            {autoRotate ? "⏸ 자동 회전 끄기" : "▶ 자동 회전 켜기"}
          </button>
          <button type="button" onClick={() => setShowGrid(value => !value)} style={{ minHeight: "48px", border: "1px solid #e3d6c2", borderRadius: "16px", background: showGrid ? "#fff2ce" : "#fff", color: "#66513a", fontWeight: 900 }}>
            {showGrid ? "▦ 그리드 끄기" : "▦ 그리드 켜기"}
          </button>
        </div>

        <div style={{ marginTop: "12px", padding: "16px", borderRadius: "20px", border: "1px solid #eadfd0", background: "rgba(255,255,255,.86)", lineHeight: 1.65 }}>
          <div style={{ fontWeight: 950, marginBottom: "6px" }}>현재 표시 모델</div>
          <code style={{ display: "block", overflowWrap: "anywhere", fontSize: "11px", color: "#7959ad" }}>{MODEL_URL}</code>
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#796e86" }}>이 페이지는 현재 실제 게임에서 사용하는 1차 GLB 파이프라인 검증용 모델을 보여줍니다. 다음 고품질 AI 멀티뷰 모델이 완성되면 같은 URL을 교체하므로 뷰어 주소는 그대로 유지됩니다.</p>
        </div>

        <Link href="/growth-adventure/home" style={{ marginTop: "12px", minHeight: "52px", display: "grid", placeItems: "center", borderRadius: "17px", background: "linear-gradient(135deg,#7050d8,#9b75e7)", color: "#fff", textDecoration: "none", fontWeight: 950, boxShadow: "0 10px 24px rgba(102,78,170,.22)" }}>
          🏠 말씀의 집에서 이 캐릭터 테스트
        </Link>
      </section>
    </main>
  );
}
