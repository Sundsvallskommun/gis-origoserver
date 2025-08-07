// all requests that start with "/auth/saml" is redirected to this module.

var express = require('express');
var samlRouter = express.Router();
var conf = require('../conf/config');
var saml2 = require('saml2-js');
var fs = require('fs');
var proxyUrl = 'authsaml';
var name_id = '';
var session_index = '';
var configOptions = {};

if (conf[proxyUrl]) {
  configOptions = Object.assign({}, conf[proxyUrl]);
} else {
  console.log('ERROR config!');
  res.send({});
}

// Create service provider
var sp_options = {
 entity_id: configOptions.baseUrl + "/metadata.xml",
 private_key: fs.readFileSync(configOptions.privateKeyPath).toString(),
 certificate: fs.readFileSync(configOptions.certificatePath).toString(),
 nameid_format: configOptions.nameid_format,
 assert_endpoint: configOptions.baseUrl + "/assert",
 allow_unencrypted_assertion: true
};
var sp = new saml2.ServiceProvider(sp_options);

// Create identity provider
var idp_options = {
 sso_login_url: configOptions.idp_options.sso_login_url,
 sso_logout_url: configOptions.idp_options.sso_logout_url,
 certificates: configOptions.idp_options.certificates
};
var idp = new saml2.IdentityProvider(idp_options);

samlRouter.route('/metadata.xml')
  .all(function (req, res, next) {
    // runs for all HTTP verbs first
    // think of it as route specific middleware!
    next();
  })
  .options(function (req, res, next) {
    res.sendStatus(200);
  })
  .get(function (req, res) {
    res.type('application/xml');
    res.send(sp.create_metadata());
  });

  samlRouter.route('/login')
    .all(function (req, res, next) {
      // runs for all HTTP verbs first
      // think of it as route specific middleware!
      next();
    })
    .options(function (req, res, next) {
      res.sendStatus(200);
    })
    .get(function (req, res) {
      sp.create_login_request_url(idp, {}, function(err, login_url, request_id) {
        if (err != null)
          return res.sendStatus(500);
        res.redirect(login_url);
      });
    });

  samlRouter.route('/test')
    .all(function (req, res, next) {
      // runs for all HTTP verbs first
      // think of it as route specific middleware!
      next();
    })
    .options(function (req, res, next) {
      res.sendStatus(200);
    })
    .get(function (req, res) {
      res.type('application/json');
      res.send('{"http://schemas.xmlsoap.org/claims/Group":["SG_FME_ADMINISTRATOR","SG_ALLMHAND_GEMPROJEKT_ÖP2040","SG_M_SBK","SG_Appl_Geoserver_LMK","SG_SBK_Kart_och_mät","SG_beslutsstod_lantmaterikontoret","SG_ALLMHAND_SystemForvaltning_GIS-plattform","SG_MAIL_SBK_Geodata","SG_Distansarbete","SG_BRONS_SBK_LMK","SG_BRONS_SBK-Scan","SG_BRONS","Lantmaterikontoret","SG_SBK_MAIL__Bärbar_dator_SBK","SG_SBK_ShapeUser","SG_SBK_Topobaseanv","Lantmaterikontoret-ALLA","SG_SBK_LANT","SG_SBK_Users","SG_SBK_SHAPEADM","SBK_Systemforv","Domain Users"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname":["Johnny"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname":["Blästa"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":["johnny.blasta@sundsvall.se"]}');
    });

    samlRouter.route('/assert')
      .all(function (req, res, next) {
        // runs for all HTTP verbs first
        // think of it as route specific middleware!
        next();
      })
      .options(function (req, res, next) {
        res.sendStatus(200);
      })
      .post(function (req, res) {
        console.log("innan post assert");
          var options = {request_body: req.body};
          sp.post_assert(idp, options, function(err, saml_response) {
            if (err != null)
        //  console.log(err);
          return res.sendStatus(500);
        // console.log("inloggad iaf");
            // Save name_id and session_index for logout
            // Note:  In practice these should be saved in the user session, not globally.
            name_id = saml_response.user.name_id;
            session_index = saml_response.user.session_index;
         console.log(saml_response.user.attributes.username[0] + "\n"  + saml_response.user.attributes.groups[0]);
            res.send("{user: '" + saml_response.user.attributes.username[0] + "', groups: '"  + "\n"  + saml_response.user.attributes.groups[0] + "'}");
          });
      });

    samlRouter.route('/logout')
      .all(function (req, res, next) {
        // runs for all HTTP verbs first
        // think of it as route specific middleware!
        next();
      })
      .options(function (req, res, next) {
        res.sendStatus(200);
      })
      .get(function (req, res) {
        var options = {
          name_id: name_id,
          session_index: session_index
        };

        sp.create_logout_request_url(idp, options, function(err, logout_url) {
          if (err != null)
            return res.sendStatus(500);
          res.redirect(logout_url);
        });
      });

module.exports = samlRouter;
