const conf = require('../../../conf/config');
const url = require('url');
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiAssociationTest';
const regex = /^[a-zA-ZäöåÄÖÅ0-9, ]+$/;

/**
 * Interact with the external API and pick out the parts that is desired.
 * 
 * @async
 * @function
 * @name doGet
 * @kind function
 * @param {any} req
 * @param {any} res
 * @param {any} municipalityCode
 * @param {any} statusCode
 * @param {any} maxHits
 * @param {any} format
 * @returns {Promise<void>}
 */
async function doGet(req, res, municipalityCode, statusCode, maxHits, format) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.scope = configOptions.scope_samfallighetsforening;
  configOptions.type = 'address';
  const responseArray = []
  var token = await simpleStorage.getToken(configOptions);

  if (municipalityCode !== '') {
    Promise.all([axios({
      method: 'GET',
      url: encodeURI(configOptions.url_samfallighetsforening + '/referens/filter?kommunkodForvaltningsobjekt=' + municipalityCode + '&andamal=Vägar' + '&status=' + statusCode + '&maxHits=' + maxHits),
      headers: {
        'Authorization': 'Bearer ' + token,
        'content-type': 'application/json',
        'scope': `${configOptions.scope_samfallighetsforening}`
       }
    })]).then(([req1]) => {
      const associationIdArr = [];
      if (req1.data.length > 0) {
        req1.data.forEach(element => {
          //responseArray.push({ address: element.adress, objectidentifier: element.objektidentitet });
          associationIdArr.push(element.objektidentitet);
        });
        if (associationIdArr < 250) {
          Promise.all([axios({
            method: 'POST',
            url: encodeURI(configOptions.url_samfallighetsforening + '/?includeData=basinformation'),
            headers: {
              'Authorization': 'Bearer ' + token,
              'content-type': 'application/json',
              'scope': `${configOptions.scope_samfallighetsforening}`
             },
             data: associationIdArr
          })]).then(([reqPost]) => {
            reqPost.data.features.forEach(element => {
              const associationObj = concatAssociation(element);
              responseArray.push({ 
                name: associationObj.foreningensForetagsnamn, 
                type: associationObj.foreningstyp, 
                objectidentifier: associationObj.objektidentitet, 
                status: associationObj.status, 
                coAdress: associationObj.coAdress, 
                utdelningsadress1: associationObj.utdelningsadress1, 
                postnummer: associationObj.postnummer, 
                postort: associationObj.postort, 
                organisationsnummer: associationObj.organisationsnummer, 
                registreringsdatum: associationObj.registreringsdatum, 
                senasteAndringSFR: associationObj.senasteAndringSFR, 
                sate: associationObj.sate, 
                foreningsstamma: associationObj.foreningsstamma, 
                statsbidragsnummer: associationObj.statsbidragsnummer
              });
            });
            responseArray.sort((a,b) => (a.address > b.address) ? 1 : ((b.address > a.address) ? -1 : 0));
            sendResult(responseArray, format, res);
          });    
        } else {
          // More then 250 hits
          const associationIdArrFirst250 = associationIdArr.slice(0, 250);
          const associationIdArrSecond250 = associationIdArr.slice(250, 500);
          Promise.all([axios({
            method: 'POST',
            url: encodeURI(configOptions.url_samfallighetsforening + '/?includeData=basinformation'),
            headers: {
              'Authorization': 'Bearer ' + token,
              'content-type': 'application/json',
              'scope': `${configOptions.scope_samfallighetsforening}`
             },
             data: associationIdArrFirst250
          }),
          axios({
            method: 'POST',
            url: encodeURI(configOptions.url_samfallighetsforening + '/?includeData=basinformation'),
            headers: {
              'Authorization': 'Bearer ' + token,
              'content-type': 'application/json',
              'scope': `${configOptions.scope_samfallighetsforening}`
             },
             data: associationIdArrSecond250
          })]).then(([reqPost,reqPost2]) => {
            reqPost.data.features.forEach(element => {
              const associationObj = concatAssociation(element);
              responseArray.push({ 
                name: associationObj.foreningensForetagsnamn, 
                type: associationObj.foreningstyp, 
                objectidentifier: associationObj.objektidentitet, 
                status: associationObj.status, 
                coAdress: associationObj.coAdress, 
                utdelningsadress1: associationObj.utdelningsadress1, 
                postnummer: associationObj.postnummer, 
                postort: associationObj.postort, 
                organisationsnummer: associationObj.organisationsnummer, 
                registreringsdatum: associationObj.registreringsdatum, 
                senasteAndringSFR: associationObj.senasteAndringSFR, 
                sate: associationObj.sate, 
                foreningsstamma: associationObj.foreningsstamma, 
                statsbidragsnummer: associationObj.statsbidragsnummer
              });
            });
            reqPost2.data.features.forEach(element => {
              const associationObj = concatAssociation(element);
              responseArray.push({ 
                name: associationObj.foreningensForetagsnamn, 
                type: associationObj.foreningstyp, 
                objectidentifier: associationObj.objektidentitet, 
                status: associationObj.status, 
                coAdress: associationObj.coAdress, 
                utdelningsadress1: associationObj.utdelningsadress1, 
                postnummer: associationObj.postnummer, 
                postort: associationObj.postort, 
                organisationsnummer: associationObj.organisationsnummer, 
                registreringsdatum: associationObj.registreringsdatum, 
                senasteAndringSFR: associationObj.senasteAndringSFR, 
                sate: associationObj.sate, 
                foreningsstamma: associationObj.foreningsstamma, 
                statsbidragsnummer: associationObj.statsbidragsnummer
              });
            });
            sendResult(responseArray, format, res);
          });    
        }
      } else {
        sendResult(responseArray, format, res);
      }
    });
 } else {
      res.status(400).json({error: 'Missing required address'});
  }
}

