const express = require('express');
const cors = require('cors');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const corsOptions = FRONTEND_URL === '*' ? {} : { origin: FRONTEND_URL };
app.use(cors(corsOptions));

// Basit yönlendirme endpoint'i
app.get('/redirect', (req, res) => {
  if (FRONTEND_URL === '*') {
    return res.status(400).send('Frontend URL tanımlı değil');
  }
  res.redirect(FRONTEND_URL);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend çalışıyor: http://localhost:${port}`);
});
