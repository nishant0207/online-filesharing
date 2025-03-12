import os
import uuid
from fastapi import UploadFile
from app.config import s3_client, AWS_S3_BUCKET_NAME
from logging import Logger
import boto3
from botocore.exceptions import NoCredentialsError

logger = Logger(__name__)

async def upload_file_to_s3(file: UploadFile):
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"

    try:
        s3_client.upload_fileobj(
            file.file,
            AWS_S3_BUCKET_NAME,
            unique_filename,
        )
        file_url = f"https://{AWS_S3_BUCKET_NAME}.s3.amazonaws.com/{unique_filename}"
        logger.info("Uploaded file to url: ",file_url)
        return file_url
    except Exception as e:
        return str(e)
    

async def generate_presigned_url(file_key: str, expiration_seconds: int = 3600):
    """Generate a pre-signed URL to download a file from S3 with expiration."""
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': AWS_S3_BUCKET_NAME, 'Key': file_key},
            ExpiresIn=expiration_seconds  # Set expiration time
        )
        return url
    except Exception as e:
        return None
    
async def delete_file_from_s3(file_key: str):
    """Delete a file from S3"""
    try:
        s3_client.delete_object(Bucket=AWS_S3_BUCKET_NAME, Key=file_key)
        return True
    except Exception as e:
        return str(e)