import motor.motor_asyncio
import os
from dotenv import load_dotenv
from logging import Logger
import boto3

logger = Logger(__name__)

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = "online-filesharing"

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client[DATABASE_NAME]
logger.info("DB intialized",db)



AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION")

# Initialize S3 client
s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)