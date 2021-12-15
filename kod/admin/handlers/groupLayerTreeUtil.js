"use strict";
const reconstructGroupLayerTree = (groups, layers) => {
    let treeRoot = { groupId: 0, title: "", name: 'ROOT', children: [], object: {} };
    treeRoot = addGroupsAndLayersToGroup(treeRoot, groups, layers);
    return treeRoot;
}

const addGroupsAndLayersToGroup = (currentTreeNode, groups, layers) => {
    groups.forEach(function (group) {
        if (!group.name) {
            console.log("Group with name is null found");
        }
        else {
            if ((group.parent == null && currentTreeNode.name == "ROOT") || (group.parent == currentTreeNode.name)) {
                let newGroupNode = { groupId: group.id, name: group.name, title: group.title, object: group, parent: group.parent, parentId: group.parent, children: [], order_number: group.order_number };
                if (groups.length > 0 || layers.length > 0) {
                    newGroupNode = addGroupsAndLayersToGroup(newGroupNode, groups, layers);
                }
                currentTreeNode.children.push(newGroupNode);
            }
            else {
                layers.forEach(function (layer) {
                    if (layer.group_id == currentTreeNode.groupId) {
                        let newLayerNode = { layerId: layer.id, name: layer.name, title: layer.title, object: layer, parentId: layer.group_id, leaf: true, order_number: layer.order_number };
                        currentTreeNode.children.push(newLayerNode);
                        remove(layers, layer);
                    }
                });
            }
        }
    });
    currentTreeNode.children.sort(sortGroupOrLayerFunction);
    return currentTreeNode;
}

function sortGroupOrLayerFunction(node1, node2) {
    if (node1.order_number < node2.order_number) {
        return -1;
    }
    if (node1.order_number > node2.order_number) {
        return 1;
    }
    else {
        return 0;
    }
}

function splitLayerGroupTreeIntoOrderedLists(currentNode, result) {
    if (currentNode.children) {
        currentNode.object.groups = [];
        currentNode.children.sort(sortGroupOrLayerFunction).forEach(function (item) {
            if (item.groupId) {
                result.addedGroups.push(item); //mark as added so we dont get dupplicates
                let resultSubCall = splitLayerGroupTreeIntoOrderedLists(item, result);
                result.layers.concat(resultSubCall.layers);
                result.groups.concat(resultSubCall.groups);
                currentNode.object.groups.push(item.object.createJsonObject());
            }
            else {
                item.object.group = currentNode.object;
                result.layers.push(item.object);
            }
        });
    }
    if (currentNode.groupId && currentNode.parent == null) {
        result.groups.push(currentNode.object.createJsonObject());
    }
    else if (currentNode.layerId) {
        //result.layers.push(currentNode.object);
    }
    return result;
}

function remove(array, element) {
    const index = array.indexOf(element);
    array.splice(index, 1);
}

module.exports.reconstructGroupLayerTree = reconstructGroupLayerTree;
module.exports.splitLayerGroupTreeIntoOrderedLists = splitLayerGroupTreeIntoOrderedLists;