// all requests that start with "/admin/layer" is redirected to this module.

var express = require('express');
var attributeRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*********************************************************************CRUD attribute*********************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
attributeRouter.route('/')
  .all(function(req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function(req, res, next) {
    res.sendStatus(200);
  })
  .get(function(req, res, next) {
    const layerId = req.query.layerId;
    // funktion för att hämta alla attribute som tillhör ett visst lager
    if (layerId)
      req.models.Attribute.find({ layer_id: layerId }, function(err, attributes) {
        console.log('Number of attributes fetched that belong to the layerId ' + layerId + ' = ' + attributes.length);
        if (attributes.length == 0)
          res.status(200).json([]);
        else
          res.status(200).json(attributes);
      });
    else if (_.isEmpty(req.query))
      req.models.Attribute.find(function(err, attributes) {
        console.log('Number of all attributes fetched : ' + attributes.length);
        if (attributes.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(attributes);
      });
    else
      res.sendStatus(400);
  })
  // OBS! note that this function expects an array of attributes! 
  // if we send one sigle object, the result will be a single object with its database id, 
  // but if send an array of objects, the result will be an array of objects too with all objects having an id from db.
  .post(function(req, res) {
    const newAttributes = req.body;
    req.models.Attribute.create(newAttributes, function(err, attributes) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log(attributes.length + ' New attributes saved');
        res.status(201).json(attributes);
      }
    });
  });

attributeRouter.route('/:id')
  .all(function(req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function(req, res, next) {
    res.sendStatus(200);
  })
  .get(function(req, res, next) {
    req.models.Attribute.find({ id: req.params.id }, function(err, attributes) {
      if (attributes.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(attributes);
      }
    });
  })
  .put(function(req, res, next) {
    let newAttribute = req.body;
    req.models.Attribute.get(req.params.id, function(err, attribute) {
      if (!attribute) {
        res.sendStatus(404);
      } else {
        Object.assign(attribute, newAttribute);
        attribute.save(function(err) {
          if (err) res.sendStatus(500);
          else res.status(200).json({});
        });
      }
    })
  })
  .post(function(req, res, next) {
    res.sendStatus(400);
  })
  .delete(function(req, res, next) {
    req.models.Attribute.get(req.params.id, function(err, attribute) {
      if (!attribute) res.sendStatus(404);
      else attribute.remove(function(err) {
        if (err) res.sendStatus(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = attributeRouter;