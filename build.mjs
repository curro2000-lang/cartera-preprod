import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const files = [
  'index.html',
  'app.js',
  'strategy.js',
  'styles.css',
  'intrinsic-data.js',
  'intrinsic-value.js'
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`);
}

await cp('.openai/hosting.json', 'dist/.openai/hosting.json');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const assets = {};
for (const file of files) {
  assets[`/${file}`] = {
    body: await readFile(file, 'utf8'),
    contentType: contentTypes[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream'
  };
}

const serverSource = `const assets = ${JSON.stringify(assets)};

function resolvePath(pathname) {
  if (pathname === '/' || pathname === '') return '/index.html';
  return assets[pathname] ? pathname : null;
}

async function fetch(request) {
  const url = new URL(request.url);
  const path = resolvePath(url.pathname);
  if (!path) return new Response('Not found', { status: 404 });

  const asset = assets[path];
  return new Response(asset.body, {
    headers: {
      'content-type': asset.contentType,
      'cache-control': 'no-store'
    }
  });
}

export { fetch };
export default { fetch };
`;

await writeFile('dist/server/index.js', serverSource);
