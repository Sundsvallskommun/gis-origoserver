var conf = require('../../conf/config');
const fetch = (...args) =>
	import('node-fetch').then(({default: fetch}) => fetch(...args));

let configOptions = {};
/**
 * LM:s access token
 */
let token;
/**
 * Timestamp when the token expires (minus a little margin)
 */
let tokenExpires;

if (conf['ngpDetaljplan']) {
    configOptions = Object.assign({}, conf['ngpDetaljplan']);
}

const uuidRegEx = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const limitRegEx = /^(?:[1-9][0-9]{0,3}|10000)$/;
const crsRegEx = /\b(?:http:\/\/www\.opengis\.net\/def\/crs\/EPSG\/0\/\d{4,6}|urn:ogc:def:crs:EPSG::\d{4,6})\b/;
const bboxRegEx = /^-?\d+(\.\d+)?(?:,-?\d+(\.\d+)?){3}$|^-?\d+(\.\d+)?(?:,-?\d+(\.\d+)?){5}$/;
// Timestamp according to RFC 3339
const rfc3339TimePattern = /([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))/;
// Complete pattern for all formats
const rfc3339CompletePattern = new RegExp(
    `^(${rfc3339TimePattern.source}|` +              // Individual timestamp
    `${rfc3339TimePattern.source}\\/\\.\\.|` +       // start/..
    `\\.\\.\\/${rfc3339TimePattern.source}|` +       // ../end
    `${rfc3339TimePattern.source}\\/${rfc3339TimePattern.source})$` // start/end
);

/**
 * An error from LM, or from talking to LM. status is what the client gets back.
 */
class NgpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * Logs one line about the error and answers the client. 404 from LM is passed on as 404, other LM
 * errors as 502. Never passes the error object to the client.
 */
function sendError(res, err, what) {
    const status = err instanceof NgpError ? err.status : 500;
    // A constant format string, and nothing from the request with line breaks in it
    console.error('ngp: %s: %s', String(what).replace(/[\r\n]/g, ''), err.message);
    if (res.headersSent) {
        // The error came while streaming, the client can only get a broken response
        res.destroy();
    } else {
        res.status(status).json({ error: status === 404 ? 'Not found' : 'Error fetching from Lantmäteriet' });
    }
}

function basicAuth() {
    return 'Basic ' + Buffer.from(configOptions.client_key + ':' + configOptions.client_secret).toString('base64');
}

/**
 * Logs in against LM and fills the global variable "token" with a new token
 */
async function createToken() {
    const url = new URL('token', configOptions.url_base);
    url.searchParams.set('scope', configOptions.scope);
    url.searchParams.set('grant_type', configOptions.grant_type);
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': basicAuth() } });
    if (!response.ok) {
        token = null;
        throw new NgpError(502, `fetching a token failed: HTTP ${response.status}`);
    }
    const responsebody = await response.json();

    token = responsebody.access_token;
    // We get how many seconds it lasts. Not an exact time. Calculate when it expires and deduct a little margin
    // for processing. You should be able to look in the token itself as well, but this is easier
    tokenExpires = Date.now() + responsebody.expires_in * 1000 - 10000;
}

/**
 * Revokes current token and resets global variable "token". A failed revoke is only logged, the
 * token has expired anyway.
 */
async function revokeToken() {
    const url = new URL('revoke', configOptions.url_base);
    url.searchParams.set('scope', configOptions.scope);
    url.searchParams.set('token', token);
    token = null;
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Authorization': basicAuth() } });
        if (!response.ok) {
            console.error('ngp: revoking the token failed: HTTP %d', response.status);
        }
    } catch (err) {
        console.error('ngp: revoking the token failed: %s', err.code || err.message);
    }
}

/**
 * Ensures there is a valid token. Called before making an API call
 */
async function ensureToken() {
    if (token && Date.now() > tokenExpires) {
        // Recall the old one just in case there would be time left for it
        await revokeToken();
    }
    if (!token) {
        await createToken();
    }
}

/**
 * Calls LM with the token. Retries once with a new token on 401, f.e. when the same consumer key
 * has been used to create a token on another server. Throws NgpError unless the answer is ok.
 */
