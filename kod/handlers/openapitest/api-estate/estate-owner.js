const conf = require('../../../conf/config');
const { URL } = require('url'); 
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;

var proxyUrl = 'apiEstateTest';

// Middleware för att kräva autentisering
function ensureAuthenticated(req, res, next, configOptions) {
  if (req.session.userinfo) {
    next();
  } else {
    res.redirect(configOptions.url_auth);
  }
}

async function getTaxation(configOptions, tokenTaxation, objectidentifier) {
    const responseArray = [];

    try {
        const response = await axios({
            method: 'GET',
            url: encodeURI(`${configOptions.url_taxation}/referens/beror/${objectidentifier}`),
            headers: {
                'Authorization': `Bearer ${tokenTaxation}`,
                'Content-Type': 'application/json',
                'Scope': configOptions.scope
            }
        });
        
        // Check if data exists and has the expected structure
        if (response.data && response.data.taxeringsenhetsreferens) {
            response.data.taxeringsenhetsreferens.forEach(element => {
                responseArray.push(element.taxeringsenhetsnummer);
            });
        }
        
        return responseArray; // Return the array

    } catch (error) {
        console.log('Error fetching taxation id:', error);
    }
}

async function getTaxationIDFromArrayOfReferensenhet(configOptions, tokenTaxation, arrReferensenhet) {
    const promises = arrReferensenhet.map(async refUnit => {
        const taxId = await getTaxation(configOptions, tokenTaxation, refUnit);
        return { referensenhet: refUnit, taxeringsId: taxId };
    });

    const responseArray = await Promise.all(promises); // Vänta på att alla promises ska lösas
    return responseArray;
}

async function checkType(configOptions, tokenEstate, objectidentifier) {
    let responseObj = {};

    try {
        const response = await axios({
          method: 'GET',
          url: encodeURI(configOptions.url_estate + '/' + objectidentifier + '?includeData=andel,registerbeteckning'),
          headers: {
            'Authorization': 'Bearer ' + tokenEstate,
            'content-type': 'application/json',
            'scope': `${configOptions.scope}`
            }
        });
        if (response.data.features.length > 0) {
          // Check if data exists and has the expected structure
          if (response.data.features[0].properties && response.data.features[0].properties.typ) {
            let beteckning = '';
            response.data.features[0].properties.registerbeteckning.forEach(designation => {
              if (designation.beteckningsstatus === 'gällande') {
                let block = '';
                if (designation.block !== '*') {
                  block = designation.block + ':'
                }
                beteckning = designation.registeromrade + ' ' + designation.trakt + ' ' + block + designation.enhet;
              }
            });
            if (response.data.features[0].properties.typ === 'samfällighet') {
              responseObj = { 
                typ: response.data.features[0].properties.typ,
                beteckning,
                delagare: response.data.features[0].properties.delagare 
              }
            } else {
              responseObj = { 
                typ: response.data.features[0].properties.typ
              }
            }

          }
        }
        return responseObj; // Return the array

    } catch (error) {
        console.log('Error fetching estate type:', error);
    }
}

