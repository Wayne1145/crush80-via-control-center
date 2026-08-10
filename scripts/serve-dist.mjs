#!/usr/bin/env node
/*
 * 仅服务已经构建好的 dist 目录。
 * WebHID 需要 localhost/127.0.0.1 的可信本地上下文，因此禁止 file:// 直开。
 */
import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.CRUSH80_PORT ?? 4178);
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`).pathname);
  const candidate = resolve(root, '.' + normalize(requested));
  const file = candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(root, 'index.html');
  response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Crush 80 控制中心： http://127.0.0.1:${port}`));
