// all requests that start with "/auth/saml" is redirected to this module.

const express = require('express');
const samlRouter = express.Router();
const conf = require('../conf/config');
const saml2 = require('saml2-js');
const fs = require('fs');
const bodyParser = require('body-parser');
var request = require('request');
var rp = require('request-promise');
var Bluebird = require('bluebird');
const url = require('url');
var proxyUrl = 'authsaml';
var name_id = '';
var session_index = '';
var configOptions = {};
let groupsAllowed = [];

if (conf[proxyUrl]) {
  configOptions = Object.assign({}, conf[proxyUrl]);
} else {
  console.log('ERROR config!');
  res.send({});
}

var samlRequestArray = [];

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
let uri = '';

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

function SAMLRequestWait(options) {
  return rp(options)
  .then(function (result) {
    return result.status;
  })
  .catch(function (err) {
    console.log(err);
    console.log('ERROR doSearchAsyncCall!');
    return 'Error';
  })
}

function checkAssert(samlReq) {
  let retStatus = 0;
  for (index = 0; index < samlRequestArray.length; ++index) {
    console.log('samlRequestArray' + samlRequestArray.length);
    if (samlReq == samlRequestArray[index].samlRequest) {
      retStatus = samlRequestArray[index].status;
    }
  }
  return retStatus;
}

async function SAMLCreateLoginWait(res) {
  sp.create_login_request_url(idp, {}, function(err, login_url, request_id) {
    if (err != null) {
      return res.sendStatus(500);
    }
    console.log('login_url');
    console.log(login_url);
    // res.redirect(login_url);
    const options = {
        uri: login_url,
        method: 'GET'
    }
    const parsedUrl = url.parse(decodeURI(login_url), true);
    let samlRequest = '';
    if ('SAMLRequest' in parsedUrl.query) {
      samlRequest = parsedUrl.query.SAMLRequest;
    }
    console.log('url: ' + options.uri);
    console.log('SAMLRequest: ' + samlRequest);
    var result = SAMLRequestWait(options);
    var status = 0;
    // do {
    //   status = checkAssert(samlRequest);
    //   console.log('status ' + status);
    //   if (status != 0) {
    //     res.sendStatus(status);
    //   }
    // } while (status == 0);
    res.send({ SAMLRequest: samlRequest });
    return result;
  });
}

