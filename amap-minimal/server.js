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
    const subPath = req.path.slice(stripPrefix.length) || '';
    const targetUrl = targetBase + subPath;
    const url = new URL(targetUrl);
    for (const [k, v] of Object.entries(req.query)) {
      url.searchParams.set(k, v);
    }
    for (const [k, v] of Object.entries(extraParams)) {
      if (!url.searchParams.has(k)) {
        url.searchParams.set(k, v);
      }
    }

    console.log('[Proxy]', req.method, req.path, '->', url.toString());

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

app.all('/_AMapService/v4/map/styles*', (req, res) => {
  proxyRequest(req, res, 'https://webapi.amap.com/v4/map/styles', '/_AMapService/v4/map/styles', { jscode: AMAP_SECURITY_KEY });
});

app.all('/_AMapService/*', (req, res) => {
  proxyRequest(req, res, 'https://restapi.amap.com', '/_AMapService', { jscode: AMAP_SECURITY_KEY });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
