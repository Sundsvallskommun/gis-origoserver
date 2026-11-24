// The overpass handler against a fake Overpass API on localhost. The config is replaced, so the test
// needs neither Overpass nor a conf/config.js.
//   npm run test:overpass
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

const handlers = path.resolve(__dirname, '..');

// Replaces a module before the handler loads it.
function stub(file, exports) {
  const filename = require.resolve(file);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const conf = {};
stub(path.join(handlers, '../conf/config'), conf);
const overpass = require('../overpass');

const fuel = { version: 0.6, elements: [{ type: 'node', id: 1, lat: 62.39, lon: 17.3, tags: { amenity: 'fuel', name: 'Mack' } }] };

// What the fake API answers with, and the requests it has received
let answer;
let requests;
let server;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, path: req.url, headers: req.headers, data: new URLSearchParams(body).get('data') });
      res.writeHead(answer.status, { 'Content-Type': answer.contentType });
      res.end(answer.body);
    });
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); });

beforeEach(() => {
  answer = { status: 200, contentType: 'application/json', body: JSON.stringify(fuel) };
  requests = [];
  Object.keys(conf).forEach((key) => delete conf[key]);
  conf.overpass = {
    url: `${base}/api/interpreter`,
    queries: [
      { name: 'amenityFuel', query: '[out:json];node[amenity=fuel];out;', options: '{}' },
      { name: 'flat', query: '[out:json];node;out;', options: { flatProperties: true } },
      { name: 'otherServer', query: '[out:json];node;out;', options: `{"overpassUrl": "${base}/other"}` },
    ],
  };
});

// Calls the handler like express does and resolves with what it sends, checking that it sends once.
async function call(query) {
  const sent = [];
  await overpass({ query }, { send: (body) => { sent.push(body); } });
  assert.equal(sent.length, 1, 'the handler should answer once');
  return sent[0];
}

test('posts the configured query and answers with GeoJSON', async () => {
  const result = await call({ q: 'amenityFuel' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].path, '/api/interpreter');
  assert.equal(requests[0].headers['content-type'], 'application/x-www-form-urlencoded');
  assert.equal(requests[0].data, '[out:json];node[amenity=fuel];out;');
  assert.deepEqual(result, {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'node/1',
      properties: { type: 'node', id: 1, tags: { amenity: 'fuel', name: 'Mack' }, relations: [], meta: {} },
      geometry: { type: 'Point', coordinates: [17.3, 62.39] },
    }],
  });
});

test('sends a User-Agent of its own, since overpass-api.de refuses requests without one', async () => {
  await call({ q: 'amenityFuel' });
  assert.equal(requests[0].headers['user-agent'], 'origoserver');

  conf.overpass.user_agent = 'origoserver (kommunen)';
  await call({ q: 'amenityFuel' });
  assert.equal(requests[1].headers['user-agent'], 'origoserver (kommunen)');
});

test('uses options from the query, as a JSON string or an object', async () => {
  const flat = await call({ q: 'flat' });
  assert.deepEqual(flat.features[0].properties, { amenity: 'fuel', name: 'Mack', id: 'node/1' });

  await call({ q: 'otherServer' });
  assert.equal(requests[1].path, '/other');
});

test('an unknown or missing query name answers {} without asking Overpass', async (t) => {
  t.mock.method(console, 'log', () => {});

  assert.deepEqual(await call({ q: 'nope' }), {});
  assert.deepEqual(await call({}), {});
  assert.deepEqual(await call({ q: ['amenityFuel', 'flat'] }), {});
  assert.equal(requests.length, 0);
});

test('an error from Overpass answers {} once and is logged', async (t) => {
  t.mock.method(console, 'error', () => {});
  answer = { status: 406, contentType: 'text/html', body: '<h1>406 Not Acceptable</h1>' };

  assert.deepEqual(await call({ q: 'amenityFuel' }), {});
  assert.match(console.error.mock.calls[0].arguments.join(' '), /amenityFuel.*HTTP 406/);
});

test('an answer that is not JSON answers {}', async (t) => {
  t.mock.method(console, 'error', () => {});
  answer = { status: 200, contentType: 'application/osm3s+xml', body: '<osm version="0.6"></osm>' };

  assert.deepEqual(await call({ q: 'amenityFuel' }), {});
  assert.match(console.error.mock.calls[0].arguments.join(' '), /out:json/);
});

test('without overpass in the config it answers {}', async (t) => {
  t.mock.method(console, 'error', () => {});
  delete conf.overpass;

  assert.deepEqual(await call({ q: 'amenityFuel' }), {});
});
