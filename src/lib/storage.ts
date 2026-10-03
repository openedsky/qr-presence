import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function localDir() {
  return process.env.STORAGE_LOCAL_DIR || join(/*turbopackIgnore: true*/ process.cwd(), "storage");
}

function isS3() {
  return (process.env.STORAGE_DRIVER || "local") === "s3";
}

let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
  });
  return client;
}

function ensureBucket() {
  const Bucket = process.env.S3_BUCKET as string;
  bucketReady ??= s3()
    .send(new HeadBucketCommand({ Bucket }))
    .then(() => undefined)
    .catch(async () => {
      await s3().send(new CreateBucketCommand({ Bucket }));
    })
    .catch((error) => {
      bucketReady = null;
      throw error;
    });
  return bucketReady;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (isS3() && process.env.S3_BUCKET) {
    await ensureBucket();
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  const dest = join(/*turbopackIgnore: true*/ localDir(), key);
  await mkdir(/*turbopackIgnore: true*/ dirname(dest), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ dest, body);
  return key;
}

export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  if (isS3() && process.env.S3_BUCKET) {
    try {
      const res = await s3().send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
        }),
      );
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (error) {
      // Objet absent (purgé, perdu) : même comportement que le stockage local, pas une erreur 500.
      const name = (error as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw error;
    }
  }
  const dest = join(/*turbopackIgnore: true*/ localDir(), key);
  try {
    return await readFile(/*turbopackIgnore: true*/ dest);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteObject(key: string) {
  if (isS3() && process.env.S3_BUCKET) {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return;
  }
  const dest = join(/*turbopackIgnore: true*/ localDir(), key);
  await rm(/*turbopackIgnore: true*/ dest, { force: true });
}

export async function getSignedObjectUrl(key: string, expiresIn = 300) {
  if (isS3() && process.env.S3_BUCKET) {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      { expiresIn },
    );
  }
  return `/api/files/${encodeURIComponent(key)}`;
}

export function meetingObjectKey(
  meetingUuid: string,
  kind: "signatures" | "exports" | "qr",
  filename: string,
) {
  const year = new Date().getFullYear();
  return `meetings/${year}/${meetingUuid}/${kind}/${filename}`;
}
