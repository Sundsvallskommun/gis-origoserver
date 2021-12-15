var conf = require('../conf/config');
var proxyRequest = require('../lib/proxyrequest');

module.exports = function lmProxy(req, res) {
  var proxyUrl = 'lmproxy';
  var options;
  if (conf[proxyUrl]) {
    options = Object.assign({}, conf[proxyUrl]);
    console.log(req.url.split(proxyUrl)[1]);
    options.url = options.url + req.url.split(proxyUrl)[1];
    console.log(options.url);
    proxyRequest(req, res, options);
  }
}