/**
 * Converts a json object array to CSV format with first row containing the keys as fieldnames.
 * 
 * @function
 * @name jsonToCsv
 * @kind function
 * @param {any} objArray
 * @returns {any}
 */
function jsonToCsv(objArray) {
  var fields = Object.keys(objArray[0]);
  var replacer = function(key, value) { return value === null ? '' : value } 
  var csv = objArray.map(function(row){
    return fields.map(function(fieldName){
      return JSON.stringify(row[fieldName], replacer)
  }).join(',')
  })
  csv.unshift(fields.join(',')); // add header column
  csv = csv.join('\r\n');
  return csv;
}

/**
 * Sends the results as json or csv depending on selected format, defaults to json.
 * 
 * @function
 * @name sendResult
 * @kind function
 * @param {any} objArray
 * @param {any} format
 * @param {any} res
 * @returns {void}
 */
function sendResult(objArray, format, res) {
  if (format === 'csv') {
    const csvText = jsonToCsv(objArray);
   res.status(200).set('text/csv').send(csvText);
   } else {
    res.status(200).json(objArray);
   }
}

/**
 * Returns only the desired attributes of the feature response.
 * 
 * @function
 * @name concatAssociation
 * @kind function
 * @param {any} feature
 * @returns {{ objektidentitet: any; foreningstyp: any; foreningensForetagsnamn: any; status: any; coAdress: any; utdelningsadress1: any; postnummer: any; postort: any; organisationsnummer: any; ... 4 more ...; statsbidragsnummer: any; }}
 */
function concatAssociation(feature) {
  let association = {};

  if ('id' in feature) {
    association['objektidentitet'] = feature.properties.objektidentitet;
    association['foreningstyp'] = feature.properties.samfallighetsforeningsattribut.foreningstyp;
    association['foreningensForetagsnamn'] = feature.properties.samfallighetsforeningsattribut.foreningensForetagsnamn;
    association['status'] = feature.properties.samfallighetsforeningsattribut.status;
    association['coAdress'] = feature.properties.samfallighetsforeningsattribut.coAdress;
    association['utdelningsadress1'] = feature.properties.samfallighetsforeningsattribut.utdelningsadress1;
    association['postnummer'] = feature.properties.samfallighetsforeningsattribut.postnummer;
    association['postort'] = feature.properties.samfallighetsforeningsattribut.postort;
    association['organisationsnummer'] = feature.properties.samfallighetsforeningsattribut.organisationsnummer;
    association['registreringsdatum'] = feature.properties.samfallighetsforeningsattribut.registreringsdatum;
    association['senasteAndringSFR'] = feature.properties.samfallighetsforeningsattribut.senasteAndringSFR;
    association['sate'] = feature.properties.samfallighetsforeningsattribut.sate;
    association['foreningsstamma'] = feature.properties.samfallighetsforeningsattribut.foreningsstamma;
    association['statsbidragsnummer'] = feature.properties.samfallighetsforeningsattribut.statsbidragsnummer;
   }
  return association;
}

module.exports = {
    get: function (req, res, next) {
      const parsedUrl = url.parse(decodeURI(req.url), true);
      let municipalityCode = '';
      let statusCode = '';
      let maxHits = '';
      let format = 'json';
      if ('status' in parsedUrl.query) {
        statusCode = parsedUrl.query.status;
      } else {
        statusCode = 'Gällande';
      }
      if ('maxHits' in parsedUrl.query) {
        maxHits = parsedUrl.query.maxHits;
      } else {
        maxHits = '250';
      }
      if ('format' in parsedUrl.query) {
        format = parsedUrl.query.format;
      } else {
        format = 'json';
      }
      if ('municipalityCode' in parsedUrl.query) {
        if (parsedUrl.query.municipalityCode.match(regex) !== null) {
          municipalityCode = parsedUrl.query.municipalityCode;         
        } else {
          res.status(400).json({error: 'Invalid in parameter municipalityCode'});
        }
      } else {
        res.status(400).json({error: 'Missing required parameter municipalityCode'});
      }
      if (municipalityCode.length > 0) {
        doGet(req, res, municipalityCode, statusCode, maxHits, format);
      }
    },
  };
  
  module.exports.get.apiDoc = {
    description: 'Get information about associations by searching on municipalities.',
    operationId: 'getAssociations',
    parameters: [
        {
          in: 'query',
          name: 'municipalityCode',
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
          description: 'The status of the association. Defaults to "Gällande"'
        },
        {
          in: 'query',
          name: 'format',
          required: false,
          type: 'string',
          description: 'The output format json or csv. Defaults to "json"'
        }
      ],
    responses: {
      200: {
        description: 'Responds with a list of associations and the data about them',
        schema: {
            type: 'array',
            items: {
              $ref: '#/definitions/AssociationResponse'
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
  