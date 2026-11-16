// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditExtension, collectExtensionFiles, createZipBuffer } from '../scripts/package.js';

test('Package Pipeline: auditExtension confirms valid MV3 manifest and asset integrity', () => {
  const audit = auditExtension();
  assert.equal(audit.valid, true, `Audit failed with errors: ${audit.errors.join(', ')}`);
  assert.equal(audit.manifest.manifest_version, 3);
  assert.ok(audit.manifest.name);
  assert.ok(audit.manifest.version);
  assert.equal(audit.errors.length, 0);
});

test('Package Pipeline: collectExtensionFiles collects production files and excludes temporary files', () => {
  const files = collectExtensionFiles();
  assert.ok(files.length > 30, 'Should collect all extension production files');
  assert.ok(files.some(f => f.path === 'manifest.json'));
  assert.ok(files.some(f => f.path === 'newtab.html'));
  assert.ok(!files.some(f => f.path.includes('.DS_Store')));
  assert.ok(!files.some(f => f.path.endsWith('.tmp')));
});

test('Package Pipeline: createZipBuffer creates standard valid PKZIP archive', () => {
  const testFiles = [
    { path: 'hello.txt', data: Buffer.from('Hello world!'), mtime: new Date() },
    { path: 'sub/test.json', data: Buffer.from(JSON.stringify({ test: true })), mtime: new Date() }
  ];

  const zipBuf = createZipBuffer(testFiles);
  assert.ok(zipBuf.length > 0);
  // Standard PKZIP local header signature: 0x04034b50 (PK\x03\x04)
  assert.equal(zipBuf.readUInt32LE(0), 0x04034b50);
});
