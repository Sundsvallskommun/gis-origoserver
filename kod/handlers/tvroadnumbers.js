var config = require('../conf/config');
var axios = require('axios');
var transformCoordinates = require('../lib/utils/transformcoordinates');
const url = require('url');
const wkt = require('wkt');
const { parse } = require('wkt');
//var Promise = require('bluebird');

var srid;
var validProjs = ["3006", "3007", "3008", "3009", "3010", "3011", "3012", "3013", "3014", "3015", "3016", "3017", "3018", "3857", "4326"];
let scope;
var proxyUrl = 'tvroadnumbers';
  
// Do the request in proper order
const tvRoadnumbers = async (req, res) => {

  if (config[proxyUrl]) {
    const configOptions = { ...config[proxyUrl] };
    scope = configOptions.scope;
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    srid = parsedUrl.searchParams.get('srid') || '3006';
    const q = parsedUrl.searchParams.get('q') || '';
    const x = parsedUrl.searchParams.get('x') || '';
    const y = parsedUrl.searchParams.get('y') || '';
    const countynr = parsedUrl.searchParams.get('countynr') || '';

    if (q === '' && x === '' && y === '') {
      console.log('No query or coords specified!');
      return res.status(400).send({});
    }

    if (!srid in validProjs) {
      console.log('Not valid srid!');
      return res.status(400).send({});
    }

    if (config[proxyUrl]) {
      if (x !== '') {
        doLookup(req, res, configOptions, x, y, srid);        
      } else {
        doSearch(req, res, configOptions, q, countynr, srid);        
      }
    } else {
      console.log('ERROR config!');
      res.status(400).send({});
    }
  }
}

// Export the module
module.exports = tvRoadnumbers;

async function doLookup(req, res, configOptions, x, y, srid) {
  let body = configOptions.bodyRoadNrCoords;
  body = body.replace("$coords$", `${x} ${y}`);
             
  const fetchWithBody = async (bodyContent) => {
    const options = {
      method: 'POST',
      url: encodeURI(configOptions.url),
      headers: {
        'User-Agent': 'Axios',
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(bodyContent)
      },
      data: bodyContent
    };

    return axios(options);
  };

  try {
    const response = await fetchWithBody(body);

    const resultObj = response.data.RESPONSE.RESULT[0];

    res.send(resultObj);
  } catch (err) {
    console.log(err);
    console.log('ERROR doLookup!');
    res.status(400).send({ error: 'ERROR doLookup!'});  }

}

async function doSearch(req, res, configOptions, q, countynr, srid, format = 'wkt') {
  let body = configOptions.bodyRoadNrSearch;
  body = body.replace("$changeid$", "1")
             .replace("$roadnr$", q);
  if (countynr !== '') {
    body = body.replace("$countynr$", `<EQ name="Länstillhörighet" value="${countynr}" />`);
  } else {
    body = body.replace("$countynr$", '');
  }
             
  const fetchWithBody = async (bodyContent) => {
    const options = {
      method: 'POST',
      url: encodeURI(configOptions.url),
      headers: {
        'User-Agent': 'Axios',
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(bodyContent)
      },
      data: bodyContent
    };

    return axios(options);
  };

  try {
    const response = await fetchWithBody(body);

    const resultObj = response.data.RESPONSE.RESULT[0];

    if (response.status === 206) {
      const lastChangeId = resultObj.INFO.LASTCHANGEID;

      let newBody = configOptions.bodyRoadNrSearch.replace("$changeid$", lastChangeId)
                                      .replace("$roadnr$", q);
      if (countynr !== '') {
        newBody = newBody.replace("$countynr$", `<EQ name="Länstillhörighet" value="${countynr}" />`);
      } else {
        newBody = newBody.replace("$countynr$", '');
      }
                                      
      const response2 = await fetchWithBody(newBody);
      const resultObj2 = response2.data.RESPONSE.RESULT[0];

      // Concatenate the Vägnummer arrays
      const combinedVagnummer = resultObj.Vägnummer.concat(resultObj2.Vägnummer);
      if (format.toLowerCase() === 'geojson') {
        res.send([createGeojson(combinedVagnummer, configOptions, srid)]);
      } else {
        res.send(createWktCollection(combinedVagnummer, configOptions, srid));
      }
    } else {
      if (format.toLowerCase() === 'geojson') {
        res.send([createGeojson(resultObj.Vägnummer, configOptions, srid)]);
      } else {
        res.send(createWktCollection(resultObj.Vägnummer, configOptions, srid));
      }
    }
  } catch (err) {
    console.log(err);
    console.log('ERROR doSearch!');
    res.status(400).send({ error: 'ERROR doSearch!' });
  }
}

