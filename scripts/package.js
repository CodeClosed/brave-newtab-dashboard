#!/usr/bin/env node
// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// CRC32 table for pure-JS zip generation
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Creates a standard PKZIP buffer from a list of relative files and their contents.
 * Pure Node.js, zero dependencies, cross-platform.
 *
 * @param {Array<{ path: string, data: Buffer, mtime?: Date }>} files
 * @returns {Buffer}
 */
export function createZipBuffer(files) {
  const localChunks = [];
  const cdEntries = [];
  let offset = 0;

  for (const file of files) {
    const rawData = file.data;
    const deflated = zlib.deflateRawSync(rawData, { level: 9 });
    const useCompressed = deflated.length < rawData.length;
    const compMethod = useCompressed ? 8 : 0; // 8 = Deflate, 0 = Stored
    const fileBytes = useCompressed ? deflated : rawData;
    const crc = crc32(rawData);

    const nameBuf = Buffer.from(file.path.replace(/\\/g, '/'), 'utf8');
    const mtime = file.mtime || new Date();
    const dosTime = ((mtime.getHours() << 11) | (mtime.getMinutes() << 5) | (mtime.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((mtime.getFullYear() - 1980) << 9) | ((mtime.getMonth() + 1) << 5) | mtime.getDate()) & 0xFFFF;

    // Local Header (30 bytes + nameBuf.length)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4);         // version needed (2.0)
    lh.writeUInt16LE(0, 6);          // general purpose flags
    lh.writeUInt16LE(compMethod, 8);  // compression method
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(fileBytes.length, 18); // compressed size
    lh.writeUInt32LE(rawData.length, 22);   // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);                // extra field length

    localChunks.push(lh, nameBuf, fileBytes);

    // Central Directory Entry (46 bytes + nameBuf.length)
    const cde = Buffer.alloc(46);
    cde.writeUInt32LE(0x02014b50, 0); // signature
    cde.writeUInt16LE(20, 4);         // version made by (DOS / OS/2)
    cde.writeUInt16LE(20, 6);         // version needed
    cde.writeUInt16LE(0, 8);          // flags
    cde.writeUInt16LE(compMethod, 10);
    cde.writeUInt16LE(dosTime, 12);
    cde.writeUInt16LE(dosDate, 14);
    cde.writeUInt32LE(crc, 16);
    cde.writeUInt32LE(fileBytes.length, 20);
    cde.writeUInt32LE(rawData.length, 24);
    cde.writeUInt16LE(nameBuf.length, 28);
    cde.writeUInt16LE(0, 30);         // extra field len
    cde.writeUInt16LE(0, 32);         // file comment len
    cde.writeUInt16LE(0, 34);         // disk number start
    cde.writeUInt16LE(0, 36);         // internal attrs
    cde.writeUInt32LE(0, 38);         // external attrs
    cde.writeUInt32LE(offset, 42);    // relative offset of local header

    cdEntries.push(cde, nameBuf);
    offset += 30 + nameBuf.length + fileBytes.length;
  }

  const cdStartOffset = offset;
  let cdSize = 0;
  for (const chunk of cdEntries) {
    cdSize += chunk.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // disk where cd starts
  eocd.writeUInt16LE(files.length, 8);  // entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12);       // cd size
  eocd.writeUInt32LE(cdStartOffset, 16);// offset of cd
  eocd.writeUInt16LE(0, 20);            // comment length

  return Buffer.concat([...localChunks, ...cdEntries, eocd]);
}

/**
 * Validates extension files, manifest, and dependencies.
 * @returns {{ valid: boolean, manifest: any, errors: string[], warnings: string[] }}
 */
export function auditExtension() {
  const errors = [];
  const warnings = [];

  const manifestPath = path.join(EXTENSION_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, manifest: null, errors: ['manifest.json not found in extension directory.'], warnings: [] };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return { valid: false, manifest: null, errors: [`Failed to parse manifest.json: ${err.message}`], warnings: [] };
  }

  // 1. Manifest version
  if (manifest.manifest_version !== 3) {
    errors.push(`Manifest version must be 3, found ${manifest.manifest_version}`);
  }

  // 2. Version syntax
  if (!manifest.version || !/^\d+(\.\d+){1,3}$/.test(manifest.version)) {
    errors.push(`Manifest version must follow Chrome version regex format (1 to 4 dot-separated integers), found "${manifest.version}"`);
  }

  // 3. Name & Description
  if (!manifest.name || manifest.name.trim().length === 0) {
    errors.push('Manifest "name" is missing or empty.');
  }
  if (!manifest.description || manifest.description.trim().length === 0) {
    errors.push('Manifest "description" is missing or empty.');
  }

  // 4. Icons verification
  if (manifest.icons && typeof manifest.icons === 'object') {
    for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
      const fullPath = path.join(EXTENSION_DIR, iconRelPath);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Icon size ${size} referenced at "${iconRelPath}" does not exist.`);
      } else {
        const stats = fs.statSync(fullPath);
        if (stats.size === 0) {
          errors.push(`Icon size ${size} at "${iconRelPath}" is empty (0 bytes).`);
        }
      }
    }
  } else {
    warnings.push('Manifest is missing "icons" field.');
  }

  // 5. Default locale & messages
  if (manifest.default_locale) {
    const localeDir = path.join(EXTENSION_DIR, '_locales', manifest.default_locale, 'messages.json');
    if (!fs.existsSync(localeDir)) {
      errors.push(`Default locale catalog missing: expected "${localeDir}"`);
    }
  }

  // 6. CSP verification
  const csp = manifest.content_security_policy?.extension_pages || '';
  if (csp) {
    if (csp.includes("'unsafe-eval'")) {
      errors.push('CSP violation: "unsafe-eval" is forbidden in Manifest V3.');
    }
  }

  // 7. newtab.html asset verification
  const newtabPath = path.join(EXTENSION_DIR, 'newtab.html');
  if (!fs.existsSync(newtabPath)) {
    errors.push('newtab.html does not exist in extension directory.');
  } else {
    const html = fs.readFileSync(newtabPath, 'utf8');
    const scriptMatches = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"/gi)];
    for (const match of scriptMatches) {
      const scriptSrc = match[1];
      if (!scriptSrc.startsWith('http://') && !scriptSrc.startsWith('https://')) {
        const fullScript = path.join(EXTENSION_DIR, scriptSrc);
        if (!fs.existsSync(fullScript)) {
          errors.push(`Script referenced in newtab.html not found on disk: "${scriptSrc}"`);
        }
      }
    }
    const linkMatches = [...html.matchAll(/<link\s+[^>]*href="([^"]+)"/gi)];
    for (const match of linkMatches) {
      const href = match[1];
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        const fullHref = path.join(EXTENSION_DIR, href);
        if (!fs.existsSync(fullHref)) {
          errors.push(`Stylesheet referenced in newtab.html not found on disk: "${href}"`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    manifest,
    errors,
    warnings
  };
}

/**
 * Collects all extension files recursively, excluding temp & OS files.
 * @param {string} dir
 * @param {string} baseDir
 * @returns {Array<{ path: string, data: Buffer, mtime: Date, size: number }>}
 */
export function collectExtensionFiles(dir = EXTENSION_DIR, baseDir = EXTENSION_DIR) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    // Skip OS/temporary artifacts
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name.endsWith('.tmp') || entry.name.endsWith('.bak')) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...collectExtensionFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const data = fs.readFileSync(fullPath);
      const stat = fs.statSync(fullPath);
      results.push({
        path: relPath,
        data,
        mtime: stat.mtime,
        size: stat.size
      });
    }
  }

  return results;
}

/**
 * Main packaging routine.
 */
export function runPackage(options = {}) {
  const { auditOnly = false, skipTests = false } = options;

  console.log('\n======================================================');
  console.log('   New Tab Dashboard — Release & Packaging Pipeline   ');
  console.log('======================================================\n');

  // Step 1: Audit
  console.log('🔍 Auditing extension structure and manifest...');
  const audit = auditExtension();
  if (!audit.valid) {
    console.error('\n❌ Audit FAILED with the following errors:');
    for (const err of audit.errors) {
      console.error(`   - ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ Manifest valid: ${audit.manifest.name} v${audit.manifest.version}`);
  if (audit.warnings.length > 0) {
    for (const w of audit.warnings) {
      console.warn(`   ⚠️  ${w}`);
    }
  }

  // Step 2: Automated Tests
  if (!skipTests) {
    console.log('\n🧪 Running unit test suite...');
    const testResult = spawnSync(process.execPath, ['--test', 'tests/'], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    if (testResult.status !== 0) {
      console.error('\n❌ Test suite failed. Packaging aborted.');
      process.exit(testResult.status || 1);
    }
    console.log('✅ Full test suite passed cleanly.');
  } else {
    console.log('\n⚠️  Skipping test suite (--skip-tests active).');
  }

  // Step 3: Collect files
  const files = collectExtensionFiles();
  let totalRawBytes = 0;
  for (const f of files) {
    totalRawBytes += f.size;
  }
  console.log(`\n📦 Discovered ${files.length} production files (${(totalRawBytes / 1024).toFixed(1)} KB uncompressed)`);

  if (auditOnly) {
    console.log('\n✨ Audit-only mode complete. Ready for release.');
    return;
  }

  // Step 4: Build zip
  console.log('\n🗜️  Building release package...');
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const zipBuffer = createZipBuffer(files);
  const outFilename = `new-tab-dashboard-v${audit.manifest.version}.zip`;
  const outPath = path.join(DIST_DIR, outFilename);

  fs.writeFileSync(outPath, zipBuffer);

  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const ratio = ((1 - (zipBuffer.length / totalRawBytes)) * 100).toFixed(1);

  console.log('\n🎉 Package created successfully:');
  console.log(`   File:          ${outPath}`);
  console.log(`   Package size:  ${(zipBuffer.length / 1024).toFixed(1)} KB (compressed: ${ratio}% savings)`);
  console.log(`   SHA-256:       ${hash}`);
  console.log(`   Permissions:   ${(audit.manifest.permissions || []).join(', ') || 'none'}`);
  console.log(`   Optional Perm: ${(audit.manifest.optional_permissions || []).join(', ') || 'none'}`);
  console.log('\n🚀 Extension is ready for upload to the Chrome Web Store / Brave Extension ecosystem!\n');
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  const auditOnly = args.includes('--audit-only');
  const skipTests = args.includes('--skip-tests');
  runPackage({ auditOnly, skipTests });
}
