// lmsearchplacename against a fake Ortnamn Direkt v2.2 on localhost. Config and token are replaced,
// so the test needs neither Lantmäteriet nor any keys.
//   npm run test:lmsearchplacename
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

const handlers = path.resolve(__dirname, '..');

// Replaces a module before lmsearchplacename loads it.
function stub(file, exports) {
  const filename = require.resolve(file);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const conf = {
  lmsearchplacename: { url: '', url_token: 'unused', consumer_key: 'k', consumer_secret: 's', scope: 'ortnamn_direkt_read' },
};
stub(path.join(handlers, '../conf/config'), conf);
stub(path.join(handlers, 'lmtokenhandler'), async () => ({ token: 'testtoken' }));
const lmSearchPlacename = require('../lmsearchplacename');

// A place name as the id lookup and the criteria search return it. The feature id is not the same
// as properties.id in the real API, and it is the feature id that the handler passes on.
function feature(id, namn, { kommunkod = '2281', kommunnamn = 'Sundsvall', coordinates = [600000, 6900000] } = {}) {
  return {
    type: 'Feature',
    id: `f${id}`,
    geometry: null,
    properties: {
      id,
      namn,
      sprak: 'Svenska',
      placering: [{ kommunkod, kommunnamn, lankod: '22', lannamn: 'Västernorrland', punkt: { type: 'Point', coordinates } }],
    },
  };
}

// What the fake API knows, per municipality, and the requests it has received.
let places;
let failing;
let requests;

let server;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://localhost');
      const query = Object.fromEntries(u.searchParams);
      requests.push({ method: req.method, path: u.pathname, query, headers: req.headers, body: body ? JSON.parse(body) : undefined });
      const send = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      if (failing.includes(`${req.method} ${u.pathname}`) || failing.includes(query.kommunkod)) return send(500, { message: 'Runtime Error' });
      const all = Object.values(places).flat();
      const matching = (query.kommunkod ? places[query.kommunkod] || [] : all)
        .filter((f) => f.properties.namn.toLowerCase().includes((query.namn || '').toLowerCase()))
        .slice(0, Number(query.maxHits || 100));
      if (req.method === 'GET' && u.pathname === '/referens/fritext') {
        return send(200, matching.map((f) => ({ id: f.properties.id, namn: f.properties.namn })));
      }
      if (req.method === 'GET' && u.pathname === '/kriterier') {
        return send(200, { type: 'FeatureCollection', features: matching });
      }
      if (req.method === 'POST' && u.pathname === '/') {
        return send(200, { type: 'FeatureCollection', features: all.filter((f) => JSON.parse(body).includes(f.properties.id)) });
      }
      return send(404, { message: 'No matching resource found for given API Request' });
    });
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  conf.lmsearchplacename.url = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); });

beforeEach(() => {
  places = {
    2281: [feature(1, 'Galtström'), feature(2, 'Galten', { coordinates: [631227, 6896649] }), feature(3, 'Berg')],
    2262: [feature(4, 'Galtberget', { kommunkod: '62', kommunnamn: 'Timrå' })],
  };
  failing = [];
  requests = [];
});

// Calls the handler like express does and resolves with what it sends.
function search(queryString) {
  return new Promise((resolve, reject) => {
    const req = { url: `/origoserver/lmsearchplacename?${queryString}`, query: Object.fromEntries(new URLSearchParams(queryString)) };
    const res = { send: resolve };
    lmSearchPlacename(req, res).catch(reject);
  });
}

const names = (result) => result.map((f) => f.properties.name);

