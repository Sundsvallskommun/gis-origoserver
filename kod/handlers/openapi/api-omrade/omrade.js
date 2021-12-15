const url = require('url');
const { Client } = require('pg')

function doGet(req, res, hasData) {
  const client = new Client({
      database: 'gis',
      host: '192.168.1.43',
      user: 'joh17bla',
      password: 'fused-dTmNr',
      port: 5434
  });

  console.log('Connecting');
  client.connect(err => {
    console.log('Connect!');
    if (err) {
      console.log('Error!');
      console.error('connection error', err.stack);
    } else {
      console.log('connected');
    }
  });

  console.log('Querying');
  client.query('SELECT id, kategori FROM public."PLAN_Omrade_punkt"', (err, result) => {
    console.log('query!');
    if (err) throw err
    console.log(result);
    res.send(result);
    client.end()
  });
  res.send({});
}

function doGet2(req, res, hasData) {
  const client = new Client({
      database: 'gis',
      host: '192.168.1.43',
      user: 'joh17bla',
      password: 'fused-dTmNr',
      port: 5434
  });

  console.log('Connecting');
  client.connect(err => {
    console.log('Connect!');
    if (err) {
      console.log('Error!');
      console.error('connection error', err.stack);
    } else {
      console.log('connected');
    }
  });

  console.log('Querying');
  client.query('SELECT id, kategori FROM public."PLAN_Omrade_punkt"', (err, result) => {
    console.log('query!');
    if (err) throw err
    console.log(result);
    res.send(result);
    client.end()
  });
  res.send({});
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let hasData = false;
    if ('hasData' in parsedUrl.query) {
      hasData = parsedUrl.query.hasData;
    }
    doGet(req, res, hasData);
    // res.status(200).json({detaljplan: false});
  },
};

module.exports.get.apiDoc = {
  description: 'List omrade.',
  operationId: 'listOmrade',
  parameters: [
    {
        in: 'query',
        name: 'hasData',
        required: false,
        type: 'string'
      }
    ],
  responses: {
    200: {
      description: 'Lists all omrade',
      schema: {
        type: 'string',
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        type: 'string',
      },
    },
    500: {
      description: 'Server error',
      schema: {
        type: 'string',
      },
    },
  },
};
