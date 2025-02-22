var conf = require('../../conf/config');
var ex = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const getUuid = require('uuid-by-string');
const fetch = (...args) =>
	import('node-fetch').then(({default: fetch}) => fetch(...args));

let configOptions = {};
const router = ex.Router();

if (conf['attachment']) {
    configOptions = Object.assign({}, conf['attachment']);
}

/**
 * List all attachments belonging to this object and group
 * 
 * @function
 * @name listAttachments
 * @kind function
 * @param {any} req
 * @param {any} res
 * @param {any} next
 * @returns {Promise<void>}
 */
function listAttachments(req, res, next) {
    //const layerConf = configOptions.groups.find(({ name }) => name === req.params.layer);
 
    const dir = path.join(configOptions.filepath, req.params.layer, req.params.object);
    let fileInfos = [];
    // Check directory for files
    if (!fs.existsSync(dir)) {
        // No files found return empty
        res.json({ "attachmentInfos": fileInfos });
    } else {  
        const groups = fs.readdirSync(dir);
        groups.forEach(group => {
            const groupPath = path.join(dir, group);
            const fileNames = fs.readdirSync(groupPath);
            // Go through the files in directory
            fileNames.forEach(filename => {
                const filePath = path.join(groupPath, filename);
                const fileInfo = {
                "id": getUuid(`${group}_${filename}`, 5),  // Create a stable uuid for the file from the group and filename, uuid version 5
                "contentType": mime.lookup(filename),
                "size": fs.statSync(filePath).size,
                "name": filename,
                "group": group
                };
                fileInfos.push(fileInfo);
            });
        });
        res.json({ "attachmentInfos": fileInfos });        
    }
}

/**
 * Get the the document with id from a specific object and group
 * 
 * @function
 * @name fetchDoc
 * @kind function
 * @param {any} req
 * @param {any} res
 * @param {any} next
 * @returns {Promise<void>}
 */
function fetchDoc(req, res, next) {
    //const groupConf = configOptions.groups.find(({ name }) => name === req.params.group);
 
    const dir = path.join(configOptions.filepath, req.params.layer, req.params.object);
    const groups = fs.readdirSync(dir);
    groups.forEach(group => {
        const groupPath = path.join(dir, group);
        const fileNames = fs.readdirSync(groupPath);

        fileNames.forEach(filename => {
            if (getUuid(`${group}_${filename}`, 5) === req.params.id) {
                const filePath = path.join(dir, group, filename);
                 res.sendFile(filePath);
            }
        });
    });
}

function deleteAttachment(req, res, next) {
    //const groupConf = configOptions.groups.find(({ name }) => name === req.params.group);
    const result = { "deleteAttachmentResults": [] };
    const idsToDelete = req.body.attachmentIds.split(',');
 
    const dir = path.join(configOptions.filepath, req.params.layer, req.params.object);

    if (fs.existsSync(dir)) {
        const groups = fs.readdirSync(dir);
        groups.forEach(group => {
            const fileNames = fs.readdirSync(path.join(dir, group));
            fileNames.forEach(filename => {
                if (idsToDelete.includes(getUuid(`${group}_${filename}`, 5))) {
                    const filePath = path.join(dir, group, filename);
                    fs.rmSync(filePath, { recursive: true });
                    result.deleteAttachmentResults.push({
                        "objectId": getUuid(`${group}_${filename}`, 5),  // Create a stable uuid for the file from the group and filename, uuid version 5
                        "globalId": null,
                        "success": true
                    });
                }
            });
        });
    }
    res.json(result);        
}

module.exports = { listAttachments, fetchDoc, deleteAttachment };