const conf = require('../../../../conf/config');
const { URL } = require('url');
const pg = require('pg');
const { Client } = pg

const service = 'apiGeometryQuery';

async function lookupDistrict(req, res) {
    const configOptions = Object.assign({}, conf[service].services.district);
    let responseObj = {};
    let failed = false;
   
    const client = new Client({
        user: configOptions.dbUser,
        password: configOptions.dbPassword,
        host: configOptions.dbHostname,
        port: configOptions.dbPort,
        database: configOptions.dbName,
    });

    try {
      await client.connect();
    } catch(err) {
      failed = true;
      res.status(500).json({error: 'Failed to connect to database!'});
    }    
    try {
      const reqBody = req.body;
      const srid = reqBody.srid ? reqBody.srid : 3006;
      /*const sqlQuery = `SELECT distriktsnamn, distriktskod, objektidentitet
        FROM public."SLM_Distrikt_yta"
        WHERE ST_Contains(
          geom,
          ST_GeomFromText('${reqBody.wkt}', ${reqBody.srid})
      );`;*/
      // Sök ut vilka distrikt som geometrin ligger inom och sortera så att den med största area hamnar överst.
      let sqlQuery = '';
      if (reqBody.wkt.startsWith("POLYGON") || reqBody.wkt.startsWith("MULTIPOLYGON")) {
        sqlQuery = `SELECT distriktsnamn, distriktskod, objektidentitet, ST_Area(ST_Intersection(d.geom, p.geom)) AS area_inom_distrikt
        FROM public."SLM_Distrikt_yta" as d, 
            (SELECT ST_GeomFromText('${reqBody.wkt}',
            ${srid}) AS geom) AS p
        WHERE ST_Intersects(d.geom, p.geom)
        ORDER BY area_inom_distrikt DESC;`;
      }
      if (reqBody.wkt.startsWith("LINESTRING") || reqBody.wkt.startsWith("MULTILINESTRING")) {
        sqlQuery = `SELECT distriktsnamn, distriktskod, objektidentitet, ST_Length(ST_Intersection(d.geom, p.geom)) AS langd_inom_distrikt
        FROM public."SLM_Distrikt_yta" as d, 
            (SELECT ST_GeomFromText('${reqBody.wkt}',
            ${srid}) AS geom) AS p
        WHERE ST_Intersects(d.geom, p.geom)
        ORDER BY langd_inom_distrikt DESC;`;
      }
      if (reqBody.wkt.startsWith("POINT") || reqBody.wkt.startsWith("MULTIPOINT")) {
        sqlQuery = `SELECT distriktsnamn, distriktskod, objektidentitet
        FROM public."SLM_Distrikt_yta"
        WHERE ST_Contains(geom, ST_SetSRID(ST_Point(${easting}, ${northing}), ${srid}));`
      }
      if(sqlQuery.length > 0) {
        const res = await client.query(sqlQuery);
        if (res.rowCount === 1) {
          responseObj = res.rows[0];
        } 
      } else {
        failed = true;
        res.status(500).json({ error: 'Geometry not supported!', message: err });
      }
    } catch(err) {
      await client.end();
      failed = true;
      res.status(500).json({ error: 'Failed to query database!', message: err });
    }

    if (!failed) {
      await client.end();
      res.status(200).json(responseObj); 
    }
}

module.exports = {
  post: function (req, res, next) {
    let validationError = false;
    if (conf && conf.apiGeometryQuery && conf.apiGeometryQuery.services && conf.apiGeometryQuery.services['district']) {
      if (!validationError) {
        lookupDistrict(req, res);
      }
    } else {
      validationError = true;
      res.status(400).json({error: 'Error in configuration!'});
    }
  },
};
  
module.exports.post.apiDoc = {
  description: 'Is the supplyed geometry within the type of area.',
  operationId: 'isWithinByGeometry',
  parameters: [
    {
      in: 'body',
      name: 'wkt',
      required: true,
      schema: {
        items: {
          $ref: '#/definitions/GeometryBody'
        }
      }
    }
  ],
  tags: [
    'district'
  ],
    responses: {
    200: {
      description: 'Responds with a object of the district for supplied geometry',
      schema: {
          type: 'array',
          items: {
            $ref: '#/definitions/DistrictResponse'
          }
        },
    },
    400: {
      description: 'Bad request',
      schema: {
        $ref: '#/definitions/ErrorResponse'
      },
    },
    500: {
      description: 'Server error',
      schema: {
        $ref: '#/definitions/ErrorResponse'
      },
    },
  },
};
  