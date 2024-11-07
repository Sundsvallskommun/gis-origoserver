// args.apiDoc needs to be a js object.  This file could be a json file, but we can't add
// comments in json files.
module.exports = {
  swagger: '2.0',

  // all routes will now have /api/v1 prefixed.
  basePath: '/origoserver/api-association-test/v1',

  schemes: ['https'],
  
  info: {
    title: 'TEST API GIS',
    description: 'Test API from the GIS department',
    version: '1.0',
  },

  definitions: {
    AssociationResponse: {
      type: 'object',
      properties: {
        name: {
          description: 'The name of the ssociation.',
          type: 'string'
        },
        type: {
          description: 'The type of the association.',
          type: 'string'
        },
        objectidentifier: {
          description: 'The unique identifier of the association.',
          type: 'string'
        }
      }
    }
  },

  // paths are derived from args.routes.  These are filled in by fs-routes.
  paths: {},
};
