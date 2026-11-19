// @turf 7 exports the function by name, not as the module itself
const { pointsWithinPolygon } = require('@turf/points-within-polygon');
const fs = require('fs');
const proj4 = require('proj4');

// True for a non-empty string that parses as a number (rejects '', '  ' and repeated params)
const isNumeric = (v) => typeof v === 'string' && v.trim() !== '' && !isNaN(v);

// The coordinate systems that the coordinates can be given in. They are converted to 3006, the
// system of the area file.
const SUPPORTED_SRIDS = [3006, 3014, 3857, 4326];

// The area file (GeoJSON in 3006) holds sensitive information, so it is not in the repo or the
// image but mounted into the container. PRECHECK_AREA_FILE gives its path, default
// fjv_buffer20.json in the server root. It is read on every request, so it can be replaced
// without a restart.
const areaFile = () => process.env.PRECHECK_AREA_FILE || 'fjv_buffer20.json';

function doGet(req, res, northing, easting, category, srid) {
  let searchWithin;
  try {
    searchWithin = JSON.parse(fs.readFileSync(areaFile(), 'utf8'));
  } catch (err) {
    // ENOENT when the file is not mounted, SyntaxError when it is not JSON
    console.error('precheck: the area file %s could not be read: %s', areaFile(), err.code || err.message);
    return res.status(503).json('The precheck is not configured (area file)');
  }
  const crs = 'EPSG:3006';
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

  const metadata = { type: category };

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
  // Answers 400 for the first invalid parameter and stops there, so that only one response is sent.
  get: function (req, res, next) {
    const query = req.query;
    let northing = '';
    let easting = '';
    let category = '';
    let srid = 3006;
    let status = 200;
    let msg = '';
    if ('northing' in query) {
      if (!isNumeric(query.northing)) {
        return res.status(400).json( 'Northing is not in valid format');
      } else {
        northing = query.northing;
      }
    } else {
      return res.status(400).json( 'Missing required parameter northing');
    }
    if ('easting' in query) {
      if (!isNumeric(query.easting)) {
        return res.status(400).json( 'Easting is not in valid format');
      } else {
        easting = query.easting;
      }
    } else {
      return res.status(400).json( 'Missing required parameter easting');
    }
    if ('category' in query) {
      if (!['DISTRICT_HEATING'].includes(query.category)) {
        return res.status(400).json('Category is not a valid value');
      } else {
        category = query.category;
      }
    } else {
      return res.status(400).json( 'Missing required parameter category');
    }
    if ('srid' in query) {
      // srid arrives as text but is compared with numbers in doGet
      srid = Number(query.srid);
      if (!SUPPORTED_SRIDS.includes(srid)) {
        return res.status(400).json('srid is not a valid value');
      }
    } else {
      srid = 3006;
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
      description: 'The coordinate reference system id of given coordinates: 3006, 3014, 3857 or 4326. Default 3006',
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
            type: 'object',
            additionalProperties: {
                type: "string",
                description: "Map with name-value pairs",
                readOnly: true,
                example: "type: DISTRICT_HEATING"
            },
            description: "A list of additional metadata properties.",
            readOnly: true,
            example: "type: DISTRICT_HEATING"
          }
        },
        example: {
          deliverable: false,
          futureDeliverable: true,
          plannedDevelopmentDate: '2025-01-01',
          metaData: { type: 'DISTRICT_HEATING' },
        }
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        type: "string"
      },
    },
    503: {
      description: 'The area file is missing or can not be read (PRECHECK_AREA_FILE)',
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
