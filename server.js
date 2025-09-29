const express = require('express');
const cors = require('cors');
const path = require('path');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();

// CORS: Vercel frontend domain’i için izin ver
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: FRONTEND_URL }));

// Backblaze B2 S3 Client
const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,        // Örn: https://s3.us-east-005.backblazeb2.com
  region: process.env.B2_REGION || 'us-east-005',
  forcePathStyle: true,
  bucketEndpoint: false,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

const BUCKET = process.env.B2_BUCKET;

// Statik dosyalar (opsiyonel, Fly.io’da gerekebilir)
app.use(express.static(path.join(__dirname, 'public')));

// Signed URL endpoint
app.get('/get-signed-url/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const key = `${gameId}.zip`;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 dk

    res.json({ signedUrl });
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) {
      console.log(`Dosya bulunamadı: ${key}`);
      return res.json({ signedUrl: null });
    }
    console.error('Signed URL oluşturulurken hata:', err);
    res.status(500).json({ signedUrl: null });
  }
});

// Download proxy
app.get('/download/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const key = `${gameId}.zip`;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    res.redirect(signedUrl);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.status(404).send('Dosya bulunamadı');
    console.error('Download sırasında hata:', err);
    res.status(500).send('Beklenmedik bir hata oluştu');
  }
});

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucu başlat
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend çalışıyor: http://localhost:${port}`));
