from __future__ import annotations

import os
import secrets
import threading
import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import httpx
import rembg
import torch
import trimesh
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel, Field
from tsr.system import TSR
from tsr.utils import remove_background, resize_foreground

OUTPUT_DIR = Path(os.getenv("AI3D_OUTPUT_DIR", "/data/output"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MAX_INPUT_BYTES = 10 * 1024 * 1024
MODEL_ID = os.getenv("TRIPOSR_MODEL_ID", "stabilityai/TripoSR")
DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"
WORKER_TOKEN = os.getenv("AI3D_WORKER_TOKEN", "").strip()

app = FastAPI(title="Bible Friend Open AI-3D Worker", version="1.0.0")
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
INFERENCE_LOCK = threading.Lock()
MODEL: TSR | None = None
REMBG_SESSION = None


class ImageTo3DRequest(BaseModel):
    assetId: str = Field(min_length=1, max_length=160)
    imageUrl: str = Field(min_length=8, max_length=2000)
    outputFormat: Literal["glb"] = "glb"
    faceLimit: int = Field(default=30000, ge=1000, le=100000)


@app.middleware("http")
async def protect_generation_api(request: Request, call_next):
    if request.url.path.startswith("/v1/") and WORKER_TOKEN:
        provided = request.headers.get("authorization", "")
        expected = f"Bearer {WORKER_TOKEN}"
        if not secrets.compare_digest(provided, expected):
            return JSONResponse(status_code=401, content={"detail": "unauthorized"})
    return await call_next(request)


def set_job(job_id: str, **values):
    with JOBS_LOCK:
        JOBS.setdefault(job_id, {}).update(values)


def get_model() -> TSR:
    global MODEL
    if MODEL is None:
        with INFERENCE_LOCK:
            if MODEL is None:
                model = TSR.from_pretrained(MODEL_ID, config_name="config.yaml", weight_name="model.ckpt")
                model.renderer.set_chunk_size(int(os.getenv("TRIPOSR_RENDER_CHUNK", "8192")))
                MODEL = model.to(DEVICE)
    return MODEL


def get_rembg_session():
    global REMBG_SESSION
    if REMBG_SESSION is None:
        REMBG_SESSION = rembg.new_session()
    return REMBG_SESSION


def download_image(url: str) -> Image.Image:
    parsed = urlparse(url)
    if parsed.scheme not in {"https", "http"}:
        raise ValueError("imageUrl must use http or https")
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            declared = int(response.headers.get("content-length") or 0)
            if declared > MAX_INPUT_BYTES:
                raise ValueError("reference image exceeds 10 MB")
            data = bytearray()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > MAX_INPUT_BYTES:
                    raise ValueError("reference image exceeds 10 MB")
    return Image.open(BytesIO(bytes(data))).convert("RGBA")


def normalize_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    mesh.remove_unreferenced_vertices()
    bounds = mesh.bounds
    center = (bounds[0] + bounds[1]) / 2
    mesh.apply_translation(-center)
    height = float(mesh.extents[1])
    if height > 1e-6:
        mesh.apply_scale(2.2 / height)
    mesh.apply_translation([0, 1.1, 0])
    return mesh


def simplify_mesh(mesh: trimesh.Trimesh, face_limit: int) -> trimesh.Trimesh:
    if len(mesh.faces) <= face_limit:
        return mesh
    try:
        return mesh.simplify_quadric_decimation(face_count=face_limit)
    except Exception:
        return mesh


def run_job(job_id: str, payload: ImageTo3DRequest, public_base_url: str):
    started = time.time()
    try:
        set_job(job_id, status="running", progress=5)
        image = download_image(payload.imageUrl)
        set_job(job_id, progress=15)
        if image.mode == "RGBA" and image.getextrema()[3][0] < 255:
            processed = image
        else:
            processed = remove_background(image, get_rembg_session())
        processed = resize_foreground(processed, 0.85)
        set_job(job_id, progress=28)

        model = get_model()
        with INFERENCE_LOCK, torch.no_grad():
            scene_codes = model([processed], device=DEVICE)
            set_job(job_id, progress=68)
            meshes = model.extract_mesh(scene_codes, True, resolution=256)
        if not meshes:
            raise RuntimeError("TripoSR returned no mesh")

        mesh = normalize_mesh(meshes[0])
        mesh = simplify_mesh(mesh, payload.faceLimit)
        set_job(job_id, progress=84)
        output_path = OUTPUT_DIR / f"{job_id}.glb"
        mesh.export(output_path, file_type="glb")
        if not output_path.exists() or output_path.stat().st_size < 12:
            raise RuntimeError("GLB export failed")
        model_url = f"{public_base_url}/files/{job_id}.glb"
        set_job(
            job_id,
            status="success",
            progress=100,
            modelUrl=model_url,
            triangleCount=int(len(mesh.faces)),
            bytes=int(output_path.stat().st_size),
            elapsedSeconds=round(time.time() - started, 2),
        )
    except Exception as exc:
        set_job(job_id, status="failed", progress=100, error=str(exc), elapsedSeconds=round(time.time() - started, 2))


@app.get("/health")
def health():
    return {
        "ok": True,
        "engine": "TripoSR",
        "model": MODEL_ID,
        "device": DEVICE,
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "authRequired": bool(WORKER_TOKEN),
    }


@app.post("/v1/image-to-3d")
def image_to_3d(payload: ImageTo3DRequest, request: Request):
    if DEVICE == "cpu" and os.getenv("ALLOW_CPU_AI3D", "false").lower() != "true":
        raise HTTPException(status_code=503, detail="GPU is required. Set ALLOW_CPU_AI3D=true only for slow development tests.")
    job_id = uuid.uuid4().hex
    set_job(job_id, jobId=job_id, status="queued", progress=0, assetId=payload.assetId)
    public_base_url = os.getenv("AI3D_PUBLIC_BASE_URL", str(request.base_url).rstrip("/"))
    thread = threading.Thread(target=run_job, args=(job_id, payload, public_base_url.rstrip("/")), daemon=True)
    thread.start()
    return {"jobId": job_id, "status": "queued", "progress": 0}


@app.get("/v1/jobs/{job_id}")
def job_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")
        return dict(job)
