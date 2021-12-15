// all requests that start with "/admin/domain" is redirected to this module.

var express = require('express');
var domainRouter = express.Router();
var orm = require('orm');
var _ = require('lodash');
var helperFunctions = require('./handlers/helperFunctions');
var xml2js = require('xml2js');
var formatter = require('./handlers/formatter');
var configBc = require('./bc/ConfigBc');
var updateTreeStructure = require('./handlers/treeStructureHelpers');

// req.models is a reference to models that ar defined in models.js and used as a middleware in admin.js

domainRouter.route('/fetchLayersAndGroups/:configId')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {

    var Config = req.models.Config;
    var Group = req.models.Group;
    var Layer = req.models.Layer;
    var configId = req.params["configId"];

    var index = {};

    index.layers = [];
    index.groups = [];
    var groupsMap = new Map();

    var configPromise = new Promise(function (resolve, reject) {
      Config.find({ id: configId }, function (err, rows) {
        if (rows.length == 0) {
          res.end('No config for this id was found.');
          return;
        } else if (rows.length > 1) {
          res.end('More than one config for this id was found. Fix the database and remove duplicate data!');
          return;
        } else {
          var config = rows[0];
        }
        configId = config.id;
        index.projectionCode = config.projection_code;
        index.projectionExtent = config.projection_extent.split(',').map(Number);
        index.extent = config.extent.split(',').map(Number);
        index.center = config.center.split(',').map(Number);
        index.resolutions = config.resolutions.split(',').map(Number);
        index.zoom = config.zoom;
        index.featureInfoOptions = config.featureinfo_options;
        config.getProj4Defs(function (err, proj4Defs) {
          index.proj4Defs = [{
            "code": proj4Defs.code,
            "alias": proj4Defs.alias,
            "projection": proj4Defs.projection
          }];
          resolve();
        });
      });
    });

    configPromise.then(function () {

      let layersPromise = new Promise(function (resolve, reject) {
        Layer.find({ config_id: configId }, function (err, layers) {

          console.log('Number of layers   : ' + layers.length);
          var layersPromises = [];
          for (let layer of layers) {
            layersPromises.push(new Promise(function (resolve, reject) {

              // let layerJsonObj = layer.createJsonObject();

              let groupsPromise = function () {
                return new Promise(function (resolve, reject) {
                  layer.getGroup(function (err, group) {
                    if (group) {  // in practice all layers must have a group, but in the test environment there might be 
                      // layers without groups. in this case group is undefined and we need to check that.
                      // layerJsonObj.group = group.name;
                      groupsMap.set(group.name, group);
                      // groupsMap.set(group.name, group.createJsonObject());
                    }
                    resolve();
                  });
                });
              }

              groupsPromise().then(function () {
                // index.layers.push(layerJsonObj);
                index.layers.push(layer);
                resolve();
              });
            }));
          }
          Promise.all(layersPromises).then(function () {
            for (let group of groupsMap.values()) {
              index.groups.push(group);
            }
            resolve();
          });
        });
      });

      Promise.all([layersPromise]).then(function () {
        console.log('Number of groups   : ' + groupsMap.size);
        console.log('done!');
        res.setHeader('Content-disposition', 'attachment; filename=index.json');
        res.setHeader('Content-type', 'application/json');
        res.status(200).json(index);
      }).catch(function (error) {
        console.log(error);
        res.status(500).json(error.message);
      });
    });
  });

