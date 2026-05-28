const conf = require('../../../conf/config');
const { URL } = require('url'); 
const simpleStorage = require('../simpleStorage');
const axios = require('axios').default;
const { generators } = require('openid-client');

var proxyUrl = 'apiEstateTest';

/**
 * Plocka ut ägarnamnet från API svaret för personer och organisationer
 *
 * @function
 * @name getNameFromAgare
 * @kind function
 * @param {object} agare?
 * @returns {any}
 */
function getNameFromAgare(agare = {}) {
  if (agare.organisationsnamn) return agare.organisationsnamn;
  const fn = agare.fornamn ?? '';
  const en = agare.efternamn ?? '';
  return `${fn} ${en}`.trim();
}

/**
 * Hämta typen för ägare
 *
 * @function
 * @name getTypeFromAgare
 * @kind function
 * @param {object} agare?
 * @returns {"" | "person" | "organisation"}
 */
function getTypeFromAgare(agare = {}) {
  if (agare.person) return 'person';
  if (agare.organisation) return 'organisation';
  return '';
}

/**
 * Hämta ut namnet för taxerad ägare person/organisation
 *
 * @function
 * @name getNameFromTaxOwner
 * @kind function
 * @param {object} taxOwner?
 * @returns {any}
 */
function getNameFromTaxOwner(taxOwner = {}) {
  if (taxOwner.person) {
    const fn = taxOwner.person.fornamn ?? '';
    const en = taxOwner.person.efternamn ?? '';
    return `${fn} ${en}`.trim();
  }
  if (taxOwner.organisation) return taxOwner.organisation.organisationsnamn ?? '';
  return '';
}

/**
 * Hämta typen för taxerad ägare
 *
 * @function
 * @name getTypeFromTaxOwner
 * @kind function
 * @param {object} taxOwner?
 * @returns {"" | "person" | "organisation"}
 */
function getTypeFromTaxOwner(taxOwner = {}) {
  if (taxOwner.person) return 'person';
  if (taxOwner.organisation) return 'organisation';
  return '';
}

/**
 * Plocka ut information om fastighet och ägare
 *
 * @function
 * @name parseOwnerFeatures
 * @kind function
 * @param {any} reqOwner
 * @param {{ includeType?: boolean | undefined }} { includeType }?
 * @returns {any}
 */
function parseOwnerFeatures(reqOwner, { includeType = false } = {}) {
  const features = reqOwner?.data?.features ?? [];
  return features.map(f => {
    const props = f?.properties ?? {};
    const fastRef = props.fastighetsreferens ?? {};

    const ownership = (props.agande ?? []).map(lagfart => {
      const agare = lagfart?.agare ?? {};
      const row = { idnumber: agare.idnummer, name: getNameFromAgare(agare) };
      if (includeType) row.type = getTypeFromAgare(agare);
      return row;
    });

    return {
      designation: fastRef.beteckning,
      objectidentifier: fastRef.objektidentitet,
      ownership
    };
  });
}

/**
 * Lägg till taxerade delägare till samfällighetssvaret
 * 
 * @function
 * @name attachTaxedOwnersToPartOwners
 * @kind function
 * @param {any} partOwners
 * @param {any} reqTaxation
 * @returns {void}
 */
function attachTaxedOwnersToPartOwners(partOwners, reqTaxation) {
  const features = reqTaxation?.data?.features ?? [];
  const partOwnerByObjId = new Map(partOwners.map(p => [p.objectidentifier, p]));

  for (const taxation of features) {
    const skvFastigheter = taxation?.properties?.skvFastighet ?? [];
    for (const skvFastighet of skvFastigheter) {
      const lmObjId =
        skvFastighet?.taxeradRegisterenhet?.registerenhetsreferens?.objektidentitet;

      const partOwner = lmObjId ? partOwnerByObjId.get(lmObjId) : null;
      if (!partOwner) continue;
      if (!Array.isArray(skvFastighet.taxeradAgare)) continue;

      const taxedOwnerArr = skvFastighet.taxeradAgare.map(taxOwner => ({
        idnumber: taxOwner.idNummer,
        name: getNameFromTaxOwner(taxOwner),
        type: getTypeFromTaxOwner(taxOwner),
        estateType: skvFastighet.typAvFastighet,
        taxedUnitId: skvFastighet.id
      }));

      partOwner.taxedOwners ??= {};
      partOwner.taxedOwners[skvFastighet.id] = taxedOwnerArr;
    }
  }
}

