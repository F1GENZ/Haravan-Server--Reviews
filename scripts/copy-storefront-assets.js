const { cpSync, existsSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');

const serverRoot = resolve(__dirname, '..');
const sourceDir = resolve(serverRoot, 'storefront', 'snippets');
const targetDir = join(serverRoot, 'dist', 'storefront', 'snippets');

if (!existsSync(sourceDir)) {
  console.error(`Storefront snippets source not found: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Copied storefront snippets to ${targetDir}`);
