from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from mongomock_motor import AsyncMongoMockClient

from app.config import settings

_client: AsyncIOMotorClient | AsyncMongoMockClient | None = None


def get_client() -> AsyncIOMotorClient | AsyncMongoMockClient:
    global _client
    if _client is None:
        if settings.mongodb_uri.startswith("mongomock://"):
            _client = AsyncMongoMockClient()
        else:
            _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_database() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongodb_db]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
