require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const AMAP_KEY = process.env.AMAP_KEY;
const AMAP_SECURITY_KEY = process.env.AMAP_SECURITY_KEY;

if (!AMAP_KEY || !AMAP_SECURITY_KEY) {
  console.error('Error: AMAP_KEY and AMAP_SECURITY_KEY must be set in .env');
  process.exit(1);
}

app.use(express.static(path.join(__dirname, 'public')));

async function proxyRequest(req, res, targetBase, stripPrefix, extraParams) {
  try {
    const subPath = req.path.slice(stripPrefix.length) || '/';
    const url = new URL(subPath, targetBase);
    for (const [k, v] of Object.entries(req.query)) {
      url.searchParams.set(k, v);
    }
    for (const [k, v] of Object.entries(extraParams)) {
      if (!url.searchParams.has(k)) {
        url.searchParams.set(k, v);
      }
    }

    const upstream = await fetch(url.toString(), {
      headers: {
        'User-Agent': req.get('user-agent') || '',
        'Referer': req.get('referer') || '',
      },
    });

    const contentType = upstream.headers.get('content-type') || '';
    res.set('Content-Type', contentType);
    res.status(upstream.status);
    const body = await upstream.text();
    res.send(body);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).send('Bad Gateway');
  }
}

app.all('/_AMapService/v4/map/styles', (req, res) => {
  proxyRequest(req, res, 'https://webapi.amap.com', '/v4/map/styles', { jscode: AMAP_SECURITY_KEY });
});

app.all('/amap/v3/', (req, res) => {
  proxyRequest(req, res, 'https://webapi.amap.com', '/v3/', { key: AMAP_KEY, jscode: AMAP_SECURITY_KEY });
});

app.all('/amap/', (req, res) => {
  proxyRequest(req, res, 'https://webapi.amap.com', '/', { key: AMAP_KEY });
});

app.all('/_AMapService/*', (req, res) => {
  proxyRequest(req, res, 'https://restapi.amap.com', '/', { jscode: AMAP_SECURITY_KEY });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
