const conf = require('../conf/config');
const axios = require('axios');
const describeAxiosError = require('../lib/describeaxioserror');
const osmToGeoJSON = require('../lib/osmtogeojson');

const DEFAULT_URL = 'https://overpass-api.de/api/interpreter';
// overpass-api.de answers 406 to requests without a User-Agent of their own
const DEFAULT_USER_AGENT = 'origoserver';

// Runs the configured Overpass query named by q and answers with GeoJSON, or {} if there is no such
// query or the query fails. The query must ask for JSON ([out:json]).
module.exports = async function overpass(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const config = conf.overpass;
  if (!config) {
    console.error('ERROR config! overpass is missing in conf');
    return res.send({});
  }
  const query = (config.queries || []).find((item) => item.name === q);
  if (!query) {
    // A constant format string, and q from the request without line breaks
    console.log('overpass: no query named %s', q.replace(/[\r\n]/g, ''));
    return res.send({});
  }
  // options is a JSON string in the config template, but may also be an object
  let options = query.options || {};
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (err) {
      console.error('ERROR overpass %s: options is not JSON', query.name);
      options = {};
    }
  }
  try {
    const response = await axios({
      url: options.overpassUrl || config.url || DEFAULT_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': config.user_agent || DEFAULT_USER_AGENT,
      },
      data: new URLSearchParams({ data: query.query }).toString(),
      timeout: config.timeout_ms || 120000,
    });
    if (typeof response.data !== 'object' || response.data === null) {
      console.error('ERROR overpass %s: the answer is not JSON, does the query have [out:json]?', query.name);
      return res.send({});
    }
    return res.send(osmToGeoJSON(response.data, { flatProperties: Boolean(options.flatProperties) }));
  } catch (err) {
    console.error('ERROR overpass %s: %s', query.name, describeAxiosError(err));
    return res.send({});
  }
};
