const conf = require('../conf/config');
const axios = require('axios').default;

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
    .then(console.log(temperatures))
    .catch(error => console.log('error', error));

  return temperatures;
}

// Do the request in proper order
const iotTemp = async (req, res) => {

  if (conf[proxyUrl]) {
    configOptions = Object.assign({}, conf[proxyUrl]);
    url_sensors = configOptions.url_sensors;
    url_temp_sensor = configOptions.url_temp_sensor;
    apikey = configOptions.apikey;

    const sensors = await getTempSensors(url_sensors, apikey);
    //console.log(sensors);
    const temperatures = await getTemps(sensors, url_temp_sensor, apikey);
    //console.log(temperatures);
    res.send(createGeojson(sensors, temperatures, configOptions));
  } else {
    res.send({});
  }
}

// Export the module
module.exports = iotTemp;

function createGeojson(sensors, temperatures, configOptions) {
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

    temperatures.forEach((temperature) => {
      if (sensor.id === temperature.id) {
        tempSensor['properties'] = { latest: temperature.values[temperature.values.length - 1], values: temperature.values };
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
