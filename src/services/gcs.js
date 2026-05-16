const { Storage } = require("@google-cloud/storage");
const path = require("path");
const crypto = require("crypto");

const buildStorage = () => {
  if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
    return new Storage({
      projectId: process.env.GCP_PROJECT_ID || credentials.project_id,
      credentials,
    });
  }

  return new Storage({
    projectId: process.env.GCP_PROJECT_ID,
  });
};

const getBucket = () => {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not set");
  }
  return buildStorage().bucket(bucketName);
};

const uploadImageBuffer = async ({ buffer, originalName, contentType }) => {
  const bucket = getBucket();
  const ext = path.extname(originalName) || ".jpg";
  const fileName = `artworks/${crypto.randomUUID()}${ext}`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  const gsUri = `gs://${bucket.name}/${fileName}`;

  return { publicUrl, gsUri, fileName };
};

module.exports = { uploadImageBuffer };
