// all requests that start with "/admin/layer" is redirected to this module.

var express = require('express');
var layerRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*********************************************************************CRUD layer*********************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
layerRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    var layerName = req.query.name;
    var searchStr = req.query.search;
    var configId = req.query.configId;

    // OBS! name=someName takes precedence over search, if name query exists search will have no effect
    if (layerName)
      req.models.Layer.find({ name: layerName }, function (err, layers) {
        if (layers.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(layers);
      });
    else if (searchStr)
      req.models.Layer.find({ name: orm.like("%" + searchStr + "%") }, function (err, layers) {
        console.log('Number of layers fetched that match the search query "' + searchStr + '" : ' + layers.length);
        if (layers.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(layers);
      });
    // funktion för att hämta alla lager som har en viss konfig
    else if (configId)
      req.models.Layer.find({ config_id: configId }, function (err, layers) {
        console.log('Number of layers fetched that belong to the configId ' + configId + ' = ' + layers.length);
        if (layers.length == 0)
          res.status(404).json({});
        else
          res.status(200).json(layers);
      });
    else if (_.isEmpty(req.query))
      req.models.Layer.find(function (err, layers) {
        console.log('Number of all layers fetched : ' + layers.length);
        if (layers.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(layers);
      });
    else
      res.sendStatus(400);
  })
  .post(function (req, res) {
    const newLayer = req.body;
    req.models.Layer.create(newLayer, function (err, layer) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log('New layer saved with id : ' + layer.id);
        res.status(201).json(layer);
      }
    });
  });

layerRouter.route('/:id')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    req.models.Layer.find({ id: req.params.id }, function (err, layers) {
      if (layers.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(layers);
      }
    });
  })
  .put(function (req, res, next) {
    let newLayer = req.body;
    req.models.Layer.get(req.params.id, function (err, layer) {
      if (!layer) {
        res.sendStatus(404);
      } else {
        Object.assign(layer, newLayer);
        layer.save(function (err) {
          if (err) res.sendStatus(500);
          else res.status(200).json({});
        });
      }
    })
  })
  .post(function (req, res, next) {
    res.sendStatus(400);
  })
  .delete(function (req, res, next) {
    req.models.Layer.get(req.params.id, function (err, layer) {
      if (!layer) res.sendStatus(404);
      else layer.remove(function (err) {
        if (err) res.sendStatus(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = layerRouter;