"use strict";

const URL = require('url');
var http = require('http');
var https = require('https');

// this method takes a url, sends the request and returns the xml document as result
// no processing on the result is done here, so it can be used to fetch any kind of data that is in xml format.
var fetchData = function (url) {
  var url = URL.parse(url);
  if (url.protocol == 'http:')
    return new Promise(function (resolve, reject) {
      http.get(url, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if (!contentType.includes('xml') && !contentType.includes('XML')) {
          error = new Error('Invalid content-type.\n' +
            `Expected text/xml but received ${contentType}`);
        }
        if (error) {
          // console.error(error.message);
          // consume response data to free up memory
          res.resume();
          reject(error);
          return;
        }
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            resolve(rawData);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
        reject(e);
      });
    });

  if (url.protocol == 'https:')
    return new Promise(function (resolve, reject) {
      https.get(url, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if (!contentType.includes('xml') && !contentType.includes('XML')) {
          error = new Error('Invalid content-type.\n' +
            `Expected text/xml but received ${contentType}`);
        }
        if (error) {
          // console.error(error.message);
          // consume response data to free up memory
          res.resume();
          reject(error);
          return;
        }
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          //console.log(res);
          try {
            resolve(rawData);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
        reject(e);
      });
    });
}

var fixUrlforGetCapabilities = function (source) {
  var service = source.service;
  var urlString = source.url;
  var fixedUrl = '';
  var host = '';
  var index = urlString.indexOf('?');
  if (index !== -1) {
    host = urlString.slice(0, index);
  } else {
    host = urlString;
  }

  fixedUrl = host + '?request=getcapabilities&service=' + source.service + '&version=' + source.version;
  return fixedUrl;
}

var fixUrlforDescribeFeaturType = function (source, layerName) {
  var service = source.service;
  var urlString = source.url;
  var fixedUrl = '';
  var host = '';
  var index = urlString.indexOf('?');
  if (index !== -1) {
    host = urlString.slice(0, index);
  } else {
    host = urlString;
  }

  if (service.toLowerCase() === 'wms') {
    if (host.includes('wms') || host.includes('WMS') || host.includes('Wms')) {
      host = host.replace(/Wms/g, 'Wfs').replace(/WMS/g, 'WFS').replace(/wms/g, 'wfs');
    }
  }

  fixedUrl = host + '?request=DescribeFeatureType&typename=' + layerName + '&service=wfs&version=' + source.version;
  console.log(fixedUrl);
  return fixedUrl;
}

module.exports.fetchData = fetchData;
module.exports.fixUrlforGetCapabilities = fixUrlforGetCapabilities;
module.exports.fixUrlforDescribeFeaturType = fixUrlforDescribeFeaturType;
