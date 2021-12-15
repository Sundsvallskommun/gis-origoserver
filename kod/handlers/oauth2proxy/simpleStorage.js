const apiFunctions = require('./APIFunctions');

var globalValue = "";
var prodToken = "";
var sandboxToken = "";
var type = "";
var prodTokenTime = null;
var sandboxTokenTime = null;

async function getValue() {
    return globalValue;
}

function setValue(value) {
    globalValue = value;
}

async function getToken(service) {
    var currentTime = new Date();
    if (service.type === 'sandbox') {
      if (sandboxTokenTime != null && +currentTime < + sandboxTokenTime) {
          return sandboxToken;
      }
      else {
          await apiFunctions.getToken(service);
          return sandboxToken;
      }
    } else {
      if (prodTokenTime != null && +currentTime < + prodTokenTime) {
          return prodToken;
      }
      else {
          await apiFunctions.getToken(service);
          return prodToken;
      }
    }
}

function setToken(inputToken, inputType) {
    if (inputType === 'sandbox') {
      sandboxToken = inputToken;
    } else {
      prodToken = inputToken;
    }
    type = inputType;
}

async function getTokenTime(type) {
  if (type === 'sandbox') {
    return sandboxTokenTime;
  } else {
    return prodTokenTime;
  }
}

function setTokenTime(seconds, type) {
    var d = new Date();
    if (type === 'sandbox') {
      sandboxTokenTime = new Date(d.getTime() + (seconds * 1000));
    } else {
      prodTokenTime = new Date(d.getTime() + (seconds * 1000));
    }
}

module.exports.getValue = getValue;
module.exports.setValue = setValue;
module.exports.getToken = getToken;
module.exports.setToken = setToken;
module.exports.getTokenTime = getTokenTime;
module.exports.setTokenTime = setTokenTime;