async function lmFetch(url, init = {}) {
    await ensureToken();
    const call = () => fetch(url, { ...init, headers: { ...init.headers, 'Authorization': `Bearer ${token}` } });
    let response = await call();
    if (response.status === 401) {
        await createToken();
        response = await call();
    }
    if (!response.ok) {
        throw new NgpError(response.status === 404 ? 404 : 502, `LM answered HTTP ${response.status}`);
    }
    return response;
}

  /**
   * Lists all assets as attachments
   * @param {*} planid detailed plan designation to list assets for. On form 2281K-DP199 or xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxxxxxx
   * @returns List of file info
   */
async function listAssets(planid, res) {
    const url = new URL('distribution/geodatakatalog/sokning/v1/detaljplan/v2/search', configOptions.url_base);

    const regex = /\$(.+?)\$/g;
    // Escaped as a JSON string, so that the planid can't change the query
    const query = configOptions.query.replace(regex, () => JSON.stringify(String(planid)).slice(1, -1));
    const postdata = {
        "query": JSON.parse(query)
    };
    const response = await lmFetch(url, { method: 'POST', body: JSON.stringify(postdata), headers: { 'Content-Type': 'application/json' } });
    const responsebody = await response.json();
    const fileinfos = [];
    // There must be exactly one feature because we searched by id. A plan that is missing, or not in
    // force, has no attachments to show.
    const assets = responsebody.features && responsebody.features.length > 0 ? responsebody.features[0].assets : {};
    for (const key in assets) {
        if (Object.hasOwnProperty.call(assets, key)) {
            const asset = assets[key];

            // The plan file itself is also included, with that it should be uninteresting, so take everything else
            if (!asset.roles.includes('detaljplan')) {
                // Create a response according to origo attachment spec (AGS + group)
                // ID could be the asset serial number, so you have to look up href again when you want to retrieve, but
                // I don't know if the order is guaranteed, and there will be an extra call.
                const id = asset.href.split('/').pop();
                const fileInfo = {
                    "id": id,
                    // TODO: not sure it's pdf but we don't know and no one cares until we actually download
                    "contentType": 'application/pdf',
                    "name": asset.title,
                    // Group is not part of AGS-spec
                    "group": 'planer'
                };

                fileinfos.push(fileInfo);
            }
        }
    }
    res.json({ "attachmentInfos": fileinfos });
}


/**
 * If we download an asset and stream it back directly to the client, we avoid buffering.
 * @param {*} uuid uuid for current asset
 * @param {*} res the response object to stream the result to
 */
async function getDocument(uuid, res) {
    // Hopefully it's always at this url, otherwise we'll have to do another search and check the assets href.
    const url = new URL(`distribution/geodatakatalog/nedladdning/v1/asset/${uuid}`, configOptions.url_base);
    const response = await lmFetch(url);
    await new Promise((resolve, reject) => {
        response.body.on('error', reject);
        res.on('close', () => {
            // The client went away before the end, stop downloading from LM
            if (!response.body.readableEnded) response.body.destroy();
            resolve();
        });
        response.body.pipe(res);
    });
}

async function getItems(collid, limit, crs, bbox, bboxCrs, datetime, afterId, res) {
    const url = new URL(`distribution/geodatakatalog/sokning/v1/detaljplan/v2/collections/${collid}/items`, configOptions.url_base);
    // Validate parameters before setting on url.
    if (limitRegEx.test(limit)) {
        url.searchParams.set('limit', limit);
    }
    if (crsRegEx.test(crs)) {
        url.searchParams.set('crs', crs);
    }
    if (bboxRegEx.test(bbox)) {
        url.searchParams.set('bbox', bbox);
    }
    if (datetime) {
        if (rfc3339CompletePattern.test(datetime.replace(" ", "+"))) {  // Put back + which somehow disappered an replaced by space
            url.searchParams.set('datetime', datetime.replace(" ", "+"));
        }
    }
    if (crsRegEx.test(bboxCrs)) {
        url.searchParams.set('bbox-crs', bboxCrs);
    }
    if (uuidRegEx.test(afterId)) {
        url.searchParams.set('afterId', afterId);
    }
    const response = await lmFetch(url, { method: 'GET' });
    res.json(await response.json());
}

