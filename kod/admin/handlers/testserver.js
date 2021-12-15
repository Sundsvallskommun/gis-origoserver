// var express = require('express');
// var path = require('path');
// var bodyParser = require('body-parser');
var rp = require('request-promise');
var xml2js = require('xml2js');
var _ = require('lodash');

// var app = express();
// app.use(bodyParser.json());

// var server = app.listen(3001, function () {
//     var host = server.address().address;
//     var port = server.address().port;
//     console.log('Origo server listening at http://%s:%s', host, port)
// });

// app.post('/getCapibilities', function (req, res) {
const getLayers = function (req, res) {
    console.log(req.query);
    const url = req.query.url;
    // const service = null;
    const service = 'wms';
    const version = '1.3.0';
    getCapabilities(url, service, version).then(result => {
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, stripPrefix: true });
        parser.parseString(result, function (err, result) {
            if (err) {
                console.log(err);
                throw new Error(err);
            } else {
                let geoServerLayers = null;
                // different servers or different versions of a server have different response formats
                if (result.WMS_Capabilities) {
                    console.log('Number of all layers fetched: ' + result.WMS_Capabilities.Capability.Layer.Layer.length);
                    geoServerLayers = result.WMS_Capabilities.Capability.Layer.Layer;

                } else if (result.WMT_MS_Capabilities) {
                    console.log('Number of all layers fetched: ' + result.WMT_MS_Capabilities.Capability.Layer.Layer.length);
                    geoServerLayers = result.WMT_MS_Capabilities.Capability.Layer.Layer;

                } else if (result.WFS_Capabilities) {
                    console.log('Number of all layers fetched: ' + result.WFS_Capabilities.FeatureTypeList.FeatureType.length);
                    geoServerLayers = result.WFS_Capabilities.FeatureTypeList.FeatureType;

                } else if (result['wfs:WFS_Capabilities']) {
                    console.log('Number of all layers fetched: ' + result['wfs:WFS_Capabilities'].FeatureTypeList.FeatureType.length);
                    geoServerLayers = result['wfs:WFS_Capabilities'].FeatureTypeList.FeatureType;

                } else {
                    response.send(JSON.stringify('no service for this url or request parameters!'));
                    return;
                }
                // const layersWithAttributes = geoServerLayers.map(layer => {
                //     if (layer.queryable == "0" || !layer.queryable) {
                //         return layer;
                //     } else
                //         return describeFeatureType(layer, url).then(result => 'iman');
                // });
                // Promise.all(layersWithAttributes)
                //     .then(result => res.json(result))
                //     .catch(err => res.set(400).send(err.message));
                res.send(geoServerLayers);
            }
        });
    }).catch(err => {
        res.status(400).json(err.message);
    });
};

const getCapabilities = function (url, service, version) {

    let fixedUrl = url + '?request=getcapabilities';
    if (service) {
        fixedUrl = fixedUrl + '&service=' + service;
    }
    if (version) {
        fixedUrl = fixedUrl + '&version=' + version;
    }
    const options = {
        method: 'GET',
        url: fixedUrl
    };
    console.log(fixedUrl);
    return rp(options);
}
let c = 0;
const describeFeatureType = function (layer, url) {
    if (layer.queryable == "0" || !layer.queryable) {
        return layer;
    }
    let fixedUrl = url.toString();
    // console.log(fixedUrl);

    if (fixedUrl.includes('geoserver/wms')) {
        fixedUrl = fixedUrl.replace('geoserver/wms', 'geoserver/wfs');
    }
    if (fixedUrl.includes('wms')) {
        fixedUrl = fixedUrl.replace('wms', 'wfs');
    }

    fixedUrl = fixedUrl + '?request=DescribeFeatureType&typename=' + layer.Name + '&service=wfs';
    // console.log(url);
    const options = {
        method: 'GET',
        url: fixedUrl
    };
    return rp(options);
}

// module.exports = app;
module.exports = getLayers;


/*app.get('/admin/ogctest', function(req, res) {
  // this is a convinient way of parsing an OGC GetCapabilities Document to JSON with nodejs
  // q=http://extmaptest.sundsvall.se/geoserver/wms?request=getcapabilities
  if (req.query) {
    //set method from req
    console.log(req.method);
    var options = {
      method: req.method,
      url: req.query.q,
      headers: {
        'User-Agent': 'opendispatcher'
      },
      timeout: 20000 //6 seconds
    };
    var request = require('request');
    x = request(options);
    x.on('response', function(response) {
      var data = [];
      response.on('data', function(chunk) {
        data.push(chunk);
      });
      response.on('end', function() {
        var finaldata = data.join('');
        var xml2js = require('xml2js');
        var parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, stripPrefix: true });
        parser.parseString(finaldata, function(err, result) {
          if (err) {
            console.log(err);
            res.end();
          } else {
            res.json(result);
          }
        });
      });
    });
    x.on('error', function(err) {
      res.status(400).json({
        "error": "Timeout on proxy"
      });
    });
  } else {
    res.status(400).json({
      "error": "wrong use of proxy"
    });
  }
});*/