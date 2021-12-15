const url = require('url');
var rp = require('request-promise');
var querystring = require("querystring");

function doGet(req, res, estate) {
  // Setup the search call and wait for result
  const options = {
      url: `http://fme.sundsvall.se/fmedatastreaming/API/KollaDetaljplan.fmw?SourceDataset_ORACLE_SPATIAL_3=GIS%40sbk_orcl&Fastighet=${querystring.escape(estate.toUpperCase())}&token=5e5a19edfd0a6e6b05b11a08ec7c39ccabf93bd2`,
      method: 'GET',
      json: true // Automatically parses the JSON string in the response
  }

  rp(options)
  .then(function (parsedBody) {
    if (typeof parsedBody !== 'undefined') {
      let status = false;
      const zoning = [];

      parsedBody.forEach((zone) => {
        if (zone.Detaljplan) {
          status = true;
        }
        if (zone.FF_EXTID) {
          zoning.indexOf(zone.FF_EXTID) === -1 ? zoning.push(zone.FF_EXTID) : console.log("This item already exists");
        }
      });

      const result = {
        status,
        zoning
      };
      res.send(result);
    } else {
      res.send({status: 'not found'});
    }
  })
  .catch(function (err) {
    console.log(err);
    console.log('ERROR doGet!');
    res.send({});
  });
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let estate = '';
    if ('estate' in parsedUrl.query) {
      estate = parsedUrl.query.estate;
    } else {
      res.status(400).json({error: 'Missing required parameter estate'});
    }
    doGet(req, res, estate);
    // res.status(200).json({detaljplan: false});
  },
};

module.exports.get.apiDoc = {
  description: 'Check to see if a estate is within zoned area.',
  operationId: 'checkZoning',
  parameters: [
    {
        in: 'query',
        name: 'estate',
        required: true,
        type: 'string'
      }
    ],
  responses: {
    200: {
      description: 'Gives a answer if a estate is within zoned area',
      schema: {
        type: 'string',
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        type: 'string',
      },
    },
    500: {
      description: 'Server error',
      schema: {
        type: 'string',
      },
    },
  },
};
