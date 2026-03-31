from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from utils.logger import get_logger
import os

logger = get_logger(__name__)

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


async def connect_db():
    global _client, _db
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "npm_db")
    try:
        _client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        _db = _client[db_name]
        await _client.admin.command("ping")
        logger.info(f"MongoDB connected → {db_name}")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        raise


async def close_db():
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _db
