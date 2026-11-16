const axios = require('axios');
const describeAxiosError = require('./describeaxioserror');

// Request headers from the client that are passed on. Not the others, such as Cookie and
// Authorization, which belong to this server and not to the proxied one.
const FORWARDED_REQUEST_HEADERS = [
  'accept', 'accept-encoding', 'accept-language', 'user-agent',
  'if-none-match', 'if-modified-since', 'range'
];

// Response headers that apply to a single connection and are not passed on to the client.
const HOP_BY_HOP_HEADERS = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
];

const MAX_REDIRECTS = 10;

/**
 * Proxies a GET to options.url and streams the response, status and headers, back to the client.
 *
 * options:
 *   url            - the address to fetch
 *   auth           - optional basic auth, { user, pass }
 *   allowRedirect  - optional function(url) that says whether a redirect to url may be followed.
 *                    If it returns false the redirect is passed on to the client. Default all
 *                    redirects are followed.
 */
module.exports = function proxyRequest(req, res, options) {
  if (!res.header('Access-Control-Allow-Origin')) {
    res.header("Access-Control-Allow-Origin", "*");
  }
  if (!res.header('Access-Control-Allow-Headers')) {
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  }

  // false keeps axios from adding its own Accept, Accept-Encoding and User-Agent. Otherwise the
  // server could compress a response for a client that didn't ask for it, since the response is
  // passed on as is.
  const headers = { accept: false, 'accept-encoding': false, 'user-agent': false };
  FORWARDED_REQUEST_HEADERS.forEach((name) => {
    if (req.headers[name]) headers[name] = req.headers[name];
  });
  const auth = options.auth && { username: options.auth.user, password: options.auth.pass };
  const allowRedirect = options.allowRedirect || (() => true);

  // Stop fetching if the client goes away
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const fetch = (url, redirects) => axios({
    url,
    method: 'GET',
    headers,
    auth,
    responseType: 'stream',
    // Passed through as is, with the server's Content-Encoding
    decompress: false,
    // Redirects are handled below so that each one can be checked
    maxRedirects: 0,
    validateStatus: () => true,
    signal: controller.signal
  }).then((response) => {
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location && redirects < MAX_REDIRECTS) {
      let next;
      try {
        next = new URL(location, url).href;
      } catch (e) {
        next = null;
      }
      if (next && allowRedirect(next)) {
        response.data.destroy();
        return fetch(next, redirects + 1);
      }
    }
    return response;
  });

  fetch(options.url, 0)
    .then((response) => {
      res.status(response.status);
      Object.entries(response.headers).forEach(([name, value]) => {
        if (!HOP_BY_HOP_HEADERS.includes(name.toLowerCase())) res.setHeader(name, value);
      });
      response.data.on('error', (err) => {
        console.error('Proxy: the response was interrupted:', err.code || err.message);
        res.destroy();
      });
      response.data.pipe(res);
    })
    .catch((err) => {
      if (axios.isCancel(err)) return;
      const msg = 'Error!';
      // Not the whole err: err.config holds the url and auth.
      console.error(msg, describeAxiosError(err));
      if (!res.headersSent) res.status(500).send(msg);
    });
}
