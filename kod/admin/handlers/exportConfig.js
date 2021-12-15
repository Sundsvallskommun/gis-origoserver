// This module reads a conifg from database and creates a full index.json

"use strict";

var orm = require('orm');
// var _ = require('lodash');
var GroupLayerTreeUtil = require('./groupLayerTreeUtil');

var exportConfig = function (req, res) {

  var exportStyle = 'origo';

  var Group = req.models.Group;
  var Layer = req.models.Layer;
  var Source = req.models.Source;
  var Attribute = req.models.Attribute;
  var Config = req.models.Config;
  var Control = req.models.Control;
  // var ControlOptions = req.models.ControlOptions;
  var Proj4Defs = req.models.Proj4Defs;
  var Style = req.models.Style;

  // var configName = req.params["configName"];
  var configId = req.params["configId"];
  var index = {
    configName : null,
    projectionExtent : null,
    extent : null,
    center : null,
    resolutions : null,
    zoom : null,
    featureinfoOptions : null,
    projectionCode : null,
    proj4Defs : [],
    controls : [],
    layers : [],
    groups : [],
    source : {},
    styles : {}
  }
  
  var sourcesMap = new Map();
  var stylesMap = new Map();

  var configPromise = new Promise(function (resolve, reject) {
    // Config.find({ name: configName }, function(err, rows) {
    Config.find({ id: configId }, function (err, rows) {
      if (rows.length == 0) {
        res.end('No config for this name was found.');
        return;
      } else if (rows.length > 1) {
        res.end('More than one config for this name was found. Fix the database and remove duplicate data!');
        return;
      } else {
        var config = rows[0];
      }
      // configId = config.id;
      index.configName = config.name;
      // index.projectionCode = config.projection_code;
      index.projectionExtent = config.projection_extent.split(',').map(Number);
      index.extent = config.extent.split(',').map(Number);
      index.center = config.center.split(',').map(Number);
      index.resolutions = config.resolutions.split(',').map(Number);
      index.zoom = config.zoom;
      index.featureinfoOptions = config.featureinfo_options;
      // En bugg i react gjorde att boolean values från en select box blir sträng.
      // värde för pinning till vissa konfiger är boolean i db och till vissa är det sträng.
      // detta för att säkerställa att i exporterade konfig står alltid boolean values
      if (index.featureinfoOptions.pinning) {
        if (index.featureinfoOptions.pinning === "false") index.featureinfoOptions.pinning = false;
        if (index.featureinfoOptions.pinning === "true") index.featureinfoOptions.pinning = true;
      }
      config.getProj4Defs(function (err, proj4Defs) {
        index.projectionCode = proj4Defs.code;
        index.proj4Defs = [{
          "code": proj4Defs.code,
          "alias": proj4Defs.alias,
          "projection": proj4Defs.projection
        }];
        resolve();
      });
    });
  });
  
  //configPromise.then(function () {
  // it is also possible to use config.getControls() method if we say Control.hasOne('config', Config, {reverse: 'control'}).
  let controlsPromise = new Promise(function (resolve, reject) {
    Control.find({ config_id: configId }, function (err, controls) {

      if (controls) {
        console.log('Number of controls : ' + controls.length);
        // there is bug in Origo that need to have "mapmenu" before "legend" in the list of controls! because of that we need to sort it so that mapmeu comes first.
        controls.sort(function (a, b) {
          if (a.name == 'mapmenu') return -1;
          else return 1;
        });
      }
      for (let control of controls) {
        index.controls.push(control.createJsonObject());
      }
      resolve();
    });
  });

  //var configId = req.params["configId"];
  let dbGroups = [];
  let dbLayers = [];
  let groupsPromise = new Promise(function (resolve, reject) {
    req.models.Group.find({ config_id: configId }, function (err, groups) {
      dbGroups = dbGroups.concat(groups);
      resolve();
    })
  });

  let layersPromise = new Promise(function (resolve, reject) {
    req.models.Layer.find({ config_id: configId }, function (err, layers) {
      dbLayers = dbLayers.concat(layers);
      resolve();
    })
  });
 
  Promise.all([configPromise, controlsPromise, groupsPromise, layersPromise]).then(function () {
    let groupLayerTree = GroupLayerTreeUtil.reconstructGroupLayerTree(dbGroups, dbLayers);
    //console.log(groupLayerTree);
    let result = GroupLayerTreeUtil.splitLayerGroupTreeIntoOrderedLists(groupLayerTree, { groups: [], layers: [], addedGroups: [] });
    
    result.groups.forEach(function (group) {
      index.groups.push(group);
    });
    let layersPromises = [];

    result.layers.forEach(function (layer) {
      let layerJsonObj = layer.createJsonObject();
      index.layers.push(layerJsonObj);  //important to place this in the list of layers before using promise to populate

      layersPromises.push(new Promise(function (layerResolve, layerReject) {
        let sourcePromise = function () {
          return new Promise(function (resolve, reject) {
            layer.getSource(function (err, source) {
              if (!source) {
                reject(new Error('layer "' + layer.name + '" has no source.'));
              } else {
                layerJsonObj.source = source.name;
                index.source[source.name] = source.createJsonObject();
                sourcesMap.set(source.name, source.createJsonObject());
                resolve();
              }
            });
          });
        }

        let stylePromise = function () {
          return new Promise(function (resolve, reject) {
            layer.getStyle(function (err, style) {
              if (!style) {
                reject(new Error('layer "' + layer.name + '" has no style.'));
              } else {
                layerJsonObj.style = style.name;
                let arr = [];
                arr[0] = [];
                arr[0].push(style.createJsonObject());
                index.styles[style.name] = arr;
                stylesMap.set(style.name, style.createJsonObject());
                resolve();
              }
            });
          });
        }

        let attributePromise = function () {
          return new Promise(function (resolve, reject) {
            Attribute.find({ layer_id: layer.id }, function (err, attributes) {
              if (attributes && attributes.length > 0) {
                layerJsonObj.attributes = [];
                for (let attribute of attributes) {
                  let attJsonObj = {};
                  if (attribute.name) attJsonObj.name = attribute.name;
                  if (attribute.title) attJsonObj.title = attribute.title;
                  if (attribute.url) attJsonObj.url = attribute.url;
                  if (attribute.url_title) attJsonObj.urltitle = attribute.url_title;
                  if (attribute.html) attJsonObj.html = attribute.html;
                  layerJsonObj.attributes.push(attJsonObj);
                }
              }
              resolve();
            });
          });
        }
        Promise.all([sourcePromise(), stylePromise(), attributePromise()]).
          then(function () {

            layerResolve();
            //resolve();
          })
          .catch(function (err) {
            console.log(err);
            //reject(err);
          });
      }));
    });
    Promise.all(layersPromises).
      then(function () {
        console.log('Number of groups   : ' + index.groups.length);
        console.log('Number of sources  : ' + sourcesMap.size);
        console.log('Number of styles   : ' + stylesMap.size);
        console.log('done!');
        res.setHeader('Content-disposition', 'attachment; filename=index.json');
        res.setHeader('Content-type', 'application/json');
        // res.status(200).json(index);
        res.status(200).send(JSON.stringify(index, undefined, 4));
        // res.status(200).send(prettifyJson(JSON.stringify(index)));
      }).catch(function (error) {
        console.log(error);
        // if we do not send status 200, it won't be downloaded and a backup.json file will be downloaded in the OrigoAdmin
        res.status(200).json(error.message);
      });
  }).catch(function (err) {
    console.log(err);
    //reject(err);
  });

  /*
          var layersPromises = [];
          for (let layer of layers) {
            layersPromises.push(new Promise(function (resolve, reject) {
              let layerJsonObj = layer.createJsonObject();
              let groupPromise = function () {
                return new Promise(function (resolve, reject) {
                  layer.getGroup(function (err, group) {
                    if (!group) {
                      reject(new Error('layer "' + layer.name + '" has no group.'));
                    } else {
                      layerJsonObj.group = group.name;
                      // groupsMap.set(group.name, group.createJsonObject());
                      // we need to save the groups in a map to avoid saving the same group several times! if we push directly every layer will have a group!
                      // index.groups.push(group.createJsonObject()); 
                      resolve();
                    }
                  });
                });
              }
  
              
  
              
  
              
  
              Promise.all([groupPromise(), sourcePromise(), stylePromise(), attributePromise()])
                .then(function () {
                  index.layers.push(layerJsonObj);
                  resolve();
                })
                .catch(function (err) {
                  // console.log(err);
                  reject(err);
                });
            }));
          }
          Promise.all(layersPromises).then(function () {
            resolve();
          }).catch(function (err) {
            // console.log(err);
            reject(err);
          });
        });
      });
  
      Promise.all([controlsPromise, layersPromise, groupsPromise]).then(function () {
        console.log('Number of groups   : ' + groups.length);
        console.log('Number of sources  : ' + sourcesMap.size);
        console.log('Number of styles   : ' + stylesMap.size);
        console.log('done!');
        res.setHeader('Content-disposition', 'attachment; filename=index.json');
        res.setHeader('Content-type', 'application/json');
        // res.status(200).json(index);
        res.status(200).send(JSON.stringify(index, undefined, 4));
        // res.status(200).send(prettifyJson(JSON.stringify(index)));
      }).catch(function (error) {
        console.log(error);
        // if we do not send status 200, it won't be downloaded and a backup.json file will be downloaded in the OrigoAdmin
        res.status(200).json(error.message);
      });
    });
    */
}

