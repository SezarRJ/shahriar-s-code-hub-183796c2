/**
 * SHAHID Storage Service
 * Handles S3/MinIO uploads, downloads, and SHA-256 verification.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { Readable } from 'stream';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

const upload = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET || 'shahid-photos';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'storage-service' });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const key = req.body.key || `${Date.now()}-${req.file.originalname}`;
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        'sha256': hash,
        'uploaded-at': new Date().toISOString(),
      },
    }));

    res.status(200).json({
      key,
      bucket: BUCKET,
      hash_sha256: hash,
      size: req.file.size,
    });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/verify/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { data: expectedHash } = req.query;

    // 1. Get stored hash from metadata for comparison
    const head = await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    const storedHash = head.Metadata?.['sha256'] || '';

    // 2. Perform actual cryptographic verification by re-hashing the file
    const obj = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));

    if (!(obj.Body instanceof Readable)) {
      throw new Error('Unexpected object body type');
    }

    const hash = crypto.createHash('sha256');
    for await (const chunk of obj.Body) {
      hash.update(chunk);
    }
    const computedHash = hash.digest('hex');

    const isIntegrityIntact = computedHash === storedHash;

    res.status(200).json({
      key,
      stored_hash: storedHash,
      computed_hash: computedHash,
      integrity_intact: isIntegrityIntact,
      verified: expectedHash ? computedHash === expectedHash : null,
      last_modified: head.LastModified,
    });
  } catch (err) {
    console.error('Verify error', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/download/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const obj = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));

    if (obj.Body instanceof Readable) {
      res.setHeader('Content-Type', obj.ContentType || 'application/octet-stream');
      obj.Body.pipe(res);
    } else {
      res.status(500).json({ error: 'Unexpected body type' });
    }
  } catch (err) {
    console.error('Download error', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Storage Service running on port ${PORT}`);
});
