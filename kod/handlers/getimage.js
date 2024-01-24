var conf = require('../conf/config');
const fetch = (...args) =>
	import('node-fetch').then(({default: fetch}) => fetch(...args));
const { writeFileSync } = require('fs');
const fs = require('fs');
var path = require('path');

var configSource = 'getImage';

/**
 * Picks out a image that is stored in database as string in base64 format by asking a WFS for a feature and picking out the attribute with the image.
 * @param {any} layer A string with the workspace:layer
 * @param {any} featureId A string with the feature id for requested feature.
 * @param {any} attribute A string with the attribute that contains the image.
 * @param {any} source A string with the base url for the WFS source
 */
const getImage = async (req, res, next) => {
    const layer = req.query.layer;
    const featureId = req.query.featureId;
    const source = req.query.source;
    const attribute = req.query.attribute;
    let urlSource = '';
    let responseType = '';

    if (conf[configSource]) {
      configOptions = Object.assign({}, conf[configSource]);
      configOptions.services.forEach((service) => {
        if (service.name === source) {
            urlSource = service.url;
        }
      });
      if (urlSource.length > 0) {
        responseFile = await getJson(urlSource, layer, featureId, attribute); 
      }
    }
    if (responseFile !== '') {
        res.sendFile(path.resolve(`${__dirname}/../temp/${responseFile}`));
    } else {
        res.status(204).send('');
    }
}
  

async function getJson(urlSource, layer, featureId, attribute) {
    const url = `${urlSource}?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson&typeName=${layer}&featureID=${featureId}`;
    let imageType = 'png';
    const options = {
        method: 'GET'
    };

    try {
        if (!fs.existsSync(path.resolve(`${__dirname}/../temp/`))) {
            fs.mkdir(path.resolve(`${__dirname}/../temp/`),
                (err) => {
                    if (err) {
                        return console.error(err);
                    }
                    console.log('Directory created successfully!');
                });
        }
        const res = await fetch(url, options);
        const json = await res.json();
        if (json["features"].length > 0) {
            if (json["features"][0]["properties"][attribute] !== undefined) {
                if(json["features"][0]["properties"][attribute] !== null) {
                    if (json["features"][0]["properties"][attribute].startsWith('data:image/jpeg')) {
                        imageType = 'jpg';
                    }
                    let base64Data = json["features"][0]["properties"][attribute].replace(/^data:image\/\w+;base64,/, '')
                    const image = Buffer.from(base64Data, "base64");
                    const imageFile = `${__dirname}/../temp/${featureId}.${imageType}`;
                    await writeFileSync(imageFile, image);
                    return `${featureId}.${imageType}`;
                }
            }
        }
    return '';
    } catch (err) {
        console.log(err);
    }
}

module.exports = getImage;