// args.apiDoc needs to be a js object.  This file could be a json file, but we can't add
// comments in json files.
module.exports = {
  swagger: '2.0',

  // all routes will now have /api/v1 prefixed.
  basePath: '/origoserver/api/v1',

  schemes: ['https'],
  
  info: {
    title: 'API GIS',
    description: 'API from the GIS department',
    version: '1.0',
  },

  definitions: {
    NykoStat: {
      type: 'object',
      properties: {
        men: {
          description: 'The count of men in Nyko.',
          type: 'integer'
        },
        women: {
          description: 'The count of women in Nyko.',
          type: 'integer'
        },
        ageByInterval: {
          description: 'The ages of population sorted in intervals.',
          type: 'array'
        },
        outtakeDate: {
          description: 'The date of outtake of data.',
          type: 'string'
        },
        variables: {
          description: 'Variables with metrics for Nyko.',
          type: 'object',
          additionalProperties: {
              type: "array",
              items: {
                "$ref": "#/definitions/Values"
              }
          }
        }
      },
      required: ['name']
    },
    metadata: {
      type: 'object',
      additionalProperties: {
          type: "string",
          description: "Map with name-value pairs",
          readOnly: true,
          example: "type: DISTRICT_HEATING"
      },
      description: "Map with name-value pairs",
      readOnly: true,
      example: "type: DISTRICT_HEATING"
    },
    Values: {
      type: 'object',
      additionalProperties: {
          type: "string",
          description: "Map with name-value pairs"
      },
      description: "Map with name-value pairs"
    },
  },

  // paths are derived from args.routes.  These are filled in by fs-routes.
  paths: {},
};
