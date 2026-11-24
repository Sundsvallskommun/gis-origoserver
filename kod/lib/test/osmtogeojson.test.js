// Overpass JSON to GeoJSON. The expected output is what osmtogeojson 2.2 (used by query-overpass)
// gave for the same data.
//   npm run test:overpass
const { test } = require('node:test');
const assert = require('node:assert/strict');
const osmToGeoJSON = require('../osmtogeojson');

const node = (id, lon, lat, tags, extra = {}) => ({ type: 'node', id, lat, lon, ...(tags && { tags }), ...extra });
const way = (id, nodes, tags) => ({ type: 'way', id, nodes, ...(tags && { tags }) });
const ids = (geojson) => geojson.features.map((f) => `${f.id} ${f.geometry.type}`);

// A square of four nodes, counterclockwise, and two nodes for a line
const square = [node(2, 17.31, 62.40), node(3, 17.32, 62.40), node(4, 17.32, 62.41), node(5, 17.31, 62.41)];
const ccw = [[17.31, 62.4], [17.32, 62.4], [17.32, 62.41], [17.31, 62.41], [17.31, 62.4]];

test('a node becomes a point with type, id, tags, relations and meta', () => {
  const geojson = osmToGeoJSON({ elements: [node(1, 17.3, 62.39, { amenity: 'fuel', name: 'Mack' })] });

  assert.deepEqual(geojson, {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'node/1',
      properties: { type: 'node', id: 1, tags: { amenity: 'fuel', name: 'Mack' }, relations: [], meta: {} },
      geometry: { type: 'Point', coordinates: [17.3, 62.39] },
    }],
  });
});

test('meta information is kept when the query asks for it', () => {
  const geojson = osmToGeoJSON({ elements: [node(1, 17, 62, { shop: 'kiosk' }, { timestamp: 't', version: 3, changeset: 9, user: 'u', uid: 7 })] });

  assert.deepEqual(geojson.features[0].properties.meta, { timestamp: 't', version: 3, changeset: 9, user: 'u', uid: 7 });
});

test('the vertices of a way are left out, unless they have tags of their own', () => {
  const geojson = osmToGeoJSON({ elements: [
    ...square.slice(0, 2),
    { ...square[2], tags: { created_by: 'JOSM' } },
    { ...square[3], tags: { entrance: 'yes' } },
    node(8, 17.35, 62.44, { source: 'survey' }),
    node(9, 17.36, 62.45),
    way(10, [2, 3, 4, 5, 2], { amenity: 'fuel' }),
  ] });

  // A node outside every way is kept even without tags, or with only uninteresting tags
  assert.deepEqual(ids(geojson), ['way/10 Polygon', 'node/5 Point', 'node/8 Point', 'node/9 Point']);
});

test('a closed way is a polygon only if its tags say it is an area', () => {
  const closed = [2, 3, 4, 2];
  const geojson = osmToGeoJSON({ elements: [
    ...square,
    way(10, closed, { amenity: 'fuel' }),
    way(11, closed, { barrier: 'fence' }),
    way(12, closed, { barrier: 'wall' }),
    way(13, closed, { amenity: 'fuel', area: 'no' }),
    way(14, closed, { natural: 'coastline' }),
    way(15, closed, { natural: 'wood' }),
    way(16, closed, { building: 'no' }),
    way(17, closed),
    way(18, [2, 3, 4], { amenity: 'fuel' }),
  ] });

  // Polygons first, then lines, then points (node 5 is in no way)
  assert.deepEqual(ids(geojson), [
    'way/10 Polygon', 'way/12 Polygon', 'way/15 Polygon',
    'way/11 LineString', 'way/13 LineString', 'way/14 LineString', 'way/16 LineString', 'way/17 LineString', 'way/18 LineString',
    'node/5 Point',
  ]);
});

test('the outer ring of a polygon runs counterclockwise', () => {
  const geojson = osmToGeoJSON({ elements: [...square, way(10, [2, 3, 4, 5, 2], { building: 'yes' }), way(11, [2, 5, 4, 3, 2], { building: 'yes' })] });

  assert.deepEqual(geojson.features[0].geometry.coordinates, [ccw]);
  assert.deepEqual(geojson.features[1].geometry.coordinates, [ccw]);
});

test('a way with a missing node is tainted, and one with fewer than two nodes is left out', () => {
  const geojson = osmToGeoJSON({ elements: [...square, way(10, [99, 2, 3]), way(11, [2]), way(12, [98, 2])] });

  // Nodes 4 and 5 are in no way that is kept, so they are points
  assert.deepEqual(ids(geojson), ['way/10 LineString', 'node/4 Point', 'node/5 Point']);
  assert.equal(geojson.features[0].properties.tainted, true);
  assert.deepEqual(geojson.features[0].geometry.coordinates, [[17.31, 62.4], [17.32, 62.4]]);
});

test('relations are listed on their members, and a node in a relation is kept', () => {
  const geojson = osmToGeoJSON({ elements: [
    ...square,
    way(10, [2, 3]),
    { type: 'relation', id: 20, members: [{ type: 'way', ref: 10, role: 'outer' }, { type: 'node', ref: 4, role: 'stop' }], tags: { type: 'site' } },
  ] });

  assert.deepEqual(ids(geojson), ['way/10 LineString', 'node/4 Point', 'node/5 Point']);
  const relation = [{ rel: 20, reltags: { type: 'site' } }];
  assert.deepEqual(geojson.features[0].properties.relations, [{ role: 'outer', ...relation[0] }]);
  assert.deepEqual(geojson.features[1].properties.relations, [{ role: 'stop', ...relation[0] }]);
});

test('flatProperties gives meta, tags and id as type/id', () => {
  const geojson = osmToGeoJSON({ elements: [node(1, 17, 62, { name: 'A', id: 'tag' }, { version: 2 })] }, { flatProperties: true });

  assert.deepEqual(geojson.features[0].properties, { version: 2, name: 'A', id: 'node/1' });
});

test('elements without coordinates or nodes, and an answer without elements, give no features', () => {
  assert.deepEqual(osmToGeoJSON({ elements: [{ type: 'node', id: 1 }, { type: 'way', id: 2 }] }).features, []);
  // Here osmtogeojson threw an error
  assert.deepEqual(osmToGeoJSON({}),{ type: 'FeatureCollection', features: [] });
  assert.deepEqual(osmToGeoJSON(null), { type: 'FeatureCollection', features: [] });
});
