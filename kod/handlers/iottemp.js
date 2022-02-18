const conf = require('../conf/config');
const axios = require('axios').default;
const co = require('co');
const generate = require('node-chartist');
const url = require('url');

var proxyUrl = 'iotTemp';

async function getTempSensors(url, apikey) {
  var sensors = [];
  var requestOptions = {
      method: 'GET',
      url: url + '?apikey=' + apikey
  };

  await axios(url + '?apikey=' + apikey, requestOptions)
      .then(response => {
        response.data.forEach((sensor) => {
          sensors.push({ id: sensor.id, geometry: sensor.location.value })
        });

      })
      .catch(error => console.log('error', error));

  return sensors;
}

async function getTemps(sensors, url, apikey) {
  let axiosArray = [];
  let temperatures = [];

  sensors.forEach((sensor) => {
    axiosArray.push(axios.get(url, { params: {sensor: sensor.id, apikey: apikey} })
            .then(response => { temperatures.push(response.data.sensors[0]); }));
  });

  await axios
    .all(axiosArray)
    .then(console.log('Get all temperatures from sensors!'))
    .catch(error => console.log('error', error));

  return temperatures;
}

async function getTemp(sensorId, url, apikey) {
  let temperature = [];

  await axios.get(url, { params: {sensor: sensorId, apikey: apikey} })
            .then(response => { temperature = response.data.sensors[0] });

  return temperature;
}

async function createChart(sensorData) {
  const options = {
    width: 1200,
    height: 200,
    axisX: { title: 'Tid' },
    axisY: { title: 'Temp' }
  };
  const returnPromises = [];
  const labels = [];
  const values = [];

  sensorData.values.forEach((value, i) => {
    let hourMinutes = '';
    if (!Number.isNaN(Date.parse(value.when))) {
      hourMinutes = new Intl.DateTimeFormat('locale', { hour: 'numeric', minute: 'numeric' }).format(Date.parse(value.when));
    }
    // Add labels for every fifth value so that the labels don't cover each other
    if (i % 4 == 0) {
      labels.push(hourMinutes);
    } else {
      labels.push('');
    }
    values.push(value.value);
  });
  const line = generate('line', options, {
    labels: labels,
    series: [
      {name: sensorData.id, value: values}
    ]
  });
  returnPromises.push(line);

  return returnPromises;
}

// Do the request in proper order
const iotTemp = async (req, res) => {
  let chartsArr = [];

  if (conf[proxyUrl]) {
    configOptions = Object.assign({}, conf[proxyUrl]);
    url_sensors = configOptions.url_sensors;
    url_temp_sensor = configOptions.url_temp_sensor;
    apikey = configOptions.apikey;

    const parsedUrl = url.parse(decodeURI(req.url), true);
    if ('id' in parsedUrl.query) {
      id = parsedUrl.query.id;
      // Get all sensors from api.sundsvall.se
      const sensors = await getTempSensors(url_sensors, apikey);
      const temperature = await getTemp(id, url_temp_sensor, apikey);
      // Create line chart of temperature the last 24 hours for sensor
      const charts = await createChart(temperature);
      Promise.all(charts).then(function(values) {
        // Make a Geojson for the sensors and add temperatures and charts
        res.send(createHtml(id, sensors, temperature, values, configOptions));
      });
    } else {
      // Get all sensors from api.sundsvall.se
      const sensors = await getTempSensors(url_sensors, apikey);
      // Get the temperatures from the sensors from api.sundsvall.se
      const temperatures = await getTemps(sensors, url_temp_sensor, apikey);
      // Create line chart of temperatures the last 24 hours
      const charts = await createCharts(temperatures);
      Promise.all(charts).then(function(values) {
        // Make a Geojson for the sensors and add temperatures and charts
        res.send(createGeojson(sensors, temperatures, values, configOptions));
      });
    }
  } else {
    res.send({});
  }
}

// Export the module
module.exports = iotTemp;

