var conf = require('../conf/config');
var oauth2proxy = require('./oauth2proxy');
const url = require('url');
const apiFunctions = require('./oauth2proxy/APIFunctions');
const simpleStorage = require('./oauth2proxy/simpleStorage');

var disturbances = async (req, res) => {
  var configName = 'disturbances';
  var options;
  if (conf[configName]) {
    await getUrl(req, res, conf[configName], conf[configName].serviceurl);
  }
}

// Export the module
module.exports = disturbances;

async function getUrl(req, res, service, url) {
  const arrGeojson = [];
  const category = {
    COMMUNICATION: 'KOMMUNIKATION',
    DISTRICT_COOLING: 'FJÄRRKYLA',
    DISTRICT_HEATING: 'FJÄRRVÄRME',
    ELECTRICITY: 'ELEKTRICITET',
    ELECTRICITY_TRADE: 'ELHANDEL',
    WASTE_MANAGEMENT: 'AVFALLSHANTERING',
    WATER: 'VATTEN'
  };
  const status = {
    OPEN: 'ÖPPEN',
    CLOSED: 'STÄNGD',
    PLANNED: 'PLANERAD'
  };
  let srid = '3006';
  var token = await simpleStorage.getToken(service);
  var urlResponse = await apiFunctions.getFromUrl(token, url, 'application/json');
  urlResponse.forEach((disturbance) => {
    disturbance.affecteds.forEach((affected) => {
      let updated = '';
      if ('updated' in disturbance) {
        updated = disturbance.updated;
      }
      if ('coordinates' in affected) {
        const coordArr = affected.coordinates.split(':')
        if (coordArr[0] === 'SWEREF 991715') {
          srid = '3014';
        }
        arrGeojson.push({
          category: category[disturbance.category],
          status: status[disturbance.status],
          title: disturbance.title,
          description: disturbance.description,
          plannedStartDate: disturbance.plannedStartDate,
          plannedStopDate: disturbance.plannedStopDate,
          created: disturbance.created,
          updated,
          reference: affected.reference,
          coord: coordArr
        });
      }
    });
  });
  const geojson = createGeojson(arrGeojson, 'Driftströrningar', srid);
  res.send(geojson);
}

function createGeojson(objectArr, title, srid) {
  const result = {};
  let features = [];
  result['type'] = 'FeatureCollection';
  result['name'] = title;
  result['crs'] = {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:EPSG::' + srid }
  };

  objectArr.forEach((object) => {
      const tempObject = {};
      let hasGeometry = false;
      tempObject['type'] = 'Feature';
      if ("coord" in object) {
        tempObject['geometry'] = {
  				"type" : "Point",
  				"coordinates" : [object.coord[2].replace("E", ""),object.coord[1].replace("N", "")]
        };
        hasGeometry = true;
      } else {
        hasGeometry = false;
      }
      tempObject['properties'] = {
        category: object.category,
        status: object.status,
        description: object.description,
        plannedStartDate: object.plannedStartDate,
        plannedStopDate: object.plannedStopDate,
        created: object.created,
        updated: object.updated,
        reference: object.reference
      };
      if (hasGeometry) {
        features.push(tempObject);
      }
  });
  result['features'] = features;
  return result;
}
