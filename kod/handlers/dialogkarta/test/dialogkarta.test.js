// Kopplingen av dialogkarta i origoserver: config -> lagring, inloggning och användare.
// API:t i sig testas i dialog-karta (server/test), där router.js och openapi.js kommer ifrån.
//   npm run test:dialogkarta
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const dialogkarta = require('..');

let server;
let base;
let dataDir;
const adGroups = [];

// Som requireAdGroupMember: "Bearer anna" är inloggad och med i gruppen, "Bearer bo" är
// inloggad men inte med, utan token är man inte inloggad.
function fakeRequireAdGroupMember({ adGroup }) {
  adGroups.push(adGroup);
  return (req, res, next) => {
    const user = (req.get('Authorization') || '').replace(/^Bearer /, '');
    if (!user) return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'Inloggning krävs' });
    if (user !== 'anna') return res.status(403).json({ error: 'Du saknar behörighet' });
    req.user = { username: user };
    return next();
  };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogkarta-'));
  const app = express();
  app.use('/origoserver/api/v1/dialogs', dialogkarta({
    storage: 'file',
    data_dir: dataDir, // absolut sökväg går också
    ad_group: 'Medborgardialog-redaktorer',
    max_attachment_mb: 1,
    validate_responses: 'strict',
  }, { requireAdGroupMember: fakeRequireAdGroupMember }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://localhost:${server.address().port}/origoserver/api/v1/dialogs`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const dialog = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [150000, 6920000] },
  properties: { title: 'Dialog Öde', method: 'walk', status: 'completed' },
};
const post = (user, body = dialog) => fetch(base, {
  method: 'POST',
  headers: { 'Content-Type': 'application/geo+json', ...(user && { Authorization: `Bearer ${user}` }) },
  body: JSON.stringify(body),
});

test('uses the configured AD group', () => {
  assert.deepEqual(adGroups, ['Medborgardialog-redaktorer']);
});

test('reading is open, writing needs a member of the group', async () => {
  assert.equal((await fetch(base)).status, 200);
  const anonymous = await post();
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get('www-authenticate'), 'Bearer');
  assert.equal((await post('bo')).status, 403);
  assert.equal((await post('anna')).status, 201);
});

test('the logged-in user is saved as creator, whatever the client sends', async () => {
  const res = await post('anna', { ...dialog, properties: { ...dialog.properties, createdBy: 'någon annan' } });
  const saved = await res.json();
  assert.equal(saved.properties.createdBy, 'anna');
  assert.equal(saved.properties.updatedBy, 'anna');
  assert.equal(res.headers.get('location'), `/origoserver/api/v1/dialogs/${saved.id}`);
});

test('serves the OpenAPI 3.2 description with the mount point as server', async () => {
  const doc = await (await fetch(`${base}/openapi.json`)).json();
  assert.equal(doc.openapi, '3.2.0');
  assert.deepEqual(doc.servers, [{ url: '/origoserver/api/v1/dialogs' }]);
});

test('max_attachment_mb limits uploads', async () => {
  const { id } = await (await post('anna')).json();
  const upload = (size) => fetch(`${base}/${id}/attachments`, {
    method: 'POST',
    headers: { Authorization: 'Bearer anna', 'Content-Type': 'application/json', 'X-Filename': 'inspel.json' },
    body: '"'.padEnd(size - 1, 'x') + '"',
  });
  assert.equal((await upload(1000)).status, 201);
  assert.equal((await upload(2 * 1024 * 1024)).status, 413);
});

test('require_login: false opens writing', async () => {
  const app = express();
  app.use('/d', dialogkarta({ storage: 'file', data_dir: dataDir, require_login: false }, {
    requireAdGroupMember: () => { throw new Error('should not be used'); },
  }));
  const s = await new Promise((resolve) => { const x = app.listen(0, () => resolve(x)); });
  try {
    const res = await fetch(`http://localhost:${s.address().port}/d`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dialog),
    });
    assert.equal(res.status, 201);
  } finally {
    s.close();
  }
});