async function createCharts(temperatures) {
  const options = {
    width: 1200,
    height: 200,
    axisX: { title: 'Tid' },
    axisY: { title: 'Temp' }
  };
  const returnPromises = [];

  temperatures.forEach((temperature) => {
    const labels = [];
    const values = [];

    temperature.values.forEach((value, i) => {
      let hourMinutes = '';
      let lastLabel = '';
      if (!Number.isNaN(Date.parse(value.when))) {
        hourMinutes = new Intl.DateTimeFormat('locale', { hour: 'numeric', minute: 'numeric' }).format(Date.parse(value.when));
      }
      // Add labels for every fifth value so that the labels don't cover each other
      if (i % 4 == 0) {
        labels.push(hourMinutes);
      } else {
        labels.push('');
      }
      values.push(value.value);
    });
    const line = generate('line', options, {
      labels: labels,
      series: [
        {name: temperature.id, value: values}
      ]
    });
    returnPromises.push(line);
  });

  return returnPromises;
}

function createGeojson(sensors, temperatures, charts, configOptions) {
  const result = {};
  let features = [];
  result['type'] = 'FeatureCollection';
  result['name'] = configOptions.title;

  sensors.forEach((sensor) => {
    const tempSensor = {};
    const tempProperties = {};
    let hasGeometry = false;
    tempSensor['type'] = 'Feature';
    tempSensor['id'] = sensor.id;
    if (typeof sensor.geometry !== 'undefined' && sensor.geometry !== null) {
      tempSensor['geometry'] = {
        coordinates: sensor.geometry.coordinates,
        type: sensor.geometry.type
      };
      hasGeometry = true;
    } else {
      hasGeometry = false;
    }

    temperatures.forEach((temperature, i) => {
      //console.log(i);
      if (sensor.id === temperature.id) {
        tempSensor['properties'] = { latest: temperature.values[temperature.values.length - 1], values: temperature.values, chart: charts[i], url:  `${configOptions.url_detail_page}${sensor.id}` };
      }
    });
    // Only add those with a geometry
    if (hasGeometry) {
      features.push(tempSensor);
    }
  });
  result['features'] = features;
  return result;
}

function createHtml(sensorId, sensors, temperature, chart, configOptions) {
  const firstTime = new Intl.DateTimeFormat('locale', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(Date.parse(temperature.values[0].when));
  const lastTime = new Intl.DateTimeFormat('locale', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(Date.parse(temperature.values[temperature.values.length - 1].when));
  let coordinates = [];
  const lastTemp = temperature.values[temperature.values.length - 1].value;
  sensors.forEach((sensor) => {
    if (sensor.id === sensorId) {
      if (typeof sensor.geometry !== 'undefined' && sensor.geometry !== null) {
          coordinates = sensor.geometry.coordinates;
      }
    }
  });

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
	<meta http-equiv="X-UA-Compatible" content="IE=Edge;chrome=1">
	<title>Temperatur de senaste 24 timmr</title>
	<link href="https://karta.sundsvall.se/css/chartist.css" rel="stylesheet">
<style>
iframe {
  width: 1200px;
  height: 800px;
  border: 0;
  z-index: 9990;
	text-align:center;
}
</style>

</head>
<body>
<h1>Temperatur mellan ${firstTime} och ${lastTime}</h1>
${chart}
<script>
  function onMapFrameLoad() {
    setTimeout(function(){ map.origo.api().addMarker(map.origo.api().getMapUtils().transformCoordinate([${coordinates}],'EPSG:4326','${configOptions.destEPSGCode}'),'${sensorId}','${lastTemp} &deg; C vid ${lastTime}'); }, 1000);
	};
</script>
<iframe id="map" name="map" class="map-container" onload="onMapFrameLoad(this)"></iframe>
<script>
  map.location.href = '${configOptions.url_detail_map}';
</script>
</body>
</html>`;

  return html;
}
