var conf = require('../conf/config');
const url = require('url');
const apiFunctions = require('./oauth2proxy/APIFunctions');
const simpleStorage = require('./oauth2proxy/simpleStorage');

// Token holder
let token;
let q;
let proxyUrl;
var configStub = 'oauth2proxy';

var oauth2proxy = async (req, res) => {
  if (conf[configStub]) {
    configOptions = Object.assign({}, conf[configStub]);
    scope = configOptions.scope;
    const parsedUrl = url.parse(decodeURI(req.url), true);
    if ('q' in parsedUrl.query) {
      q = parsedUrl.query.q;
    } else {
      q = '';
      console.log('No query specified!');
      res.send({});
    }
    if ('url' in parsedUrl.query) {
      proxyUrl = parsedUrl.query.url;
    } else {
      proxyUrl = '';
      console.log('No url specified!');
      res.send({});
    }

    if (conf[configStub]) {
      options = Object.assign({}, conf[configStub]);
      var configFound = false;
      for (i = 0; i < options.services.length; i++) {
        if (options.services[i].name === q) {
          configFound = true;
          await getUrl(req, res, options.services[i], proxyUrl);
        }
      }
      if (!configFound) {
        console.log('Missing config!');
        res.send({});
      }
    } else {
      console.log('ERROR config!');
      res.send({});
    }
  }
}

// Export the module
module.exports = oauth2proxy;

async function getUrl(req, res, service, url) {
  let ts = Date.now();
  var token = await simpleStorage.getToken(service);
  ts = Date.now();
  var urlResponse = await apiFunctions.getFromUrl(token, url);
  res.send(urlResponse);
}
