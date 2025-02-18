const express = require('express');
const clientsRouter = express.Router();

var supportedClients = require('../conf/config').auth.clients;

var clients = function(req, res) {
  console.log('req.query.state');
  console.log(req.query.state);
  console.log('(req.query.state !== null && req.query.state !== undefined)');
  console.log((req.query.state !== null && req.query.state !== undefined));
  const clientName = (req.query.state !== null && req.query.state !== undefined) ? req.query.state : '';

  console.log('req.query.code');
  console.log(req.query.code);
  let leClientUrl = supportedClients[clientName];
  console.log('leClientUrl');
  console.log(leClientUrl);
  if (leClientUrl) {
    leClientUrl = `${leClientUrl}?code=${req.query.code}`;
    res.redirect(leClientUrl);
  } else {
    res.status(404).json({error: "The client was not found"})
  }
}

clientsRouter.get('', clients)

module.exports = clientsRouter;
