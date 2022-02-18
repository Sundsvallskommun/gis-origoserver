const conf = require('../../../conf/config');
const url = require('url');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

var proxyUrl = 'apiNyko';

function doGet(req, res, nyko, year, interval) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  let connected = false;
    if (nyko !== '' && year !== '') {
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
          executeStatement(nyko, year, interval, res);
      });
      if (!connected) {
        connection.connect();
      }

      function executeStatement(nyko, year, interval, res) {
       let men = '';
       let women = '';
       let ageInterval = [];
       let sqlInterval = "SELECT [AldersIntervallSkola] as 'Label', SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Ar] = " + year + " group by [AldersIntervallSkola] order by [AldersIntervallSkola] FOR JSON AUTO;"
       if (interval === '5ar') {
         sqlInterval = "SELECT [AldersIntervall5Ar] as 'Label', SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Ar] = " + year + " group by [AldersIntervall5Ar] order by [AldersIntervall5Ar] FOR JSON AUTO;";
       }
       requestAgeInterval = new Request(sqlInterval, function(err) {
       if (err) {
           console.log(err);}
       });
       requestAgeInterval.on('row', function(columns) {
           var resultJson = JSON.parse(columns[0].value);
           // Rearrange order since SQL Server placed on group out of order
           if (interval === '5ar') {
             ageInterval.push(resultJson[0]);
             ageInterval.push(resultJson[11]);
             ageInterval.push(resultJson[1]);
             ageInterval.push(resultJson[2]);
             ageInterval.push(resultJson[3]);
             ageInterval.push(resultJson[4]);
             ageInterval.push(resultJson[5]);
             ageInterval.push(resultJson[6]);
             ageInterval.push(resultJson[7]);
             ageInterval.push(resultJson[9]);
             ageInterval.push(resultJson[10]);
             ageInterval.push(resultJson[12]);
             ageInterval.push(resultJson[13]);
             ageInterval.push(resultJson[14]);
             ageInterval.push(resultJson[15]);
           } else {
             ageInterval.push(resultJson[0]);
             ageInterval.push(resultJson[8]);
             ageInterval.push(resultJson[1]);
             ageInterval.push(resultJson[2]);
             ageInterval.push(resultJson[3]);
             ageInterval.push(resultJson[4]);
             ageInterval.push(resultJson[5]);
             ageInterval.push(resultJson[6]);
             ageInterval.push(resultJson[7]);
             ageInterval.push(resultJson[9]);
           }
       });

       requestAgeInterval.on('done', function(rowCount, more) {
       console.log(rowCount + ' rows returned');
       });

       // Close the connection after the final event emitted by the request, after the callback passes
       requestAgeInterval.on("requestCompleted", function (rowCount, more) {
         //connection.close();
         connection.execSql(requestMen);
       });

       requestMen = new Request("SELECT SUM([AntalPersoner]) FROM [EDW].[api_webbkarta].[BefolkningArNyko3] where [NYKO3] = " + nyko + " and [Ar] = " + year + " and [Kon] = 'M';", function(err) {
       if (err) {
           console.log(err);}
       });
       requestMen.on('row', function(columns) {
           men = columns[0].value;
       });

       requestMen.on('done', function(rowCount, more) {
       console.log(rowCount + ' rows returned');
       });

       // Close the connection after the final event emitted by the request, after the callback passes
       requestMen.on("requestCompleted", function (rowCount, more) {
         //connection.close();
         connection.execSql(requestWomen);
       });
       requestWomen = new Request("SELECT SUM([AntalPersoner]) FROM [EDW].[api_webbkarta].[BefolkningArNyko3] where [NYKO3] = " + nyko + " and [Ar] = " + year + " and [Kon] = 'K';", function(err) {
       if (err) {
           console.log(err);}
       });
       requestWomen.on('row', function(columns) {
         women = columns[0].value;
       });

       requestWomen.on('done', function(rowCount, more) {
       console.log(rowCount + ' rows returned');
       });

       // Close the connection after the final event emitted by the request, after the callback passes
       requestWomen.on("requestCompleted", function (rowCount, more) {
         // Create line chart of temperature the last 24 hours for sensor
         if ((parseInt(men) + parseInt(women)) >= 5) {
           res.status(200).json({ men: men, women: women, ageByInterval: ageInterval });
         } else {
           res.status(200).json({error: 'Ingen statistik visas, befolkningen mindre eller lika med 5!'});
         }
         connection.close();
         connected = false;
       });
       connection.execSql(requestAgeInterval);
      }
    } else {
      res.status(400).json({error: 'Missing required parameter nyko and/or year'});
    }
}

module.exports = {
  get: function (req, res, next) {
    const parsedUrl = url.parse(decodeURI(req.url), true);
    let nyko = '';
    let year = '';
    let interval = 'skola';
    if ('nyko' in parsedUrl.query) {
      nyko = parsedUrl.query.nyko;
    } else {
      res.status(400).json({error: 'Missing required parameter nyko'});
    }
    if ('year' in parsedUrl.query) {
      year = parsedUrl.query.year;
    } else {
      res.status(400).json({error: 'Missing required parameter year'});
    }
    if ('interval' in parsedUrl.query) {
      interval = parsedUrl.query.interval;
    }
    doGet(req, res, nyko, year, interval);
  },
};

module.exports.get.apiDoc = {
  description: 'Get statistics about the population in NYKO.',
  operationId: 'getNykoStat',
  parameters: [
      {
        in: 'query',
        name: 'nyko',
        required: true,
        type: 'string'
      },
      {
        in: 'query',
        name: 'year',
        required: true,
        type: 'string'
      },
      {
        in: 'query',
        name: 'interval',
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
