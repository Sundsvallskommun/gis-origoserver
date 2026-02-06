const conf = require('../../../../../conf/config');
const pg = require('pg');
const { Client } = pg
const simpleStorage = require('../../../simpleStorage');
const axios = require('axios').default;

const service = 'apiGeometryQuery';
const configOptions = Object.assign({}, conf[service]);

async function lookupDistrict(req, res, easting, northing, srid) {
    let responseObj = {};
   
    const client = new Client({
        user: configOptions.services.district.dbUser,
        password: configOptions.services.district.dbPassword,
        host: configOptions.services.district.dbHostname,
        port: configOptions.services.district.dbPort,
        database: configOptions.services.district.dbName,
    });
    try {
      await client.connect();
    } catch(err) {
      res.status(500).send({error: 'Failed to connect to database!'});
    }    
    try {
      const res = await client.query(`SELECT distriktsnamn, distriktskod, objektidentitet
        FROM public."SLM_Distrikt_yta"
        WHERE ST_Contains(geom, ST_SetSRID(ST_Point(${easting}, ${northing}), ${srid}));`);
      if (res.rowCount === 1) {
        responseObj = { 
            distriktsnamn: res.rows[0].distriktsnamn, 
            distriktskod: `${res.rows[0].distriktskod}`, 
            objektidentitet: res.rows[0].objektidentitet 
        };
      }
    } catch(err) {
      res.status(500).send({error: 'Failed to query database!'});
    }    
    
    await client.end();

    res.status(200).json(responseObj);
}

async function lookupRegisterenhet(req, res, uuid) {
    configOptions.scope = configOptions.scope_register;
    configOptions.type = 'register';
    var token = await simpleStorage.getToken(configOptions);
    Promise.all([axios({
      method: 'GET',
      url: encodeURI(configOptions.url_register + '/tillhor/' + uuid),
      headers: {
        'Authorization': 'Bearer ' + token,
        'content-type': 'application/json',
        'scope': `${configOptions.scope}`
        }
    })]).then(([reqBeteckning]) => {
        if (reqBeteckning.data?.features.length > 0) {
            const coords = reqBeteckning.data.features[0].properties?.registerenhetsreferens?.registerenhetsomrade?.[0].centralpunktskoordinat?.coordinates;
            if (typeof coords !== 'undefined') {
                lookupDistrict(req, res, coords[0], coords[1], 3006);               
            } else {
                res.status(200).json({ distriktsnamn: '', distriktskod: '', objektidentitet: '' });
            }
        }
    });
}

module.exports = {
  get: function (req, res, next) {
    let validationError = false;
    const uuidRegEx = /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/i;

    if (conf && conf.apiGeometryQuery && conf.apiGeometryQuery.services && conf.apiGeometryQuery.services['district']) {
        let found = req.params.uuid.match(uuidRegEx);
        if (found === null) {
            validationError = true;
            res.status(400).send({
            status: 400,
            errors: [
                {
                path: 'uuid',
                errorCode: 'type.openapi.requestValidation',
                message: 'must be a uuid',
                location: 'path'
                }
            ]
            });
        }
        if (!validationError) {
            lookupRegisterenhet(req, res, req.params.uuid);
        }
    } else {
      validationError = true;
      res.status(400).send({error: 'Error in configuration!'});
    }
  },
};
  
module.exports.get.apiDoc = {
  description: 'Is the supplyed registerenhet within the district.',
  operationId: 'isWithinByRegisterenhet',
  parameters: [
    {
      in: 'path',
      name: 'uuid',
      required: true,
      pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
      type: 'string'
    }
  ],
  tags: [
    'district'
  ],
  responses: {
    200: {
      description: 'Responds with a object of the district for this registerenhet',
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
  