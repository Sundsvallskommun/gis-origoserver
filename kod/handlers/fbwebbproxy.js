var conf = require('../conf/config');
const axios = require('axios');
const https = require('https');

module.exports = function fbwebbProxy(req, res) {
    var proxyUrl = 'fbwebbproxy';
    var options;
    const agent = new https.Agent({  
        rejectUnauthorized: false
    });
    if (conf[proxyUrl]) {
        const uuid = req.query.uuid;
        options = Object.assign({}, conf[proxyUrl]);
        options.url = options.url + uuid;
        axios.get(options.url, {
            proxy: {
                host: options.host,
                port: options.port,
                auth: {
                    username: options.user,
                    password: options.pass
                }
            },
            httpsAgent: agent
            })
            .then((response) => {
            console.log(response.data);
            })
            .catch((error) => {
            console.error(error);
            });
    }

  }