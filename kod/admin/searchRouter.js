var fakeResponse = [
  { "NAMN": "Erik vallers väg 12a",
    "GID": 1027, 
    "TYPE": "hallstakartan.tk_s_ads_p", 
    "layer": "Adress", 
    "st_astext": "POINT(134690.511 6610941.918)" 
  },
  { "NAMN": "Erik vallers väg 12j", "GID": 1036, "TYPE": "hallstakartan.tk_s_ads_p", "layer": "Adress", "st_astext": "POINT(134692.758 6610934.812)" },
  { "NAMN": "Eriksberg 1:12>1", "GID": 352, "TYPE": "hallstakartan.tk_s_fat_y", "layer": "Fastighet", "st_astext": "MULTIPOLYGON(((135772.530427313 6608591.59315852,135787.593692882 6608579.06671386,135775.619607964 6608564.66937858,135731.030138465 6608534.19156811,135715.798029854 6608558.60391391,135699.44814222 6608582.2580369,135682.017304211 6608605.1010744,135729.175140676 6608645.00853922,135729.492803617 6608643.74461566,135747.744251209 6608612.22288118,135772.530427313 6608591.59315852)))" }, 
  { "NAMN": "Eriksberg 1:2>1", "GID": 351, "TYPE": "hallstakartan.tk_s_fat_y", "layer": "Fastighet", "st_astext": "MULTIPOLYGON(((135787.593692882 6608579.06671386,135806.259621307 6608563.55017583,135832.240812008 6608528.0466178,135849.459131862 6608485.64672556,135852.892925679 6608460.38016119,135772.908748715 6608448.92753079,135760.421092871 6608478.07275367,135746.449801485 6608506.52004682,135731.030138465 6608534.19156811,135775.619607964 6608564.66937858,135787.593692882 6608579.06671386)))" },
  { "NAMN": "Erik vallers väg 12a", "GID": 1027, "TYPE": "hallstakartan.tk_s_ads_p", "layer": "Ort", "st_astext": "POINT(134690.511 6610941.918)" }];

// all requests that start with "/admin/search" is redirected to this module.

var express = require('express');
var searchRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');
// var ol = require('openlayers')s;

//*************************************************************************CRUD control************************************************************************
// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js
searchRouter.route('/')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {
    var searchString = req.query.q;

    if (searchString) {
      res.status(200).json(fakeResponse);
    }
    else if (_.isEmpty(req.query)) {
      console.log('No search string specified');
      res.status(200).json([]);
    }
    else
      res.sendStatus(400);
  });

module.exports = searchRouter;

// this module is not used now, but will be needed if we decide to move search function from client to server in the future.