function updateTreeStructure(req, res) {

  const data = JSON.parse(req.body.data);
  const node = data.node;
  const nextParentNode = data.nextParentNode;
  const nextSiblings = data.nextSiblings;
  const nextParentNodeName = nextParentNode.name === 'ROOT' ? null : nextParentNode.name;

  const layersPromise = new Promise((layersResolve, layersReject) => {
    // Finding layers with the same next parent and updating their order_number
    req.models.Layer.find({ group_id: nextParentNode.id, config_id: nextParentNode.config_id }, function (err, layers) {
      const promises = layers.map(layer => new Promise((resolve, reject) => {

        nextSiblings.forEach((ns, index) => {
          if (ns.type && ns.id == layer.id) {
            layer.order_number = index;
          }
        });
        layer.save(function (err) {
          if (err) {
            console.log(err);
            reject('layer ' + layer.name + ' order_number did not update properly');
          } else {
            resolve();
          }
        });
      }));
      Promise.all(promises)
        .then(data => layersResolve())
        .catch(data => {
          console.log(data);
          layersReject();
        });
    });
  });

  const groupsPromise = new Promise((groupsResolve, groupsReject) => {
    // Finding groups with the same next parent and updating their order_number
    req.models.Group.find({ parent: nextParentNodeName, config_id: nextParentNode.config_id }, function (err, groups) {
      const promises = groups.map(group => new Promise((resolve, reject) => {
        nextSiblings.forEach((ns, index) => {
          if (!ns.type && ns.id == group.id) {
            group.order_number = index;
          }
        });
        group.save(function (err) {
          if (err) {
            console.log(err);
            reject('group ' + group.name + ' order_number did not update properly');
          } else {
            resolve();
          }
        });
      }));
      Promise.all(promises)
        .then(data => groupsResolve())
        .catch(data => {
          console.log(data);
          groupsReject();
        });
    });
  });

  // The result will be max 1, therefore one promise is just fine.
  const nodePromise = new Promise((resolve, reject) => {
    if (node.type) { // node is a layer
      // Finding node layer itself and updating its order_number and parent.
      req.models.Layer.find({ id: node.id, config_id: node.config_id }).each(function (layer) {
        nextSiblings.forEach((ns, index) => {
          if (ns.type && ns.id == layer.id) {
            layer.order_number = index;
            layer.group_id = nextParentNode.id;
          }
        });
      }).save(function (err) {
        if (err) {
          console.log(err);
          reject('node order_number did not update properly, node was a layer');
        } else {
          resolve();
        }
      });

    } else { // node is a group
      // Finding node group itself and updating its order_number and parent.
      req.models.Group.find({ id: node.id, config_id: node.config_id }).each(function (group) {
        nextSiblings.forEach((ns, index) => {
          if (!ns.type && ns.id == group.id) {
            group.order_number = index;
            group.parent = nextParentNodeName;
          }
        });
      }).save(function (err) {
        if (err) {
          console.log(err);
          reject('node order_number did not update properly, node was a group');
        } else {
          resolve();
        }
      });
    }
  });

  // This is to ensure the database is updated before sending a response back. If we send the response too soon next request might read the data before it is completely updated.
  Promise.all([layersPromise, groupsPromise, nodePromise])
    .then(data => {
      console.log('tree structure updated successfully');
      res.status(200).send({});
    })
    .catch(err => {
      console.log(err);
      res.status(200).send({ message: 'Tree structure update failed' });
    });
}

module.exports = updateTreeStructure;