// args.apiDoc needs to be a js object.  This file could be a json file, but we can't add
// comments in json files.
module.exports = {
  swagger: '2.0',

  // all routes will now have /api/v1 prefixed.
  basePath: '/origoserver/api-geometry-query/v1',

  schemes: ['https'],
  
  info: {
    title: 'API GIS Geometry query',
    description: 'Answers different geometry query',
    version: '1.0.0',
    contact: {
      name: 'Johnny Blästa',
      email: 'johnny.blasta@sundsvall.se',
    }
  },

  definitions: {
    ErrorResponse: {
      type: 'object',
      properties: {
        error: {
          description: 'The error message.',
          type: 'array',
          items: {
            "$ref": "#/definitions/Error"
          }
        }

      }
    },
    Error: {
      type: 'object',
      properties: {
        path: {
          description: 'The path of the error.',
          type: 'string'
        },
        errorCode: {
          description: 'The error code.',
          type: 'string'
        },
        message: {
          description: 'A clearification on the error.',
          type: 'string'
        },
        location: {
          description: 'The location of the error.',
          type: 'string'
        }
      }
    },
    DistrictResponse: {
      type: 'object',
      properties: {
        objectidentifier: {
          description: 'The unique identifier of the district.',
          type: 'string'
        },
        districtname: {
          description: 'The district name.',
          type: 'string'
        },
        districtcode: {
          description: 'The district code.',
          type: 'string'
        }
      }
    },
    GeometryBody: {
      type: 'object',
      properties: {
        wkt: {
          description: 'The unique identifier of the district.',
          type: 'string'
        },
        srid: {
          description: 'The district name.',
          type: 'string'
        }
      }
    }
  },

  // paths are derived from args.routes.  These are filled in by fs-routes.
  paths: {},
};
