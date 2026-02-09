const conf = require('../../../conf/config');
const { URL } = require('url'); 
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstate';

async function doGet(req, res, objectidentifier) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.type = 'owner';
  const responseObj = {}
  
  var tokenOwner = await simpleStorage.getToken(configOptions);
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
            'scope': `${configOptions.scope}`
            }
        }),axios({
          method: 'GET',
          url: encodeURI(configOptions.url_estate + '/' + objectidentifier + '?includeData=total'),
          headers: {
            'Authorization': 'Bearer ' + tokenEstate,
            'content-type': 'application/json',
            'scope': `${configOptions.scope}`
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
                let versionValidFrom = '';
                let enrollmentDay = '';
                let address = '';
                let postalCode = '';
                let city = '';
                let coAddress = '';
                if ('fornamn' in lagfart.agare) {
                  ownernName = lagfart.agare.fornamn + ' ';
                }
                if ('efternamn' in lagfart.agare) {
                  ownernName = ownernName + lagfart.agare.efternamn;
                }
                if ('organisationsnamn' in lagfart.agare) {
                  ownernName = lagfart.agare.organisationsnamn;
                }
                if ('person' in lagfart.agare) {
                  if ('adress' in lagfart.agare.person) {
                    if ('coAdress' in lagfart.agare.person.adress) {
                      coAddress = lagfart.agare.person.adress.coAdress;
                    }
                    if ('utdelningsadress2' in lagfart.agare.person.adress) {
                      address = lagfart.agare.person.adress.utdelningsadress2;
                    }
                    if ('postnummer' in lagfart.agare.person.adress) {
                      postalCode = lagfart.agare.person.adress.postnummer;
                    }
                    if ('postort' in lagfart.agare.person.adress) {
                      city = lagfart.agare.person.adress.postort;
                    }
                  }
                }
                if ('organisation' in lagfart.agare) {
                  if ('adress' in lagfart.agare.organisation) {
                    if ('coAdress' in lagfart.agare.organisation.adress) {
                      coAddress = lagfart.agare.organisation.adress.coAdress;
                    }
                    if ('utdelningsadress2' in lagfart.agare.organisation.adress) {
                      address = lagfart.agare.organisation.adress.utdelningsadress2;
                    }
                    if ('postnummer' in lagfart.agare.organisation.adress) {
                      postalCode = lagfart.agare.organisation.adress.postnummer;
                    }
                    if ('postort' in lagfart.agare.organisation.adress) {
                      city = lagfart.agare.organisation.adress.postort;
                    }
                  }
                }
                if ('versionGiltigFran' in lagfart) {
                  versionValidFrom = lagfart.versionGiltigFran;
                }
                if ('inskrivningsdag' in lagfart) {
                  enrollmentDay = lagfart.inskrivningsdag;
                }
                let share = '';
                if ('beviljadAndel' in lagfart) {
                  share = lagfart.beviljadAndel.taljare + '/' + lagfart.beviljadAndel.namnare;
                }
                ownershipArr.push({
                  type: lagfart.typ,
                  objectidentifier: lagfart.objektidentitet,
                  enrollmentDay,
                  decision: lagfart.beslut,
                  share,
                  diaryNumber: lagfart.dagboksnummer,
                  versionValidFrom,
                  owner: {
                    idnumber: lagfart.agare.idnummer,
                    name: ownernName,
                    coAddress,
                    address,
                    postalCode,
                    city
                  }
                })
              });
            }
            const mortageArr = [];
            if ('belastar' in reqOwner.data.features[0].properties) {
              reqOwner.data.features[0].properties.belastar.forEach(burdens => {
                if (burdens.inskrivenBelastning.typ === 'Inteckning') {
                  let enrollmentDay = '';
                  if ('inskrivningsdag' in burdens.inskrivenBelastning) {
                    enrollmentDay = burdens.inskrivenBelastning.inskrivningsdag;
                  }
                  mortageArr.push({
                    objectidentifier: burdens.inskrivenBelastning.objektidentitet,
                    type: burdens.inskrivenBelastning.typ,
                    priorityOrder: burdens.foretradesordning,
                    enrollmentDay,
                    decision: burdens.inskrivenBelastning.beslut,
                    diaryNumber: burdens.inskrivenBelastning.dagboksnummer,
                    mortageType: burdens.inskrivenBelastning.pantbrevstyp,
                    mortageAmount: { 
                      currency: burdens.inskrivenBelastning.belopp.valuta,
                      sum: burdens.inskrivenBelastning.belopp.summa
                    }
                  })
                }
              });
            }
           const previousOwnershipArr = [];
            if ('tidigareAgande' in reqOwner.data.features[0].properties) {
              reqOwner.data.features[0].properties.tidigareAgande.forEach(lagfart => {
                let ownernName = '';
                let versionValidFrom = '';
                let enrollmentDay = '';
                if ('fornamn' in lagfart.agare) {
                  ownernName = lagfart.agare.fornamn + ' ';
                }
                if ('efternamn' in lagfart.agare) {
                  ownernName = ownernName + lagfart.agare.efternamn;
                }
                if ('organisationsnamn' in lagfart.agare) {
                  ownernName = lagfart.agare.organisationsnamn;
                }
                if ('versionGiltigFran' in lagfart) {
                  versionValidFrom = lagfart.versionGiltigFran;
                }
                if ('inskrivningsdag' in lagfart) {
                  enrollmentDay = lagfart.inskrivningsdag;
                }
                let share = '';
                if ('beviljadAndel' in lagfart) {
                  share = lagfart.beviljadAndel.taljare + '/' + lagfart.beviljadAndel.namnare;
                }
                previousOwnershipArr.push({
                  type: lagfart.typ,
                  objectidentifier: lagfart.objektidentitet,
                  enrollmentDay,
                  decision: lagfart.beslut,
                  share,
                  diaryNumber: lagfart.dagboksnummer,
                  versionValidFrom: versionValidFrom,
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
                    let fileNumber = '';
                    if ('aktnummer' in acquisition) {
                      fileNumber = acquisition.aktnummer;
                    }
                    let share = null;
                    if ('andelFang' in acquisition) {
                      share = acquisition.andelFang.taljare + '/' + acquisition.andelFang.namnare;
                    }
                    acquisitionArr.push({
                      objectidentifier: acquisition.objektidentitet,
                      enrollmentDay: acquisition.inskrivningsdag,
                      fileNumber,
                      decision: acquisition.beslut,
                      share,
                      acquisitionDay: acquisition.fangesdag,
                      acquisitionType: acquisition.fangesart,
                      acquisitionCode: acquisition.fangeskod,
                      registeredOwnership: acquisition.inskrivetAgande
                    })
                  });
                }
                let purchasePrice = {};
                if ('kopeskilling' in change) {      
                  let purchasePriceImmovableProperty = {};       
                  if ('kopeskillingFastEgendom' in change.kopeskilling) {    
                    purchasePriceImmovableProperty = { 
                      currency: change.kopeskilling.kopeskillingFastEgendom.valuta,
                      sum: change.kopeskilling.kopeskillingFastEgendom.summa
                    };
                  }      
                  purchasePrice = {
                    objectidentifier: change.kopeskilling.objektidentitet,
                    purchasePriceImmovableProperty,
                    purchasePriceType: change.kopeskilling.kopeskillingstyp
                  };
                }
                const transferArr = [];
                if ('overlatelse' in change) {
                  change.overlatelse.forEach(transfer => {
                    let share = '';
                    if ('andelOverlatelse' in transfer) {
                      share = transfer.andelOverlatelse.taljare + '/' + transfer.andelOverlatelse.namnare;
                    }
                    transferArr.push({
                      objectidentifier: transfer.objektidentitet,
                      share,
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
            responseObj.mortage = mortageArr;
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
    const fullUrl = req.protocol + '://' + req.get('host') + req.url;
    const parsedUrl = new URL(fullUrl);
    const params = parsedUrl.searchParams;
    const configOptions = Object.assign({}, conf[proxyUrl]);
    var ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
    let objectidentifier = '';
    if (params.has('objectidentifier')) {
      objectidentifier = params.get('objectidentifier');
    } else {
      res.status(400).json({error: 'Missing required parameter objectidentifier'});
    }
    if (!ip.includes(configOptions.allowedIP)) {
      res.status(400).json({error: 'Request not allowed from this IP!'});
    } else {
      doGet(req, res, objectidentifier);
    }
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
  tags: [
   'fastighetsdata'
  ],
  responses: {
    200: {
      description: 'Responds with the title deeds and owner etc',
      schema: {
        $ref: '#/definitions/EstateData'
      },
    },
    400: {
      description: 'Server error',
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
  