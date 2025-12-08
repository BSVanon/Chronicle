#!/usr/bin/env node
// Zip the onchain-dist folder for React Onchain upload.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const DEST_DIR = process.env.DEST_DIR || 'onchain-dist';
const ZIP = process.env.ZIP || 'onchain-upload.zip';

if (!fs.existsSync(DEST_DIR)) {
  console.error(`Directory "${DEST_DIR}" does not exist. Run onchain-prep first.`);
  process.exit(1);
}

try {
  // Prefer system zip for speed; fallback message if missing
  execSync(`zip -rq ${ZIP} ${DEST_DIR}`, { stdio: 'inherit' });
  console.log(`Wrote ${ZIP}`);
} catch (err) {
  console.error("Failed to run 'zip' CLI. Install it or switch to an npm zip library.");
  console.error(err.message);
  process.exit(1);
}
