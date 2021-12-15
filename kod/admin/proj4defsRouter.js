// all requests that start with "/admin/proj4defs" is redirected to this module.

var express = require('express');
var proj4defsRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*************************************************************************CRUD proj4defs************************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
proj4defsRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    var proj4defsName = req.query.name;
    var searchStr = req.query.search;
    // OBS! name=someName takes precedence over search, if name query exists search will have no effect
    if (proj4defsName)
      req.models.Proj4Defs.find({ name: proj4defsName }, function (err, proj4defss) {
        if (proj4defss.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(proj4defss);
      });
    else if (searchStr)
      req.models.Proj4Defs.find({ name: orm.like("%" + searchStr + "%") }, function (err, proj4defss) {
        console.log('Number of proj4defss fetched that match the search query "' + searchStr + '" : ' + proj4defss.length);
        if (proj4defss.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(proj4defss);
      });
    else if (_.isEmpty(req.query))
      req.models.Proj4Defs.find(function (err, proj4defss) {
        if (!proj4defss || proj4defss.length == 0)
          res.sendStatus(404);
        else {
          console.log('Number of all proj4defss fetched : ' + proj4defss.length);
          res.status(200).json(proj4defss);
        }
      });
    else
      res.sendStatus(400);
  })
  .post(function (req, res) {
    const newProj4defs = req.body;
    req.models.Proj4Defs.create(newProj4defs, function (err, proj4defs) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log('New proj4defs saved with id : ' + proj4defs.id);
        res.status(201).json(proj4defs);
      }
    });
  });

proj4defsRouter.route('/:id')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    req.models.Proj4Defs.find({ id: req.params.id }, function (err, proj4defss) {
      if (proj4defss.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(proj4defss);
      }
    });
  })
  .put(function (req, res, next) {
    let newProj4defs = req.body;
    req.models.Proj4Defs.get(req.params.id, function (err, proj4defs) {
      if (!proj4defs) {
        res.sendStatus(404);
      } else {
        Object.assign(proj4defs, newProj4defs);
        proj4defs.save(function (err) {
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
    req.models.Proj4Defs.get(req.params.id, function (err, proj4defs) {
      if (!proj4defs) res.sendStatus(404);
      else proj4defs.remove(function (err) {
        if (err) res.sendStatus(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = proj4defsRouter;