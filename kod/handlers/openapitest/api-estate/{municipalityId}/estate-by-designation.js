const conf = require('../../../../conf/config');
const { URL } = require('url'); 
const simpleStorage = require('../../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstateTest';
const regex = /^[a-zA-ZäöåÄÖÅ0-9:,\- ]+$/;
const regexNumbers = /^[0-9]+$/;

async function doGet(req, res, designation, municipalityId, statusDesignation, maxHits) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.scope = configOptions.scope_register;
  configOptions.type = 'register';
  const responseArray = []
  
  var token = await simpleStorage.getToken(configOptions);
  configOptions.scope = configOptions.scope_address;
  configOptions.type = 'address';
  var tokenAdress = await simpleStorage.getToken(configOptions);
 
  if (designation !== '') {
    Promise.all([axios({
      method: 'GET',
      url: encodeURI(configOptions.url_register + '/referens/fritext?beteckning=' + designation + '&kommunkod=' + municipalityId + '&status=' + statusDesignation + '&maxHits=' + maxHits),
      headers: {
        'Authorization': 'Bearer ' + token,
        'content-type': 'application/json',
        'scope': `${configOptions.scope}`
        }
    })]).then(([req1]) => {
      const registerenhetIdArr = [];
      if (req1.data.length > 0) {
        req1.data.forEach(element => {
          responseArray.push({ designation: element.beteckning, objectidentifier: element.registerenhet });
        });
        responseArray.sort((a,b) => (a.designation > b.designation) ? 1 : ((b.designation > a.designation) ? -1 : 0));
        res.status(200).json(responseArray);  
        /* req1.data.forEach(element => {
          if (typeof element.registerenhet !== 'undefined') {
            registerenhetIdArr.push(element.registerenhet);
          }          
        });
        console.log('After push' + new Date().toISOString());
        Promise.all([axios({
          method: 'POST',
          url: encodeURI(configOptions.url_address + '/registerenhet?includeData=total'),
          headers: {
            'Authorization': 'Bearer ' + tokenAdress,
            'content-type': 'application/json',
            'scope': `${configOptions.scope_address}`
           },
           data: registerenhetIdArr
        })]).then(([reqPost]) => {
          console.log('After registerenhet' + new Date().toISOString());
          reqPost.data.features.forEach(element => {
            const addressObj = concatAddress(element);
            responseArray.push({ 
              address: addressObj.adress, 
              designation: addressObj.registerenhetsreferensBeteckning, 
              objectidentifier: element.properties.registerenhetsreferens.objektidentitet
            });
          });
          responseArray.sort((a,b) => (a.designation > b.designation) ? 1 : ((b.designation > a.designation) ? -1 : 0));
          res.status(200).json(responseArray);
        });    */
      } else {
        res.status(200).json(responseArray);
      }
    });
  } else {
    res.status(400).json({error: 'Missing required parameter designation'});
  }
}

function concatAddress(feature) {
  let adress = {};

  if ('id' in feature) {
    adress['objektidentitet'] = feature.properties.objektidentitet;
    adress['kommun'] = feature.properties.adressomrade.kommundel.kommun;
    const faststalltNamn = feature.properties.adressomrade.faststalltNamn;
    const adressplatsnummer = feature.properties.adressplatsattribut.adressplatsbeteckning.adressplatsnummer || '';
    const bokstavstillagg = feature.properties.adressplatsattribut.adressplatsbeteckning.bokstavstillagg || '';
    let popularnamn = '';
    if ('adressplatsnamn' in feature.properties) {
      if ('popularnamn' in feature.properties.adressplatsnamn) {
        popularnamn = feature.properties.adressplatsnamn.popularnamn;
      }
    }
    adress['adress'] = faststalltNamn + ' ' + adressplatsnummer + bokstavstillagg + ', ' + feature.properties.adressplatsattribut.postort;
    adress['popularnamn'] = popularnamn;
    adress['faststalltNamn'] = faststalltNamn;
    adress['adressplatsnummer'] = adressplatsnummer;
    adress['bokstavstillagg'] = bokstavstillagg;
    adress['postnummer'] = feature.properties.adressplatsattribut.postnummer;
    adress['postort'] = feature.properties.adressplatsattribut.postort;
    adress['adressplatspunkt'] = feature.properties.adressplatsattribut.adressplatspunkt;
    adress['registerenhetsreferensBeteckning'] = feature.properties.registerenhetsreferens.beteckning;
    adress['registerenhetsreferensObjektidentitet'] = feature.properties.registerenhetsreferens.objektidentitet;
  }
  return adress;
}

module.exports = {
  get: function (req, res, next) {
    const fullUrl = req.protocol + '://' + req.get('host') + req.url;
    const parsedUrl = new URL(fullUrl);
    const params = parsedUrl.searchParams;
    let = validationError = false;
    if(String(req.params.municipalityId).length !== 4) {
      validationError = true;
      res.status(400).json({
        status: 400,
        errors: [
          {
            path: 'municipalityId',
            errorCode: 'type.openapi.requestValidation',
            message: 'must be a 4-digit number',
            location: 'path'
          }
        ]
      });
    }
    const municipalityId = req.params.municipalityId ? req.params.municipalityId : 2281;
    let designation = '';
    let statusDesignation = 'gällande';
    if (params.has('status')) {
      statusDesignation = params.get('status');
    } else {
      statusDesignation = 'gällande';
    }
    if (params.has('maxHits')) {
      if (params.get('maxHits').match(regexNumbers) !== null) {
        maxHits = params.get('maxHits');
      } else {
        maxHits = '100';
      }     
    } else {
      maxHits = '100';
    }
    if (params.has('designation')) {
      if (params.get('designation').match(regex) !== null) {
        designation = params.get('designation');     
      } else {
        validationError = true;
        res.status(400).json({error: 'Invalid in parameter designation'});
      }    
    } else {
      validationError = true;
      res.status(400).json({error: 'Missing required parameter designation'});
    }
    if (designation.length > 0 && !validationError) {
      doGet(req, res, designation, municipalityId, statusDesignation, maxHits);
    }    
  },
};
  
module.exports.get.apiDoc = {
  description: 'Get information about estate.',
  operationId: 'getEstateIdByDesignation',
  parameters: [
    {
      in: 'path',
      name: 'municipalityId',
      required: true,
      pattern: '[0-2]{1}[0-9]{3}',
      type: 'string'
    },
    {
      in: 'query',
      name: 'designation',
      required: true,
      type: 'string',
      description: 'An designation to search for (starts with).'
    },
    {
      in: 'query',
      name: 'maxHits',
      required: false,
      type: 'string',
      description: 'The maximal number of hits returned. Defaults to 100.'
    },
    {
      in: 'query',
      name: 'status',
      required: false,
      type: 'string',
      description: 'The status of the estate. Defaults to "gällande".'
    }
  ],
  tags: [
    'fastigheter'
  ],
  responses: {
    200: {
      description: 'Responds with a list of designations and their unique identifier',
      schema: {
          type: 'array',
          items: {
            $ref: '#/definitions/EstateDesignationResponse'
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
  