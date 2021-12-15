// all requests that start with "/admin/config" is redirected to this module.

var express = require('express');
var configRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*************************************************************************CRUD config************************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
configRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    var configName = req.query.name;
    var searchStr = req.query.search;
    // OBS! name=someName takes precedence over search, if name query exists search will have no effect
    if (configName)
      req.models.Config.find({ name: configName }, function (err, configs) {
        if (configs.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(configs);
      });
    else if (searchStr)
      req.models.Config.find({ name: orm.like("%" + searchStr + "%") }, function (err, configs) {
        console.log('Number of configs fetched that match the search query "' + searchStr + '" : ' + configs.length);
        if (configs.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(configs);
      });
    else if (_.isEmpty(req.query))
      req.models.Config.find(function (err, configs) {
        if (!configs || configs.length == 0)
          res.status(404).json([]);
        else {
          console.log('Number of all configs fetched : ' + configs.length);
          res.status(200).json(configs);
        }
      });
    else
      res.sendStatus(400);
  })
  .post(function (req, res) {
    const newConfig = req.body;
    req.models.Config.create(newConfig, function (err, config) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log('New config saved with id : ' + config.id);
        res.status(201).json(config);
      }
    });
  });

configRouter.route('/:id')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    req.models.Config.find({ id: req.params.id }, function (err, configs) {
      if (configs.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(configs);
      }
    });
  })
  .put(function (req, res, next) {
    let newConfig = req.body;
    req.models.Config.get(req.params.id, function (err, config) {
      if (!config) {
        res.sendStatus(404);
      } else {
        Object.assign(config, newConfig);
        config.save(function (err) {
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
    req.models.Config.get(req.params.id, function (err, config) {
      if (!config) res.sendStatus(404);
      else config.remove(function (err) {
        if (err) res.sendStatus(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = configRouter;