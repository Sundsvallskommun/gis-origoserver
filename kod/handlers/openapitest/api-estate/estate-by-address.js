const conf = require('../../../conf/config');
const url = require('url');
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstateTest';
const regex = /^[a-zA-ZäöåÄÖÅ0-9, ]+$/;

async function doGet(req, res, address) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.scope = configOptions.scope_address;
  configOptions.type = 'address';
  const responseArray = []
  
  var token = await simpleStorage.getToken(configOptions);

  if (address !== '') {
    Promise.all([axios({
      method: 'GET',
      url: encodeURI(configOptions.url_address + '/referens/fritext?adress=' + address + '&kommunkod=2281' + '&status=' + statusDesignation + '&maxHits=' + maxHits),
      headers: {
        'Authorization': 'Bearer ' + token,
        'content-type': 'application/json',
        'scope': `${configOptions.scope}`
       }
    })]).then(([req1]) => {
      const adressIdArr = [];
      if (req1.data.length > 0) {
        req1.data.forEach(element => {
          //responseArray.push({ address: element.adress, objectidentifier: element.objektidentitet });
          adressIdArr.push(element.objektidentitet);
        });
        Promise.all([axios({
          method: 'POST',
          url: encodeURI(configOptions.url_address + '/?includeData=total'),
          headers: {
            'Authorization': 'Bearer ' + token,
            'content-type': 'application/json',
            'scope': `${configOptions.scope}`
           },
           data: adressIdArr
        })]).then(([reqPost]) => {
          reqPost.data.features.forEach(element => {
            const addressObj = concatAddress(element);
            responseArray.push({ 
              address: addressObj.adress, 
              designation: addressObj.registerenhetsreferensBeteckning, 
              objectidentifier: element.properties.registerenhetsreferens.objektidentitet
            });
          });
          res.status(200).json(responseArray);
        });    
      } else {
        res.status(200).json(responseArray);
      }
    });
 } else {
      res.status(400).json({error: 'Missing required address'});
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
      const parsedUrl = url.parse(decodeURI(req.url), true);
      let address = '';
      if ('status' in parsedUrl.query) {
        statusDesignation = parsedUrl.query.status;
      } else {
        statusDesignation = 'Gällande';
      }
      if ('maxHits' in parsedUrl.query) {
        maxHits = parsedUrl.query.maxHits;
      } else {
        maxHits = '100';
      }
      if ('address' in parsedUrl.query) {
        if (parsedUrl.query.address.match(regex) !== null) {
          address = parsedUrl.query.address;         
        } else {
          res.status(400).json({error: 'Invalid in parameter address'});
        }
      } else {
        res.status(400).json({error: 'Missing required parameter address'});
      }
      if (address.length > 0) {
        doGet(req, res, address, statusDesignation, maxHits);
      }
    },
  };
  
  module.exports.get.apiDoc = {
    description: 'Get information about estate by searching on address.',
    operationId: 'getEstateIdByAddress',
    parameters: [
        {
          in: 'query',
          name: 'address',
          required: true,
          type: 'string',
          description: 'An address to search for  (starts with).'
        },
        {
          in: 'query',
          name: 'maxHits',
          required: false,
          type: 'integer',
          description: 'The maximal number of hits returned. Defaults to 100'
        },
        {
          in: 'query',
          name: 'status',
          required: false,
          type: 'string',
          description: 'The status of the address. Defaults to "Gällande"'
        }
      ],
    responses: {
      200: {
        description: 'Responds with a list of addresses and their unique estate identifier',
        schema: {
            type: 'array',
            items: {
              $ref: '#/definitions/EstateSearchResponse'
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
  