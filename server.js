const express = require('express');
const cors = require('cors');
const path = require('path');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();

// Frontend Vercel URL
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: FRONTEND_URL }));

// Backblaze B2 Client
const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'us-east-005',
  forcePathStyle: true,
  bucketEndpoint: false,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

const BUCKET = process.env.B2_BUCKET;

// Signed URL endpoint
app.get('/get-signed-url/:gameId', async (req, res) => {
  const key = `${req.params.gameId}.zip`;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    res.json({ signedUrl });
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.json({ signedUrl: null });
    console.error(err);
    res.status(500).json({ signedUrl: null });
  }
});

// Download proxy (isteğe bağlı)
app.get('/download/:gameId', async (req, res) => {
  const key = `${req.params.gameId}.zip`;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    res.redirect(signedUrl);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.status(404).send('Dosya bulunamadı');
    console.error(err);
    res.status(500).send('Beklenmedik hata');
  }
});

// Sunucu başlat
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend çalışıyor: http://localhost:${port}`));
