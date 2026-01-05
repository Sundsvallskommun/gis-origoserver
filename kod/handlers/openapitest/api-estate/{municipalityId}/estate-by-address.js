const conf = require('../../../../conf/config');
const { URL } = require('url'); 
const simpleStorage = require('../../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstateTest';
const regex = /^[a-zA-ZäöåÄÖÅ0-9, ]+$/;
const regexNumbers = /^[0-9]+$/;

async function doGet(req, res, address, municipalityId, statusAddress, maxHits) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.scope = configOptions.scope_address;
  configOptions.type = 'address';
  const responseArray = []
  var token = await simpleStorage.getToken(configOptions);

  if (address !== '') {
    Promise.all([axios({
      method: 'GET',
      url: encodeURI(configOptions.url_address + '/referens/fritext?adress=' + address + '&kommunkod=' + municipalityId + '&status=' + statusAddress + '&maxHits=' + maxHits),
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
              objectidentifier: element.properties.registerenhetsreferens.objektidentitet,
              districtname: addressObj.distriktsnamn,
              districtcode: addressObj.distriktskod
            });
          });
          responseArray.sort((a,b) => (a.address > b.address) ? 1 : ((b.address > a.address) ? -1 : 0));
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
  let faststalltNamn = "";
  if ('id' in feature) {
    adress['objektidentitet'] = feature.properties.objektidentitet;
    if ('adressomrade' in feature.properties) {
      adress['kommun'] = feature.properties.adressomrade.kommundel.kommun;
      faststalltNamn = feature.properties.adressomrade.faststalltNamn;
    }
    if ('gardsadressomrade' in feature.properties) {
      adress['kommun'] = feature.properties.gardsadressomrade.adressomrade.kommundel.kommun;
      faststalltNamn = feature.properties.gardsadressomrade.adressomrade.faststalltNamn + ' ' + feature.properties.gardsadressomrade.faststalltNamn;
    }
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
    if ('distrikttillhorighet' in feature.properties) {
      adress['distriktsnamn'] = feature.properties.distrikttillhorighet.distriktsnamn;
      adress['distriktskod'] = feature.properties.distrikttillhorighet.distriktskod;
    }
  }
  return adress;
}

module.exports = {
    get: function (req, res, next) {
    const fullUrl = req.protocol + '://' + req.get('host') + req.url;
    const parsedUrl = new URL(fullUrl);
    const params = parsedUrl.searchParams;
    const municipalityId = req.params.municipalityId ? req.params.municipalityId : 2281;
    let address = '';
    let statusAddress = 'Gällande';
    let maxHits = '100';
    if (params.has('status')) {
      statusAddress = params.get('status');
    } else {
      statusAddress = 'Gällande';
    }
    if (params.has('maxHits')) {
      if (params.get('maxHits').match(regexNumbers) !== null) {
        maxHits = params.get('maxHits');
      } else {
        maxHits = '100';
      }     
    }
    if (params.has('address')) {
      if (params.get('address').match(regex) !== null) {
        address = params.get('address');     
      } else {
        res.status(400).json({error: 'Invalid in parameter address'});
      }
    } else {
      res.status(400).json({error: 'Missing required parameter address'});
    }
    if (address.length > 0) {
      doGet(req, res, address, municipalityId, statusAddress, maxHits);
    } else {
      res.status(200).json({});
    }
  },
};
  
  module.exports.get.apiDoc = {
    description: 'Get information about estate by searching on address.',
    operationId: 'getEstateIdByAddress',
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
        name: 'address',
        required: true,
        type: 'string',
        description: 'An address to search for  (starts with).'
      },
      {
        in: 'query',
        name: 'maxHits',
        required: false,
        type: 'string',
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
    tags: [
      'adresser'
    ],
    responses: {
      200: {
        description: 'Responds with a list of addresses and their unique estate identifier',
        schema: {
            type: 'array',
            items: {
              $ref: '#/definitions/EstateAddressResponse'
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
  