const url = require('url');
var rp = require('request-promise');
var querystring = require("querystring");

function doGet(req, res, northing, easting, category, crs) {
  // Setup the search call and wait for result
  const options = {
      url: `http://fme.sundsvall.se/fmedatastreaming/API/KollaFjarrvarme.fmw?SourceDataset_ORACLE_SPATIAL_3=GIS%40sbk_orcl&Coordinates=[${querystring.escape(easting.toUpperCase())},${querystring.escape(northing.toUpperCase())}]&token=5e5a19edfd0a6e6b05b11a08ec7c39ccabf93bd2`,
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
    //res.status(500).json('FME error!');
    res.status(200).json({
      deliverable: false,
      futureDeliverable: true,
      plannedDevelopmentDate: '2025-01-01',
      metaData: {
        type: 'DISTRICT_HEATING'
      }
    });
  });
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let northing = '';
    let easting = '';
    let category = '';
    let crs = 'EPSG:3006';
    let status = 200;
    let msg = '';
    if ('northing' in parsedUrl.query) {
      if (isNaN(parsedUrl.query.northing)) {
        //res.status(400).json({ error: 'Northing is not in valid format' });
        res.status(400).json( 'Northing is not in valid format');
      } else {
        northing = parsedUrl.query.northing;
      }
    } else {
      //res.status(400).json({error: 'Missing required parameter northing'});
      res.status(400).json( 'Missing required parameter northing');
    }
    if ('easting' in parsedUrl.query) {
      if (isNaN(parsedUrl.query.easting)) {
        //res.status(400).json({error: 'Easting is not in valid format'});
        res.status(400).json( 'Easting is not in valid format');
      } else {
        easting = parsedUrl.query.easting;
      }
    } else {
      //res.status(400).json({error: 'Missing required parameter easting'});
      res.status(400).json( 'Missing required parameter easting');
    }
    if ('category' in parsedUrl.query) {
      if (!['DISTRICT_HEATING'].includes(parsedUrl.query.category)) {
        //res.status(400).json({ error: 'Category is not a valid value' });
        res.status(400).json('Category is not a valid value');
      } else {
        category = parsedUrl.query.category;
      }
    } else {
      //res.status(400).json({ error: 'Missing required parameter category' });
      res.status(400).json( 'Missing required parameter category');
    }
    if ('crs' in parsedUrl.query) {
      const regex = new RegExp('EPSG:[0-9]+$');
      if (!regex.test(parsedUrl.query.crs)) {
        //res.status(400).json({ error: 'crs is not a valid value' });
        res.status(400).json('crs is not a valid value');
      } else {
        crs = parsedUrl.query.crs;
      }
    } else {
      crs = 'EPSG:3006';
    }
    doGet(req, res, northing, easting, category, crs);
    //res.status(status).json('test');
  },
};

module.exports.get.apiDoc = {
  description: 'Check to see if coordinates is within area for precheck.',
  operationId: 'preCheck',
  parameters: [
    {
      in: 'query',
      name: 'northing',
      description: 'The northward-measured distance (the y-coordinate) of coordinates for a point',
      required: false,
      type: 'string'
    },
    {
      in: 'query',
      name: 'easting',
      description: 'The eastward-measured distance (the x-coordinate) of coordinates for a point',
      required: false,
      type: 'string'
    },
    {
      in: 'query',
      name: 'category',
      description: 'The category for the preCheck f.e. DISTRICT_HEATING',
      required: false,
      type: 'string'
    },
    {
      in: 'query',
      name: 'crs',
      description: 'The coordinate reference system of given coordinates, default EPSG:3006',
      required: false,
      type: 'string'
    }
  ],
  responses: {
    200: {
      description: 'Gives a answer if coordinates is within reach of service',
      schema: {
        type: 'object',
        properties: {
          deliverable: {
            description: 'States if service is deliverable.',
            type: 'boolean'
          },
          futureDeliverable: {
            description: 'States if service is deliverable in the future.',
            type: 'boolean'
          },
          plannedDevelopmentDate: {
            description: 'Gives a date for planned development.',
            type: 'string',
            format: 'date'
          },
          metaData: {
            description: 'Key-values with additional metadata properties.',
            type: 'object'
          }
        },
        example: {
          deliverable: false,
          futureDeliverable: true,
          plannedDevelopmentDate: '2025-01-01',
          metaData: {
            type: 'DISTRICT_HEATING'
          },
        }
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        type: "string"
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
