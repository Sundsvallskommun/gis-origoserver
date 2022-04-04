var conf = require('../conf/config');
var proxyRequest = require('../lib/proxyrequest');
const url = require('url');

module.exports = function cascadeWMS(req, res) {
  var proxyUrl = 'cascadeWMS';
  var options;
  if (conf[proxyUrl]) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    const layers = parsedUrl.query.LAYERS;
    let search = parsedUrl.search;
    conf[proxyUrl].proxies.forEach(function(proxy) {
  		if (proxy.layers.includes(layers)) {
        if ('nativeLayers' in proxy) {
          search = search.replace('&QUERY_LAYERS='+layers, '&QUERY_LAYERS='+proxy.nativeLayers[layers]);
          search = search.replace('&LAYERS='+layers, '&LAYERS='+proxy.nativeLayers[layers]);
        }
        options = Object.assign({}, proxy.options);
        options.url = options.url + search;
        proxyRequest(req, res, options);
      }
  	});
  }
}
