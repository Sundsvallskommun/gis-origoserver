const fetch = require('node-fetch');
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
        headers: {
            'Authorization': 'Basic ' + authString,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: urlencoded,
        redirect: 'follow'
    };

    await fetch(service.url, requestOptions)
        .then(response => response.json())
        .then(result => {
            simpleStorage.setToken(result.access_token);
            simpleStorage.setTokenTime((result.expires_in - 10));
        })
        .catch(error => console.log('error', error));

    return token;
}

async function getFromUrl(token, url) {
    var returnResponse;

    var requestOptions = {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/geo+json'
        }
    };

    await fetch(url, requestOptions)
        .then(response => returnResponse = response.json())
        .catch(error => console.log('error', error));

    return returnResponse;
}

module.exports.getToken = getToken;
module.exports.getFromUrl = getFromUrl;
