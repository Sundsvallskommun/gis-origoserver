var express = require('express');
var router = express.Router();

//handlers
var searchAddressEstate = require('../handlers/searchaddressestate');
var search = require('../handlers/search');
var singleSearch = require('../handlers/singlesearch');
var getInskrivning = require('../handlers/getinskrivning');
var proxy = require('../handlers/proxy');
var lmProxy = require('../handlers/lmproxy');
var lmProxyVer = require('../handlers/lmproxyver');
var excelCreator = require('../handlers/excelcreator');

var getAkt = require('../handlers/getakt');
var lmElevation = require('../handlers/lmelevation');
var lmSearchPlacename = require('../handlers/lmsearchplacename');
var lmEstate = require('../handlers/lmsearchestate');
var lmSearchAddress = require('../handlers/lmsearchaddress');
var lmGetEstate = require('../handlers/lmgetestate');
var iotProxy = require('../handlers/iotproxy');
var overpass = require('../handlers/overpass');
var tvApi = require('../handlers/tvapi');
var tvRoadnumbers = require('../handlers/tvroadnumbers');
var convertToGeojson = require('../handlers/converttogeojson');
var oauth2proxy = require('../handlers/oauth2proxy');
var apiContract = require('../handlers/apiContract');
var lmBuilding = require('../handlers/lmbuilding');
var iotTemp = require('../handlers/iottemp');
//var ldapProxy = require('../handlers/ldapproxy');
var befStat = require('../handlers/befstat');
var cascadeWMS = require('../handlers/cascadewms');
var auth = require('../handlers/auth');
var clients = require('../handlers/clients');
var disturbances = require('../handlers/disturbances');
var getImage = require('../handlers/getimage');
var fbwebbProxy = require('../handlers/fbwebbproxy');
var ngp = require('../handlers/ngp');
var attachment = require('../handlers/attachment');
var lmCommunityAssociation = require('../handlers/lmcommunityassociation');

/* GET start page. */
router.get('/', function (req, res) {
  res.render('index');
});

router.all('/addressestatesearch', searchAddressEstate);
router.all('/search', search);
router.all('/singlesearch', singleSearch);
router.all('/estate/inskrivning', getInskrivning);
router.all('/proxy', proxy);
router.all('/lmproxy/*splat', lmProxy);
router.all('/lmproxy-ver/*splat', lmProxyVer);
router.use('/excelcreator', excelCreator);

router.all('/document/*splat', getAkt);
router.all('/lm/elevation*splat', lmElevation);
router.all('/lm/placenames', lmSearchPlacename);
router.all('/lm/enhetsomraden', lmEstate['lmGetEstateFromPoint']);
router.all('/lm/registerenheter', lmEstate['lmSearchEstate']);
router.all('/lm/registerenheter/*splat', lmEstate['lmSearchEstate']);
router.all('/lm/addresses', lmSearchAddress);
router.all('/lm/getestate', lmGetEstate);
router.all('/lm/building', lmBuilding);
router.all('/lm/communityassociation*splat', lmCommunityAssociation);
router.all('/iotproxy/', iotProxy);
router.all('/overpass/', overpass);
router.all('/tvapi/', tvApi);
router.all('/tvroadnumbers/', tvRoadnumbers);
router.all('/converttogeojson/', convertToGeojson);
router.all('/oauth2proxy/*splat', oauth2proxy);
router.all('/apicontract/getcontract/*splat', apiContract['getContract']);
router.all('/apicontract/getallcontracts/*splat', apiContract['getAllContracts']);
router.all('/iottemp', iotTemp);
//router.all('/ldapproxy/*', ldapProxy);
router.all('/befstat', befStat);
router.all('/cascadewms/*splat', cascadeWMS);
router.use('/auth', auth);
router.use('/clients', clients);
router.all('/disturbances', disturbances);
router.all('/getimage', getImage);
router.all('/fbwebbproxy/*splat', fbwebbProxy);
router.use('/ngp', ngp);
router.use('/attachment', attachment);

module.exports = router;
