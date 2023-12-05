const conf = require('../../../conf/config');
const url = require('url');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

var proxyUrl = 'apiNyko';

function doUpdate(req, res, update) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  let connected = false;

    if (update !== '') {
      var config = {
        server: configOptions.db_server,
        authentication: {
          type: configOptions.db_auth_type,
          options: {
            userName: configOptions.db_auth_username,
            password: configOptions.db_auth_password,
            domain: configOptions.db_auth_domain
          }
        },
        options: {
          database: configOptions.db_database,
          trustServerCertificate: configOptions.db_trust_server_certificate
        }
      };

      var connection = new Connection(config);
      connection.on('connect', function(err) {
        // If no error, then good to proceed.
        //console.log("Connected");
        connected = true;
        executeStatement(res);
      });
      if (!connected) {
        connection.connect();
      }

      function executeStatement(res) {
        let men = '';
        let women = '';
        let outtakeDate = [];
        requestAgeUttagsdatum = new Request("SELECT DISTINCT [Uttagsdatum] FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] order by [Uttagsdatum] DESC FOR JSON AUTO;", function(err) {
        if (err) {
          console.log(err);}
        });
        requestAgeUttagsdatum.on('row', function(columns) {
          outtakeDate = JSON.parse(columns[0].value);
          fs = require('fs');

          fs.writeFileSync("uttagsdatum.json", JSON.stringify(outtakeDate));
          res.status(200).json(outtakeDate);
        });

        requestAgeUttagsdatum.on('done', function(rowCount, more) {
          console.log(rowCount + ' rows returned');
        });

        // Close the connection after the final event emitted by the request, after the callback passes
        requestAgeUttagsdatum.on("requestCompleted", function (rowCount, more) {
          connection.close();
        });
        connection.execSql(requestAgeUttagsdatum);
      }
    } else {
      res.status(400).json({error: 'Missing required parameter nyko and/or year'});
    }
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let update = '';
    if ('update' in parsedUrl.query) {
      update = parsedUrl.query.update;
      doUpdate(req, res, update);
    } else {
      const fs = require('fs');
      try {
        if (fs.existsSync("uttagsdatum.json")) {
          const uttagsdatum = fs.readFileSync("uttagsdatum.json");
          res.status(200).json(JSON.parse(uttagsdatum));
        } else {
          res.status(200).json([{"Uttagsdatum":"2023-01-01"},{"Uttagsdatum":"2022-01-01"},{"Uttagsdatum":"2021-01-01"},{"Uttagsdatum":"2020-01-01"},{"Uttagsdatum":"2019-01-01"},{"Uttagsdatum":"2018-01-01"},{"Uttagsdatum":"2017-01-01"},{"Uttagsdatum":"2016-01-01"},{"Uttagsdatum":"2014-01-01"}]);
        }
      } catch(err) {
        console.error(err)
      }
    }
  },
};

module.exports.get.apiDoc = {
  description: 'Get statistics about the population in NYKO.',
  operationId: 'getNykoUttagsDatum',
  parameters: [
    {
      in: 'query',
      name: 'update',
      required: false,
      type: 'string'
    }
  ],
  responses: {
    200: {
      description: 'Gets the stats for given NYKO and year',
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
