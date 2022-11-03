const url = require('url');
var rp = require('request-promise');
var querystring = require("querystring");
var pointsWithinPolygon = require('@turf/points-within-polygon');
const fs = require('fs');
const proj4 = require('proj4');

function doGet(req, res, northing, easting, category, srid) {
  // Setup the search call and wait for result
  const options = {
      url: `http://fme.sundsvall.se/fmedatastreaming/API/KollaFjarrvarme.fmw?SourceDataset_ORACLE_SPATIAL_3=GIS%40sbk_orcl&Coordinates=[${querystring.escape(easting.toUpperCase())},${querystring.escape(northing.toUpperCase())}]&token=5e5a19edfd0a6e6b05b11a08ec7c39ccabf93bd2`,
      method: 'GET',
      json: true // Automatically parses the JSON string in the response
  }
  const searchWithin = JSON.parse( fs.readFileSync('fjv_buffer20.json', 'utf8') );
  const crs = `EPSG:${srid}`;
  let coord = [Number(easting), Number(northing)];

  var projection3006 = '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';
  if(srid === 3014){
    var projection3014 = "+proj=tmerc +lat_0=0 +lon_0=17.25 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs";
    //I'm not going to redefine those two in latter examples.
    coord = proj4(projection3014, projection3006, coord);
  } else if (srid === 3857) {
    var projection3857 = "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs";
    //I'm not going to redefine those two in latter examples.
    coord = proj4(projection3857, projection3006, coord);
  } else if (srid === 4326) {
    var projection4326 = "+proj=longlat +datum=WGS84 +no_defs +type=crs";
    //I'm not going to redefine those two in latter examples.
    coord = proj4(projection4326, projection3006, coord);
  }

  const point = {
    "type": "Feature",
    "crs" : {
      "type" : "name",
      "properties" : {
        "name" : crs
      }
    },
    "geometry": {
      "type": "Point",
      "coordinates": coord
    }
  };

  var ptsWithin = pointsWithinPolygon(point, searchWithin);

  const metadata = [];
  metadata.push({ type: 'DISTRICT_HEATING' });

  if (ptsWithin.features.length > 0) {
    res.status(200).json({
      deliverable: true,
      metaData: metadata
    });
  } else {
    res.status(200).json({
      deliverable: false,
      futureDeliverable: false,
      plannedDevelopmentDate: '',
      metaData: metadata
    });
  }
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let northing = '';
    let easting = '';
    let category = '';
    let srid = '3006';
    let status = 200;
    let msg = '';
    if ('northing' in parsedUrl.query) {
      if (isNaN(parsedUrl.query.northing)) {
        res.status(400).json( 'Northing is not in valid format');
      } else {
        northing = parsedUrl.query.northing;
      }
    } else {
      res.status(400).json( 'Missing required parameter northing');
    }
    if ('easting' in parsedUrl.query) {
      if (isNaN(parsedUrl.query.easting)) {
        res.status(400).json( 'Easting is not in valid format');
      } else {
        easting = parsedUrl.query.easting;
      }
    } else {
      res.status(400).json( 'Missing required parameter easting');
    }
    if ('category' in parsedUrl.query) {
      if (!['DISTRICT_HEATING'].includes(parsedUrl.query.category)) {
        res.status(400).json('Category is not a valid value');
      } else {
        category = parsedUrl.query.category;
      }
    } else {
      res.status(400).json( 'Missing required parameter category');
    }
    if ('srid' in parsedUrl.query) {
      if (isNaN(parsedUrl.query.srid)) {
        res.status(400).json('srid is not a valid value');
      } else {
        srid = parsedUrl.query.srid;
      }
    } else {
      srid = '3006';
    }
    doGet(req, res, northing, easting, category, srid);
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
      name: 'srid',
      description: 'The coordinate reference system id of given coordinates, default 3006',
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
            description: 'A list of additional metadata properties.',
            type: 'array',
            items: {
              $ref: '#/definitions/metadata'
            }
          }
        },
        example: {
          deliverable: false,
          futureDeliverable: true,
          plannedDevelopmentDate: '2025-01-01',
          metaData: [{ type: 'DISTRICT_HEATING' }],
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
