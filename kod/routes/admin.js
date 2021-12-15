// all requests that start with "/admin" is redirected to this module.

var express = require('express');
var adminRouter = express.Router();
const fileUpload = require('express-fileupload');
const app = express();

// default options
adminRouter.use(fileUpload());

// var orm = require('orm');
// models are defined in models.js and used as a middleware for all queries that come through "/admin".
// models are available for handlers on req.models
var models = require('../admin/models.js');

var configRouter = require('../admin/configRouter.js');
var groupRouter = require('../admin/groupRouter.js');
var sourceRouter = require('../admin/sourceRouter.js');
var layerRouter = require('../admin/layerRouter.js');
var styleRouter = require('../admin/styleRouter.js');
var controlRouter = require('../admin/controlRouter.js');
var attributeRouter = require('../admin/attributeRouter.js');
var domainRouter = require('../admin/domainRouter.js');
var proj4defsRouter = require('../admin/proj4defsRouter');
var searchRouter = require('../admin/searchRouter');
var capabilitiesRouter = require('../admin/handlers/getLayersFromCapabilities');

// loading models for orm, options are arbitrary
adminRouter.use(models({ /*option1: '1', option2: '2' */ }));
adminRouter.use(function (req, res, next) {

    // Website you wish to allow to connect
    if (!res.header('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Request methods you wish to allow
    if (!res.header('Access-Control-Allow-Methods')) {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    }

    // Request headers you wish to allow
    if (!res.header('Access-Control-Allow-Headers')) {
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    }

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    if (!res.header('Access-Control-Allow-Credentials')) {
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    // Pass to next layer of middleware
    next();
});

// handlers
// a handler is just a function that takes req, res and handles it!

/* GET start page. */
adminRouter.get('/', function(req, res) {
  res.render('index');
});

adminRouter.use('/config', configRouter);
adminRouter.use('/group', groupRouter);
adminRouter.use('/source', sourceRouter);
adminRouter.use('/layer', layerRouter);
adminRouter.use('/style', styleRouter);
adminRouter.use('/control', controlRouter);
adminRouter.use('/attribute', attributeRouter);
adminRouter.use('/proj4defs', proj4defsRouter);
adminRouter.use('/domain', domainRouter);
adminRouter.use('/search', searchRouter);
adminRouter.use('/getLayersFromCapabilities', capabilitiesRouter);

//*********************************************************************ExportConfig**********************************************************************
// read data from database and create index.json
var exportConfig = require('../admin/handlers/exportConfig');
// adminRouter.get('/exportConfig/:configName', exportConfig');
adminRouter.get('/exportConfig/:configId', exportConfig);

//********************************************************************importConfig**************************************************************************
// read the index.json from body, form the corresponding objects and save them in the database
var importConfig = require('../admin/handlers/importConfig');
adminRouter.options('/importConfig', function (req, res, next) {
    res.sendStatus(200);
});
adminRouter.post('/importConfig', importConfig);

// *******************************************************************getCapabilities***********************************************************************
//var getLayersFromCapabilities = require('../admin/handlers/getLayersFromCapabilities');
//adminRouter.use('/getLayersFromCapabilities', getLayersFromCapabilities);

adminRouter.get('/test', function(req, res) {
    res.send('testing bamboo!');
});

module.exports = adminRouter;
