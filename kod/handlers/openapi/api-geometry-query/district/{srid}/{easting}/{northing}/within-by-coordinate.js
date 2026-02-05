const conf = require('../../../../../../../conf/config');
const pg = require('pg');
const { Client } = pg

const service = 'apiGeometryQuery';

async function lookupDistrict(req, res, easting, northing, srid) {
    const configOptions = Object.assign({}, conf[service].services.district);
    let responseObj = {};
   
    const client = new Client({
        user: configOptions.dbUser,
        password: configOptions.dbPassword,
        host: configOptions.dbHostname,
        port: configOptions.dbPort,
        database: configOptions.dbName,
    });
    try {
      await client.connect();
    } catch(err) {
      res.status(500).json({error: 'Failed to connect to database!'});
    }    
    try {
      const res = await client.query(`SELECT distriktsnamn, distriktskod, objektidentitet
        FROM public."SLM_Distrikt_yta"
        WHERE ST_Contains(geom, ST_SetSRID(ST_Point(${easting}, ${northing}), ${srid}));`);
      if (res.rowCount === 1) {
        responseObj = res.rows[0];
      }
    } catch(err) {
      res.status(500).json({error: 'Failed to query database!'});
    }    
    
    await client.end();

    res.status(200).json(responseObj);
}

module.exports = {
  get: function (req, res, next) {
    let validationError = false;

    if (conf && conf.apiGeometryQuery && conf.apiGeometryQuery.services && conf.apiGeometryQuery.services['district']) {
      if(String(req.params.srid).length >= 4 && isNaN(req.params.srid)) {
        validationError = true;
        res.status(400).json({
          status: 400,
          errors: [
            {
              path: 'srid',
              errorCode: 'type.openapi.requestValidation',
              message: 'must be a 4-digit number',
              location: 'path'
            }
          ]
        });
      }
      if(String(req.params.easting).length > 4 && isNaN(req.params.easting)) {
        validationError = true;
          res.status(400).json({
          status: 400,
          errors: [
            {
              path: 'easting',
              errorCode: 'type.openapi.requestValidation',
              message: 'must be a number',
              location: 'path'
            }
          ]
        });
      }
      if(String(req.params.northing).length > 4 && isNaN(req.params.northing)) {
        validationError = true;
        res.status(400).json({
          status: 400,
          errors: [
            {
              path: 'northing',
              errorCode: 'type.openapi.requestValidation',
              message: 'must be a number',
              location: 'path'
            }
          ]
        });
      }
      if (!validationError) {
        lookupDistrict(req, res, req.params.easting, req.params.northing, req.params.srid);
      }
    } else {
      validationError = true;
      res.status(400).json({error: 'Error in configuration!'});
    }
  },
};
  
module.exports.get.apiDoc = {
  description: 'Is the supplyed coordinate within the type of area.',
  operationId: 'isWithinByCoordinate',
  parameters: [
    {
      in: 'path',
      name: 'srid',
      required: true,
      pattern: '[0-9]{4}',
      type: 'string'
    },
    {
      in: 'path',
      name: 'easting',
      required: true,
      type: 'string'
    },
    {
      in: 'path',
      name: 'northing',
      required: true,
      type: 'string'
    }
  ],
  tags: [
    'district'
  ],
  responses: {
    200: {
      description: 'Responds with a object of the district for these coordinates',
      schema: {
          type: 'array',
          items: {
            $ref: '#/definitions/DistrictResponse'
          }
        },
    },
    400: {
      description: 'Bad request',
      schema: {
        $ref: '#/definitions/ErrorResponse'
      },
    },
    500: {
      description: 'Server error',
      schema: {
        $ref: '#/definitions/ErrorResponse'
      },
    },
  },
};
  