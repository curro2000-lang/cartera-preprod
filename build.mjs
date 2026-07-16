import { cp, mkdir, rm } from 'node:fs/promises';

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

for (const file of files) {
  await cp(file, `dist/${file}`);
}
