const conf = require('../../conf/config');
const openidIssuer = require('./openidIssuer');

module.exports = async function authorize(req, res) {
  try {
    const client = await openidIssuer.getOpenidClient();
    console.log('client');
    console.log(client);
    console.log('req.query.redirectUrl');
    console.log(req.query.redirectUrl);
    console.log('conf.auth.redirect_uris[req.query.redirectUrl]');
    console.log(conf.auth.clients[req.query.redirectUrl]);
    const callbackUrl = conf.auth.clients[req.query.redirectUrl];
    console.log('callbackUrl');
    console.log(callbackUrl);
	  if(callbackUrl) {		
      const authorizationUrl = client.authorizationUrl({
      redirect_uris: callbackUrl,
      response_type: 'code',
      scope: conf.auth.scope ?? 'openid',
      state: (req.query.state !== null && req.query.state !== undefined) ? req.query.state : 'just-in'
    });
    res.redirect(authorizationUrl);
    } else {
    res.status(500).send('authorize error');
    }
  } catch (e) {
      console.log('authorize');
      console.error(e.toString());
      res.status(500).send('authorize error');
  }
};