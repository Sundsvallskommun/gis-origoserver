var conf = require('../conf/config');
const url = require('url');
const axios = require('axios').default;
const apiFunctions = require('./oauth2proxy/APIFunctions');
const simpleStorage = require('./oauth2proxy/simpleStorage');

// Token holder
let token;
let q;
let proxyUrl;
var configStub = 'apiContract';

var getContract = async (req, res) => {
  if (conf[configStub]) {
    configOptions = Object.assign({}, conf[configStub]);
    scope = configOptions.scope;
    const parsedUrl = url.parse(decodeURI(req.url), true);
    if ('q' in parsedUrl.query) {
      q = parsedUrl.query.q;
    } else {
      q = '';
      console.log('No query specified!');
      res.send({});
    }
    if ('url' in parsedUrl.query) {
      proxyUrl = parsedUrl.query.url;
    } else {
      proxyUrl = '';
      console.log('No url specified!');
      res.send({});
    }

    if (conf[configStub]) {
      options = Object.assign({}, conf[configStub]);
      var configFound = false;
      for (i = 0; i < options.services.length; i++) {
        if (options.services[i].name === q) {
          configFound = true;
          await getUrl(req, res, options.services[i], proxyUrl);
        }
      }
      if (!configFound) {
        console.log('Missing config!');
        res.send({});
      }
    } else {
      console.log('ERROR config!');
      res.send({});
    }
  }
}

var getAllContracts = async (req, res) => {
  if (conf[configStub]) {
    configOptions = Object.assign({}, conf[configStub]);
    scope = configOptions.scope;
    const parsedUrl = url.parse(decodeURI(req.url), true);
    if ('q' in parsedUrl.query) {
      q = parsedUrl.query.q;
    } else {
      q = '';
      console.log('No query specified!');
      res.send({});
    }

    if (conf[configStub]) {
      options = Object.assign({}, conf[configStub]);
      var configFound = false;
      for (i = 0; i < options.services.length; i++) {
        if (options.services[i].name === q) {
          configFound = true;
          await getLandease(req, res, options.services[i], 'LEASEHOLD');
        }
      }
      if (!configFound) {
        console.log('Missing config!');
        res.send({});
      }
    } else {
      console.log('ERROR config!');
      res.send({});
    }
  }
}

// Export the module
module.exports = {
  getContract,
  getAllContracts
};

async function getLandease(req, res, service, type) {
    var returnResponse;
    var returnGeoJson = {};
    let ts = Date.now();
    const mockGeo = [];
    mockGeo.push({"geometry":{"coordinates":[[[619970.584,6919399.706],[619981.794,6919457.483],[619979.834,6919457.881],[619921.902,6919469.637],[619936.425,6919516.411],[619933.979,6919516.916],[619919.567,6919519.896],[619915.801,6919520.509],[619911.996,6919520.8],[619908.181,6919520.768],[619904.382,6919520.412],[619900.626,6919519.736],[619896.942,6919518.744],[619893.355,6919517.444],[619889.891,6919515.844],[619886.574,6919513.956],[619883.43,6919511.795],[619880.481,6919509.374],[619877.747,6919506.712],[619875.248,6919503.828],[619873.003,6919500.743],[619871.027,6919497.479],[619855.84,6919469.838],[619862.395,6919454.826],[619970.584,6919399.706]]],"type":"Polygon"}});
    mockGeo.push({"geometry":{"coordinates":[[[618939.346,6920669.221],[618966.253,6920617.924],[619061.919,6920678.959],[619028.077,6920764.32],[619002.228,6920748.875],[618994.378,6920744.648],[618986.183,6920741.136],[618977.708,6920738.369],[618969.019,6920736.368],[618960.187,6920735.149],[618951.282,6920734.722],[618939.346,6920669.221]]],"type":"Polygon"}});
    mockGeo.push({"geometry":{"coordinates":[[[619082.455,6920238.418],[619075.219,6920228.546],[619068.873,6920218.079],[619063.465,6920207.098],[619059.038,6920195.687],[619055.625,6920183.932],[619048.655,6920155.319],[619048.515,6920154.632],[619048.437,6920153.935],[619048.419,6920153.234],[619048.464,6920152.534],[619048.569,6920151.84],[619048.735,6920151.159],[619048.96,6920150.494],[619049.242,6920149.852],[619049.579,6920149.237],[619049.969,6920148.654],[619050.409,6920148.108],[619050.894,6920147.602],[619051.422,6920147.14],[619051.989,6920146.727],[619052.59,6920146.365],[619053.22,6920146.056],[619053.874,6920145.805],[619054.548,6920145.611],[619055.237,6920145.477],[619055.934,6920145.404],[619056.636,6920145.393],[619057.335,6920145.443],[619058.028,6920145.554],[619058.708,6920145.725],[619124.055,6920164.929],[619120.668,6920176.439],[619123.557,6920192.981],[619113.835,6920226.069],[619119.697,6920240.089],[619082.455,6920238.418]]],"type":"Polygon"}});
    var token = await simpleStorage.getToken(service);

    var requestOptions = {
        method: 'GET',
        url: 'https://api-test.sundsvall.se/contract/0.1/contracts',
        headers: {
          'Authorization': 'Bearer ' + token
        }
    };

    await axios(requestOptions)
        .then(response => {
          returnResponse = response.data;
          var objectIdentity = [];
          if ('landLeaseContracts' in response.data) {
            returnGeoJson = createGeojson(response.data.landLeaseContracts, mockGeo, '3006');
          }
        })
        .catch(function (error) {
          if (error.response) {
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
            res.send({ error: error.response.status, data: error.response.data });
        }
        });

    ts = Date.now();

    res.send(returnGeoJson);
}

function createGeojson(contracts, geometries, srid) {
  const result = {};
  let features = [];
  var i = 0;
  result['type'] = 'FeatureCollection';
  result['name'] = 'LandLeaseContracts';
  result['crs'] = {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:EPSG::' + srid }
  };

  contracts.forEach((contract) => {
    const tempEntity = {};
    const tempProperties = {};
    let hasGeometry = false;
    tempEntity['type'] = 'Feature';
    tempEntity['geometry'] = geometries[i].geometry;
    i = i + 1;

    tempEntity['properties'] = contract;
    features.push(tempEntity);
  });
  result['features'] = features;
  return result;
}
