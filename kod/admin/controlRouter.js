// all requests that start with "/admin/control" is redirected to this module.

var express = require('express');
var controlRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*************************************************************************CRUD control************************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
controlRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    var controlName = req.query.name;
    var searchStr = req.query.search;
    var configId = req.query.configId;

    // OBS! name=someName takes precedence over search, if name query exists search will have no effect
    if (controlName)
      req.models.Control.find({ name: controlName }, function (err, controls) {
        if (controls.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(controls);
      });
    else if (searchStr)
      req.models.Control.find({ name: orm.like("%" + searchStr + "%") }, function (err, controls) {
        console.log('Number of controls fetched that match the search query "' + searchStr + '" : ' + controls.length);
        if (controls.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(controls);
      });
    // funktion för att hämta alla kontroller som har en viss konfig
    else if (configId)
      req.models.Control.find({ config_id: configId }, function (err, controls) {
        if (controls.length == 0) {
          console.log('No controls found for configId ' + configId);
          res.status(404).json([]);
        }
        else {
          console.log('Number of controls fetched that belong to the configId ' + configId + ' = ' + controls.length);
          res.status(200).json(controls);
        }
      });
    else if (_.isEmpty(req.query))
      req.models.Control.find(function (err, controls) {
        if (!controls || controls.length == 0)
          res.status(404).json([]);
        else {
          console.log('Number of all controls fetched : ' + controls.length);
          res.status(200).json(controls);
        }
      });
    else
      res.sendStatus(400);
  })
  .post(function (req, res) {
    const newControl = req.body;
    req.models.Control.create(newControl, function (err, control) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log('New control saved with id : ' + control.id);
        res.status(201).json(control);
      }
    });
  });

controlRouter.route('/:id')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    req.models.Control.find({ id: req.params.id }, function (err, controls) {
      if (controls.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(controls);
      }
    });
  })
  .put(function (req, res, next) {
    let newControl = req.body;
    req.models.Control.get(req.params.id, function (err, control) {
      if (!control) {
        res.sendStatus(404);
      } else {
        Object.assign(control, newControl);
        control.save(function (err) {
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
    req.models.Control.get(req.params.id, function (err, control) {
      if (!control) res.status(404).json({});
      else control.remove(function (err) {
        if (err) res.status(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = controlRouter;