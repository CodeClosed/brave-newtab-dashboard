import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, getDomainFromUrl } from '../extension/js/utils/url.js';

test('A3: normalizes host:port for dev servers and NAS to http://', () => {
  const localhost = normalizeUrl('localhost:3000');
  assert.equal(localhost.valid, true);
  assert.equal(localhost.url, 'http://localhost:3000/');
  assert.equal(localhost.domain, 'localhost');

  const nas = normalizeUrl('my-nas.local:5000');
  assert.equal(nas.valid, true);
  assert.equal(nas.url, 'http://my-nas.local:5000/');
  assert.equal(nas.domain, 'my-nas.local');

  const ipPort = normalizeUrl('192.168.1.1:8080');
  assert.equal(ipPort.valid, true);
  assert.equal(ipPort.url, 'http://192.168.1.1:8080/');
  assert.equal(ipPort.domain, '192.168.1.1');
});

test('A3: normalizes host:port for public domains to https://', () => {
  const example = normalizeUrl('example.com:8080');
  assert.equal(example.valid, true);
  assert.equal(example.url, 'https://example.com:8080/');
  assert.equal(example.domain, 'example.com');
});

test('A3: bare hosts default to http:// for localhost, IP addresses, and *.local', () => {
  const localhost = normalizeUrl('localhost');
  assert.equal(localhost.valid, true);
  assert.equal(localhost.url, 'http://localhost/');

  const nas = normalizeUrl('my-nas.local');
  assert.equal(nas.valid, true);
  assert.equal(nas.url, 'http://my-nas.local/');

  const ip = normalizeUrl('192.168.1.1');
  assert.equal(ip.valid, true);
  assert.equal(ip.url, 'http://192.168.1.1/');
});

test('A3: bare hosts for public domains default to https://', () => {
  const site = normalizeUrl('example.com/test');
  assert.equal(site.valid, true);
  assert.equal(site.url, 'https://example.com/test');
  assert.equal(site.domain, 'example.com');
});

test('A3: single-label hosts are rejected unless localhost or port given', () => {
  const singleLabel = normalizeUrl('foo');
  assert.equal(singleLabel.valid, false);

  const singleLabelWithPath = normalizeUrl('foo/bar');
  assert.equal(singleLabelWithPath.valid, false);

  const singleLabelWithPort = normalizeUrl('foo:8080');
  assert.equal(singleLabelWithPort.valid, true);
  assert.equal(singleLabelWithPort.url, 'https://foo:8080/');
});

test('A3: dangerous schemes are strictly rejected', () => {
  const dangerous = [
    'javascript:alert(1)',
    'data:text/html,payload',
    'file:///etc/passwd',
    'mailto:a@b.c',
    'chrome://settings',
    'ftp://files.example.com'
  ];

  for (const item of dangerous) {
    const res = normalizeUrl(item);
    assert.equal(res.valid, false, `Expected ${item} to be rejected`);
  }
});

test('A3: javascript:1 parses as host "javascript" and port 1, yielding harmless https URL', () => {
  const res = normalizeUrl('javascript:1');
  assert.equal(res.valid, true);
  assert.equal(res.url, 'https://javascript:1/');
  assert.equal(res.domain, 'javascript');
});
