const conf = require('../../../conf/config');
const url = require('url');
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstate';

async function doGet(req, res, designation, statusDesignation, maxHits) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.scope = configOptions.scope_register;
  configOptions.type = 'register';
  const responseArray = []
  
  var token = await simpleStorage.getToken(configOptions);
  
  if (designation !== '') {
    Promise.all([axios({
      method: 'GET',
      url: encodeURI(configOptions.url_register + '/referens/fritext?beteckning=' + designation + '&kommunkod=2281' + '&status=' + statusDesignation + '&maxHits=' + maxHits),
      headers: {
        'Authorization': 'Bearer ' + token,
        'content-type': 'application/json',
        'scope': `${configOptions.scope}`
        }
    })]).then(([req1]) => {
      req1.data.forEach(element => {
        responseArray.push({ designation: element.beteckning, objectidentifier: element.registerenhet });
      });
      res.status(200).json(responseArray);
    });
  } else {
    res.status(400).json({error: 'Missing required parameter designation'});
  }
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let designation = '';
    if ('status' in parsedUrl.query) {
      statusDesignation = parsedUrl.query.status;
    } else {
      statusDesignation = 'gällande';
    }
    if ('maxHits' in parsedUrl.query) {
      maxHits = parsedUrl.query.maxHits;
    } else {
      maxHits = '100';
    }
    if ('designation' in parsedUrl.query) {
      designation = parsedUrl.query.designation;
    } else {
      res.status(400).json({error: 'Missing required parameter designation'});
    }
    doGet(req, res, designation, statusDesignation, maxHits);
  },
};
  
module.exports.get.apiDoc = {
  description: 'Get information about estate.',
  operationId: 'getEstateIdByDesignation',
  parameters: [
      {
        in: 'query',
        name: 'designation',
        required: true,
        type: 'string'
      }
  ],
  responses: {
    200: {
      description: 'Responds with a list of designations and their unique identifier',
      schema: {
          type: 'array',
          items: {
            $ref: '#/definitions/EstateDesignationId'
          }
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
  