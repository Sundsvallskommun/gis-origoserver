// args.apiDoc needs to be a js object.  This file could be a json file, but we can't add
// comments in json files.
module.exports = {
  swagger: '2.0',

  // all routes will now have /api/v1 prefixed.
  basePath: '/origoserver/api/v1',

  info: {
    title: 'API GIS',
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
        }
      },
      required: ['name']
    },
    metadata: {
      type: 'object',
      properties: {
        keys: {
          description: 'Key',
          type: 'string',
          example: 'type'
        },
        value: {
          description: 'Value',
          type: 'string',
          example: 'DISTRICT_HEATING'
        }
      },
      readOnly: true
    }
  },

  // paths are derived from args.routes.  These are filled in by fs-routes.
  paths: {},
};
