const conf = require('../../../conf/config');
const url = require('url');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

var proxyUrl = 'apiNyko';

function doGet(req, res, nyko, uttagsdatum, interval) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  let connected = false;
  let sqlInterval = '';
  let sqlWomen = '';
  let sqlMen = '';
  let sqlVariabels = '';

    if (nyko !== '') {
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
        executeStatement(nyko, uttagsdatum, interval, res);
      });
      if (!connected) {
        connection.connect();
      }

      function executeStatement(nyko, uttagsdatum, interval, res) {
        let men = '';
        let women = '';
        let ageInterval = [];
        let outtakeDate = [];
        let uttag = uttagsdatum;
        let variables = {};
        let varBistand20 = [];
        let varAndelUnga = [];
        let varAndelAldre = [];
        let varAndelEjEU = [];
        let varAndelArbetande = [];
        let varAndelUtbildade = [];
        let varAndelArbetslosa = [];
        let varInkomst = [];
        let varOhalsa = [];

        sqlInterval = "SELECT [AldersIntervall5Ar] as 'Label', SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Uttagsdatum] = '" + uttag + "' group by [AldersIntervall5Ar] order by [AldersIntervall5Ar] FOR JSON AUTO;";
        if (interval === 'Skola') {
          sqlInterval = "SELECT [AldersIntervallSkola] as 'Label', SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Uttagsdatum] = '" + uttag + "' group by [AldersIntervallSkola] order by [AldersIntervallSkola] FOR JSON AUTO;"
        }
        sqlWomen = "SELECT SUM([AntalPersoner]) FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%'  and [Uttagsdatum] = '" + uttag + "' and [Kon] = 'K';";
        sqlMen = "SELECT SUM([AntalPersoner]) FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%'  and [Uttagsdatum] = '" + uttag + "' and [Kon] = 'M';";
        sqlVariabels = "SELECT * FROM [EDW].[mart_scb].[vSocioekonomiskStatistik] WHERE [NYKO] = '2281" + nyko + "'";
        console.log(sqlVariabels);

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
          connection.execSql(requestVariables);
        });

        requestVariables = new Request(sqlVariabels, function(err) {
        if (err) {
          console.log(err);}
        });
        requestVariables.on('row', function(columns) {
          console.log(columns);
          if (columns.Variabel === 'Andel av befolkningen med ekonomiskt bistånd 20+ år') {
            varBistand20.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Andel befolkning 0-19 år') {
            varAndelUnga.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Andel befolkning 65 år +') {
            varAndelAldre.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Andel födda utanför EU28') {
            varAndelEjEU.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Andel förvärvsarbetande 20-64 år') {
            varAndelArbetande.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Andel med eftergymnasial utbildning 20-64 år') {
            varAndelUtbildade.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Andel öppet arbetslösa 16-64 år') {
            varAndelArbetslosa.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Inkomst (median) tusentals kronor 20+ år') {
            varInkomst.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          } else if (columns.Variabel === 'Ohälsotal (antal dagar) 16-64 år') {
            varOhalsa.push({ year: columns.Ar, men: columns.Man, women: columns.Kvinnor, total: columns.Totalt })
          }
        });

        requestVariables.on('done', function(rowCount, more) {
          console.log(rowCount + ' rows returned');
        });

        // Close the connection after the final event emitted by the request, after the callback passes
        requestVariables.on("requestCompleted", function (rowCount, more) {
          variables = { assistans: varBistand20, young: varAndelUnga, old: varAndelAldre, nonEU: varAndelEjEU, working: varAndelArbetande, educated: varAndelUtbildade, unemployed: varAndelArbetslosa, income: varInkomst, unhealth: varOhalsa };
          //connection.close();
          connection.execSql(requestMen);
        });

        requestMen = new Request(sqlMen, function(err) {
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
        requestWomen = new Request(sqlWomen, function(err) {
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
          showIntervals = true;
          ageInterval.forEach((item) => {
            if (typeof item !== 'undefined') {
              if (item.Antal <= 3) {
                showIntervals = false;
              }
            }
          });
          if (!showIntervals) {
            ageInterval = [];
          }
          if ((parseInt(men) + parseInt(women)) >= 3) {
            res.status(200).json({ men: men, women: women, ageByInterval: ageInterval, outtakeDate: uttagsdatum, variables: variables });
          } else {
            res.status(200).json({error: 'Ingen statistik visas, befolkningen mindre eller lika med 3!'});
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
    let uttagsdatum = '';
    let intervall = '5ar';
    if ('nyko' in parsedUrl.query) {
      nyko = parsedUrl.query.nyko;
    } else {
      res.status(400).json({error: 'Missing required parameter nyko'});
    }
    if ('uttagsdatum' in parsedUrl.query) {
      uttagsdatum = parsedUrl.query.uttagsdatum;
    }
    if ('intervall' in parsedUrl.query) {
      intervall = parsedUrl.query.intervall ? parsedUrl.query.intervall : '5ar';
    }
    doGet(req, res, nyko, uttagsdatum, intervall);
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
        name: 'uttagsdatum',
        required: false,
        type: 'string'
      },
      {
        in: 'query',
        name: 'intervall',
        required: false,
        type: 'string'
      }
    ],
  responses: {
    200: {
      description: 'Gets the stats for given NYKO and year',
      schema: {
        type: 'object',
        items: {
          $ref: '#/definitions/NykoStat'
        }
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
