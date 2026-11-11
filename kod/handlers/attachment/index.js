var conf = require("../../conf/config");
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  listAttachments,
  fetchDoc,
  deleteAttachments,
  deleteAllAttachments,
  listAllAttachments,
  safeJoin,
  isAllowedFile,
  maxFileSize,
} = require("./attachments");
const multer = require("multer");
const getUuid = require("uuid-by-string");
const attachmentRouter = express.Router();

// Let the upload middleware buffer the file in memory, at most one file of maxFileSize
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: maxFileSize, files: 1 } }).single("attachment");

const failed = (description) => ({
  addAttachmentResult: { objectId: null, globalId: null, success: false, error: { description } },
});

// A file over the size limit gets 413 with the usual result object instead of an error page.
function uploadFile(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json(failed(err.code === "LIMIT_FILE_SIZE" ? `Filen är större än ${Math.round(maxFileSize / 1024 / 1024)} MB` : err.message));
  });
}

let configOptions = {};

if (conf["attachment"]) {
  configOptions = Object.assign({}, conf["attachment"]);
}

attachmentRouter.get("/:layer/:object/attachments/", listAttachments);
attachmentRouter.get("/:layer/attachments/", listAllAttachments);
attachmentRouter.get("/:layer/:object/attachments/:id", fetchDoc);
attachmentRouter.get("/:layer/:object/deleteAttachments/", deleteAllAttachments);
attachmentRouter.post("/:layer/:object/deleteAttachments/", deleteAttachments);
attachmentRouter.post("/:layer/:object/addAttachment", uploadFile, function (req, res, next) {
  let dir, fileName, base;
  try {
    dir = safeJoin(configOptions.filepath, req.params.layer, req.params.object, req.body.group);
    if (typeof req.file !== "undefined") {
      base = path.basename(Buffer.from(req.file.originalname, "latin1").toString("utf8"));
      if (!base || base === "." || base === "..") throw new Error("Ogiltigt filnamn");
      if (!isAllowedFile(base)) {
        res.status(415).json(failed("Filtypen är inte tillåten"));
        return;
      }
      fileName = path.join(dir, base);
    }
  } catch (e) {
    res.status(400).json(failed(e.message));
    return;
  }

  // Create directory if doesn't already exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (typeof req.file !== "undefined") {
    // Write the file to disc
    fs.writeFileSync(fileName, req.file.buffer);
    // Create response object to send back after successful saved
    const retval = {
      addAttachmentResult: {
        // Same id as listAttachments and deleteAttachments give the file: group and file name.
        objectId: getUuid(`${req.body.group}_${base}`, 5),
        globalId: null,
        success: true,
      },
    };
    res.json(retval);
  } else {
    // Something went wrong with posting the file
    const retval = {
      addAttachmentResult: {
        objectId: null,
        globalId: null,
        success: false,
      },
    };
    res.json(retval);
  }
});

module.exports = attachmentRouter;
