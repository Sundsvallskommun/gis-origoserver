var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cors = require('cors');
const rateLimit = require('express-rate-limit');
var openapi = require('express-openapi');
var path = require('path');

var routes = require('./routes/index');
var adminRouter = require('./routes/admin');
var mapStateRouter = require('./routes/mapstate');
const lmApiProxy = require('./routes/lmapiproxy');
var errors = require('./routes/errors');
var conf = require('./conf/config');
var authSamlRouter = require('./handlers/authsaml');

var app = express();

const limiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 10000, // Limit each IP to 10000 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// apply rate limiter to all requests
app.use(limiter);

if (conf['cors']) {
  var configOptions = Object.assign({}, conf['cors']);
  var corsOptions = {};
  // Configures the Access-Control-Allow-Origin CORS header.
  if ('origin' in configOptions) {
    corsOptions['origin'] = configOptions.origin;
  }
  // Configures the Access-Control-Allow-Methods CORS header.
  if ('methods' in configOptions) {
    corsOptions['methods'] = configOptions.methods;
  }
  // Configures the Access-Control-Allow-Headers CORS header.
  if ('headers' in configOptions) {
    corsOptions['allowedHeaders'] = configOptions.headers;
  }
  // Configures the Access-Control-Allow-Credentials CORS header.
  if ('credentials' in configOptions) {
    corsOptions['credentials'] = configOptions.credentials;
  }
  // Some legacy browsers (IE11, various SmartTVs) choke on 204
  if ('optionsSuccessStatus' in configOptions) {
    corsOptions['optionsSuccessStatus'] = configOptions.optionsSuccessStatus;
  }
  app.use(cors(corsOptions));
}

openapi.initialize({
  apiDoc: require('./handlers/openapi/api-doc.js'),
  app: app,
  paths: [
    path.resolve(__dirname, 'handlers/openapi/api-zoning'),
		path.resolve(__dirname, 'handlers/openapi/api-nyko'),
		path.resolve(__dirname, 'handlers/openapi/api-precheck'),
    //path.resolve(__dirname, 'handlers/openapi/api-routes2'),
  ],
});

openapi.initialize({
  apiDoc: require('./handlers/openapi/api-estate/api-doc.js'),
  app: app,
  paths: [
		path.resolve(__dirname, 'handlers/openapi/api-estate'),
  ],
});

openapi.initialize({
  apiDoc: require('./handlers/openapitest/api-estate/api-doc.js'),
  app: app,
  paths: [
		path.resolve(__dirname, 'handlers/openapitest/api-estate'),
  ],
});

openapi.initialize({
  apiDoc: require('./handlers/openapitest/api-association/api-doc.js'),
  app: app,
  paths: [
		path.resolve(__dirname, 'handlers/openapitest/api-association/'),
  ],
});

var server = app.listen(3001, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('Origo server listening at http://%s:%s', host, port)
});

//Workaround to set __dirname properly when using node-windows
process.chdir(__dirname);

var handlebars = require('express-handlebars')
    .create({ defaultLayout: 'main', helpers: {
      eq: function (v1, v2) { return v1 === v2; },
      ne: function (v1, v2) { return v1 !== v2; },
      lt: function (v1, v2) { return v1 < v2; },
      gt: function (v1, v2) { return v1 > v2; },
      lte: function (v1, v2) { return v1 <= v2; },
      gte: function (v1, v2) { return v1 >= v2; },
      and: function () { return Array.prototype.every.call(arguments, Boolean); },
      or: function () { return Array.prototype.slice.call(arguments, 0, -1).some(Boolean); },
      dateFormat: require('handlebars-dateformat')
    }});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1)
app.get('/origoserver/ip', (request, response) => response.send(request.ip))
app.get('/origoserver/x-forwarded-for', (request, response) => response.send(request.headers['x-forwarded-for']));

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit:50000}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/origoserver/', routes);
app.use('/admin', adminRouter);
app.use('/mapstate', mapStateRouter);
if (conf['lmapiproxy']) {
  conf['lmapiproxy'].forEach(proxyAppConfig => app.use(`/origoserver/lmapiproxy/${proxyAppConfig.id}`, lmApiProxy(proxyAppConfig)));
	//app.use('/origoserver/lmapiproxy', lmApiProxy(conf['lmapiproxy']));
}
app.use('/origoserver/auth/saml', authSamlRouter);
app.use(errors);

module.exports = app;