async function searchItems(foundObject, limit, crs, bbox, bboxCrs, datetime, afterId, res) {
    const url = new URL('distribution/geodatakatalog/sokning/v1/detaljplan/v2/search', configOptions.url_base);
    const postdata = {
        "query": JSON.parse(foundObject.query)
    };

    // Validate parameters before setting on url.
    if (limitRegEx.test(limit)) {
        postdata.limit = Number(limit);
    }
    if (crsRegEx.test(crs)) {
        url.searchParams.set('crs', crs);
    }
    if (bboxRegEx.test(bbox)) {
        postdata.bbox = bbox;
    }
    if (datetime) {
        if (rfc3339CompletePattern.test(datetime.replace(" ", "+"))) {  // Put back + which somehow disappered an replaced by space
            postdata.datetime = datetime.replace(" ", "+");
        }
    }
    if (crsRegEx.test(bboxCrs)) {
        url.searchParams.set('bbox-crs', bboxCrs);
    }
    if (uuidRegEx.test(afterId)) {
        url.searchParams.set('afterId', afterId);
    }
    if (typeof foundObject.collections !== 'undefined' && Array.isArray(foundObject.collections)) {
        postdata.collections = foundObject.collections;
    }
    const response = await lmFetch(url, { method: 'POST', body: JSON.stringify(postdata), headers: { 'Content-Type': 'application/json' } });
    res.json(await response.json());
}

/**
 * Express handler that handles list attachments. Sends back attachments according to origo's spec
 * @param {*} req
 * @param {*} res
 */
const listAll = async (req, res) => {
    const id = req.params.filenumber;
    try {
        await listAssets(id, res);
    } catch (err) {
        sendError(res, err, `attachments for plan ${id}`);
    }
}

/**
 * Express handler that streams a file to the client
 * @param {*} req
 * @param {*} res
 */
const fetchDoc = async (req, res) => {
    const documentid = req.params.uuid;
    if (!uuidRegEx.test(documentid)) {
        return res.status(400).json({ error: 'Not a valid document id' });
    }
    try {
        await getDocument(documentid, res);
    } catch (err) {
        sendError(res, err, `document ${documentid} in plan ${req.params.filenumber}`);
    }
}

/**
 * Get items from a collection as a GeoJSON.
 *
 * @async
 * @function
 * @name getCollectionItems
 * @kind variable
 * @param {any} req
 * @param {any} res
 * @returns {Promise<void>}
 */
const getCollectionItems = async (req, res) => {
    const collectionId = req.params.collectionId;
    const limit = req.query.limit ? req.query.limit : 100;
    const crs = req.query.crs ? req.query.crs : 'urn:ogc:def:crs:EPSG::3006';

    if (!/^[0-9]{4}$/.test(collectionId)) {
        return res.status(400).json({ error: 'Not a valid collection id' });
    }
    try {
        await getItems(collectionId, limit, crs, req.query.bbox, req.query['bbox-crs'], req.query.datetime, req.query.afterId, res);
    } catch (err) {
        sendError(res, err, `items in collection ${collectionId}`);
    }
}

const doSearch = async (req, res) => {
    const queryId = req.params.queryId;
    const limit = req.query.limit ? req.query.limit : 100;
    const crs = req.query.crs ? req.query.crs : 'urn:ogc:def:crs:EPSG::3006';

    // Find a predefined search that matches the one that is requested
    const foundObject = /^[a-zA-Z0-9]+$/.test(queryId) && (configOptions.search || []).find(item => item.name === queryId);
    if (!foundObject) {
        return res.status(400).json({ error: 'Not a valid search' });
    }
    try {
        await searchItems(foundObject, limit, crs, req.query.bbox, req.query['bbox-crs'], req.query.datetime, req.query.afterId, res);
    } catch (err) {
        sendError(res, err, `search ${queryId}`);
    }
}

module.exports = { listAll, fetchDoc, getCollectionItems, doSearch };
