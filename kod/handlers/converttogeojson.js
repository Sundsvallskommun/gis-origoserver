var conf = require('../conf/config');
var request = require('request');
var rp = require('request-promise');
var transformCoordinates = require('../lib/utils/transformcoordinates');
const url = require('url');
const wkt = require('wkt');
const { parse } = require('wkt');
var iconv = require('iconv-lite');
var mysql = require('mysql');

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
      res.send({});
    }

    if (conf[proxyUrl]) {
      options = Object.assign({}, conf[proxyUrl]);
      options.converts.forEach((convert) => {
        if (typeof convert.filterOn !== 'undefined' || convert.filterOn !== null) {
          filterOn = convert.filterOn;
          filterValue = parsedUrl.query[filterOn];
        }
        if (typeof convert.excludeOn !== 'undefined' || convert.excludeOn !== null) {
          excludeOn = convert.excludeOn;
          excludeValue = convert.excludeValue;
        }
      if (q === convert.name) {
          doGet(req, res, convert, convert.crs || srid, filterOn, filterValue, excludeOn, excludeValue);
        }
      });
    } else {
      console.log('ERROR config!');
      res.send({});
    }
  }
}

// Export the module
module.exports = convertToGeojson;

function doGet(req, res, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue) {
  // Setup the search call and wait for result
  const options = {
    url: encodeURI(configOptions.url),
    method: 'GET',
    json: false  // Automatically parses the JSON string in the response set to true
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
    res.send(createGeojson(results, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue));
  });
  } else {
    var chunks = [];
    rp(options)
    .on('data', function(chunk) {
      chunks.push(chunk);
    })
    .then(function (result) {
      var body = {};
      if (typeof configOptions.encoding === 'undefined' || configOptions.encoding === null) {
        body = JSON.parse(result);
      } else {
        var bodyWithCorrectEncoding = iconv.decode(Buffer.concat(chunks), configOptions.encoding);
        body = JSON.parse(bodyWithCorrectEncoding);
      }
      if (configOptions.arrayOfObjects === null) {
        res.send(createGeojson(body, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue));
      } else {
        res.send(createGeojson(body[configOptions.arrayOfObjects], configOptions, srid, filterOn, filterValue, excludeOn, excludeValue));
      }
    })
    .catch(function (err) {
      console.log(err);
      console.log('ERROR doGet!');
      res.send({});
    });
  }
}

function createGeojson(entities, configOptions, srid, filterOn, filterValue, excludeOn, excludeValue) {
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
          coordinates: [ entity[configOptions.geometry[1]], entity[configOptions.geometry[0]] ],
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
    }
    configOptions.properties.forEach((property) => {
      tempProperties[property] = getAttribute(entity, property);
    });
    tempEntity['properties'] = tempProperties;
    // Only add those with a geometry
    if (hasGeometry) {
      let pushEntity = false;
      // If no filter parameter was configed then all should be pushed
      if (filterOn === '') {
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
      if (excludeOn !== '') {
        //console.log('excludeValue1 ' + excludeValue);
        //console.log('excludeValue2 ' + getAttribute(entity, excludeOn));
        if (String(excludeValue) == String(getAttribute(entity, excludeOn)) ){
          pushEntity = false;
        }
      }
      if (pushEntity) {
        features.push(tempEntity);
      }
    }
  });
  result['features'] = features;
  return result;
}
