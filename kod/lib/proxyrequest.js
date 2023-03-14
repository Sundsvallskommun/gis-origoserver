var request = require('request');

module.exports = function proxyRequest(req, res, options) {
  if (!res.header('Access-Control-Allow-Origin')) {
    res.header("Access-Control-Allow-Origin", "*");
  }
  if (!res.header('Access-Control-Allow-Headers')) {
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  }
  req.pipe(request.get(options))
  .on('error', err => {
    const msg = 'Error!';
    console.error(msg, err);
    return res.status(500).send(msg);
  })
  .pipe(res);
}
