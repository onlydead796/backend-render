const express = require('express');
const cors = require('cors');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();

// Frontend URL (Vercel/Netlify deploy için)
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
  const gameId = req.params.gameId;
  if (!/^\d+$/.test(gameId)) return res.status(400).json({ signedUrl: null });

  const key = `${gameId}.zip`;

  try {
    // Dosya var mı kontrol et
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

    // Signed URL oluştur
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 dk

    // CORS header ekle
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.json({ signedUrl });
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.json({ signedUrl: null });
    console.error('Signed URL Hatası:', err);
    res.status(500).json({ signedUrl: null });
  }
});

// Opsiyonel: download proxy (isteğe bağlı)
app.get('/download/:gameId', async (req, res) => {
  const gameId = req.params.gameId;
  if (!/^\d+$/.test(gameId)) return res.status(400).send('Geçersiz gameId');

  const key = `${gameId}.zip`;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Redirect ile download
    res.redirect(signedUrl);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.status(404).send('Dosya bulunamadı');
    console.error('Download Hatası:', err);
    res.status(500).send('Beklenmedik hata');
  }
});

// Sunucu başlat
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend çalışıyor: http://localhost:${port}`));
