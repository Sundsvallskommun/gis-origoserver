const removeConfigGraph = function (req, res, configId) {
    req.models.Config.get(configId, function (err, config) {
      if (!config)
        console.log('no config for this id found : ' + configId);
      else {
        config.remove(function (err) {
          if (err) console.log(err);
          else {
            console.log('config removed, id : ' + configId);
            //res.status(200).json({});
          }
        });
      }
    });
  
    req.models.Group.find({ config_id: configId }).remove(function (err) {
      if (err) console.log('error removing groups for config id: ' + configId);
      else console.log('Groups removed for config id : ' + configId);
    });
  
    req.models.Control.find({ config_id: configId }).remove(function (err) {
      if (err) console.log('error removing sources for config id : ' + configId);
      else console.log('Controls removed for config id : ' + configId);
    });
  
    req.models.Layer.find({ config_id: configId }).each(function (layer) {
      // req.models.Style.find( {} )
      layer.getStyle(function (err, style) {
        if (err)
          console.log('error getting style for layer id = ' + layer.id);
        if (style)
          style.remove(function (err) {
            if (err) console.log('error removing style id : ' + style.id);
            // else console.log('style removed, id : ' + style.id);
          });
      });
  
      req.models.Attribute.find({ layer_id: layer.id }).remove(function (err) {
        if (err) console.log('error removing attributes for layer id : ' + layer.id);
        // else console.log('attributes removed for layer id : ' + layer.id);
      });
  
      layer.remove(function (err) {
        if (err) console.log('error removing layer id : ' + layer.id);
        // else console.log('layer removed, id : ' + layer.id);
      });
    });
  };

  module.exports.removeConfigGraph = removeConfigGraph