async function doSAMLRequest(res) {
  await SAMLCreateLoginWait(res);
}

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
      const parsedUrl = url.parse(decodeURI(req.url), true);
      let fecthResponse = '';
      if ('groupsAllowed' in parsedUrl.query) {
        groupsAllowed = parsedUrl.query.groupsAllowed.split(",");
      } else {
        groupsAllowed = [];
      }
      console.log(groupsAllowed);
      doSAMLRequest(res);
      if (fecthResponse === 'OK'){
        console.log('Fetch OK!');
      } else {
        console.log('fecthResponse' + fecthResponse);
      }
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
        const parsedUrl = url.parse(decodeURI(req.url), true);
        if ('groupsAllowed' in parsedUrl.query) {
          groupsAllowed = parsedUrl.query.groupsAllowed.split(",");
        } else {
          groupsAllowed = [];
        }
        console.log(groupsAllowed);

        const jsonResponse = JSON.parse('{"http://schemas.xmlsoap.org/claims/Group":["SG_FME_ADMINISTRATOR","SG_ALLMHAND_GEMPROJEKT_ÖP2040","SG_M_SBK","SG_Appl_Geoserver_LMK","SG_SBK_Kart_och_mät","SG_beslutsstod_lantmaterikontoret","SG_ALLMHAND_SystemForvaltning_GIS-plattform","SG_MAIL_SBK_Geodata","SG_Distansarbete","SG_BRONS_SBK_LMK","SG_BRONS_SBK-Scan","SG_BRONS","Lantmaterikontoret","SG_SBK_MAIL__Bärbar_dator_SBK","SG_SBK_ShapeUser","SG_SBK_Topobaseanv","Lantmaterikontoret-ALLA","SG_SBK_LANT","SG_SBK_Users","SG_SBK_SHAPEADM","SBK_Systemforv","Domain Users"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname":["Johnny"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname":["Blästa"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":["johnny.blasta@sundsvall.se"]}');
        console.log(jsonResponse);
        const groupsKey = 'http://schemas.xmlsoap.org/claims/Group';
        if (groupsAllowed) {
         groupsAllowed = Object.assign({}, groupsAllowed);
        }
        let verified = false;
        if (groupsKey in jsonResponse) {
         jsonResponse[groupsKey].forEach((group) => {
           console.log(group);
           Object.keys(groupsAllowed).forEach(function(key) {
             if (group === groupsAllowed[key]) {
               verified = true;
               console.log(groupsAllowed[key]);
             }
           })
         })
        }
        if (!verified) {
          res.sendStatus(403);  // Send acces denied
        } else {
          res.sendStatus(200);  // Send status ok
          //res.send(saml_response.user.attributes);
        }
        //res.type('text/plain');
        //let verified = false;
        //if (!verified) {
        //  console.log("Åtkomst nekad!");
        //  res.sendStatus(403);
        //} else {
        //  res.sendStatus(200);
          //res.send('{"http://schemas.xmlsoap.org/claims/Group":["SG_FME_ADMINISTRATOR","SG_ALLMHAND_GEMPROJEKT_ÖP2040","SG_M_SBK","SG_Appl_Geoserver_LMK","SG_SBK_Kart_och_mät","SG_beslutsstod_lantmaterikontoret","SG_ALLMHAND_SystemForvaltning_GIS-plattform","SG_MAIL_SBK_Geodata","SG_Distansarbete","SG_BRONS_SBK_LMK","SG_BRONS_SBK-Scan","SG_BRONS","Lantmaterikontoret","SG_SBK_MAIL__Bärbar_dator_SBK","SG_SBK_ShapeUser","SG_SBK_Topobaseanv","Lantmaterikontoret-ALLA","SG_SBK_LANT","SG_SBK_Users","SG_SBK_SHAPEADM","SBK_Systemforv","Domain Users"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname":["Johnny"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname":["Blästa"],"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":["johnny.blasta@sundsvall.se"]}');
        //}
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
        console.log("innan post assert");
        console.log(req);
        const parsedUrl = url.parse(decodeURI(req.Referer), true);
        let samlRequest = '';
        if ('SAMLRequest' in parsedUrl.query) {
          samlRequest = parsedUrl.query.SAMLRequest;
        }
        console.log('samlRequest: ' + samlRequest);
        sp.post_assert(idp, options, function(err, saml_response) {
          if (err != null) {
            //  console.log(err);
            return res.sendStatus(500);
          }
          // console.log("inloggad iaf");
          // Save name_id and session_index for logout
          // Note:  In practice these should be saved in the user session, not globally.
          name_id = saml_response.user.name_id;
          session_index = saml_response.user.session_index;
          console.log(saml_response.user.attributes);

          const groupsKey = 'http://schemas.xmlsoap.org/claims/Group';
          if (groupsAllowed) {
           groupsAllowed = Object.assign({}, groupsAllowed);
          }
          let verified = false;
          if (groupsKey in saml_response.user.attributes) {
           saml_response.user.attributes[groupsKey].forEach((group) => {
             Object.keys(groupsAllowed).forEach(function(key) {
               if (group === groupsAllowed[key]) {
                 verified = true;
                 console.log(groupsAllowed[key]);
               }
             })
           })
          }
          if (!verified) {
            samlRequestArray.push({samlRequest: samlRequestArray, status: 403});
            res.sendStatus(403);  // Send acces denied
          } else {
            samlRequestArray.push({samlRequest: samlRequestArray, status: 200});
            res.sendStatus(200);  // Send status ok
            //res.send(saml_response.user.attributes);
          }
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
