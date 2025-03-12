from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.config import db
from app.models import User, FileMetadata, UserCreate, UserLogin, ShareRequest
from bson import ObjectId
from datetime import datetime, timedelta, timezone
from typing import List
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.services import upload_file_to_s3,generate_presigned_url, delete_file_from_s3
import asyncio


router = APIRouter()

# Secure this route with JWT
@router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find().to_list(100)
    return [User(id=str(user["_id"]), **user) for user in users]

# Secure this route with JWT
@router.get("/files")
async def get_files(
    current_user: dict = Depends(get_current_user),
    sort_by: str = "newest",
    filter_by: str = None
):
    """Get all files uploaded by the authenticated user with sorting & filtering"""
    
    query = {"owner_id": str(current_user["_id"])}
    
    if filter_by == "shared":
        query = {"shared_with": current_user["email"]}
    elif filter_by == "uploaded":
        query = {"owner_id": str(current_user["_id"])}

    files = await db.files.find(query).to_list(100)

    if not files:
        raise HTTPException(status_code=404, detail="No files found")

    if sort_by == "newest":
        files.sort(key=lambda x: x["created_at"], reverse=True)
    elif sort_by == "oldest":
        files.sort(key=lambda x: x["created_at"])
    elif sort_by == "size":
        files.sort(key=lambda x: x.get("size", 0), reverse=True)
    elif sort_by == "alphabetical":
        files.sort(key=lambda x: x["filename"].lower())

    return [FileMetadata(id=str(file["_id"]), **file) for file in files]

@router.post("/signup")
async def signup(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = hash_password(user.password)
    new_user = {
        "username": user.username,
        "email": user.email,
        "hashed_password": hashed_password,
    }

    result = await db.users.insert_one(new_user)
    return {"message": "User created successfully", "user_id": str(result.inserted_id)}

@router.post("/login")
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # Create JWT Token
    token_expires = timedelta(minutes=60)
    access_token = create_access_token(data={"sub": db_user["email"]}, expires_delta=token_expires)

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_url = await upload_file_to_s3(file)
    
    if "https://" not in file_url:
        raise HTTPException(status_code=500, detail=f"File upload failed: {file_url}")

    file_metadata = {
        "filename": file.filename,
        "owner_id": str(current_user["_id"]),
        "s3_url": file_url,
        "shared_with": [],
        "created_at": datetime.utcnow(),
    }

    result = await db.files.insert_one(file_metadata)
    return {"message": "File uploaded successfully", "file_id": str(result.inserted_id), "file_url": file_url}


@router.get("/download/{file_id}")
async def download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Generate a pre-signed URL for downloading a file"""
    file = await db.files.find_one({"_id": ObjectId(file_id), "owner_id": str(current_user["_id"])})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    file_url = await generate_presigned_url(file["s3_url"].split("/")[-1])
    if not file_url:
        raise HTTPException(status_code=500, detail="Failed to generate download link")

    return {"download_url": file_url}


@router.delete("/delete/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a file from S3 and database"""
    file = await db.files.find_one({"_id": ObjectId(file_id), "owner_id": str(current_user["_id"])})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    file_key = file["s3_url"].split("/")[-1]
    delete_status = await delete_file_from_s3(file_key)

    if delete_status is not True:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {delete_status}")

    await db.files.delete_one({"_id": ObjectId(file_id)})
    
    return {"message": "File deleted successfully"}


@router.post("/share/{file_id}")
async def share_file(file_id: str, request: ShareRequest, current_user: dict = Depends(get_current_user)):
    """Share a file with another user by email"""
    file = await db.files.find_one({"_id": ObjectId(file_id), "owner_id": str(current_user["_id"])})

    if not file:
        raise HTTPException(status_code=404, detail="File not found or unauthorized")

    # Check if the user exists
    user_to_share_with = await db.users.find_one({"email": request.shared_with_email})
    if not user_to_share_with:
        raise HTTPException(status_code=404, detail="User not found")

    # Update the file's shared_with list
    if request.shared_with_email not in file["shared_with"]:
        await db.files.update_one({"_id": ObjectId(file_id)}, {"$push": {"shared_with": request.shared_with_email}})
    
    return {"message": f"File shared with {request.shared_with_email}"}


@router.get("/shared-files", response_model=List[FileMetadata])
async def get_shared_files(current_user: dict = Depends(get_current_user)):
    """Get all files shared with the authenticated user"""
    files = await db.files.find({"shared_with": current_user["email"]}).to_list(100)
    
    if not files:
        raise HTTPException(status_code=404, detail="No shared files found")
    
    return [FileMetadata(id=str(file["_id"]), **file) for file in files]



@router.post("/public-link/{file_id}")
async def generate_public_link(file_id: str, expiry_minutes: int = 60, current_user: dict = Depends(get_current_user)):
    """
    Generate a temporary public link for sharing with an expiration time.
    """
    file = await db.files.find_one({"_id": ObjectId(file_id), "owner_id": str(current_user["_id"])})

    if not file:
        raise HTTPException(status_code=404, detail="File not found or unauthorized")

    expiration_time = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

    # Store the expiration time in the database
    await db.files.update_one({"_id": ObjectId(file_id)}, {"$set": {"expires_at": expiration_time}})

    public_url = await generate_presigned_url(file["s3_url"].split("/")[-1], expiry_minutes * 60)
    
    if not public_url:
        raise HTTPException(status_code=500, detail="Failed to generate public link")

    return {"public_url": public_url, "expires_at": expiration_time}


async def remove_expired_links():
    """Remove expired public links periodically."""
    while True:
        now = datetime.now(timezone.utc)
        await db.files.update_many({"expires_at": {"$lt": now}}, {"$unset": {"expires_at": ""}})
        await asyncio.sleep(600)  # Run every 10 minutes


@router.delete("/shared-files/{file_id}")
async def remove_shared_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a shared file from the user's list"""
    file = await db.files.find_one({"_id": ObjectId(file_id), "shared_with": current_user["email"]})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove user from shared_with list
    await db.files.update_one(
        {"_id": ObjectId(file_id)},
        {"$pull": {"shared_with": current_user["email"]}}
    )

    return {"message": "File removed from shared list"}


@router.post("/files/{file_id}/star")
async def toggle_star(file_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle the 'starred' status of a file."""
    file = await db.files.find_one({"_id": ObjectId(file_id), "owner_id": str(current_user["_id"])})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    new_star_status = not file.get("starred", False)

    await db.files.update_one({"_id": ObjectId(file_id)}, {"$set": {"starred": new_star_status}})

    return {"message": f"File {'starred' if new_star_status else 'unstarred'} successfully"}

# Start the background task
loop = asyncio.get_event_loop()
loop.create_task(remove_expired_links())