// this method fetches all groups for a config that has at least one layer.
// empty groups will not be returned 
domainRouter.route('/fetchConfigNotEmptyGroups/:configId')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {

    var Config = req.models.Config;
    var Group = req.models.Group;
    var Layer = req.models.Layer;
    var configId = req.params["configId"];

    var index = {};

    index.layers = [];
    index.groups = [];
    var groupsMap = new Map();

    var configPromise = new Promise(function (resolve, reject) {
      Config.find({ id: configId }, function (err, rows) {
        if (rows.length == 0) {
          res.end('No config for this id was found.');
          return;
        } else if (rows.length > 1) {
          res.end('More than one config for this id was found. Fix the database and remove duplicate data!');
          return;
        } else {
          var config = rows[0];
        }
        configId = config.id;
        // index.projectionCode = config.projection_code;
        // index.projectionExtent = config.projection_extent.split(',').map(Number);
        // index.extent = config.extent.split(',').map(Number);
        // index.center = config.center.split(',').map(Number);
        // index.resolutions = config.resolutions.split(',').map(Number);
        // index.zoom = config.zoom;
        // index.featureInfoOptions = config.featureinfo_options;
        config.getProj4Defs(function (err, proj4Defs) {
          if (proj4Defs)
            index.proj4Defs = [{
              "code": proj4Defs.code,
              "alias": proj4Defs.alias,
              "projection": proj4Defs.projection
            }];
          resolve();
        });
      });
    });

    configPromise.then(function () {

      let layersPromise = new Promise(function (resolve, reject) {
        Layer.find({ config_id: configId }, function (err, layers) {

          // console.log('Number of layers   : ' + layers.length);
          var layersPromises = [];
          for (let layer of layers) {
            layersPromises.push(new Promise(function (resolve, reject) {

              // let layerJsonObj = layer.createJsonObject();

              let groupsPromise = function () {
                return new Promise(function (resolve, reject) {
                  layer.getGroup(function (err, group) {
                    if (group) {  // in practice all layers must have a group, but in the test environment there might be 
                      // layers without groups. in this case group is undefined and we need to check that.
                      // layerJsonObj.group = group.name;
                      groupsMap.set(group.name, group);
                      // groupsMap.set(group.name, group.createJsonObject());
                    }
                    resolve();
                  });
                });
              }

              groupsPromise().then(function () {
                // index.layers.push(layerJsonObj);
                index.layers.push(layer);
                resolve();
              });
            }));
          }
          Promise.all(layersPromises).then(function () {
            for (let group of groupsMap.values()) {
              index.groups.push(group);
            }
            resolve();
          });
        });
      });

      Promise.all([layersPromise]).then(function () {
        console.log('Number of groups that belongs to the configId ' + configId + ' : ' + groupsMap.size);
        console.log('done!');
        res.setHeader('Content-disposition', 'attachment; filename=index.json');
        res.setHeader('Content-type', 'application/json');
        res.status(200).json(index.groups);
      }).catch(function (error) {
        console.log(error);
        res.status(500).json(error.message);
      });
    });
  });

// To remove a config and all its layers, groups, styles and attributes
domainRouter.route('/removeConfigGraph/:configId')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .delete(function (req, res, next) {
    const configId = req.params.configId;
    configBc.removeConfigGraph(req, res, configId);
    res.status(200).json({});
  });

domainRouter.route('/removeLayerGraph/:layerId')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .delete(function (req, res, next) {
    const layerId = req.params.layerId;
    req.models.Layer.get(layerId, function (err, layer) {
      if (err) res.sendStatus(500);
      if (!layer) res.sendStatus(404);
      layer.getStyle(function (err, style) {
        if (err)
          console.log('error getting style for layer id = ' + layer.id);
        if (style)
          style.remove(function (err) {
            if (err) console.log('error removing style id : ' + style.id);
            else console.log('style removed, id : ' + style.id);
          });
      });
      req.models.Attribute.find({ layer_id: layer.id }).remove(function (err) {
        if (err) console.log('error removing attributes for layer id : ' + layer.id);
        else console.log('attributes removed for layer id : ' + layer.id);
      });
      layer.remove(function (err) {
        if (err) {
          console.log('error removing layer id : ' + layer.id);
          res.sendStatus(500);
        }
        else {
          console.log('layer removed, id : ' + layer.id);
          res.status(200).json({});
        }
      });
    })
  });

// ', '?url=' + source.url + '&layer=' + layer.name);
domainRouter.route('/fetchAttributeFromServer')

  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .post(function (req, res, next) {

    var source = req.body.source;
    var layerName = req.body.layerName;

    var describeFeatureTypeUrl = helperFunctions.fixUrlforDescribeFeaturType(source, layerName);
    // console.log(describeFeatureTypeUrl);
    helperFunctions.fetchData(describeFeatureTypeUrl)
      .then(function (response) {
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: false, stripPrefix: true });
        parser.parseString(response, function (err, jsonAttribute) {

          var attributes = formatter.Attribute(jsonAttribute);
          // console.log(attributes);
          res.setHeader('Content-type', 'application/json');
          res.status(200).json(attributes);
        });
      })
      .catch(function (err) {
        console.log(err);
        res.setHeader('Content-type', 'application/json');
        res.status(500).json({
          exceptionMessage: err.message
        });
      });
  });

domainRouter.route('/updateTreeStructure')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .post(function (req, res, next) {
    updateTreeStructure(req, res);
  });

domainRouter.route('/saveVisibilityStatus')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .post(function (req, res, next) {
    const data = JSON.parse(req.body.data);
    req.models.Group.find({ id: data.group_id, config_id: data.config_id }).each(function (group) {
      group.collapsed_in_admin_tree = data.expanded;
    }).save(function (err) {
      if (err) console.log(err.message);
    });
    res.status(200).send({});
  });

