const conf = require('../conf/config');
const axios = require('axios').default;
const co = require('co');
const generate = require('node-chartist');
const sql = require('mssql');
const url = require('url');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

var proxyUrl = 'befStat';

// Do the request in proper order
const befStat = async (req, res) => {
  const configOptions = Object.assign({}, conf[proxyUrl]);
  const parsedUrl = url.parse(decodeURI(req.url), true);
  let nyko = '';
  let year = '';
  let interval = 'skola';
  if ('nyko' in parsedUrl.query) {
    nyko = parsedUrl.query.nyko;
  }
  if ('year' in parsedUrl.query) {
    year = parsedUrl.query.year;
  }
  if ('interval' in parsedUrl.query) {
    interval = parsedUrl.query.interval;
  }

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
        // console.log("Connected");
        executeStatement(nyko, year, interval, res);
    });

    connection.connect();

    function executeStatement(nyko, year, interval, res) {
     let men = 0;
     let women = 0;
     let ageInterval = {};
     let sqlInterval = "SELECT [AldersIntervallSkola], SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Ar] = " + year + " group by [AldersIntervallSkola] order by [AldersIntervallSkola] FOR JSON AUTO;"

     if (interval === '5ar') {
       sqlInterval = "SELECT [AldersIntervall5Ar], SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[vBefolkningArNyko6] where [NYKO] like '" + nyko + "%' and [Ar] = " + year + " group by [AldersIntervall5Ar] order by [AldersIntervall5Ar] FOR JSON AUTO;";
     }
     requestAgeInterval = new Request(sqlInterval, function(err) {
     // requestAgeInterval = new Request("SELECT [AldersIntervall], SUM([AntalPersoner]) as 'Antal' FROM [EDW].[api_webbkarta].[BefolkningArNyko3] where [NYKO3] = " + nyko + " and [Ar] = " + year + " group by [AldersIntervall] order by [AldersIntervall] FOR JSON AUTO;", function(err) {
     if (err) {
         console.log(err);}
     });
     var resultJson = [];
     requestAgeInterval.on('row', function(columns) {
         columns.forEach(function(column) {
           if (column.value === null) {
             console.log('NULL');
           } else {
             resultJson+= column.value + " ";
           }
         });
         ageInterval = resultJson;
         resultJson = [];
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
     var result = "";
     requestMen.on('row', function(columns) {
         columns.forEach(function(column) {
           if (column.value === null) {
             console.log('NULL');
           } else {
             result+= column.value + " ";
           }
         });
         men = result;
         result ="";
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
     var result = "";
     requestWomen.on('row', function(columns) {
         columns.forEach(function(column) {
           if (column.value === null) {
             console.log('NULL');
           } else {
             result+= column.value + " ";
           }
         });
         women = result;
         result ="";
     });

     requestWomen.on('done', function(rowCount, more) {
     console.log(rowCount + ' rows returned');
     });

     // Close the connection after the final event emitted by the request, after the callback passes
     requestWomen.on("requestCompleted", function (rowCount, more) {
       // Create line chart of temperature the last 24 hours for sensor
       if ((parseInt(men) + parseInt(women)) >= 5) {
         createCharts(nyko, men, women, ageInterval, res);
       } else {
         emptyResponse(res, nyko, 'Ingen statistik visas, befolkningen mindre eller lika med 5!');
       }
       connection.close();
     });
     connection.execSql(requestAgeInterval);
    }
  } else {
    emptyResponse(res, nyko, 'NYKO eller år saknas!');
  }
}

// Export the module
module.exports = befStat;

function emptyResponse(res, nyko, message) {
  res.send(`<!DOCTYPE html>
   <html lang="sv">
   <head>
     <meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
     <meta http-equiv="X-UA-Compatible" content="IE=Edge;chrome=1">
     <title>Demografisk statistik över NYKO-område ${nyko}</title>
    <link rel="stylesheet" type="text/css" href="https://internkarta.sundsvall.se/metadata/NYKO/style-deso.css">
    <link href="https://kartatest.sundsvall.se/chartist/chartist.min.css" rel="stylesheet">
   </head>
   <body>
   <center>
      <div class="container">
          <div class="header">
          <header class="header">
          <br>
              <h1>Demografisk statistik över Nyckelkodsområde: ${nyko} (Nivå ${nyko.length})</h1><br>
              <hr>
              <h3><b>Statistik från Sundsvalls kommuns metadata-katalog</b></h3>
              <h3><b>Kontakt: geodata@sundsvall.se</b></h3><br><br>
              </p><br><br>
          </header>
      </div>

      <div class="grid-container-one">
        <h2>${message}</h2>
   </div>
   <p>Senast uppdaterad: </p><br>
   <div class="footer"></div>
   </div>
   </center>
   <script src="https://kartatest.sundsvall.se/chartist/chartist.min.js"></script>
   </body>
   </html>`);
}

function createCharts(nyko, men, women, ageInterval, res) {
  ageIntervalJson = JSON.parse(ageInterval);
  co(function * () {
    const optionsPie = { width: 400, height: 200, legend: true };

    const pieSex = yield generate('pie', optionsPie, {
      series: [
      {value: women },
      {value: men }
    ]
    });

    let lblAgeInt = [];
    let lblAgeIntValue = [];
    ageIntervalJson.forEach((item) => {
      lblAgeInt.push(item.AldersIntervall)
      lblAgeIntValue.push(item.Antal)
    });
    const optionsBar = { width: 1000, height: 500, axisX: {
    // The offset of the chart drawing area to the border of the container
    offset: 30,
    // Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
    position: 'end',
    // Allows you to correct label positioning on this axis by positive or negative x and y offset.
    labelOffset: {
      x: 0,
      y: 0
    },
    // If labels should be shown or not
    showLabel: true,
    // If the axis grid should be drawn or not
    showGrid: true,
    // This value specifies the minimum width in pixel of the scale steps
    scaleMinSpace: 30,
    // Use only integer values (whole numbers) for the scale steps
    onlyInteger: false
  }, axisY: {
    // The offset of the chart drawing area to the border of the container
    offset: 40,
    // Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
    position: 'start',
    // Allows you to correct label positioning on this axis by positive or negative x and y offset.
    labelOffset: {
      x: 0,
      y: 0
    },
    // If labels should be shown or not
    showLabel: true,
    // If the axis grid should be drawn or not
    showGrid: true,
    // This value specifies the minimum height in pixel of the scale steps
    scaleMinSpace: 20,
    // Use only integer values (whole numbers) for the scale steps
    onlyInteger: false
  }};
    const data = {
      labels: lblAgeInt,
      series: [
        lblAgeIntValue
      ]
    };
    const barAgeInterval = yield generate('bar', optionsBar, data);
    res.send(createHtml(nyko, women, men, pieSex, barAgeInterval));
  })
}

function createHtml(nyko, women, men, chartSex, barAgeInterval) {
  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
	<meta http-equiv="X-UA-Compatible" content="IE=Edge;chrome=1">
	<title>Demografisk statistik över NYKO-område ${nyko}</title>
  <link rel="stylesheet" type="text/css" href="https://internkarta.sundsvall.se/metadata/NYKO/style-deso.css">
  <link href="https://kartatest.sundsvall.se/chartist/chartist.css" rel="stylesheet">
  <link href="https://kartatest.sundsvall.se/chartist/extra.css" rel="stylesheet">
</head>
<body>
<center>
    <div class="container">
        <div class="header">
        <header class="header">
        <br>
            <h1>Demografisk statistik över Nyckelkodsområde: ${nyko} (Nivå ${nyko.length})</h1><br>
            <hr>
            <h3><b>Statistik från Sundsvalls kommuns metadata-katalog</b></h3>
            <h3><b>Kontakt: geodata@sundsvall.se</b></h3><br><br>
            </p><br><br>
        </header>
    </div>

    <div class="grid-container-one">

        <div class="grid-item" id="alder">
          <h2>Befolkning efter ålder</h2>
          ${barAgeInterval}
          <h3>Åldersgrupper (År)<h3>
          <br/>
        </div>
    </div>
    <div class="grid-container-one">

        <div class="grid-item" id="kon">
          <h2>Befolkning efter kön</h2>
          ${chartSex}
          <div class="lblWomen">Kvinnor ${((parseInt(women)/(parseInt(women) + parseInt(men)))*100).toFixed(1)} %</div>
          <div class="lblMen">Män ${((parseInt(men)/(parseInt(women) + parseInt(men)))*100).toFixed(1)} %</div>
        </div>
    </div>
<p>Senast uppdaterad: </p><br>
<div class="footer"></div>
</div>
</center>
<script src="https://kartatest.sundsvall.se/chartist/chartist.min.js"></script>
</body>
</html>`;

  return html;
}
