var conf = require('../conf/config');
var request = require('request');
var rp = require('request-promise');
var transformCoordinates = require('../lib/utils/transformcoordinates');
const url = require('url');
const wkt = require('wkt');
const { parse } = require('wkt');
var iconv = require('iconv-lite');
var mysql = require('mysql');
const { Client } = require('pg');

var objectIds;
var username;
var password;
var output;
var srid;
var validProjs = ["3006", "3007", "3008", "3009", "3010", "3011", "3012", "3013", "3014", "3015", "3016", "3017", "3018", "3857", "4326"];
var filterOn = '';
var filterValue = '';
var excludeOn = '';
var excludeValue = '';
var excludeType = 'equal';
var filter = '';
var dateFilter = '';

// Token holder
let token;
let scope;
var proxyUrl = 'convertToGeojson';

function getAttribute(entity, key) {
  let retVal = '';
  if (typeof key !== 'undefined' && key !== null) {
    if (key.includes(".")) {
      keys = key.split(".");
      let tempVal = entity[keys[0]];
      for (index = 1; index < keys.length; ++index) {
        tempVal = tempVal[keys[index]];
      }
      retVal = tempVal;
    } else {
      retVal = entity[key];
    }
  }
  return retVal;
}

// Do the request in proper order
const convertToGeojson = async (req, res) => {

  if (conf[proxyUrl]) {
    configOptions = Object.assign({}, conf[proxyUrl]);
    scope = configOptions.scope;
    const parsedUrl = url.parse(decodeURI(req.url), true);
    if ('srid' in parsedUrl.query) {
      srid = parsedUrl.query.srid;
    } else {
      srid = '3006';
    }
    if ('q' in parsedUrl.query) {
      q = parsedUrl.query.q;
    } else {
      q = '';
      console.log('No converting specified!');
      res.status(501).send({ error: 'No converting specified!'});
    }

    if (conf[proxyUrl]) {
      options = Object.assign({}, conf[proxyUrl]);
      let found = false;
      options.converts.forEach((convert) => {
        if (typeof convert.filterOn !== 'undefined' || convert.filterOn !== null) {
          filterOn = convert.filterOn;
          filterValue = parsedUrl.query[filterOn];
        }
        if (typeof convert.dateFilter !== 'undefined' || convert.dateFilter !== null) {
          dateFilter = convert.dateFilter;
        }
        if (typeof convert.excludeOn !== 'undefined' || convert.excludeOn !== null) {
          excludeOn = convert.excludeOn;
          excludeValue = convert.excludeValue;
        }
        if (typeof convert.excludeType !== 'undefined' || convert.excludeType !== null) {
          excludeType = convert.excludeType;
        }
        if (q === convert.name) {
          found = true;
          doGet(req, res, convert, convert.crs || srid, filterOn, filterValue, excludeOn, excludeValue, excludeType, dateFilter);
        }
      });
      if (!found) {
        console.log('Not configured!');
        res.status(501).send({ error: 'Not configured!'});
      }
  } else {
      console.log('ERROR config!');
      res.status(501).send({ error: 'ERROR config!'});
    }
  }
}

// Export the module
module.exports = convertToGeojson;

function doGet(req, res, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue, excludeType, dateFilter) {
  // Setup the search call and wait for result
  let options = {
    url: encodeURI(configOptions.url),
    method: 'GET',
    json: false  // Automatically parses the JSON string in the response set to true
  }
  if (typeof configOptions.headers !== 'undefined') {
    options = {
      url: encodeURI(configOptions.url),
      method: 'GET',
      json: false,  // Automatically parses the JSON string in the response set to true
      headers: configOptions.headers
    }
  } 

  if(configOptions.type === 'mysql'){
    var con = mysql.createConnection({
      host: configOptions.server,
      port: configOptions.port,
      user: configOptions.user,
      password: configOptions.password,
      database: configOptions.database,
      connectTimeout : 10000
    });

    con.connect(function(err) {
      if (err) throw err;
      console.log("Connected!");
    });

    con.query(`select * from ${configOptions.table}`, function (err, results) {
      if (err) throw err;
      res.send(createGeojson(results, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue, excludeType, dateFilter));
    });
  } else if(configOptions.type === 'postgres'){
    const client = new Client({
      user: configOptions.user,
      password: configOptions.password,
      host: configOptions.server,
      port: configOptions.port,
      database: configOptions.database,
    });
  // Connect to the database
  client
    .connect()
    .then(() => {
      let sqlQuery = `SELECT ${configOptions.properties.join()}, ST_AsGeoJSON(${configOptions.geometry})::jsonb as geojson FROM ${configOptions.schema}."${configOptions.table}"`;
      client.query(sqlQuery, (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.sendStatus(500);
        } else {
          res.send(createGeojson(result.rows, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue, excludeType, dateFilter));
        }

        // Close the connection when done
        client
          .end()
          .then(() => {
            console.log('Connection to PostgreSQL closed');
          })
          .catch((err) => {
            console.error('Error closing connection', err);
            res.sendStatus(500);
          });
      });
    })
    .catch((err) => {
      console.error('Error connecting to PostgreSQL database', err);
      res.sendStatus(500);
    });
  } else {
    var chunks = [];
    rp(options)
    .on('data', function(chunk) {
      chunks.push(chunk);
    })
    .then(function (result) {
      var body = {};
      if (result.startsWith('<')) {        
        res.status(500).send({ error: 'Not JSON reponse!' });
      } else {
        if (typeof configOptions.encoding === 'undefined' || configOptions.encoding === null) {
          try {
            body = JSON.parse(result);
          } catch (error) {
            console.log(error);
            res.status(500).send({ error, config: configOptions });
          }
        } else {
          var bodyWithCorrectEncoding = iconv.decode(Buffer.concat(chunks), configOptions.encoding);
          body = JSON.parse(bodyWithCorrectEncoding);
        }
        if (configOptions.arrayOfObjects === null) {
          res.send(createGeojson(body, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue, excludeType));
        } else {
          res.send(createGeojson(body[configOptions.arrayOfObjects], configOptions, srid, filterOn, filterValue, excludeOn, excludeValue, excludeType, dateFilter));
        }
      }
    })
    .catch(function (err) {
      console.log(err);
      console.log('ERROR doGet!');
      res.status(500).send({error: 'ERROR doGet!'});
    });
  }
}

