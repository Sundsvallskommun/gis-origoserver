const axios = require('axios').default;
const simpleStorage = require('./simpleStorage');

async function getToken(service) {
    var token = "";
    const client_key = service.client_key;
    const client_secret = service.client_secret;
    var authString = Buffer.from(client_key + ':' + client_secret, 'utf-8').toString('base64');

    var urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", service.grant_type);

    var requestOptions = {
        method: 'POST',
        url: service.url,
        headers: {
            'Authorization': 'Basic ' + authString,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: urlencoded
    };

    await axios(service.url, requestOptions)
        .then(response => {
          simpleStorage.setToken(response.data.access_token, service.type);
          simpleStorage.setTokenTime((response.data.expires_in - 10), service.type);
        })
        .catch(error => console.log('error', error));

    return token;
}

async function getFromUrl(token, url) {
    var returnResponse;

    var requestOptions = {
        method: 'GET',
        url: url,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/geo+json'
        }
    };

    let ts = Date.now();
    await axios(requestOptions)
        .then(response => {
          returnResponse = response.data;
        })
        .catch(error => console.log('error', error));

    ts = Date.now();

    return returnResponse;
}

module.exports.getToken = getToken;
module.exports.getFromUrl = getFromUrl;
