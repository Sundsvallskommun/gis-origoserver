// all requests that start with "/admin/config" is redirected to this module.

var express = require('express');
var capabilitiesRouter = express.Router();
var helperFunctions = require('./helperFunctions');
var xml2js = require('xml2js');
var formatter = require('./formatter');
const url = require('url');

capabilitiesRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    // Get the query parameters from the url
    const parsedUrl = url.parse(decodeURI(req.url), true);
    console.log(parsedUrl);
    const protocol = parsedUrl.query.protocol;
    const baseurl = parsedUrl.query.baseurl;
    const service = parsedUrl.query.service;
    const version = parsedUrl.query.version;

    var getCapabilitiesUrl = protocol + '://' + baseurl + '?request=getcapabilities&service=' + service + '&version=' + version;
    helperFunctions.fetchData(getCapabilitiesUrl)
      .then(data => parseXMLfromGeoserver(data, res))
      .catch(function (err) {
        res.json(err.message);
        console.log('from layers catch: ' + err);
      });
  })
  .post(function (req, res) {
    // var url = req.query.url;
    var source = req.body;
    var url = source.url;
    console.log(source);


    var getCapabilitiesUrl = helperFunctions.fixUrlforGetCapabilities(source);
    // var getCapabilitiesUrl = url + '?request=getcapabilities' + '&service=wfs';
    console.log(getCapabilitiesUrl);

    helperFunctions.fetchData(getCapabilitiesUrl)
      .then(data => parseXMLfromGeoserver(data, res))
      .catch(function (err) {
        res.json(err.message);
        console.log('from layers catch: ' + err);
      });
    });

function parseXMLfromGeoserver(rawData, res) {
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false, stripPrefix: true });
      parser.parseString(rawData, function (err, result) {

        console.log(result);
        var geoServerLayers;
        // different versions of WMS have slightly different xml schemes.
        if (result.WMS_Capabilities) {
          console.log('Number of all layers fetched: ' + result.WMS_Capabilities.Capability.Layer.Layer.length);
          geoServerLayers = result.WMS_Capabilities.Capability.Layer.Layer;

        } else if (result.WMT_MS_Capabilities) {
          console.log('Number of all layers fetched: ' + result.WMT_MS_Capabilities.Capability.Layer.Layer.length);
          geoServerLayers = result.WMT_MS_Capabilities.Capability.Layer.Layer;

        } else if (result.WFS_Capabilities) {
          console.log('Number of all layers fetched: ' + result.WFS_Capabilities.FeatureTypeList.FeatureType.length);
          geoServerLayers = result.WFS_Capabilities.FeatureTypeList.FeatureType;

        } else if (result['wfs:WFS_Capabilities'] && result['wfs:WFS_Capabilities']['wfs:FeatureTypeList']) {
          console.log('Number of all layers fetched: ' + result['wfs:WFS_Capabilities']['wfs:FeatureTypeList']['wfs:FeatureType'].length);
          geoServerLayers = result['wfs:WFS_Capabilities']['wfs:FeatureTypeList']['wfs:FeatureType'];

        } else if (result['wfs:WFS_Capabilities'] && result['wfs:WFS_Capabilities']['FeatureTypeList']) {
          console.log('Number of all layers fetched: ' + result['wfs:WFS_Capabilities']['FeatureTypeList']['FeatureType'].length);
          geoServerLayers = result['wfs:WFS_Capabilities']['FeatureTypeList']['FeatureType'];

        } else {
          res.send(JSON.stringify('no service for this url or request parameters!'));
          return;
        }

        // here geoServer layers are converted to proper format
        var layers = geoServerLayers.map(function (geoServerLayer) {
          return new formatter.Layer(geoServerLayer);
        });
        res.json(layers);
        // response.json(geoServerLayers);
    })
  }

module.exports = capabilitiesRouter;










/*
 let parseXMLfromGeoserver = function(rawData) {
    xmlParser(rawData, function(err, result) {

      var geoServerLayers;
      // different versions of WMS have slightly different xml schemes.
      // here we handle 1.1.0, 1.1.1, 1.3.0 for getting layers
      if (result.WMS_Capabilities) { // OpenGIS® Web Map Server Implementation Specification version 1.1.0 & 1.1.1
        console.log('Number of all layers fetched: ' + result.WMS_Capabilities.Capability[0].Layer[0].Layer.length);
        // here geoServer layers are in json format, but values are returned in an array
        geoServerLayers = result.WMS_Capabilities.Capability[0].Layer[0].Layer;

      } else if (result.WMT_MS_Capabilities) { // OpenGIS® Web Map Server Implementation Specification version 1.3.0
        console.log('Number of all layers fetched: ' + result.WMT_MS_Capabilities.Capability[0].Layer[0].Layer.length);
        // here geoServer layers are in json format, but values are returned in an array
        geoServerLayers = result.WMT_MS_Capabilities.Capability[0].Layer[0].Layer;
      } else {
        response.send(JSON.stringify('no service for this url or request parameters!'));
        return;
      }

      // here geoServer layers are converted to proper format
      var myLayers = geoServerLayers.map(function(geoServerLayer) {
        return new formatter.Layer(geoServerLayer);
      });

      // here arrributes are fetched for queryable layers, attributes are in xml format
      // for those layers that are not queryable we return an object with name and index
      var myLayersAttributes = myLayers.map(function(layer, index) {

        if (layer.queryable) { // here we should ckeck if layer is queryable, if it is then we can use describeFeatureType service to get its attributes
        // if (false) {
          var describeFeatureTypeUrl = helperFunctions.fixUrlforDescribeFeaturType(url, layer.name);
          // console.log(describeFeatureTypeUrl);
          return helperFunctions.fetchData(describeFeatureTypeUrl);
        } else {
          // console.log('========> ' + index + ' ' + layer.name)
          return {
            name: layer.name,
            index: index,
            notXML: true
          };
        }
      });

      // Promise.all takes an array of promises, but here for those layers that are not queryable it has
      // an object instead of a promise. in this case it delivers the same object as result. Therefore
      // arrayOfAttributes is composed of results of resolved promises(xml) and raw objects
      Promise.all(myLayersAttributes).then(function(arrayOfAttributes) {

        arrayOfAttributes.forEach(function(att, index) {
          if (att.hasOwnProperty('notXML')) {
            return;
          } else {
            // here arributes are converted to json format, xmlParser returns undefined for those values that are not xml
            xmlParser(att, function(err, jsonAttribute) {
              myLayers[index].attributes = formatter.Attribute(jsonAttribute);
            });
          }
        });
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(myLayers));
      }).catch(function(err) {
        // response.send(JSON.stringify(err.message));
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(myLayers)); // if it fails from WMS side "fetchData()" will be rejected, but we still want to have layers even without attributs!
        console.log('from attributes catch: ' + err.message);
      });
    });
  }
*/