var exportConfigOld = function (req, res) {

  var exportStyle = 'origo';

  var Group = req.models.Group;
  var Layer = req.models.Layer;
  var Source = req.models.Source;
  var Attribute = req.models.Attribute;
  var Config = req.models.Config;
  var Control = req.models.Control;
  // var ControlOptions = req.models.ControlOptions;
  var Proj4Defs = req.models.Proj4Defs;
  var Style = req.models.Style;

  // var configName = req.params["configName"];
  var configId = req.params["configId"];
  // var configId;
  var index = {};
  index.controls = [];
  index.layers = [];

  index.groups = [];
  // var groupsMap = new Map();
  var groups = [];
  index.source = {};
  var sourcesMap = new Map();
  index.styles = {};
  var stylesMap = new Map();

  var configPromise = new Promise(function (resolve, reject) {
    // Config.find({ name: configName }, function(err, rows) {
    Config.find({ id: configId }, function (err, rows) {
      if (rows.length == 0) {
        res.end('No config for this name was found.');
        return;
      } else if (rows.length > 1) {
        res.end('More than one config for this name was found. Fix the database and remove duplicate data!');
        return;
      } else {
        var config = rows[0];
      }
      configId = config.id;
      index.configName = config.name;
      // index.projectionCode = config.projection_code;
      index.projectionExtent = config.projection_extent.split(',').map(Number);
      index.extent = config.extent.split(',').map(Number);
      index.center = config.center.split(',').map(Number);
      index.resolutions = config.resolutions.split(',').map(Number);
      index.zoom = config.zoom;
      index.featureinfoOptions = config.featureinfo_options;
      config.getProj4Defs(function (err, proj4Defs) {
        index.projectionCode = proj4Defs.code;
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
    // it is also possible to use config.getControls() method if we say Control.hasOne('config', Config, {reverse: 'control'}).
    let controlsPromise = new Promise(function (resolve, reject) {
      Control.find({ config_id: configId }, function (err, controls) {

        if (controls) {
          console.log('Number of controls : ' + controls.length);
          // there is bug in Origo that need to have "mapmenu" before "legend" in the list of controls! because of that we need to sort it so that mapmeu comes first.
          controls.sort(function (a, b) {
            if (a.name == 'mapmenu') return -1;
            else return 1;
          });
        }
        for (let control of controls) {
          index.controls.push(control.createJsonObject());
        }
        resolve();
      });
    });

    let groupsPromise = new Promise(function (resolve, reject) {
      Group.find({ config_id: configId }, function (err, groupss) {

        if (groupss) {
          console.log('Number of groups : ' + groupss.length);
          // TODO: sorting groups
        }
        for (let grp of groupss) {
          groups.push(grp.createJsonObject());
        }
        if (exportStyle === 'decerno') {
          /* // with two iterations we ensure that all groups with parent will come after their parent group.
          var groups1 = [];
          var groups2 = [];
          for (let group of groupsMap.values()) {
            if (!group.parent)
              groups1.push(group);
            else
              groups2.push(group);
          }
          // recursive function to make sure that all subgroups are coming after their parent too.
          function swap () {
            for (var i = 0; i < groups2.length; i++) {
              let first = groups2[i];
              let rest = groups2.slice(i);
              let parentIndex = rest.findIndex(e => first.parent === e.name);
              if (parentIndex > 0) {
                groups2[i] = groups2[parentIndex + i];
                groups2[parentIndex + i] = first;
                swap();
              }
            }
          }
          swap();
          let groups = [...groups1, ...groups2]; 
          index.groups = groups; */

          groups.sort((a, b) => a.order_number - b.order_number);
          index.groups = groups.map(g => delete g.order_number);
          resolve();

        } else if (exportStyle === 'origo') {

          // console.log(groups);
          let findParent = function (group, groups) {
            let res = null;
            let ll = groups.length;
            for (let i = 0; i < ll; i++) {
              let g = groups[i];
              if (g.name === group.parent)
                return g;
              if (g.groups) {
                res = findParent(group, g.groups);
                if (res) {
                  return res;
                }
              }
            }
          }
          let l = groups.length;
          for (let i = 0; i < l; i++) {
            let group = groups.shift();
            if (group.parent) {
              let parent = findParent(group, groups);
              if (!parent.groups) parent.groups = [];
              parent.groups.push(group);
              delete group.order_number;
              delete group.parent;
            } else {
              groups.push(group);
              delete group.order_number;
            }
          }
        }
        index.groups = groups;
        resolve();
      });
    });

    let layersPromise = new Promise(function (resolve, reject) {
      Layer.find({ config_id: configId }, function (err, layers) {

        if (layers) {
          console.log('Number of layers   : ' + layers.length);
          layers.sort((a, b) => a.order_number - b.order_number);
        }
        var layersPromises = [];
        for (let layer of layers) {
          layersPromises.push(new Promise(function (resolve, reject) {
            let layerJsonObj = layer.createJsonObject();
            let groupPromise = function () {
              return new Promise(function (resolve, reject) {
                layer.getGroup(function (err, group) {
                  if (!group) {
                    reject(new Error('layer "' + layer.name + '" has no group.'));
                  } else {
                    layerJsonObj.group = group.name;
                    // groupsMap.set(group.name, group.createJsonObject());
                    // we need to save the groups in a map to avoid saving the same group several times! if we push directly every layer will have a group!
                    // index.groups.push(group.createJsonObject()); 
                    resolve();
                  }
                });
              });
            }

            let sourcePromise = function () {
              return new Promise(function (resolve, reject) {
                layer.getSource(function (err, source) {
                  if (!source) {
                    reject(new Error('layer "' + layer.name + '" has no source.'));
                  } else {
                    layerJsonObj.source = source.name;
                    index.source[source.name] = source.createJsonObject();
                    sourcesMap.set(source.name, source.createJsonObject());
                    resolve();
                  }
                });
              });
            }

            let stylePromise = function () {
              return new Promise(function (resolve, reject) {
                layer.getStyle(function (err, style) {
                  if (!style) {
                    reject(new Error('layer "' + layer.name + '" has no style.'));
                  } else {
                    layerJsonObj.style = style.name;
                    let arr = [];
                    arr[0] = [];
                    arr[0].push(style.createJsonObject());
                    index.styles[style.name] = arr;
                    stylesMap.set(style.name, style.createJsonObject());
                    resolve();
                  }
                });
              });
            }

            let attributePromise = function () {
              return new Promise(function (resolve, reject) {
                Attribute.find({ layer_id: layer.id }, function (err, attributes) {
                  if (attributes.length > 0) {
                    layerJsonObj.attributes = [];
                    for (let attribute of attributes) {
                      let attJsonObj = {};
                      if (attribute.name) attJsonObj.name = attribute.name;
                      if (attribute.title) attJsonObj.title = attribute.title;
                      if (attribute.url) attJsonObj.url = attribute.url;
                      if (attribute.url_title) attJsonObj.urltitle = attribute.url_title;
                      if (attribute.html) attJsonObj.html = attribute.html;
                      layerJsonObj.attributes.push(attJsonObj);
                    }
                  }
                  resolve();
                });
              });
            }

            Promise.all([groupPromise(), sourcePromise(), stylePromise(), attributePromise()])
              .then(function () {
                index.layers.push(layerJsonObj);
                resolve();
              })
              .catch(function (err) {
                // console.log(err);
                reject(err);
              });
          }));
        }
        Promise.all(layersPromises).then(function () {
          resolve();
        }).catch(function (err) {
          // console.log(err);
          reject(err);
        });
      });
    });

    Promise.all([controlsPromise, layersPromise, groupsPromise]).then(function () {
      console.log('Number of groups   : ' + groups.length);
      console.log('Number of sources  : ' + sourcesMap.size);
      console.log('Number of styles   : ' + stylesMap.size);
      console.log('done!');
      res.setHeader('Content-disposition', 'attachment; filename=index.json');
      res.setHeader('Content-type', 'application/json');
      // res.status(200).json(index);
      res.status(200).send(JSON.stringify(index, undefined, 4));
      // res.status(200).send(prettifyJson(JSON.stringify(index)));
    }).catch(function (error) {
      console.log(error);
      // if we do not send status 200, it won't be downloaded and a backup.json file will be downloaded in the OrigoAdmin
      res.status(200).json(error.message);
    });
  });
}

function prettifyJson(jsonStr) {
  try {
    let obj = JSON.parse(jsonStr);
    return JSON.stringify(obj, undefined, 4);
  }
  catch (err) {
    console.log("Could not prettify JSON, not valid JSON.");
    return jsonStr;
  }
}
module.exports = exportConfig;
