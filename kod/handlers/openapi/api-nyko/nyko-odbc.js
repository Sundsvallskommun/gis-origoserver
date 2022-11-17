const conf = require('../../../conf/config');
const url = require('url');
const odbc = require('odbc');

var proxyUrl = 'apiNyko';

function doGet(req, res, nyko, uttagsdatum, interval) {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  let sqlInterval = '';
  let sqlWomen = '';
  let sqlMen = '';
  let sqlVariabels = '';
  let men = '';
  let women = '';
  let ageInterval = [];
  let ageIntervalNewOrder = [];
  let showIntervals = true;
  let variables = [];

    if (nyko !== '') {
      const connectionString = 'DRIVER='+configOptions.db_driver+';SERVER='+configOptions.db_server+';DATABASE='+configOptions.db_database+';UID='+configOptions.db_auth_username+';PWD='+configOptions.db_auth_password+';';

      const connection = odbc.connect(connectionString, (error, connection) => {
        if (error) { console.log(error) }
        // Setup SQL queries
        sqlWomen = "SELECT SUM([AntalPersoner]) as women FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%'  and [Uttagsdatum] = '" + uttagsdatum + "' and [Kon] = 'K';";
        sqlMen = "SELECT SUM([AntalPersoner]) as men FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%'  and [Uttagsdatum] = '" + uttagsdatum + "' and [Kon] = 'M';";
        sqlInterval = "SELECT [AldersIntervall5Ar] as 'Label', SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Uttagsdatum] = '" + uttagsdatum + "' group by [AldersIntervall5Ar] order by [AldersIntervall5Ar];";
        sqlVariabels = "SELECT * FROM [EDW].[mart_scb].[vSocioekonomiskStatistik] WHERE [NYKO] = '2281'" + nyko + "''";
        if (interval === 'Skola') {
          sqlInterval = "SELECT [AldersIntervallSkola] as 'Label', SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Uttagsdatum] = '" + uttagsdatum + "' group by [AldersIntervallSkola] order by [AldersIntervallSkola];"
        }
        connection.query(sqlVariabels, (error, result) => {
          if (error) { console.error(error) }
          const varBistand20 = [];
          const varAndelUnga = [];
          const varAndelAldre = [];
          const varAndelEjEU = [];
          const varAndelArbetande = [];
          const varAndelUtbildade = [];
          const varAndelArbetslosa = [];
          const varInkomst = [];
          const varOhalsa = [];
          result.forEach((row) => {
            if (row.Variabel === 'Andel av befolkningen med ekonomiskt bistånd 20+ år') {
              varBistand20.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Andel befolkning 0-19 år') {
              varAndelUnga.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Andel befolkning 65 år +') {
              varAndelAldre.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Andel födda utanför EU28') {
              varAndelEjEU.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Andel förvärvsarbetande 20-64 år') {
              varAndelArbetande.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Andel med eftergymnasial utbildning 20-64 år') {
              varAndelUtbildade.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Andel öppet arbetslösa 16-64 år') {
              varAndelArbetslosa.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Inkomst (median) tusentals kronor 20+ år') {
              varInkomst.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            } else if (row.Variabel === 'Ohälsotal (antal dagar) 16-64 år') {
              varOhalsa.push({ year: row.Ar, men: row.Man, women: row.Kvinnor, total: row.Totalt })
            }
          })
          variables.push({ assistans: varBistand20, young: varAndelUnga, old: varAndelAldre, nonEU: varAndelEjEU, working: varAndelArbetande, educated: varAndelUtbildade, unemployed: varAndelArbetslosa, income: varInkomst, unhealth: varOhalsa });
        });
        connection.query(sqlWomen, (error, result) => {
          if (error) { console.error(error) }
          women = result[0].women;
          connection.query(sqlMen, (error, result) => {
            if (error) { console.error(error) }
            men = result[0].men;
            connection.query(sqlInterval, (error, result) => {
              if (error) { console.error(error) }
              result.forEach((item, i) => {
                if ('Label' in item) {
                  ageInterval.push(item);
                  if (item.Antal <= 3) {
                    showIntervals = false;
                  }
                }
              });

              if (interval === '5ar') {
                ageIntervalNewOrder.push(ageInterval[0]);
                ageIntervalNewOrder.push(ageInterval[11]);
                ageIntervalNewOrder.push(ageInterval[1]);
                ageIntervalNewOrder.push(ageInterval[2]);
                ageIntervalNewOrder.push(ageInterval[3]);
                ageIntervalNewOrder.push(ageInterval[4]);
                ageIntervalNewOrder.push(ageInterval[5]);
                ageIntervalNewOrder.push(ageInterval[6]);
                ageIntervalNewOrder.push(ageInterval[7]);
                ageIntervalNewOrder.push(ageInterval[9]);
                ageIntervalNewOrder.push(ageInterval[10]);
                ageIntervalNewOrder.push(ageInterval[12]);
                ageIntervalNewOrder.push(ageInterval[13]);
                ageIntervalNewOrder.push(ageInterval[14]);
                ageIntervalNewOrder.push(ageInterval[15]);
              } else {
                ageIntervalNewOrder.push(ageInterval[0]);
                ageIntervalNewOrder.push(ageInterval[8]);
                ageIntervalNewOrder.push(ageInterval[1]);
                ageIntervalNewOrder.push(ageInterval[2]);
                ageIntervalNewOrder.push(ageInterval[3]);
                ageIntervalNewOrder.push(ageInterval[4]);
                ageIntervalNewOrder.push(ageInterval[5]);
                ageIntervalNewOrder.push(ageInterval[6]);
                ageIntervalNewOrder.push(ageInterval[7]);
                ageIntervalNewOrder.push(ageInterval[9]);
              }
              if (!showIntervals) {
                ageIntervalNewOrder = [];
              }
              if ((parseInt(men) + parseInt(women)) >= 3) {
                res.status(200).json({ men: men, women: women, ageByInterval: ageIntervalNewOrder, outtakeDate: uttagsdatum });
              } else {
                res.status(200).json({error: 'Ingen statistik visas, befolkningen mindre eller lika med 3!'});
              }
            });
          });
        });
      });
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
  operationId: 'getNykoStatOdbc',
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
