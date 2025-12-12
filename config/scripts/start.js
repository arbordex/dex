#!/usr/bin/env node

/**
 * Smart start script that adapts based on NODE_ENV
 * - Development (default): Run from source with hot reloading
 * - Staging/Production: Run compiled code
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const distPath = path.join(projectRoot, 'dist', 'src', 'index.js');
const env = process.env.NODE_ENV?.toLowerCase() || 'development';

const isDev = env === 'development';
const isStaging = env === 'staging';
const isProd = env === 'production';

let command;
let args;

if (isDev) {
  // Development: run with hot reloading using tsx watch
  console.log('🚀 Starting in DEVELOPMENT mode (with hot reloading)...\n');
  command = 'tsx';
  // tsx accepts --tsconfig (not --project). tsconfig now lives at repo root.
  args = ['watch', '--tsconfig', path.join(projectRoot, 'tsconfig.json'), 'src/index.ts'];
} else if (isStaging || isProd) {
  // Staging/Production: run compiled code
  if (!existsSync(distPath)) {
    console.error('❌ Build not found. Run `npm run build` first.');
    process.exit(1);
  }

  const envLabel = isStaging ? 'STAGING' : 'PRODUCTION';
  console.log(`🚀 Starting in ${envLabel} mode (compiled code)...\n`);
  command = 'node';
  args = [distPath];
} else {
  console.error(`❌ Invalid NODE_ENV: ${env}`);
  console.error('   Valid options: development, staging, production');
  process.exit(1);
}

// Spawn the process
const child = spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
});

// Handle exit
child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle errors
child.on('error', (err) => {
  console.error(`❌ Failed to start: ${err.message}`);
  process.exit(1);
});