test('searches with the free text search and looks up the hits by id', async () => {
  const result = await search('q=galt&kommunkod=2281');

  assert.deepEqual(requests.map((r) => `${r.method} ${r.path}`), ['GET /referens/fritext', 'POST /']);
  const [freeText, lookup] = requests;
  assert.deepEqual(freeText.query, { namn: 'galt', match: 'contains', kommunkod: '2281' });
  assert.equal(freeText.headers.authorization, 'Bearer testtoken');
  assert.deepEqual(lookup.query, { srid: '3006' });
  assert.deepEqual(lookup.body, [1, 2]);
  assert.equal(lookup.headers.authorization, 'Bearer testtoken');

  // Sorted by relevance: the exact match first. Coordinates are turned to north, east.
  assert.deepEqual(result, [
    { geometry: { coordinates: [6896649, 631227], type: 'Point' }, properties: { id: 'f2', name: 'Galten', municipality: 'Sundsvall' }, type: 'Feature' },
    { geometry: { coordinates: [6900000, 600000], type: 'Point' }, properties: { id: 'f1', name: 'Galtström', municipality: 'Sundsvall' }, type: 'Feature' },
  ]);
});

test('passes match type, limit and srid on', async () => {
  await search('q=galt&kommunkod=2281&matchtype=startsWith&limit=5&srid=3014');

  const [freeText, lookup] = requests;
  assert.deepEqual(freeText.query, { namn: 'galt', match: 'startsWith', maxHits: '5', kommunkod: '2281' });
  assert.deepEqual(lookup.query, { srid: '3014' });
});

test('encodes Swedish characters in the search string', async () => {
  const result = await search(`q=${encodeURIComponent('galtström')}&kommunkod=2281`);

  assert.equal(requests[0].query.namn, 'galtström');
  assert.deepEqual(names(result), ['Galtström']);
});

test('uses the criteria search when a language is given, since the free text search ignores it', async () => {
  const result = await search('q=galt&kommunkod=2281&lang=Svenska');

  assert.deepEqual(requests.map((r) => `${r.method} ${r.path}`), ['GET /kriterier']);
  assert.deepEqual(requests[0].query, { namn: 'galt', match: 'contains', sprak: 'Svenska', srid: '3006', kommunkod: '2281' });
  assert.deepEqual(names(result), ['Galten', 'Galtström']);
});

test('uses the criteria search when a name type is given', async () => {
  await search(`q=galt&kommunkod=2281&nametype=${encodeURIComponent('Tätort')}&limit=10`);

  assert.deepEqual(requests.map((r) => `${r.method} ${r.path}`), ['GET /kriterier']);
  assert.deepEqual(requests[0].query, { namn: 'galt', match: 'contains', namntyp: 'Tätort', maxHits: '10', srid: '3006', kommunkod: '2281' });
});

test('no hits gives an empty list without a lookup by id', async () => {
  const result = await search('q=zzqx&kommunkod=2281');

  assert.deepEqual(result, []);
  assert.deepEqual(requests.map((r) => `${r.method} ${r.path}`), ['GET /referens/fritext']);
});

test('searches each municipality and returns the hits of all', async () => {
  const result = await search('q=galt&kommunkod=2281,2262');

  assert.deepEqual(requests.filter((r) => r.method === 'GET').map((r) => r.query.kommunkod).sort(), ['2262', '2281']);
  assert.deepEqual(names(result), ['Galten', 'Galtström', 'Galtberget']);
  assert.equal(result[2].properties.municipality, 'Timrå');
});

test('a municipality that fails gives no hits, the others are still returned', async (t) => {
  t.mock.method(console, 'error', () => {});
  failing = ['2262'];

  const result = await search('q=galt&kommunkod=2281,2262');

  assert.deepEqual(names(result), ['Galten', 'Galtström']);
  assert.equal(console.error.mock.callCount(), 1);
});

test('a failing lookup by id gives no hits and sends the response once', async (t) => {
  t.mock.method(console, 'error', () => {});
  failing = ['POST /'];
  const sent = [];

  await new Promise((resolve) => {
    lmSearchPlacename(
      { url: '/x?q=galt&kommunkod=2281', query: { q: 'galt', kommunkod: '2281' } },
      { send: (body) => { sent.push(body); resolve(); } },
    );
  });
  // Give a second send a chance to happen
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(sent, [[]]);
});

test('does not search without a search string or municipality', async (t) => {
  t.mock.method(console, 'log', () => {});

  assert.deepEqual(await search('q=&kommunkod=2281'), {});
  assert.deepEqual(await search('kommunkod=2281'), {});
  assert.deepEqual(await search('q=galt'), {});
  assert.deepEqual(requests, []);
});
