#!/usr/bin/env node
// Prepare a static bundle for React Onchain upload.
// For Chronicle (Next.js), we expect `next build && next export -o out` first,
// then run this script with SRC_DIR=out (default).

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

// ===== Config =====
const SRC_DIR = process.env.SRC_DIR || 'out';          // static export output
const DEST_DIR = process.env.DEST_DIR || 'onchain-dist';

const INCLUDE_EXT = new Set([
  '.html','.js','.css','.map',
  '.svg','.png','.jpg','.jpeg','.webp',
  '.woff','.woff2','.ttf','.json','.ico'
]);

// Exclude obvious SSR/dev artifacts just in case
const EXCLUDE_SUBSTR = [
  `${path.sep}server${path.sep}`,
  `${path.sep}dev${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}api${path.sep}`,
];

const BROTLI_OPTS = {
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
};
// ==================

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function normalizeRel(p) {
  return p.split(path.sep).join('/');
}

function mimeFor(p) {
  const ext = path.extname(p).toLowerCase();
  const m = {
    '.html':'text/html','.js':'application/javascript','.css':'text/css',
    '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
    '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json','.ico':'image/x-icon',
    '.map':'application/json',
  };
  return m[ext] || 'application/octet-stream';
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...await walk(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

async function main() {
  try {
    // Ensure source exists
    await fs.access(SRC_DIR).catch(() => {
      console.error(`Source directory "${SRC_DIR}" does not exist.\n` +
        'Run `next build && npx next export -o out` first, or set SRC_DIR appropriately.');
      process.exit(1);
    });

    // Clean and create destination
    await fs.rm(DEST_DIR, { recursive: true, force: true });
    await ensureDir(DEST_DIR);

    const allFiles = await walk(SRC_DIR);

    const manifest = { version: 1, generatedAt: new Date().toISOString(), files: [] };
    let totalRaw = 0;
    let totalBr = 0;

    for (const abs of allFiles) {
      const rel = path.relative(SRC_DIR, abs);
      const relNorm = normalizeRel(rel);
      const ext = path.extname(relNorm).toLowerCase();

      // Extension filter
      if (!INCLUDE_EXT.has(ext)) continue;

      // Exclude paths containing server/dev/.next/api segments
      const withSep = path.sep + rel + path.sep;
      if (EXCLUDE_SUBSTR.some(sub => withSep.includes(sub))) continue;

      const src = abs;
      const dst = path.join(DEST_DIR, rel);
      await ensureDir(path.dirname(dst));

      const raw = await fs.readFile(src);
      const br = await new Promise((res, rej) =>
        zlib.brotliCompress(raw, BROTLI_OPTS, (e, out) => e ? rej(e) : res(out))
      );

      // Write BOTH raw and .br so a loader/SW can choose
      await fs.writeFile(dst, raw);
      await fs.writeFile(dst + '.br', br);

      totalRaw += raw.length;
      totalBr += br.length;

      manifest.files.push({
        path: relNorm,
        mime: mimeFor(relNorm),
        size_raw: raw.length,
        size_br: br.length,
        sha256_raw: sha256(raw),
        sha256_br: sha256(br),
      });
    }

    manifest.totals = { bytes_raw: totalRaw, bytes_br: totalBr };

    await fs.writeFile(
      path.join(DEST_DIR, 'onchain-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    const hasIndex = manifest.files.some(
      (f) => f.path === 'index.html' || f.path.endsWith('/index.html'),
    );
    if (!hasIndex) {
      console.warn('WARNING: No index.html found in source. React Onchain needs an entrypoint.');
    }

    console.log(`Prepared ${manifest.files.length} files → ${DEST_DIR}`);
    console.log(`Totals: raw ${(totalRaw/1e6).toFixed(2)} MB, br ${(totalBr/1e6).toFixed(2)} MB`);
  } catch (err) {
    console.error('Error during onchain-prep:', err);
    process.exit(1);
  }
}

main();