/**
 * Plocka ut lagfarna och taxerade ägare för en fastighet
 *
 * @function
 * @name parseSingleEstateOwnerAndTaxation
 * @kind function
 * @param {any} reqOwner
 * @param {any} reqTaxation
 * @param {any} objectidentifier
 * @returns {{ designation: any; objectidentifier: any; ownership: any; taxedOwners: {}; } | null}
 */
function parseSingleEstateOwnerAndTaxation(reqOwner, reqTaxation, objectidentifier) {
  const ownerEstates = parseOwnerFeatures(reqOwner, { includeType: true });
  if (ownerEstates.length === 0) return null;

  const first = ownerEstates[0];
  const taxedOwners = {};

  const taxFeatures = reqTaxation?.data?.features ?? [];
  for (const taxation of taxFeatures) {
    const skvFastigheter = taxation?.properties?.skvFastighet ?? [];
    for (const skvFastighet of skvFastigheter) {
      const lmObjId =
        skvFastighet?.taxeradRegisterenhet?.registerenhetsreferens?.objektidentitet;

      // bara den fastighet vi frågade efter (inte samtaxerade)
      if (lmObjId !== objectidentifier) continue;
      if (!Array.isArray(skvFastighet.taxeradAgare)) continue;

      taxedOwners[skvFastighet.id] = skvFastighet.taxeradAgare.map(taxOwner => ({
        idnumber: taxOwner.idNummer,
        name: getNameFromTaxOwner(taxOwner),
        type: getTypeFromTaxOwner(taxOwner),
        estateType: skvFastighet.typAvFastighet
      }));
    }
  }

  return {
    designation: first.designation,
    objectidentifier: first.objectidentifier,
    ownership: first.ownership,
    taxedOwners
  };
}


/**
 * Sätt upp och utför anrop mot ägar- och taxeringsdata, både för vanliga fastigheter och samfälligheter för en specifik fastighet.
 *
 * @async
 * @function
 * @name fetchOwnersForObjectId
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} objectidentifier
 * @returns {Promise<any>}
 */
async function fetchOwnersForObjectId(configOptions, token, objectidentifier) {
  return axios({
    method: 'GET',
    url: encodeURI(
      `${configOptions.url_owner}/beror/${objectidentifier}?includeData=agareAktuella`
    ),
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    }
  });
}

/**
 * Sätt upp och utför anrop mot gemensamhetsanläggningsdata för en specifik gemensamhetsanläggning.
 *
 * @async
 * @function
 * @name fetchOwnersForCommunityFacility
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} objectidentifier
 * @returns {Promise<any>}
 */
async function fetchOwnersForCommunityFacility(configOptions, token, objectidentifier) {
  return axios({
    method: 'GET',
    url: encodeURI(
      `${configOptions.url_communityFacility}/${objectidentifier}?includeData=andel`
    ),
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    }
  });
}

/**
 * Sätt upp och utför anrop mot ägar- och taxeringsdata, både för vanliga fastigheter och samfälligheter för en lista av fastigheter.
 *
 * @async
 * @function
 * @name fetchOwnersForObjectIds
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} objectIds
 * @returns {Promise<any>}
 */
async function fetchOwnersForObjectIds(configOptions, token, objectIds) {
  // objectIds = [objektidentitet, ...]
  return axios({
    method: 'POST',
    url: encodeURI(`${configOptions.url_owner}/beror?includeData=agareAktuella`),
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    data: objectIds
  });
}

/**
 * Sätt upp och utför anrop mot taxerings API:et för en lista av fastigheter.
 *
 * @async
 * @function
 * @name fetchTaxationTotal
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} taxationUnitNumbers
 * @returns {Promise<any>}
 */
async function fetchTaxationTotal(configOptions, token, taxationUnitNumbers) {
  // taxationUnitNumbers = ["123", ...] eller nested; vi flattar här
  const flat = Array.isArray(taxationUnitNumbers)
    ? taxationUnitNumbers.flat()
    : taxationUnitNumbers;

  return axios({
    method: 'POST',
    url: encodeURI(`${configOptions.url_taxation}/?includeData=total`),
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    data: { taxeringsenhetsnummer: flat }
  });
}

/**
 * Sätt upp och utför anrop mot taxeringsdata, både för vanliga fastigheter och samfälligheter för en specifik fastighet.
 *
 * @async
 * @function
 * @name getTaxation
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} objectidentifier
 * @returns {Promise<any[] | undefined>}
 */
