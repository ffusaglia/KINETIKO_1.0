from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Scene(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    config: Dict[str, Any]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SceneCreate(BaseModel):
    name: str
    config: Dict[str, Any]


class SceneUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "VJ Kinetic Type Engine API"}


@api_router.post("/scenes", response_model=Scene)
async def create_scene(payload: SceneCreate):
    scene = Scene(name=payload.name, config=payload.config)
    await db.scenes.insert_one(scene.model_dump())
    return scene


@api_router.get("/scenes", response_model=List[Scene])
async def list_scenes():
    docs = await db.scenes.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return docs


@api_router.get("/scenes/{scene_id}", response_model=Scene)
async def get_scene(scene_id: str):
    doc = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Scene not found")
    return doc


@api_router.put("/scenes/{scene_id}", response_model=Scene)
async def update_scene(scene_id: str, payload: SceneUpdate):
    doc = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Scene not found")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.scenes.update_one({"id": scene_id}, {"$set": update})
    doc.update(update)
    return doc


@api_router.delete("/scenes/{scene_id}")
async def delete_scene(scene_id: str):
    res = await db.scenes.delete_one({"id": scene_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scene not found")
    return {"deleted": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
