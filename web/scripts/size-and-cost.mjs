#!/usr/bin/env node
// Size & On-Chain Cost Estimator
// Adapted for Chronicle (Next.js) — uses the `.next` build output directory.

import { readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { constants as zconst } from 'node:zlib';
import zlib from 'node:zlib';
import path from 'node:path';

// ===== Config (tweak as needed) =====
// Next.js build output lives in `.next` by default
const DIST_DIR = '.next';
const INCLUDE_EXT = ['.js','.css','.html','.svg','.png','.jpg','.jpeg','.webp','.woff','.woff2'];
const FEE_SAT_PER_BYTE = 0.1;        // default: 100 sat/KB = 0.1 sat/byte
const OVERHEAD_FACTOR = 1.05;        // 5% fudge for chunking/manifest/envelope
// ====================================

function brotliBuffer(buf) {
  return new Promise((resolve, reject) => {
    zlib.brotliCompress(
      buf,
      {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        },
      },
      (err, out) => (err ? reject(err) : resolve(out))
    );
  });
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
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

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024*1024) return `${(b/1024).toFixed(2)} KB`;
  return `${(b/1024/1024).toFixed(2)} MB`;
}

async function main() {
  const table = [];
  let totalRaw = 0, totalGz = 0, totalBr = 0;

  const files = (await walk(DIST_DIR)).filter(f => INCLUDE_EXT.includes(path.extname(f)));

  for (const f of files) {
    const st = await stat(f);
    const rawBytes = st.size;
    totalRaw += rawBytes;

    const buf = await readFile(f);

    // gzip
    const gzBuf = zlib.gzipSync(buf, { level: zconst.Z_BEST_COMPRESSION });
    const gzBytes = gzBuf.length;
    totalGz += gzBytes;

    // brotli
    const brBuf = await brotliBuffer(buf);
    const brBytes = brBuf.length;
    totalBr += brBytes;

    table.push({
      file: f.replace(`${DIST_DIR}/`, ''),
      rawBytes,
      gzBytes,
      brBytes,
    });
  }

  // choose compressed size to estimate on-chain upload (React Onchain streams compressed chunks)
  const chosenCompressed = Math.min(totalGz, totalBr);
  const estBytesOnChain = Math.ceil(chosenCompressed * OVERHEAD_FACTOR);
  const estSats = estBytesOnChain * FEE_SAT_PER_BYTE;
  const estBSV = estSats / 1e8;

  const report = {
    distDir: DIST_DIR,
    fee_sat_per_byte: FEE_SAT_PER_BYTE,
    overhead_factor: OVERHEAD_FACTOR,
    totals: {
      raw_bytes: totalRaw,
      gzip_bytes: totalGz,
      brotli_bytes: totalBr,
      chosen_compressed_bytes: chosenCompressed,
      estimated_onchain_bytes: estBytesOnChain,
    },
    cost: {
      sats: Math.round(estSats),
      bsv: estBSV,
    },
    files: table.sort((a,b) => b.rawBytes - a.rawBytes),
  };

  await writeFile('dist-size-report.json', JSON.stringify(report, null, 2), 'utf8');

  // pretty print
  console.log('\n=== Build Size & On-Chain Cost Estimate ===');
  console.table(report.files.map(r => ({
    file: r.file,
    raw: fmtBytes(r.rawBytes),
    gzip: fmtBytes(r.gzBytes),
    brotli: fmtBytes(r.brBytes),
  })));
  console.log('\nTotals:');
  console.log(`  Raw:        ${fmtBytes(totalRaw)}`);
  console.log(`  Gzip:       ${fmtBytes(totalGz)}`);
  console.log(`  Brotli:     ${fmtBytes(totalBr)}`);
  console.log(`  Using:      ${chosenCompressed === totalBr ? 'Brotli' : 'Gzip'} (smaller)`);
  console.log(`  Overhead:   ${(OVERHEAD_FACTOR*100-100).toFixed(1)}%`);
  console.log(`  Est bytes:  ${fmtBytes(estBytesOnChain)} on-chain`);
  console.log('\nFee model:');
  console.log(`  Fee:        ${FEE_SAT_PER_BYTE} sat/byte (== ${(FEE_SAT_PER_BYTE*1000).toFixed(0)} sat/KB)`);
  console.log(`  Est cost:   ${Math.round(estSats)} sats  (~${estBSV.toFixed(8)} BSV)`);
  console.log('\nWrote dist-size-report.json\n');
}

main().catch((err) => {
  console.error('Error computing size & cost:', err);
  process.exit(1);
});