async function doGet(req, res, objectidentifier) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.type = 'owner';
  const responseObj = {}
  
  var tokenOwner = await simpleStorage.getToken(configOptions);
  configOptions.type = 'estate';
  var tokenEstate = await simpleStorage.getToken(configOptions);
  configOptions.type = 'taxation';
  var tokenTaxation = await simpleStorage.getToken(configOptions);

  const fullUrl = `http://${req.headers.host}${req.url}`;
  const parsedURL = new URL(fullUrl);

  const checkUuidRegEx = /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/i;
  let found = objectidentifier.match(checkUuidRegEx);
  if (found !== null) {
    if (objectidentifier !== '') {
        var estateType = await checkType(configOptions, tokenEstate, objectidentifier);
        if (estateType.typ === 'samfällighet') {
          const arrObjektid = [];
          const arrDelagare = [];
          responseObj.designation = estateType.beteckning;
          estateType.delagare.forEach(delagare => {
            arrObjektid.push(delagare.delagare.objektidentitet);
          });
          var arrTaxationObj = await getTaxationIDFromArrayOfReferensenhet(configOptions, tokenTaxation, arrObjektid);
          const arrTaxationId = arrTaxationObj.map(tax => tax.taxeringsId);
          Promise.all([axios({
            method: 'POST',
            url: encodeURI(configOptions.url_owner + '/beror?includeData=agareAktuella'),
            headers: {
              'Authorization': 'Bearer ' + tokenOwner,
              'content-type': 'application/json',
              'scope': `${configOptions.scope}`
              },
            data: arrObjektid
            }),axios({
              method: 'POST',
              url: encodeURI(configOptions.url_taxation + '/' + '?includeData=total'),
              headers: {
                'Authorization': 'Bearer ' + tokenTaxation,
                'content-type': 'application/json',
                'scope': `${configOptions.scope}`
                },
              data: { "taxeringsenhetsnummer": arrTaxationId.flat() }
            })]).then(([reqOwner,reqTaxation]) => {
              if (reqOwner.data.features.length > 0) {
                reqOwner.data.features.forEach(owner => {
                  const ownershipArr = [];
                  if ('agande' in owner.properties) {
                    owner.properties.agande.forEach(lagfart => {
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
                        idnumber: lagfart.agare.idnummer,
                        name: ownernName
                      });
                    });
                  }
                  arrDelagare.push({
                    designation: owner.properties.fastighetsreferens.beteckning,
                    objectidentifier: owner.properties.fastighetsreferens.objektidentitet,
                    ownership: ownershipArr
                  });
                });
              }
              let taxedOwnerObj = {};
              if (reqTaxation.data.features.length > 0) {
                reqTaxation.data.features.forEach(taxation => {
                  taxation.properties.skvFastighet.forEach(skvFastighet => {
                    const taxedOwnerArr = [];
                    if ('taxeradAgare' in skvFastighet) {
                      skvFastighet.taxeradAgare.forEach(taxOwner => {
                        let ownernName = '';
                        if ('person' in taxOwner) {
                          if ('fornamn' in taxOwner.person) {
                            ownernName = taxOwner.person.fornamn + ' ';
                          }
                          if ('efternamn' in taxOwner.person) {
                            ownernName = ownernName + taxOwner.person.efternamn;
                          }
                        }
                        if ('organisation' in taxOwner) {
                          ownernName = taxOwner.organisation.organisationsnamn;
                        }
                        taxedOwnerArr.push({
                          idnumber: taxOwner.idNummer,
                          name: ownernName
                        });
                      });
                    }
                    taxedOwnerObj[skvFastighet.taxeradRegisterenhet.registerenhetsreferens.objektidentitet] = taxedOwnerArr;
                  });
                });
              }
              responseObj.partOwners = arrDelagare;
              Object.keys(taxedOwnerObj).forEach(refObject => {
                const partOwner = responseObj.partOwners.find(owner => owner.objectidentifier === refObject);
                if (partOwner) {
                    partOwner.taxedOwners = taxedOwnerObj[refObject];
                }
              });
              if (parsedURL.searchParams.get('type') === 'html') {
                res.render('lmEstateOwnersSamfallighet', responseObj);
              } else {
                res.status(200).json(responseObj);
              }
            });
        } else {
          var arrTaxationId = await getTaxation(configOptions, tokenTaxation, objectidentifier);
          Promise.all([axios({
            method: 'GET',
            url: encodeURI(configOptions.url_owner + '/beror/' + objectidentifier + '?includeData=agareAktuella'),
            headers: {
              'Authorization': 'Bearer ' + tokenOwner,
              'content-type': 'application/json',
              'scope': `${configOptions.scope}`
              }
          }),axios({
            method: 'POST',
            url: encodeURI(configOptions.url_taxation+ '/' + '?includeData=total'),
            headers: {
              'Authorization': 'Bearer ' + tokenTaxation,
              'content-type': 'application/json',
              'scope': `${configOptions.scope}`
              },
            data: { "taxeringsenhetsnummer": arrTaxationId }
          })]).then(([reqOwner,reqTaxation]) => {
            if (reqOwner.data.features.length > 0) {
              responseObj.designation = reqOwner.data.features[0].properties.fastighetsreferens.beteckning;
              responseObj.objectidentifier = reqOwner.data.features[0].properties.fastighetsreferens.objektidentitet;
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
                    idnumber: lagfart.agare.idnummer,
                    name: ownernName
                  });
                });
              }

              const taxationEstatesArr = [];
              if ('taxeringsenhetsnummer' in reqTaxation.data.features[0].properties) {
                if ('skvFastighet' in reqTaxation.data.features[0].properties) {
                  reqTaxation.data.features[0].properties.skvFastighet.forEach(estate => {
                    estate.taxeradAgare.forEach(taxedowner => {
                      let taxedOwnernName = '';
                      if ('person' in taxedowner) {
                        if ('fornamn' in taxedowner.person) {
                          taxedOwnernName = taxedowner.person.fornamn + ' ';
                        }
                        if ('efternamn' in taxedowner.person) {
                          taxedOwnernName = taxedOwnernName + taxedowner.person.efternamn;
                        }
                      }
                      if ('organisation' in taxedowner) {
                        if ('organisationsnamn' in taxedowner.organisation) {
                          taxedOwnernName = taxedowner.organisation.organisationsnamn;
                        }
                      }
                      if (!taxationEstatesArr.some(item => item.idnumber === taxedowner.idNummer)) {
                        taxationEstatesArr.push({ 
                          idnumber: taxedowner.idNummer, 
                          name: taxedOwnernName 
                        });                      
                      }
                    });
                  });
                }
              }
              responseObj.ownership = ownershipArr;
              responseObj.taxedOwners = taxationEstatesArr;
              if (parsedURL.searchParams.get('type') === 'html') {
                res.render('lmEstateOwners', responseObj);
              } else {
                res.status(200).json(responseObj);
              }
            } else {
              res.status(400).json({error: 'Not found'});
            }
          });
        }
      } else {
        res.status(400).json({error: 'Missing required parameter objectidentifier'});
      }
    } else {
      res.status(400).json({error: 'Malformed objectidentifier'});
    }
}

module.exports = {
  get: function (req, res, next) {
    const configOptions = Object.assign({}, conf[proxyUrl]);
    ensureAuthenticated(req, res, next, configOptions);
    const fullUrl = req.protocol + '://' + req.get('host') + req.url;
    const parsedUrl = new URL(fullUrl);
    const params = parsedUrl.searchParams;
    var ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;
    let objectidentifier = '';
    if (params.has('objectidentifier')) {
      objectidentifier = params.get('objectidentifier');
    } else {
      res.status(400).json({error: 'Missing required parameter objectidentifier'});
    }
    //if (!ip.includes(configOptions.allowedIP)) {
      //res.status(400).json({error: 'Request not allowed from this IP!'});
    //} else {
      doGet(req, res, objectidentifier);
    //}
  },
};

module.exports.get.apiDoc = {
  description: 'Get information about estate.',
  operationId: 'getEstateQwners',
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
      description: 'Responds with the owners and taxedowners',
      schema: {
        $ref: '#/definitions/EstateOwner'
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
  