domainRouter.route('/updateGroupAndLayerTreeInformation')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .post(function (req, res, next) {

    var items = req.body.itemsToUpdate;
    var layersPromises = [];
    items.forEach(function (item) {
      layersPromises.push(new Promise(function (resolve, reject) {

        //console.log(item);

        let getParentPromise = new Promise(function (resolveParent, rejectParent) {
          if (item.previousParentId == item.newParentId || item.newParentId == 0 || item.newParentId == null) {
            resolveParent();
          }
          else {
            req.models.Group.get(item.newParentId, function (err, group) {
              item.newParent = group;
              resolveParent();
            });
          }
        });
        let dbObject = null;
        let getDbObjectPromise = new Promise(function (resolveDbObject, rejectDbObject) {
          if (item.type == "Group") {
            req.models.Group.get(item.itemId, function (err, group) {
              dbObject = group;
              resolveDbObject();
            });
          }
          else if (item.type == "Layer") {
            req.models.Layer.get(item.itemId, function (err, layer) {
              dbObject = layer;
              resolveDbObject();
            });
          }
        });
        Promise.all([getParentPromise, getDbObjectPromise]).then(function () {
          updateGroupAndLayerTreeInformationInDb(dbObject, item, resolve, reject);
        });
      }));
    });
    Promise.all(layersPromises).then(function () {
      res.status(200).json("{}");
    }).catch(function (error) {
      console.log(error);
      res.status(500).json(error.message);
    });
  });

function updateGroupAndLayerTreeInformationInDb(dbItem, item, resolve, reject) {
  dbItem.order_number = item.newOrderNumber;
  if (item.type == "Group") {
    if (item.newParentId == 0) {
      dbItem.parent = null;
    }
    else if (item.newParent) {
      dbItem.parent = item.newParent.name;
    }
    dbItem.collapsed_in_admin_tree = item.collapsed_in_admin_tree;
  }
  else if (item.type == "Layer") {
    if (item.newParentId == 0) {
      dbItem.parent = null;
    }
    if (item.newParent) {
      dbItem.group = item.newParent;
    }
  }
  //console.log("saving item with id " + item.itemId);
  try {
    dbItem.save(function (err) {
      console.log("Save complete");
      resolve();
      if (err) {
        console.log(err);
        return reject(err);
      }
    });

  }
  catch (ex) {
    consol.log(ex.message);
    return reject(err);
  }
}

domainRouter.route('/fetchConfigStyles/:configId')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res, next) {

    var Layer = req.models.Layer;
    var Config = req.models.Config;
    // var Style = req.models.Style;
    var configId = req.params["configId"];
    var styles = [];

    // var configPromise = new Promise(function (resolve, reject) {
    //   Config.find({ id: configId }, function (err, rows) {
    //     if (rows.length == 0) {
    //       res.end('No config for this id was found.');
    //       return;
    //     } else {
    //       var config = rows[0];
    //     }
    //     resolve();
    //   });
    // });

    // configPromise.then(function () {

    let layersPromise = new Promise(function (resolve, reject) {
      Layer.find({ config_id: configId }, function (err, layers) {
        var layersPromises = [];
        for (let layer of layers) {
          layersPromises.push(new Promise(function (resolve, reject) {
            let obj = {};
            let stylePromise = function () {
              return new Promise(function (resolve, reject) {
                layer.getStyle(function (err, style) {
                  // if (!style) reject(new Error('layer "' + layer.name + '" has no style.'));
                  if (style) {
                    obj.name = style.name;
                    obj.id = style.id;
                  }
                  resolve();
                });
              });
            }
            stylePromise()
              .then(function () {
                styles.push(obj);
                resolve();
              })
              .catch(function (err) {
                reject(err);
              });
          }));
        }
        Promise.all(layersPromises).then(function () {
          resolve();
        }).catch(function (err) {
          reject(err);
        });
      });
    });

    layersPromise.then(function () {
      console.log('done!');
      res.setHeader('Content-disposition', 'attachment; filename=index.json');
      res.setHeader('Content-type', 'application/json');
      res.status(200).json(styles);
    }).catch(function (error) {
      console.log(error);
      // if we do not send status 200, it won't be downloaded and a backup.json file will be downloaded in the OrigoAdmin
      res.status(200).json(error.message);
    });
    // });
  });
module.exports = domainRouter;

