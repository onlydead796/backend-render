const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();

// FRONTEND_URL environment variable, yoksa tüm originlere izin ver
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// CORS ayarı
const corsOptions = FRONTEND_URL === '*'
  ? {}
  : { origin: FRONTEND_URL };

app.use(cors(corsOptions));

// Backblaze B2 S3 client ayarı
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

// GitHub Token
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

// GitHub'dan dosya çekme fonksiyonu
async function fetchFromGitHub(path) {
  if (!GITHUB_TOKEN) throw new Error('GitHub token bulunamadı');
  const url = `https://api.github.com/repos/onlydead796/online-fix-game-name/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw',
      'User-Agent': 'Your-App-Name'
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// /github-file endpoint
app.get('/github-file', async (req, res) => {
  try {
    // 1. GitHub'dan JSON dosyasını çek
    const data = await fetchFromGitHub('online-fix.json');
    const jsonData = JSON.parse(data);

    // 2. Bu JSON'u yeni sunucuya POST ile gönder
    const response = await fetch('https://steam-manifesthub-revolution.vercel.app/api/github-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData)
    });

    // 3. Oradan dönen cevabı frontend'e ilet
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('GitHub veya yeni sunucuya gönderim hatası:', error);
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

// /get-signed-url/:gameId endpoint
app.get('/get-signed-url/:gameId', async (req, res) => {
  const gameId = req.params.gameId;
  if (!/^\d+$/.test(gameId)) return res.status(400).json({ signedUrl: null });

  const key = `${gameId}.zip`;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 dk

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

// /download/:gameId endpoint (opsiyonel)
app.get('/download/:gameId', async (req, res) => {
  const gameId = req.params.gameId;
  if (!/^\d+$/.test(gameId)) return res.status(400).send('Geçersiz gameId');

  const key = `${gameId}.zip`;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    res.redirect(signedUrl);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.status(404).send('Dosya bulunamadı');
    console.error('Download Hatası:', err);
    res.status(500).send('Beklenmedik hata');
  }
});

// Sunucu başlat
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend çalışıyor: http://localhost:${port}`);
});
