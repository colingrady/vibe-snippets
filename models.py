from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid
import os

# Create the database directory if it doesn't exist
os.makedirs('data', exist_ok=True)

# Create async engine
engine = create_async_engine('sqlite+aiosqlite:///data/snippets.db', echo=True)
Base = declarative_base()

class Snippet(Base):
    __tablename__ = 'snippets'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), unique=True, nullable=False)
    content = Column(Text, nullable=False)
    git_tracking = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'content': self.content,
            'git_tracking': self.git_tracking,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

# Create tables
async def init_db():
    engine = create_async_engine('sqlite+aiosqlite:///data/snippets.db', echo=True)
    async with engine.begin() as conn:
        # Drop all tables first to ensure clean state
        await conn.run_sync(Base.metadata.drop_all)
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
    return engine

# Create async session factory
async_session = sessionmaker(
    create_async_engine('sqlite+aiosqlite:///data/snippets.db', echo=True),
    class_=AsyncSession,
    expire_on_commit=False
) 