/**
 * Funktion för att reprojektera individuella koordinater
 * 
 * @function
 * @name reprojektWKT
 * @kind function
 * @param {any} wkt
 * @param {any} srid
 * @returns {string}
 */
function reprojektWKT(wkt, srid) {
  // Här specificeras en enkel parsning av WKT, vi tar bort "LINESTRING" eller "POINT" och hanterar bara koordinaterna
  const regex = /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON)\s*\((.*)\)$/;
  const match = wkt.match(regex);

  if (!match) {
    console.log('Invalid WKT!');
    res.status(400).send({ error: 'Invalid WKT!'});
  }

  const geomType = match[1];
  const coordsString = match[2];
  
  // Dela upp koordinaterna i en array av koordinater
  const coordsArray = coordsString.split(',').map(coord => {
    const [x, y] = coord.trim().split(' ').map(Number);
    return transformCoordinates('3006', srid, [x, y]); // Reprojektera koordinaterna
  });

  // Återskapa WKT-strukturen
  const newCoordsString = coordsArray.map(coord => coord.join(' ')).join(', ');
  return `${geomType} (${newCoordsString})`;
}

/**
 * Funktion för att gruppera vägdelar efter väg-ID
 * 
 * @function
 * @name groupRoadSegments
 * @kind function
 * @param {any} segments
 * @param {any} srid
 * @returns {any}
 */
function groupRoadSegments(segments, srid) {
  return segments.reduce((accumulator, segment) => {
    const { Huvudnummer, Länstillhörighet, Geometry } = segment;
    
    // Om väg-ID inte finns i ackumulatorn, skapa en ny post
    if (!accumulator[`${Huvudnummer}${Länstillhörighet}`]) {
        accumulator[`${Huvudnummer}${Länstillhörighet}`] = {
          roadId: Huvudnummer,
          countyId: Länstillhörighet,
          geometries: []
        };
    }
    
    // Lägg till geometrin i rätt väg
    if (srid !== '3006') {
      accumulator[`${Huvudnummer}${Länstillhörighet}`].geometries.push(reprojektWKT(Geometry['WKT-SWEREF99TM-3D'], srid));
    } else {
      accumulator[`${Huvudnummer}${Länstillhörighet}`].geometries.push(Geometry['WKT-SWEREF99TM-3D']);
    }
    return accumulator;
  }, {});
}

/**
 * Take segments and join them to a collection
 * 
 * @function
 * @name createWktCollection
 * @kind function
 * @param {any} roadSegments
 * @param {any} configOptions
 * @param {any} srid
 * @returns {any[]}
 */
function createWktCollection(roadSegments, configOptions, srid) {
  const result = [];

  const groupedRoads = groupRoadSegments(roadSegments, srid);
  const resultArray = Object.values(groupedRoads);

  resultArray.forEach((road) => {
    result.push({ 
      Huvudnummer: `${road.roadId}`,
      Länstillhörighet: `${road.countyId}`,
      Geometri: `GEOMETRYCOLLECTION (${road.geometries.join(', ')})`
    });
  });

  return result;
}

/**
 * Create a geojson from the supplied entities
 * 
 * @function
 * @name createGeojson
 * @kind function
 * @param {any} entities
 * @param {any} configOptions
 * @param {any} srid
 * @returns {{ type: string; name: any; crs: { type: string; properties: { name: string; }; }; features: any[]; }}
 */
function createGeojson(entities, configOptions, srid) {
  const result = {};
  let features = [];
  result['type'] = 'FeatureCollection';
  result['name'] = configOptions.title;
  result['crs'] = {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:EPSG::' + srid }
  };

  entities.forEach((entity) => {
    const tempEntity = {};
    let hasGeometry = false;
    tempEntity['type'] = 'Feature';
    if ("Geometry" in entity) {
      tempEntity['geometry'] = parse(entity.Geometry['WKT-SWEREF99TM-3D']);
      hasGeometry = true;
    } else {
      hasGeometry = false;
    }
    tempEntity['properties'] = {
      Huvudnummer: entity.Huvudnummer,
      Undernummer: entity.Undernummer,
      Valid_From: entity.Valid_From,
      Valid_To: entity.Valid_To
    };
    if (hasGeometry) {
      features.push(tempEntity);
    }
  });
  result['features'] = features;
  return result;
}