function createGeojson(entities, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue, excludeType, dateFilter) {
  const result = {};
  let features = [];
  result['type'] = 'FeatureCollection';
  result['name'] = configOptions.title;
  result['crs'] = {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:EPSG::' + srid }
  };
  if (typeof entities !== 'undefined') {
    entities.forEach((entity) => {
      const tempEntity = {};
      const tempProperties = {};
      let hasGeometry = false;
      tempEntity['type'] = 'Feature';
      if ("Array" === configOptions.geometry_format) {
        if (typeof entity[configOptions.geometry] !== 'undefined' && entity[configOptions.geometry] !== null) {
          tempEntity['geometry'] = {
            coordinates: JSON.parse(entity[configOptions.geometry]),
            type: configOptions.geometry_type
          };
          hasGeometry = true;
        } else {
          hasGeometry = false;
        }
      } else if ("LatLng" === configOptions.geometry_format) {
        if (configOptions.geometry.length > 1) {
          tempEntity['geometry'] = {
            coordinates: [ Number(entity[configOptions.geometry[1]]), Number(entity[configOptions.geometry[0]]) ],
            type: configOptions.geometry_type
          };
          hasGeometry = true;
        } else {
          hasGeometry = false;
        }
      } else if ("GeometryCollections" === configOptions.geometry_format) {
        var i;
        var tempGeometries = [];
        for (i = 0; i < configOptions.geometry.length; i++) {
          const tempGeom = getAttribute(entity, configOptions.geometry[i]);
          if (typeof tempGeom !== 'undefined' && tempGeom !== null) {
            tempGeometries.push({
                type: configOptions.geometry_type[i],
                coordinates: JSON.parse(tempGeom)
            });
          }
        }
        tempEntity['geometry'] = {
           type: 'GeometryCollection',
           geometries: tempGeometries
        }
        hasGeometry = true;
      } else if ("GeoJSON" === configOptions.geometry_format) {
        if (typeof entity[configOptions.geometry] !== 'undefined' && entity[configOptions.geometry] !== null) {
          tempEntity['geometry'] = entity[configOptions.geometry];
          hasGeometry = true;
        } else {
          hasGeometry = false;
        }
      } else if ("Geometry" === configOptions.geometry_format) {
        if (typeof entity['geojson'] !== 'undefined' && entity['geojson'] !== null) {
          tempEntity['geometry'] = entity['geojson'];
          hasGeometry = true;
        } else {
          hasGeometry = false;
        }
      }
      configOptions.properties.forEach((property) => {
        if (configOptions.onlyUseLastPartOfNestedPropname) {
          const propArray = property.split(".");
          tempProperties[propArray[propArray.length-1]] = getAttribute(entity, property);
        } else {
          tempProperties[property] = getAttribute(entity, property);
        }
      });
      tempEntity['properties'] = tempProperties;
      // Only add those with a geometry
      if (hasGeometry) {
        let pushEntity = false;
        // If no filter parameter was configed then all should be pushed
        if (filterOn === '' && dateFilter === '' ) {
          pushEntity = true;
        } else {
          // If no value for the filter is supplied then all should be pushed
          if (typeof filterValue === 'undefined' || filterValue === null || filterValue === '') {
            pushEntity = true;
          } else {
            if (filterValue == getAttribute(entity, filterOn) ){
              pushEntity = true;
            }
          }
        }
        if (typeof dateFilter !== 'undefined') {
          if (dateFilter.type === 'between' ){
            const firstDate = getAttribute(entity, dateFilter.firstDate);
            const secondDate = getAttribute(entity, dateFilter.secondDate);
            if (Date.parse(firstDate) > Date.now()) {
              pushEntity = false;
            }
            if (Date.parse(secondDate) < Date.now()) {
              pushEntity = false;
            }
          }
        }
        if (excludeOn !== '') {
          if (Array.isArray(excludeValue)) {
            let foundExclude = false;
            excludeValue.forEach((value) => {
              if (String(value) == String(getAttribute(entity, excludeOn)) ){
                foundExclude = true;
              }
            });
            if (foundExclude) {
              pushEntity = false;
            }
          } else if (String(excludeValue) == String(getAttribute(entity, excludeOn)) && excludeType === 'equal' ){
            pushEntity = false;
          } else if (Date.parse(getAttribute(entity, excludeOn).replaceAll('"', '')) < (Date.now() + excludeValue) && excludeType === 'timeMiliseconds' ){
            pushEntity = false;
          }
        }
        if (pushEntity) {
          features.push(tempEntity);
        }
      }
    });
  }
  result['features'] = features;
  return result;
}
