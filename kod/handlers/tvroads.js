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
var proxyUrl = 'tvroads';
const configOptions = { ...config[proxyUrl] };
  

/**
 * Check parameters and direct to proper handling
 * 
 * @async
 * @function
 * @name tvRoadnumbers
 * @kind variable
 * @param {any} req
 * @param {any} res
 * @returns {Promise<any>}
 */
const tvRoads = async (req, res) => {

  if (config[proxyUrl]) {
    scope = configOptions.scope;
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    srid = parsedUrl.searchParams.get('srid') || '3006';
    const q = parsedUrl.searchParams.get('q') || '';
    const x = parsedUrl.searchParams.get('x') || '';
    const y = parsedUrl.searchParams.get('y') || '';
    const Feature_Oid = parsedUrl.searchParams.get('Feature_Oid') || '';
    const countynr = parsedUrl.searchParams.get('countynr') || '';
    const featureType = parsedUrl.searchParams.get('featureType') || '';
    const format = parsedUrl.searchParams.get('format') || 'wkt';

    if (q === '' && x === '' && y === '' && Feature_Oid === '') {
      console.log('No query, coords or Feature_Oid specified!');
      return res.status(400).send({});
    }

    if (!srid in validProjs) {
      console.log('Not valid srid!');
      return res.status(400).send({});
    }

    if (config[proxyUrl]) {
      if (Feature_Oid !== '') {
        getFeature(req, res, configOptions, Feature_Oid, featureType, srid, format);        
      } else if (x !== '') {
        doLookup(req, res, configOptions, x, y, srid, format);        
      } else {
        doSearch(req, res, configOptions, q, countynr, srid, format);        
      }
    } else {
      console.log('ERROR config!');
      res.status(400).send({});
    }
  }
}

/**
 * Setup and request and return it
 * 
 * @async
 * @function
 * @name fetchWithBody
 * @kind variable
 * @param {any} bodyContent
 * @returns {Promise<axios.AxiosResponse<any, any>>}
 */
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

function getSearchBody(featureType, q, countynr, changeid) {
  const bodySyntaxRoadNr = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="Vägnummer" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="$changeid$">
      <FILTER>
          <EQ name="Huvudnummer" value="$roadnr$" />$countynr$<EQ name="Deleted" value="false" />
      </FILTER>
    </QUERY>
  </REQUEST>`;
  const bodySyntaxStreetname = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="Gatunamn" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="$changeid$">
      <FILTER>
          <LIKE name='Namn' value='/^$name$/' />
          <EQ name="Deleted" value="false" />
          <WITHIN name="Geometry.WKT-SWEREF99TM-3D" shape="box" value="${configOptions.bbox}"/>
      </FILTER>
    </QUERY>
  </REQUEST>`;
  const bodySyntaxOtherRoads = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="ÖvrigtVägnamn" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="$changeid$">
      <FILTER>
          <LIKE name='Namn' value='/^$name$/' />
          <EQ name="Deleted" value="false" />
          <WITHIN name="Geometry.WKT-SWEREF99TM-3D" shape="box" value="${configOptions.bbox}"/>
      </FILTER>
    </QUERY>
  </REQUEST>`;
  let bodyReturn = '';
  switch (featureType) {
    case 'Vägnummer':
      bodyReturn = bodySyntaxRoadNr;
      bodyReturn = bodyReturn.replace("$changeid$", changeid)
                      .replace("$roadnr$", q);
      if (countynr !== '') {
        bodyReturn = bodyReturn.replace("$countynr$", `<EQ name="Länstillhörighet" value="${countynr}" />`);
      } else {
        bodyReturn = bodyReturn.replace("$countynr$", '');
      }
      break;
    case 'Gatunamn':
      bodyReturn = bodySyntaxStreetname;
      bodyReturn = bodyReturn.replace("$changeid$", changeid)
                      .replace("$name$", q);
      break;
    case 'ÖvrigtVägnamn':
      bodyReturn = bodySyntaxOtherRoads;
      bodyReturn = bodyReturn.replace("$changeid$", changeid)
                      .replace("$name$", q);
      break;
  
    default:
      break;
  }

  return bodyReturn;
}

async function handleResponse(response, configOptions, q, countynr, srid, format) {
  let returnValue = {};

  const resultObj = response.data.RESPONSE.RESULT[0];
  let roads = null;
  let foundKey = null;

  for (let key of ['Vägnummer', 'Gatunamn', 'ÖvrigtVägnamn']) {
      if (resultObj.hasOwnProperty(key)) {
          roads = resultObj[key];
          foundKey = key;
          break;
      }
  }

  switch (response.status) {
    case 200:
      if (format.toLowerCase() === 'geojson') {
        returnValue = createGeojson(roads, configOptions, srid, foundKey);
      } else {
        returnValue = createWktCollection(roads, configOptions, srid, foundKey);
      }
      break;
    case 206:
      const lastChangeId = resultObj.INFO.LASTCHANGEID;

      const newBodyQueryRoadNr = getSearchBody("Vägnummer", q, countynr, lastChangeId);

      const response2 = await fetchWithBody(newBodyQueryRoadNr);
      const resultObj2 = response2.data.RESPONSE.RESULT[0];

      // Concatenate the Vägnummer arrays
      const combinedVagnummer = resultObj.Vägnummer.concat(resultObj2.Vägnummer);
      if (format.toLowerCase() === 'geojson') {
        returnValue = createGeojson(combinedVagnummer, configOptions, srid);
      } else {
        returnValue = createWktCollection(combinedVagnummer, configOptions, srid);
      }
      break;
  
    default:
      break;
  }

  return returnValue;
};

// Export the module
module.exports = tvRoads;

async function getFeature(req, res, configOptions, Feature_Oid, featureType, srid, format) {
  const bodyQuery = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="${featureType}" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="1">
      <FILTER>
          <EQ name='Feature_Oid' value='${Feature_Oid}' />
      </FILTER>
    </QUERY>
  </REQUEST>`;

  try {
    const responseFeature = await fetchWithBody(bodyQuery);

    const resultObj = responseFeature.data.RESPONSE.RESULT[0];

    if (format.toLowerCase() === 'geojson') {
      res.send(createGeojson(resultObj[featureType], configOptions, srid, true));
    } else {
      res.send(resultObj);
    }
  } catch (err) {
    console.log(err);
    console.log('ERROR doSearch!');
    res.status(400).send({ error: 'ERROR doSearch!' });
  }
}

