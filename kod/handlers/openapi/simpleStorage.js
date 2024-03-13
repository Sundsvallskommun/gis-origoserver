const apiFunctions = require('./getFunctions');

var globalValue = "";
var registerToken = "";
var estateToken = "";
var ownerToken = "";
var addressToken = "";
var type = "";
var registerTokenTime = null;
var estateTokenTime = null;
var ownerTokenTime = null;
var addressTokenTime = null;

async function getValue() {
  return globalValue;
}

function setValue(value) {
  globalValue = value;
}

async function getToken(service) {
  var currentTime = new Date();
  switch (service.type) {
    case 'estate':
      if (estateTokenTime != null && +currentTime < + estateTokenTime) {
        return estateToken;
      }
      else {
        await apiFunctions.getToken(service);
        return estateToken;
      }
    case 'owner':
      if (ownerTokenTime != null && +currentTime < + ownerTokenTime) {
        return ownerToken;
      }
      else {
        await apiFunctions.getToken(service);
        return ownerToken;
      }
    case 'register':
      if (registerTokenTime != null && +currentTime < + registerTokenTime) {
        return registerToken;
      }
      else {
        await apiFunctions.getToken(service);
        return registerToken;
      }
    case 'address':
      if (addressTokenTime != null && +currentTime < + addressTokenTime) {
        return addressToken;
      }
      else {
        await apiFunctions.getToken(service);
        return addressToken;
      }
      
    default:
      if (registerTokenTime != null && +currentTime < + registerTokenTime) {
        return registerToken;
      }
      else {
        await apiFunctions.getToken(service);
        return registerToken;
      }
  }
}

function setToken(inputToken, tokenType) {
  switch (tokenType) {
    case 'estate':
      estateToken = inputToken;
      break;
    case 'owner':
      ownerToken = inputToken;
      break;
    case 'register':
      registerToken = inputToken;
      break;
    case 'address':
      addressToken = inputToken;
      break;
      
    default:
      registerToken = inputToken;
      break;
  }
  type = tokenType;
}

async function getTokenTime(tokenType) {
  switch (tokenType) {
    case 'estate':
      return estateToken;
    case 'owner':
      return ownerToken;
    case 'register':
      return registerToken;
    case 'address':
      return addressToken;
          
    default:
      return registerToken;
  }
}

function setTokenTime(seconds, tokenType) {
  var d = new Date();
  switch (tokenType) {
    case 'estate':
      estateTokenTime = new Date(d.getTime() + (seconds * 1000));
      break;
    case 'owner':
      ownerTokenTime = new Date(d.getTime() + (seconds * 1000));
      break;
    case 'register':
      registerTokenTime = new Date(d.getTime() + (seconds * 1000));
      break;
    case 'address':
      addressTokenTime = new Date(d.getTime() + (seconds * 1000));
      break;
      
    default:
      registerTokenTime = new Date(d.getTime() + (seconds * 1000));
      break;
    }
}

module.exports.getValue = getValue;
module.exports.setValue = setValue;
module.exports.getToken = getToken;
module.exports.setToken = setToken;
module.exports.getTokenTime = getTokenTime;
module.exports.setTokenTime = setTokenTime;
