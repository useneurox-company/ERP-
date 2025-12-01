import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Only initialize storage client if running on Replit
export const objectStorageClient = process.env.REPL_ID ? new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
}) : null as any;

if (!objectStorageClient) {
  console.warn("⚠️  WARNING: Object storage is disabled (not running on Replit)");
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(fileName: string): Promise<File | null> {
    const paths = this.getPublicObjectSearchPaths();
    for (const path of paths) {
      const [bucketName, ...prefixParts] = path.split("/").filter(Boolean);
      const prefix = prefixParts.join("/");
      const fullPath = prefix ? `${prefix}/${fileName}` : fileName;
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(fullPath);
      
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }

  async downloadObject(file: File, res: Response): Promise<void> {
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/octet-stream";
    
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${file.name.split("/").pop()}"`);
    
    file.createReadStream()
      .on("error", (err) => {
        console.error("Error streaming file:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error downloading file" });
        }
      })
      .pipe(res);
  }

  normalizeObjectEntityPath(objectPathOrURL: string): string {
    let objectPath = objectPathOrURL;
    if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) {
      const url = new URL(objectPath);
      objectPath = url.pathname;
    }
    
    if (!objectPath.startsWith("/objects/")) {
      throw new Error(`Invalid object path: ${objectPath}`);
    }
    
    return objectPath;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    const normalizedPath = this.normalizeObjectEntityPath(objectPath);
    const privateDir = this.getPrivateObjectDir();
    
    const objectRelativePath = normalizedPath.replace("/objects/", "");
    const fullPath = `${privateDir}/${objectRelativePath}`.replace(/\/+/g, "/");
    
    const [bucketName, ...pathParts] = fullPath.split("/").filter(Boolean);
    const filePath = pathParts.join("/");
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    return file;
  }

  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; objectPath: string }> {
    const privateDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateDir}/${objectId}`.replace(/\/+/g, "/");
    
    const [bucketName, ...pathParts] = fullPath.split("/").filter(Boolean);
    const filePath = pathParts.join("/");
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(filePath);
    
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: "application/octet-stream",
    });
    
    // Return both signed URL for upload and canonical path for storage
    return {
      uploadURL: signedUrl,
      objectPath: `/objects/${objectId}`
    };
  }

  async trySetObjectEntityAclPolicy(
    objectPathOrURL: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const objectPath = this.normalizeObjectEntityPath(objectPathOrURL);
    const objectFile = await this.getObjectEntityFile(objectPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return objectPath;
  }

  async canAccessObjectEntity({
    objectFile,
    userId,
    requestedPermission,
  }: {
    objectFile: File;
    userId?: string;
    requestedPermission: ObjectPermission;
  }): Promise<boolean> {
    return await canAccessObject({
      objectFile,
      userId,
      requestedPermission,
    });
  }
}
