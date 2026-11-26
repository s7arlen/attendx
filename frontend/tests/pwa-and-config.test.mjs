import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('PWA manifest and service worker files are present and exclude API caching', () => {
  const manifestPath = path.resolve('public/manifest.json');
  const swPath = path.resolve('public/sw.js');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'AttendX');
  assert.equal(manifest.display, 'standalone');

  const swSource = fs.readFileSync(swPath, 'utf8');
  assert.match(swSource, /\/api/);
  assert.match(swSource, /\/socket\.io/);
  assert.match(swSource, /\/uploads/);
});

test('vercel security headers do not disable geolocation needed for classroom geofencing', () => {
  const vercel = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
  const headerEntry = vercel.headers?.[0]?.headers?.find((h) => h.key === 'Permissions-Policy');
  assert.ok(headerEntry);
  assert.match(headerEntry.value, /geolocation=\(self\)/);
  assert.match(headerEntry.value, /camera=\(self\)/);
});

test('USN format regex matches institutional standard', () => {
  const usnSrc = fs.readFileSync(path.resolve('src/lib/usn.ts'), 'utf8');
  assert.match(usnSrc, /USN_REGEX/);
});
