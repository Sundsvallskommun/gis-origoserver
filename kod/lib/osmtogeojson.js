// Overpass JSON (out:json) to GeoJSON, with the same output as osmtogeojson 2.2 for nodes and ways,
// which is what query-overpass returned before. Multipolygon and boundary relations are not turned
// into polygons: their member ways come out as ways, and the relation only shows in the
// "relations" property of its members, like any other relation.

// Tags that alone do not make a node worth its own feature (osmtogeojson's defaults)
const UNINTERESTING_TAGS = new Set([
  'source', 'source_ref', 'source:ref', 'history', 'attribution', 'created_by',
  'tiger:county', 'tiger:tlid', 'tiger:upload_uuid',
]);

// Which closed ways are areas, from osm-polygon-features 0.9.2 (CC0): true for every value,
// otherwise the values that are areas (included) or that are not (excluded).
const POLYGON_FEATURES = {
  building: true,
  highway: { included: ['services', 'rest_area', 'escape', 'elevator'] },
  natural: { excluded: ['coastline', 'cliff', 'ridge', 'arete', 'tree_row'] },
  landuse: true,
  waterway: { included: ['riverbank', 'dock', 'boatyard', 'dam'] },
  amenity: true,
  leisure: true,
  barrier: { included: ['city_wall', 'ditch', 'hedge', 'retaining_wall', 'wall', 'spikes'] },
  railway: { included: ['station', 'turntable', 'roundhouse', 'platform'] },
  area: true,
  boundary: true,
  man_made: { excluded: ['cutline', 'embankment', 'pipeline'] },
  power: { included: ['plant', 'substation', 'generator', 'transformer'] },
  place: true,
  shop: true,
  aeroway: { excluded: ['taxiway'] },
  tourism: true,
  historic: true,
  public_transport: true,
  office: true,
  'building:part': true,
  military: true,
  ruins: true,
  'area:highway': true,
  craft: true,
  golf: true,
  indoor: true,
};

function hasInterestingTags(tags) {
  return Object.keys(tags).some((key) => !UNINTERESTING_TAGS.has(key));
}

function isPolygonFeature(tags) {
  if (tags.area === 'no') return false;
  return Object.entries(tags).some(([key, value]) => {
    const rule = POLYGON_FEATURES[key];
    if (rule === undefined || value === 'no') return false;
    if (rule === true) return true;
    if (rule.included) return rule.included.includes(value);
    return !rule.excluded.includes(value);
  });
}

function meta(element) {
  const result = {};
  ['timestamp', 'version', 'changeset', 'user', 'uid'].forEach((key) => {
    if (element[key] !== undefined) result[key] = element[key];
  });
  return result;
}

// Twice the signed area of a ring of [lon, lat]: positive when it runs counterclockwise
function signedArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum;
}

function feature(element, geometry, relations) {
  return {
    type: 'Feature',
    id: `${element.type}/${element.id}`,
    properties: {
      type: element.type,
      id: element.id,
      tags: element.tags || {},
      relations: relations[element.type].get(element.id) || [],
      meta: meta(element),
    },
    geometry,
  };
}

// flatProperties gives properties with the meta information, the tags and id as "type/id"
module.exports = function osmToGeoJSON(data, { flatProperties = false } = {}) {
  const elements = Array.isArray(data && data.elements) ? data.elements : [];
  const nodes = elements.filter((e) => e.type === 'node' && e.lat !== undefined && e.lon !== undefined);
  const ways = elements.filter((e) => e.type === 'way' && Array.isArray(e.nodes));
  const rels = elements.filter((e) => e.type === 'relation' && Array.isArray(e.members));

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const wayNodeIds = new Set(ways.flatMap((w) => w.nodes));
  const relationNodeIds = new Set(rels.flatMap((r) => r.members.filter((m) => m.type === 'node').map((m) => m.ref)));

  // The relations each element is a member of
  const relations = { node: new Map(), way: new Map(), relation: new Map() };
  rels.forEach((rel) => {
    rel.members.forEach((member) => {
      const byId = relations[member.type];
      if (!byId) return;
      if (!byId.has(member.ref)) byId.set(member.ref, []);
      byId.get(member.ref).push({ role: member.role, rel: rel.id, reltags: rel.tags });
    });
  });

  const polygons = [];
  const lines = [];
  ways.forEach((way) => {
    const wayNodes = way.nodes.map((id) => nodesById.get(id));
    const coordinates = wayNodes.filter(Boolean).map((n) => [+n.lon, +n.lat]);
    if (coordinates.length <= 1) return;
    const closed = wayNodes[0] !== undefined && wayNodes[0] === wayNodes[wayNodes.length - 1];
    const isPolygon = closed && way.tags !== undefined && isPolygonFeature(way.tags);
    // Outer rings counterclockwise, as RFC 7946 and osmtogeojson have them
    if (isPolygon && signedArea(coordinates) < 0) coordinates.reverse();
    const f = feature(way, isPolygon
      ? { type: 'Polygon', coordinates: [coordinates] }
      : { type: 'LineString', coordinates }, relations);
    if (wayNodes.some((n) => n === undefined)) f.properties.tainted = true;
    (isPolygon ? polygons : lines).push(f);
  });

  // Nodes that are not only a vertex of a way
  const points = nodes
    .filter((n) => !wayNodeIds.has(n.id) || relationNodeIds.has(n.id) || (n.tags && hasInterestingTags(n.tags)))
    .map((n) => feature(n, { type: 'Point', coordinates: [+n.lon, +n.lat] }, relations));

  const features = [...polygons, ...lines, ...points];
  if (flatProperties) {
    features.forEach((f) => {
      f.properties = { ...f.properties.meta, ...f.properties.tags, id: f.id };
    });
  }
  return { type: 'FeatureCollection', features };
};
