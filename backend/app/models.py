from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone

# User Model
class User(BaseModel):
    id: Optional[str]
    username: str
    email: str
    password: str
    created_at: datetime = datetime.now(timezone.utc)

# File Metadata Model
class FileMetadata(BaseModel):
    id: Optional[str]
    filename: str
    owner_id: str
    s3_url: str
    shared_with: Optional[List[str]] = []
    created_at: datetime = datetime.now(timezone.utc)
    expires_at: Optional[datetime] = None
    starred: bool = False


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    created_at: datetime = datetime.now(timezone.utc)

class UserLogin(BaseModel):
    email: EmailStr
    password:str


class ShareRequest(BaseModel):
    shared_with_email: str