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
const tvRoadnumbers = async (req, res) => {

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
  const bodySyntax = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="$featureType$" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="$changeid$">
      <FILTER>
          <EQ name="Huvudnummer" value="$roadnr$" />$countynr$<EQ name="Deleted" value="false" />
      </FILTER>
    </QUERY>
  </REQUEST>`;
  let bodyReturn = bodySyntax;
  bodyReturn = bodyReturn.replace("$changeid$", changeid)
                         .replace("$roadnr$", q)
                         .replace("$featureType$", featureType);
  if (countynr !== '') {
    bodyReturn = bodyReturn.replace("$countynr$", `<EQ name="Länstillhörighet" value="${countynr}" />`);
  } else {
    bodyReturn = bodyReturn.replace("$countynr$", '');
  }

  return bodyReturn;
}

// Export the module
module.exports = tvRoadnumbers;

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
  const bodySyntax = `<REQUEST>
    <LOGIN authenticationkey="${configOptions.authenticationkey}"/>
    <QUERY objecttype="$featureType$" namespace="vägdata.nvdb_dk_o" schemaversion="1.2" limit="800"  changeid="$changeid$">
      <FILTER>
          <EQ name="Huvudnummer" value="$roadnr$" />$countynr$<EQ name="Deleted" value="false" />
      </FILTER>
    </QUERY>
  </REQUEST>`;
  let bodyRoadNr = bodySyntax;
  bodyRoadNr = bodyRoadNr.replace("$changeid$", "1")
                         .replace("$roadnr$", q)
                         .replace("$featureType$", "Vägnummer");
  if (countynr !== '') {
    bodyRoadNr = bodyRoadNr.replace("$countynr$", `<EQ name="Länstillhörighet" value="${countynr}" />`);
  } else {
    bodyRoadNr = bodyRoadNr.replace("$countynr$", '');
  }
  const bodyQuery = getSearchBody(featureType, q, countynr, changeid);
  console.log(bodyQuery);

  try {
    const response = await fetchWithBody(bodyRoadNr);

    const resultObj = response.data.RESPONSE.RESULT[0];

    if (response.status === 206) {
      const lastChangeId = resultObj.INFO.LASTCHANGEID;

      let newBody = bodySyntax.replace("$changeid$", lastChangeId)
                        .replace("$roadnr$", q)
                        .replace("$featureType$", "Vägnummer");
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
        res.send(createGeojson(combinedVagnummer, configOptions, srid));
      } else {
        res.send(createWktCollection(combinedVagnummer, configOptions, srid));
      }
    } else {
      if (format.toLowerCase() === 'geojson') {
        res.send(createGeojson(resultObj.Vägnummer, configOptions, srid));
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
function createGeojson(entities, configOptions, srid, section = false) {
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