async function doLookup(req, res, configOptions, x, y, srid, format) {
  const coords = transformCoordinates(srid, '3006', [Number(x), Number(y)]);
  const bodyRoadNr = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="Vägnummer" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="1">
      <FILTER>
          <NEAR name="Geometry.WKT-SWEREF99TM-3D" value="${coords[0]} ${coords[1]}" maxdistance="${configOptions.maxdistance}" />
      </FILTER>
    </QUERY>
  </REQUEST>`;
  const bodyStreetname = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="Gatunamn" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="1">
      <FILTER>
          <NEAR name="Geometry.WKT-SWEREF99TM-3D" value="${coords[0]} ${coords[1]}" maxdistance="${configOptions.maxdistance}" />
      </FILTER>
    </QUERY>
  </REQUEST>`;
  const bodyOtherRoads = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="ÖvrigtVägnamn" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="1">
      <FILTER>
          <NEAR name="Geometry.WKT-SWEREF99TM-3D" value="${coords[0]} ${coords[1]}" maxdistance="${configOptions.maxdistance}" />
      </FILTER>
    </QUERY>
  </REQUEST>`;

  try {
    const responseRoadNr = await fetchWithBody(bodyRoadNr);
    const responseStreetname = await fetchWithBody(bodyStreetname);
    const responseOtherRoads = await fetchWithBody(bodyOtherRoads);

    const resultObj = {
      'Vägnummer':responseRoadNr.data.RESPONSE.RESULT[0].Vägnummer,
      'Gatunamn':responseStreetname.data.RESPONSE.RESULT[0].Gatunamn,
      'ÖvrigtVägnamn':responseOtherRoads.data.RESPONSE.RESULT[0].ÖvrigtVägnamn      
    };

    if (format.toLowerCase() === 'geojson') {
      res.send(createGeojson(resultObj.Vägnummer, configOptions, srid, true));
    } else {
      res.send(resultObj);
    }
  } catch (err) {
    console.log(err);
    console.log('ERROR doSearch!');
    res.status(400).send({ error: 'ERROR doSearch!' });
  }
}

async function doSearch(req, res, configOptions, q, countynr, srid, format) {
  const bodyQueryRoadNr = getSearchBody("Vägnummer", q, countynr, "1");
  const bodyQueryStreetname = getSearchBody("Gatunamn", q, countynr, "1");
  const bodyQueryOtherRoads = getSearchBody("ÖvrigtVägnamn", q, countynr, "1");
  let arrRoadNr = [];
  let arrStreetname = [];
  let arrOtherRoads = [];

  try {
    // Only do the roadnumber request if the search value is a number and the rest orherwise
    if (typeof q === 'number' && !isNaN(q)) {
      const responseRoadNr = await fetchWithBody(bodyQueryRoadNr);
      arrRoadNr = await handleResponse(responseRoadNr, configOptions, q, countynr, srid, format);    
    } else {
      const responseStreetname = await fetchWithBody(bodyQueryStreetname);
      const responseOtherRoads = await fetchWithBody(bodyQueryOtherRoads);

      arrStreetname = await handleResponse(responseStreetname, configOptions, q, countynr, srid, format);
      arrOtherRoads = await handleResponse(responseOtherRoads, configOptions, q, countynr, srid, format);
    }

    res.send(arrRoadNr.concat(arrStreetname, arrOtherRoads));
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
  const regex = /^(POINT Z|POINT|LINESTRING Z|LINESTRING|POLYGON Z|POLYGON|MULTIPOINT Z|MULTIPOINT|MULTILINESTRING Z|MULTILINESTRING|MULTIPOLYGON Z|MULTIPOLYGON)\s*\((.*)\)$/;
  const match = wkt.match(regex);

  if (!match) {
    console.log('Invalid WKT!');
  }

  const geomType = match[1];
  const coordsString = match[2];
  // Dela upp koordinaterna i en array av koordinater
  let coordsArray = [];
  if (geomType.endsWith(' Z')) {
    coordsArray = coordsString.split(',').map(coord => {
      const [x, y, z] = coord.trim().split(' ').map(Number);
      return transformCoordinates('3006', srid, [x, y, z]); // Reprojektera koordinaterna
    });
  } else {
    coordsArray = coordsString.split(',').map(coord => {
      const [x, y] = coord.trim().split(' ').map(Number);
      return transformCoordinates('3006', srid, [x, y]); // Reprojektera koordinaterna
    });
  }

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

function groupStreetSegments(segments, srid) {
  return segments.reduce((accumulator, segment) => {
    const { Namn, Feature_Oid, Geometry } = segment;
    
    // Om väg-ID inte finns i ackumulatorn, skapa en ny post
    if (!accumulator[`${Namn}${Feature_Oid}`]) {
        accumulator[`${Namn}${Feature_Oid}`] = {
          Name: Namn,
          Feature_Oid: Feature_Oid,
          geometries: []
        };
    }
    
    // Lägg till geometrin i rätt väg
    if (srid !== '3006') {
      accumulator[`${Namn}${Feature_Oid}`].geometries.push(reprojektWKT(Geometry['WKT-SWEREF99TM-3D'], srid));
    } else {
      accumulator[`${Namn}${Feature_Oid}`].geometries.push(Geometry['WKT-SWEREF99TM-3D']);
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
function createWktCollection(roadSegments, configOptions, srid, foundKey) {
  const result = [];

  switch (foundKey) {
    case 'Vägnummer':
      const groupedRoads = groupRoadSegments(roadSegments, srid);
      const resultArray = Object.values(groupedRoads);

      resultArray.forEach((road) => {
        result.push({ 
          Huvudnummer: `${road.roadId}`,
          Länstillhörighet: `${road.countyId}`,
          Geometri: `GEOMETRYCOLLECTION (${road.geometries.join(', ')})`
        });
      });
      break;
  
    default:
      const groupedStreets = groupStreetSegments(roadSegments, srid);
      const resultArrayStreet = Object.values(groupedStreets);

      resultArrayStreet.forEach((street) => {
        result.push({ 
          Namn: `${street.Name}`,
          Feature_Oid: `${street.Feature_Oid}`,
          Geometri: `GEOMETRYCOLLECTION (${street.geometries.join(', ')})`
        });
      });
      break;
  }

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
function createGeojson(entities, configOptions, srid, foundKey, section = false) {
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
      if (srid !== '3006') {
        tempEntity['geometry'] = parse(reprojektWKT(entity.Geometry['WKT-SWEREF99TM-3D'], srid));
      } else {
        tempEntity['geometry'] = parse(entity.Geometry['WKT-SWEREF99TM-3D']);
      }
      hasGeometry = true;
    } else {
      hasGeometry = false;
    }
    if (section) {
      tempEntity['properties'] = {
        Huvudnummer: entity.Huvudnummer,
        Undernummer: entity.Undernummer,
        GID: entity.GID,
        Europaväg: entity.Europaväg,
        Element_Id: entity.Element_Id,
        Feature_Oid: entity.Feature_Oid,
        Start_Measure: entity.Start_Measure,
        End_Measure: entity.End_Measure,
        Seq_No: entity.Seq_No,
        Role: entity.Role,
        Direction: entity.Direction,
        Updated: entity.Updated,
        Valid_From: entity.Valid_From,
        Valid_To: entity.Valid_To
      };        
    } else {
      tempEntity['properties'] = {
        Huvudnummer: entity.Huvudnummer,
        Undernummer: entity.Undernummer,
        Valid_From: entity.Valid_From,
        Valid_To: entity.Valid_To
      };
    }
    if (hasGeometry) {
      features.push(tempEntity);
    }
  });
  result['features'] = features;
  return result;
}
