// all requests that start with "/admin/style" is redirected to this module.

var express = require('express');
var styleRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');

//*********************************************************************CRUD style*********************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
styleRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    var styleName = req.query.name;
    var searchStr = req.query.search;

    // OBS! name=someName takes precedence over search, if name query exists search will have no effect
    if (styleName)
      req.models.Style.find({ name: styleName }, function (err, styles) {
        if (styles.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(styles);
      });
    else if (searchStr)
      req.models.Style.find({ name: orm.like("%" + searchStr + "%") }, function (err, styles) {
        console.log('Number of styles fetched that match the search query "' + searchStr + '" : ' + styles.length);
        if (styles.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(styles);
      });
    else if (_.isEmpty(req.query))
      req.models.Style.find(function (err, styles) {
        console.log('Number of all styles fetched : ' + styles.length);
        if (styles.length == 0)
          res.sendStatus(404);
        else
          res.status(200).json(styles);
      });
    else
      res.sendStatus(400);
  })
  .post(function (req, res) {
    const newstyle = req.body;
    req.models.Style.create(newstyle, function (err, style) {
      if (err) {
        console.log(err.message);
        res.status(500).send(err.message);
      } else {
        console.log('New style saved with id : ' + style.id);
        res.status(201).json(style);
      }
    });
  });

styleRouter.route('/:id')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    req.models.Style.find({ id: req.params.id }, function (err, styles) {
      if (styles.length == 0)
        res.sendStatus(404);
      else {
        res.status(200).json(styles);
      }
    });
  })
  .put(function (req, res, next) {
    const newStyle = req.body;
    req.models.Style.get(req.params.id, function (err, style) {
      if (!style) {
        res.sendStatus(404);
      } else {
        
        for (let key in style) {
          if (style.hasOwnProperty(key)) {
            style[key] = newStyle[key];
          }
        }

        style.save(function (err) {
          if (err) res.sendStatus(500);
          else res.status(200).json(style);
        });
      }
    })
  })
  .post(function (req, res, next) {
    res.sendStatus(400);
  })
  .delete(function (req, res, next) {
    req.models.Style.get(req.params.id, function (err, style) {
      if (!style) res.sendStatus(404);
      else style.remove(function (err) {
        if (err) res.sendStatus(500);
        else res.status(200).json({});
      });
    });
  });

module.exports = styleRouter;