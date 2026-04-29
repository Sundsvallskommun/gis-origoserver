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
  console.log('ensureAuthenticated');
  if (req.session?.userinfo) return next();

  if (!req.session.returnTo) req.session.returnTo = req.originalUrl;

  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  const state = generators.state();
  console.log('state');

  req.session.code_verifier = code_verifier;
  req.session.oidc_state = state;
  console.log(req.session);

  const authorizationUrl = client.authorizationUrl({
    scope: configOptions.scope_auth,
    response_type: 'code',
    redirect_uri: configOptions.redirect_uri,
    state,
    code_challenge,
    code_challenge_method: 'S256',
  });
  console.log('pre redirect');

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
              if (type === 'html') {
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
    
    // Spara originalURL och query-parametrar i sessionen INNAN autentisering
    /*if (params.toString()) {
      req.session.savedQueryParams = Object.fromEntries(params);
      req.session.returnTo = req.originalUrl; // Spara hela den ursprungliga URL:en
    }
    console.log(req.session);
    const client = await openidIssuer.getOpenidClient();
    await ensureAuthenticated(req, res, next, configOptions, client);
    */
    var ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

    // Efter lyckad autentisering, återställ den ursprungliga URL:en
    /*
    if (req.session.returnTo) {
      const returnTo = req.session.returnTo;
      delete req.session.returnTo; // Rensa returnTo efter användning

      // Kontrollera att returnTo är en relativ URL för att undvika open redirect
      if (returnTo.startsWith('/')) {
        // Uppdatera parsedUrl med den återställda URL:en
        const restoredUrl = new URL(req.protocol + '://' + req.get('host') + returnTo);
        const restoredParams = restoredUrl.searchParams;
        req.session.savedQueryParams = Object.fromEntries(restoredParams);
      }
    }*/

    /*const userinfo = req.session.userinfo;
    if (configOptions.allowedUsers.includes(userinfo.sub)) {
      let objectidentifier = '';

      // Försök hämta parametern från URL:en först,
      // annars från sparade parametrar i sessionen
      if (params.has('objectidentifier')) {
        objectidentifier = params.get('objectidentifier');
        // Uppdatera sparade parametrar
        req.session.savedQueryParams = Object.fromEntries(params);
      } else if (req.session.savedQueryParams &&
                 req.session.savedQueryParams.objectidentifier) {
        objectidentifier = req.session.savedQueryParams.objectidentifier;
      } else {
        return res.status(400).json({
          error: 'Missing required parameter objectidentifier'
        });
      }

      // Rensa sparade parametrar efter användning
      delete req.session.savedQueryParams;
      doGet(req, res, objectidentifier);
    } else {
        res.status(400).json({error: 'Du är inte behörig!'});
    }*/
    let objectidentifier = '';
    if (params.has('objectidentifier')) {
      objectidentifier = params.get('objectidentifier');
    } else {
      res.status(400).json({error: 'Missing required parameter objectidentifier'});
    }
    const user = req.session?.loggedInUser;
    console.log(req.hostname);
    console.log(user);

    if (
      !user ||
      !configOptions.allowedHosts.includes(req.hostname) ||
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
  