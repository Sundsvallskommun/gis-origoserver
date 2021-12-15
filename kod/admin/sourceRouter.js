// all requests that start with "/admin/source" is redirected to this module.

var express = require('express');
var sourceRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*********************************************************************CRUD source*********************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
sourceRouter.route('/')
  .all(function(req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function(req, res, next) {
    res.sendStatus(200);
  })
  .get(function(req, res, next) {
    var sourceName = req.query.name;
    var searchStr = req.query.search;
    // OBS! name=someName takes precedence over search, if name query exists search will have no effect
    if (sourceName)
      req.models.Source.find({ name: sourceName }, function(err, sources) {
        if (sources.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(sources);
      });
    else if (searchStr)
      req.models.Source.find({ name: orm.like("%" + searchStr + "%") }, function(err, sources) {
        console.log('Number of sources fetched that match the search query "' + searchStr + '" : ' + sources.length);
        if (sources.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(sources);
      });
    else if (_.isEmpty(req.query))
      req.models.Source.find(function(err, sources) {
        if (!sources || sources.length == 0)
          res.sendStatus(404);
        else{
          console.log('Number of all sources fetched : ' + sources.length);
          res.status(200).json(sources);
        }
      });
    else
      res.sendStatus(400);
  })
  .post(function(req, res) {
    const newSource = req.body;
    req.models.Source.create(newSource, function(err, source) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log('New source saved with id : ' + source.id);
        res.status(201).json(source);
      }
    });
  });

sourceRouter.route('/:id')
  .all(function(req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function(req, res, next) {
    res.sendStatus(200);
  })
  .get(function(req, res, next) {
    req.models.Source.find({ id: req.params.id }, function(err, sources) {
      if (sources.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(sources);
      }
    });
  })
  .put(function(req, res, next) {
    let newSource = req.body;
    req.models.Source.get(req.params.id, function(err, source) {
      if (!source) {
        res.sendStatus(404);
      } else {
        Object.assign(source, newSource);
        source.save(function(err) {
          if (err) res.sendStatus(500);
          else res.status(200).json({});
        });
      }
    });
  })
  .post(function(req, res, next) {
    res.sendStatus(400);
  })
  .delete(function(req, res, next) {
    req.models.Source.get(req.params.id, function(err, source) {
      if (!source) res.sendStatus(404);
      else source.remove(function(err) {
        if (err) res.sendStatus(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = sourceRouter;