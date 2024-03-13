const conf = require('../../../conf/config');
const url = require('url');
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstate';

async function doGet(req, res, objectidentifier) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.scope = configOptions.scope_owner;
  configOptions.type = 'owner';
  const responseObj = {}
  
  var tokenOwner = await simpleStorage.getToken(configOptions);
  configOptions.scope = configOptions.scope_estate;
  configOptions.type = 'estate';
  var tokenEstate = await simpleStorage.getToken(configOptions);
 
  const checkUuidRegEx = /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/i;
  let found = objectidentifier.match(checkUuidRegEx);
  if (found !== null) {
    if (objectidentifier !== '') {
        Promise.all([axios({
          method: 'GET',
          url: encodeURI(configOptions.url_owner + '/beror/' + objectidentifier + '?includeData=total'),
          headers: {
            'Authorization': 'Bearer ' + tokenOwner,
            'content-type': 'application/json',
            'scope': `${configOptions.scope_owner}`
            }
        }),axios({
          method: 'GET',
          url: encodeURI(configOptions.url_estate + '/' + objectidentifier + '?includeData=total'),
          headers: {
            'Authorization': 'Bearer ' + tokenEstate,
            'content-type': 'application/json',
            'scope': `${configOptions.scope_estate}`
            }
        })]).then(([reqOwner,reqEstate]) => {
          if (reqOwner.data.features.length > 0) {
            responseObj.designation = reqOwner.data.features[0].properties.fastighetsreferens.beteckning;
            responseObj.objectidentifier = reqOwner.data.features[0].properties.fastighetsreferens.objektidentitet;
            responseObj.totalArea = reqEstate.data.features[0].properties.fastighetsattribut.totalareal;
            responseObj.totalAreaWater = reqEstate.data.features[0].properties.fastighetsattribut.totalVattenareal;
            responseObj.totalAreaLand = reqEstate.data.features[0].properties.fastighetsattribut.totalLandareal;
            const ownershipArr = [];
            if ('agande' in reqOwner.data.features[0].properties) {
              reqOwner.data.features[0].properties.agande.forEach(lagfart => {
                let ownernName = '';
                if ('fornamn' in lagfart.agare) {
                  ownernName = lagfart.agare.fornamn + ' ';
                }
                if ('efternamn' in lagfart.agare) {
                  ownernName = ownernName + lagfart.agare.efternamn;
                }
                if ('organisationsnamn' in lagfart.agare) {
                  ownernName = lagfart.agare.organisationsnamn;
                }
                ownershipArr.push({
                  type: lagfart.typ,
                  objectidentifier: lagfart.objektidentitet,
                  enrollmentDay: lagfart.inskrivningsdag,
                  decision: lagfart.beslut,
                  share: lagfart.beviljadAndel.taljare + '/' + lagfart.beviljadAndel.namnare,
                  diaryNumber: lagfart.dagboksnummer,
                  versionValidFrom: lagfart.versionGiltigFran,
                  owner: {
                    idnumber: lagfart.agare.idnummer,
                    name: ownernName
                  }
                })
              });
            }
            const previousOwnershipArr = [];
            if ('tidigareAgande' in reqOwner.data.features[0].properties) {
              reqOwner.data.features[0].properties.tidigareAgande.forEach(lagfart => {
                let ownernName = '';
                if ('fornamn' in lagfart.agare) {
                  ownernName = lagfart.agare.fornamn + ' ';
                }
                if ('efternamn' in lagfart.agare) {
                  ownernName = ownernName + lagfart.agare.efternamn;
                }
                if ('organisationsnamn' in lagfart.agare) {
                  ownernName = lagfart.agare.organisationsnamn;
                }
                previousOwnershipArr.push({
                  type: lagfart.typ,
                  objectidentifier: lagfart.objektidentitet,
                  enrollmentDay: lagfart.inskrivningsdag,
                  decision: lagfart.beslut,
                  share: lagfart.beviljadAndel.taljare + '/' + lagfart.beviljadAndel.namnare,
                  diaryNumber: lagfart.dagboksnummer,
                  versionValidFrom: lagfart.versionGiltigFran,
                  owner: {
                    idnumber: lagfart.agare.idnummer,
                    name: ownernName
                  }
                })
              });
            }
            const ownerChangesArr = [];
            if ('fastighetsagandeforandring' in reqOwner.data.features[0].properties) {
              reqOwner.data.features[0].properties.fastighetsagandeforandring.forEach(change => {
                const acquisitionArr = [];
                if ('fang' in change) {
                  change.fang.forEach(acquisition => {
                    acquisitionArr.push({
                      objectidentifier: acquisition.objektidentitet,
                      enrollmentDay: acquisition.inskrivningsdag,
                      fileNumber: acquisition.aktnummer,
                      decision: acquisition.beslut,
                      share: acquisition.andelFang.taljare + '/' + acquisition.andelFang.namnare,
                      acquisitionDay: acquisition.fangesdag,
                      acquisitionType: acquisition.fangesart,
                      acquisitionCode: acquisition.fangeskod,
                      registeredOwnership: acquisition.inskrivetAgande
                    })
                  });
                }
                let purchasePrice = {};
                if ('kopeskilling' in change) {                  
                  purchasePrice = {
                    objectidentifier: change.kopeskilling.objektidentitet,
                    purchasePriceImmovableProperty: { 
                      currency: change.kopeskilling.kopeskillingFastEgendom.valuta,
                      sum: change.kopeskilling.kopeskillingFastEgendom.summa
                    },
                    purchasePriceType: change.kopeskilling.kopeskillingstyp
                  };
                }
                const transferArr = [];
                if ('overlatelse' in change) {
                  change.overlatelse.forEach(transfer => {
                    transferArr.push({
                      objectidentifier: transfer.objektidentitet,
                      share: transfer.andelOverlatelse.taljare + '/' + transfer.andelOverlatelse.namnare,
                      registeredOwnership: transfer.inskrivetAgande
                    })
                  });
                }               
               ownerChangesArr.push({
                  objectidentifier: change.objektidentitet,
                  acquisition: acquisitionArr,
                  purchasePrice: purchasePrice,
                  transfer: transferArr
                })
              });
              responseObj.ownerChanges = ownerChangesArr;
            }
            const estateActionsArr = [];
            if ('fastighetsatgard' in reqEstate.data.features[0].properties) {
              reqEstate.data.features[0].properties.fastighetsatgard.forEach(action => {
                estateActionsArr.push({
                  actionType1: action.atgardstyp1,
                  actionType2: action.atgardstyp2 ? action.atgardstyp2 : '',
                  fileDesignation: action.aktbeteckning,
                  actionDate: action.atgardsdatum,
                  objectidentifier: action.objektidentitet,
                  littera: action.littera ? action.littera : '',
                  runningNumber: action.lopnummer
                })
              });
            }
            responseObj.ownership = ownershipArr;
            responseObj.previousOwnership = previousOwnershipArr;
            responseObj.actions = estateActionsArr;
            res.status(200).json(responseObj);
          } else {
            res.status(400).json({error: 'Not found'});
          }
        });
      } else {
        res.status(400).json({error: 'Missing required parameter objectidentifier'});
      }
    } else {
      res.status(400).json({error: 'Malformed objectidentifier'});
    }
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let objectidentifier = '';
    if ('objectidentifier' in parsedUrl.query) {
      objectidentifier = parsedUrl.query.objectidentifier;
    } else {
      res.status(400).json({error: 'Missing required parameter objectidentifier'});
    }
    doGet(req, res, objectidentifier);
  },
};

module.exports.get.apiDoc = {
  description: 'Get information about estate.',
  operationId: 'getEstateData',
  parameters: [
    {
      in: 'query',
      name: 'objectidentifier',
      required: true,
      type: 'string'
    }
  ],
  responses: {
    200: {
      description: 'Responds with the title deeds and owner',
      schema: {
          type: 'array',
          items: {
            $ref: '#/definitions/EstateData'
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
  