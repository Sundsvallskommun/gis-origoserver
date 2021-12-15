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

  definitions: {},

  // paths are derived from args.routes.  These are filled in by fs-routes.
  paths: {},
};
