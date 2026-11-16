/**
 * Handler for getting an authentication token for Lantmäteriets services
 * Usage: 
 * Get consumer_key, consumer_secret and alternate set the scope at 
 * Lantmäteriets API-portal. Set them values in config.js.
 * 
 */

// Dependencies
const axios = require('axios');

// Export the module, invoke promise where service is requested.
// Resolves with the response body as text, also for an error status, and rejects only on network
// errors.
module.exports = function getToken(url_token, key, secret, scope) {
    return axios({
        url: url_token,
        method: 'POST',
        auth: {
            username: key,
            password: secret
        },
        data: new URLSearchParams({
            'scope': scope,
            'grant_type': 'client_credentials'
        }),
        responseType: 'text',
        validateStatus: () => true
    })
    .then(({ data }) => data)
    .catch(() => {
        throw 'An error occured collecting token: ';
    });
}