async function getTaxation(configOptions, token, objectidentifier) {
    const responseArray = [];

    try {
        const response = await axios({
            method: 'GET',
            url: encodeURI(`${configOptions.url_taxation}/referens/beror/${objectidentifier}`),
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
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

/**
 * Hämta alla taxeringsid för alla fastigheter.
 *
 * @async
 * @function
 * @name getTaxationIDFromArrayOfReferensenhet
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} arrReferensenhet
 * @returns {Promise<any[]>}
 */
async function getTaxationIDFromArrayOfReferensenhet(configOptions, token, arrReferensenhet) {
    const promises = arrReferensenhet.map(async refUnit => {
        const taxId = await getTaxation(configOptions, token, refUnit);
        return { referensenhet: refUnit, taxeringsId: taxId };
    });

    const responseArray = await Promise.all(promises); // Vänta på att alla promises ska lösas
    return responseArray;
}

/**
 * Kolla om det är en fastighet eller samfällighet och om det är en samfällighet lista delägar fastigheterna.
 *
 * @async
 * @function
 * @name checkType
 * @kind function
 * @param {any} configOptions
 * @param {any} token
 * @param {any} objectidentifier
 * @returns {Promise<{} | undefined>}
 */
async function checkType(configOptions, token, objectidentifier) {
    let responseObj = {};

    try {
        const response = await axios({
          method: 'GET',
          url: encodeURI(configOptions.url_estate + '/' + objectidentifier + '?includeData=andel,registerbeteckning'),
          headers: {
            'Authorization': 'Bearer ' + token,
            'content-type': 'application/json'
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

/**
 * Sätt upp och utför anrop mot ägar- och taxeringsdata, både för vanliga fastigheter och samfälligheter, 
 * och hantera svaret beroende på om det är en vanlig fastighet, samfällighet eller gemensamhetsanläggning.
 *
 * @async
 * @function
 * @name doGet
 * @kind function
 * @param {any} req
 * @param {any} res
 * @param {any} objectidentifier
 * @param {any} communityFacility
 * @returns {Promise<void>}
 */
async function doGet(req, res, objectidentifier, communityFacility) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  configOptions.type = 'owner';

  const responseObj = {};

  try {
    const token = await simpleStorage.getToken(configOptions);

    const fullUrl = `http://${req.headers.host}${req.url}`;
    const parsedURL = new URL(fullUrl);
    const qp = req.session.savedQueryParams || {};
    const type = qp.type;

    const checkUuidRegEx =
      /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/i;

    const found = objectidentifier.match(checkUuidRegEx);
    if (found === null) {
      res.status(400).json({ error: 'Malformed objectidentifier' });
      return;
    }
    if (objectidentifier === '') {
      res.status(400).json({ error: 'Missing required parameter objectidentifier' });
      return;
    }

    // Hantera community facility-frågan, som hämtas från ett annat API än fastighets- och samfällighetsfrågan.
    if (
      communityFacility.toLowerCase() === 'ja' ||
      communityFacility.toLowerCase() === 'yes' ||
      communityFacility.toLowerCase() === 'true'
    ) {
      const arrDelagandeRegisterenhet = [];
      const reqCommunityFacility = await fetchOwnersForCommunityFacility(configOptions, token, objectidentifier);
      reqCommunityFacility.data.features.forEach(feature => { 
        const props = feature.properties || {};
        props.delagare.forEach(delagare => {
          // Behandla varje delägande fastighet och hämta ut dess objektidentitet, 
          // som sedan används för att hämta taxeringsid och ägare för varje delägande fastighet i efterhand. 
          // En gemensamhetsanläggning har ingen ägare utan bara delägande fastigheter som vi måste fråga på om ägare och taxering för.
          delagare?.delagandeRegisterenhet?.forEach(registerenhet => {
            if (registerenhet.objektidentitet) {
              arrDelagandeRegisterenhet.push(registerenhet.objektidentitet);
            }
          });
        });
      });
      if (arrDelagandeRegisterenhet.length === 0) {
        res.status(200).json({});
        return;
      }

      const arrTaxationObj = await getTaxationIDFromArrayOfReferensenhet(
        configOptions,
        token,
        arrDelagandeRegisterenhet
      );
      const arrTaxationId = arrTaxationObj.map(tax => tax.taxeringsId);

      const [reqOwner, reqTaxation] = await Promise.all([
        fetchOwnersForObjectIds(configOptions, token, arrDelagandeRegisterenhet),
        fetchTaxationTotal(configOptions, token, arrTaxationId)
      ]);

      const partOwners = parseOwnerFeatures(reqOwner, { includeType: false });
      responseObj.partOwners = partOwners;
      //responseObj.partOwnersOther = arrOtherDelagare;

      attachTaxedOwnersToPartOwners(responseObj.partOwners, reqTaxation);

      if (type === 'html') {
        res.render('lmEstateOwnersGemensamhetsanlaggning', responseObj);
      } else {
        res.status(200).json(responseObj);
      }
      return;
    }

    const estateType = await checkType(configOptions, token, objectidentifier);

    // --- Samfällighet ---
    // Hantera samfällighet separat eftersom vi då måste hämta ägare och taxering för alla delägare,
    // inte bara den vi frågade på, och sedan matcha ihop dett i efterhand. För vanliga fastigheter
    // så är det bara att fråga på objektidentiteten som vanligt och sedan matcha ihop ägare och taxering direkt i svaret.
    if (estateType.typ === 'samfällighet') {
      responseObj.designation = estateType.beteckning;

      const arrObjektid = [];
      const arrOtherDelagare = [];

      estateType.delagare.forEach(delagare => {
        if (delagare?.delagare?.objektidentitet) {
          arrObjektid.push(delagare.delagare.objektidentitet);
        }
        if (delagare?.annanDelagare?.objektidentitet) {
          arrOtherDelagare.push({
            objektidentitet: delagare.annanDelagare.objektidentitet,
            skifteslagDelagare: delagare.annanDelagare.skifteslagDelagare
          });
        }
      });

      if (arrObjektid.length === 0) {
        res.status(200).json({});
        return;
      }

      const arrTaxationObj = await getTaxationIDFromArrayOfReferensenhet(
        configOptions,
        token,
        arrObjektid
      );
      const arrTaxationId = arrTaxationObj.map(tax => tax.taxeringsId);

      const [reqOwner, reqTaxation] = await Promise.all([
        fetchOwnersForObjectIds(configOptions, token, arrObjektid),
        fetchTaxationTotal(configOptions, token, arrTaxationId)
      ]);

      const partOwners = parseOwnerFeatures(reqOwner, { includeType: false });
      responseObj.partOwners = partOwners;
      responseObj.partOwnersOther = arrOtherDelagare;

      attachTaxedOwnersToPartOwners(responseObj.partOwners, reqTaxation);

      if (type === 'html') {
        res.render('lmEstateOwnersSamfallighet', responseObj);
      } else {
        res.status(200).json(responseObj);
      }
      return;
    }

    // --- Vanlig fastighet ---
    const arrTaxationId = await getTaxation(configOptions, token, objectidentifier);

    const [reqOwner, reqTaxation] = await Promise.all([
      fetchOwnersForObjectId(configOptions, token, objectidentifier),
      fetchTaxationTotal(configOptions, token, arrTaxationId)
    ]);

    const parsed = parseSingleEstateOwnerAndTaxation(
      reqOwner,
      reqTaxation,
      objectidentifier
    );

    if (!parsed) {
      res.status(400).json({ error: 'Not found' });
      return;
    }

    Object.assign(responseObj, parsed);

    if (type === 'html') {
      res.render('lmEstateOwners', responseObj);
    } else {
      res.status(200).json(responseObj);
    }
  } catch (err) {
    // Här kan du välja statuskod beroende på feltyp
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = {
  get: async function (req, res, next) {
    const configOptions = Object.assign({}, conf[proxyUrl]);
    const fullUrl = req.protocol + '://' + req.get('host') + req.url;
    const parsedUrl = new URL(fullUrl);
    const params = parsedUrl.searchParams;
    
    let objectidentifier = '';
    let communityFacility = 'nej';
    if (params.has('communityFacility')) {
      communityFacility = params.get('communityFacility').toLowerCase();
    }
    if (params.has('objectidentifier')) {
      objectidentifier = params.get('objectidentifier');
    } else {
      res.status(400).json({error: 'Missing required parameter objectidentifier'});
    }
    let user = req.session?.loggedInUser;
    const hostname = (req.hostname || '').trim().toLowerCase();
    if(hostname === 'localhost') {
      user = 'joh17bla'
    }

    if (
      !user ||
      !configOptions.allowedUsers.includes(user)
    ) {
      return res.status(403).json({ error: "Request not allowed" });
    }

    return doGet(req, res, objectidentifier, communityFacility);
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
    },
    {
      in: 'query',
      name: 'communityFacility',
      type: 'string',
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
  