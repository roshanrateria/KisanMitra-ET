import http from 'http';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handler } from './index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const loadEnv = () => {
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) return;
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
};

loadEnv();

const PORT = Number(process.env.PORT || 3001);

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString('utf8');
    });

    req.on('end', async () => {
        const event = {
            httpMethod: req.method || 'GET',
            path: url.pathname,
            rawPath: url.pathname,
            queryStringParameters: Object.fromEntries(url.searchParams.entries()),
            headers: req.headers,
            body: body || undefined,
            isBase64Encoded: false,
            requestContext: {
                http: { method: req.method || 'GET', path: url.pathname },
            },
        };

        try {
            const result = await handler(event);
            res.statusCode = result?.statusCode || 200;
            if (result?.headers) {
                for (const [key, value] of Object.entries(result.headers)) {
                    if (value !== undefined) res.setHeader(key, String(value));
                }
            }
            res.end(result?.body || '');
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
                JSON.stringify({
                    error: 'Local server error',
                    message: err instanceof Error ? err.message : 'Unknown error',
                })
            );
        }
    });
});

server.listen(PORT, () => {
    console.log(`Local API server running at http://localhost:${PORT}`);
});
