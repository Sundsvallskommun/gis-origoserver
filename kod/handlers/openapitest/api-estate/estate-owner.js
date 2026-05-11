const conf = require('../../../conf/config');
const { URL } = require('url'); 
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;
const crypto = require('crypto');
const { generators } = require('openid-client');
const openidIssuer = require('../../auth/openidIssuer');

var proxyUrl = 'apiEstateTest';

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ensureAuthenticated(req, res, next, configOptions, client) {
  if (req.session?.userinfo) return next();

  if (!req.session.returnTo) req.session.returnTo = req.originalUrl;

  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  const state = generators.state();

  req.session.code_verifier = code_verifier;
  req.session.oidc_state = state;

  const authorizationUrl = client.authorizationUrl({
    scope: configOptions.scope_auth,
    response_type: 'code',
    redirect_uri: configOptions.redirect_uri,
    state,
    code_challenge,
    code_challenge_method: 'S256',
  });

  return res.redirect(authorizationUrl);
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
  const qp = req.session.savedQueryParams || {};
  const type = qp.type; 

  const checkUuidRegEx = /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/i;
  let found = objectidentifier.match(checkUuidRegEx);
  if (found !== null) {
    if (objectidentifier !== '') {
        var estateType = await checkType(configOptions, tokenEstate, objectidentifier);
        if (estateType.typ === 'samfällighet') {
          const arrObjektid = [];
          const arrDelagare = [];
          const arrOtherDelagare = [];
          responseObj.designation = estateType.beteckning;
          estateType.delagare.forEach(delagare => {
            if (delagare?.delagare?.objektidentitet) {
              arrObjektid.push(delagare.delagare.objektidentitet);
            }
            if (delagare?.annanDelagare?.objektidentitet) {
              arrOtherDelagare.push({ objektidentitet: delagare.annanDelagare.objektidentitet, skifteslagDelagare: delagare.annanDelagare.skifteslagDelagare });
            }
          });
          var arrTaxationObj = await getTaxationIDFromArrayOfReferensenhet(configOptions, tokenTaxation, arrObjektid);
          const arrTaxationId = arrTaxationObj.map(tax => tax.taxeringsId);
          if (arrObjektid.length > 0) { // Koll om det finns några delägare registrerade
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
                  responseObj.partOwners = arrDelagare;
                  responseObj.partOwnersOther = arrOtherDelagare;
                  const partOwnerByObjId = new Map(
                    responseObj.partOwners.map(p => [p.objectidentifier, p])
                  );

                  if (reqTaxation.data.features.length > 0) {
                    reqTaxation.data.features.forEach(taxation => {
                      taxation.properties.skvFastighet.forEach(skvFastighet => {
                        const lmObjId =
                          skvFastighet?.taxeradRegisterenhet?.registerenhetsreferens?.objektidentitet;

                        // matcha mot delägarfastigheterna
                        const partOwner = lmObjId ? partOwnerByObjId.get(lmObjId) : null;
                        if (!partOwner) return;

                        if (!('taxeradAgare' in skvFastighet)) return;

                        const taxedOwnerArr = skvFastighet.taxeradAgare.map(taxOwner => {
                          let ownerName = '';
                          let ownerType = '';

                          if (taxOwner?.person) {
                            ownerName = `${taxOwner.person.fornamn ?? ''} ${taxOwner.person.efternamn ?? ''}`.trim();
                            ownerType = 'person';
                          } else if (taxOwner?.organisation) {
                            ownerName = taxOwner.organisation.organisationsnamn ?? '';
                            ownerType = 'organisation';
                          }

                          return {
                            idnumber: taxOwner.idNummer,
                            name: ownerName,
                            type: ownerType,
                            estateType: skvFastighet.typAvFastighet,
                            taxedUnitId: skvFastighet.id
                          };
                        });

                        partOwner.taxedOwners ??= {};
                        partOwner.taxedOwners[skvFastighet.id] = taxedOwnerArr;
                      });
                    });
                  }
                }
                if (type === 'html') {
                  res.render('lmEstateOwnersSamfallighet', responseObj);
                } else {
                  res.status(200).json(responseObj);
                }
              });
          } else {
            res.status(200).json({});
          }
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
                  let ownernType = '';
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
                    ownernType = 'person';
                  }
                  if ('organisation' in lagfart.agare) {
                    ownernType = 'organisation';
                  }
                  ownershipArr.push({
                    idnumber: lagfart.agare.idnummer,
                    name: ownernName,
                    type: ownernType
                  });
                });
              }
              const taxationEstatesArr = [];
              let taxedOwnerObj = {};
              if (reqTaxation.data.features.length > 0) {
                reqTaxation.data.features.forEach(taxation => {
                  taxation.properties.skvFastighet.forEach(skvFastighet => {
                    const taxedOwnerArr = [];
                    // Check to see if this is the same estate that we searched for and not a estate that is co-taxed with this.
                    if (skvFastighet.taxeradRegisterenhet?.registerenhetsreferens?.objektidentitet === objectidentifier) {
                      if ('taxeradAgare' in skvFastighet) {
                        skvFastighet.taxeradAgare.forEach(taxOwner => {
                          let ownerName = '';
                          let ownerType = '';
                          if ('person' in taxOwner) {
                            if ('fornamn' in taxOwner.person) {
                              ownerName = taxOwner.person.fornamn + ' ';
                            }
                            if ('efternamn' in taxOwner.person) {
                              ownerName = ownerName + taxOwner.person.efternamn;
                            }
                            ownerType = 'person';
                          }
                          if ('organisation' in taxOwner) {
                            if ('organisationsnamn' in taxOwner.organisation) {
                              ownerName = taxOwner.organisation.organisationsnamn;
                            }
                            ownerType = 'organisation';
                          }
                          taxedOwnerArr.push({
                            idnumber: taxOwner.idNummer,
                            name: ownerName,
                            type: ownerType,
                            estateType: skvFastighet.typAvFastighet
                          });
                        });
                        taxedOwnerObj[skvFastighet.id] = taxedOwnerArr;
                      }
                    }
                  });
                });
              }
              responseObj.ownership = ownershipArr;
              responseObj.taxedOwners = taxedOwnerObj;
              if (type === 'html') {
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
  get: async function (req, res, next) {
    const configOptions = Object.assign({}, conf[proxyUrl]);
    const fullUrl = req.protocol + '://' + req.get('host') + req.url;
    const parsedUrl = new URL(fullUrl);
    const params = parsedUrl.searchParams;
    
    let objectidentifier = '';
    if (params.has('objectidentifier')) {
      objectidentifier = params.get('objectidentifier');
    } else {
      res.status(400).json({error: 'Missing required parameter objectidentifier'});
    }
    let user = req.session?.loggedInUser;
    /*const hostname = (req.hostname || '').trim().toLowerCase();
    if(hostname === 'localhost') {
      user = 'joh17bla'
    }*/

    if (
      !user ||
      !configOptions.allowedUsers.includes(user)
    ) {
      return res.status(403).json({ error: "Request not allowed" });
    }

    return doGet(req, res, objectidentifier);
  },
};

module.exports.get.apiDoc = {
  description: 'Get the owners of an estate both legal and taxed.',
  operationId: 'getEstateQwners',
  parameters: [
    {
      in: 'query',
      name: 'objectidentifier',
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
  