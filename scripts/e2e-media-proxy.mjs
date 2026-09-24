import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';

// Test-only HTTP transport: WebKit's native media stack can bypass Playwright page.route.
// Everything except explicitly registered fault fixtures passes through to the real Nest API.
const fixtures = new Map();
const movie = await readFile('apps/web/public/media/product-demo.mp4');
createServer(async (req, res) => {
  const control = /^\/__test-media\/([a-f0-9-]+)$/.exec(req.url);
  if (control) {
    const id = control[1];
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { mode } = JSON.parse(body);
      if (!['missing', 'corrupt', 'timeout', 'ready'].includes(mode)) {
        res.writeHead(400).end();
        return;
      }
      const existing = fixtures.get(id);
      fixtures.set(id, { mode, reads: existing?.reads ?? 0 });
    } else if (req.method === 'DELETE') fixtures.delete(id);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(fixtures.get(id) ?? { reads: 0 }));
    return;
  }
  const match = /^\/artifacts\/fault-([a-f0-9-]+)\.mp4$/.exec(req.url);
  const fixture = match && fixtures.get(match[1]);
  if (fixture) {
    fixture.reads++;
    if (fixture.mode === 'timeout') return;
    if (fixture.mode === 'missing') {
      res.writeHead(404).end();
      return;
    }
    const bytes = fixture.mode === 'ready' ? movie : Buffer.from('broken');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    if (start > end) {
      res.writeHead(416).end();
      return;
    }
    if (range) {
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    res.end(bytes.subarray(start, end + 1));
    return;
  }
  const upstream = request(
    `http://localhost:4001${req.url}`,
    { method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}).listen(4000, 'localhost');
