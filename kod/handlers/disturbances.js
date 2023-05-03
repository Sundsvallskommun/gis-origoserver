var conf = require('../conf/config');
var oauth2proxy = require('./oauth2proxy');
const url = require('url');
const apiFunctions = require('./oauth2proxy/APIFunctions');
const simpleStorage = require('./oauth2proxy/simpleStorage');
var pointsWithinPolygon = require('@turf/points-within-polygon');

var disturbances = async (req, res) => {
  var configName = 'disturbances';
  var options;
  if (conf[configName]) {
    await getUrl(req, res, conf[configName], conf[configName].serviceurl);
  }
}

// const searchWithin = JSON.parse( fs.readFileSync('elnat_zoner_3006.geojson', 'utf8') );
        
const getPoints = false;

const polyAlnon = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 157040.6387359928, 6919150.616764633 ],
        [ 157692.8485788232, 6916242.434207892 ],
        [ 161465.2918150955, 6915739.6279866202 ],
        [ 164723.8601536181, 6916029.9914910281 ],
        [ 165896.3468498673, 6917471.9671692336 ],
        [ 162948.4058877297, 6926004.1371768676 ],
        [ 163892.8021512839, 6926810.6375175668 ],
        [ 160280.2200652967, 6930152.5087704659 ],
        [ 156871.3159838119, 6930685.6343943253 ],
        [ 155295.1615480706, 6930473.2237425996 ],
        [ 155490.1964881472, 6929651.815181369 ],
        [ 157335.3471479722, 6926562.8470589751 ],
        [ 157684.3448041903, 6924491.7210674174 ],
        [ 157885.6603588583, 6922571.335831604 ],
        [ 157955.4226663618, 6921584.5555223934 ],
        [ 157040.6387359928, 6919150.616764633 ]
      ]
    ]
  }
};

const polyCentrumAlnon = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 158776.1690328002, 6925846.003364238 ],
        [ 158148.8160366704, 6925609.3024693709 ],
        [ 157947.7434304627, 6925568.4270769637 ],
        [ 157519.9460628699, 6925467.9418357993 ],
        [ 157684.7560187974, 6924483.6528266678 ],
        [ 157826.0449606107, 6923146.0015231818 ],
        [ 158795.4902149523, 6923234.7219742043 ],
        [ 159126.5669701591, 6923385.6923620421 ],
        [ 159448.7080462693, 6923805.7958035758 ],
        [ 159546.6466446695, 6924071.8896444961 ],
        [ 159743.4762036745, 6924388.984707294 ],
        [ 159340.6174384643, 6925095.8504282096 ],
        [ 158776.1690328002, 6925846.003364238 ]
      ]
    ]
  }
};

const polyNordvastraAlnon = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 160796.5026898916, 6929675.4131397037 ],
        [ 160280.2200652967, 6930152.5087704659 ],
        [ 156871.3159838119, 6930685.6343943253 ],
        [ 155295.1615480706, 6930473.2237425996 ],
        [ 155490.1964881472, 6929651.815181369 ],
        [ 157335.7820072222, 6926562.3241852755 ],
        [ 157519.9460628699, 6925467.9418357993 ],
        [ 157949.3156459637, 6925569.7013853947 ],
        [ 158148.8160366704, 6925609.3024693709 ],
        [ 158776.1690328002, 6925846.003364238 ],
        [ 158451.9962928454, 6926548.3805965828 ],
        [ 158900.4426416816, 6927336.7973186169 ],
        [ 158899.6172310711, 6928052.3262759168 ],
        [ 159290.9417253468, 6928499.5533719948 ],
        [ 159701.7261230648, 6928780.1265503895 ],
        [ 159966.0603006479, 6928850.0075544873 ],
        [ 160243.9872788105, 6928975.9791286867 ],
        [ 160796.5026898916, 6929675.4131397037 ]
      ]
    ]
  }
};

const polyNordostraAlnon = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 159546.6466446695, 6924071.8896444961 ],
        [ 159448.7080462693, 6923805.7958035758 ],
        [ 159525.8540131158, 6923709.6081123231 ],
        [ 159574.0291981487, 6923649.2714707898 ],
        [ 159737.6364132026, 6923653.9907428771 ],
        [ 160536.2915143055, 6924131.7060842011 ],
        [ 163685.7798846669, 6922110.8952501258 ],
        [ 164232.4026083985, 6922287.9148125723 ],
        [ 162948.4058877297, 6926004.1371768676 ],
        [ 163892.8021512839, 6926810.6375175668 ],
        [ 160796.5026898916, 6929675.4131397037 ],
        [ 160243.9872788105, 6928975.9791286867 ],
        [ 159966.0603006479, 6928850.0075544873 ],
        [ 159701.7261230648, 6928780.1265503895 ],
        [ 159290.9417253468, 6928499.5533719948 ],
        [ 158899.6172310711, 6928052.3262759168 ],
        [ 158900.4426416816, 6927336.7973186169 ],
        [ 158451.9962928454, 6926548.3805965828 ],
        [ 158776.1690328002, 6925846.003364238 ],
        [ 159340.6174384643, 6925095.8504282096 ],
        [ 159743.4762036745, 6924388.984707294 ],
        [ 159546.6466446695, 6924071.8896444961 ]
      ]
    ]
  }
};

const polySydvastraAlnon = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 161465.2918150955, 6915739.6279866202 ],
        [ 162537.1258307999, 6915835.3817754649 ],
        [ 162787.8556300775, 6918116.6460936721 ],
        [ 159126.5669701591, 6923385.6923620421 ],
        [ 158795.4902149523, 6923234.7219742043 ],
        [ 157826.0449606107, 6923146.0015231818 ],
        [ 157885.6603588583, 6922571.335831604 ],
        [ 157955.4226663618, 6921584.5555223934 ],
        [ 157040.6387359928, 6919150.616764633 ],
        [ 157692.8485788232, 6916242.434207892 ],
        [ 161465.2918150955, 6915739.6279866202 ]
      ]
    ]
  }
};

const polySydostraAlnon = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 163685.7798846669, 6922110.8952501258 ],
        [ 160536.2915143055, 6924131.7060842011 ],
        [ 159737.6364132026, 6923653.9907428771 ],
        [ 159574.0291981487, 6923649.2714707898 ],
        [ 159448.7080462693, 6923805.7958035758 ],
        [ 159126.5669701591, 6923385.6923620421 ],
        [ 162787.8556300775, 6918116.6460936721 ],
        [ 162537.1258307999, 6915835.3817754649 ],
        [ 164723.8601536181, 6916029.9914910281 ],
        [ 165896.3468498673, 6917471.9671692336 ],
        [ 164232.4026083985, 6922287.9148125723 ],
        [ 163685.7798846669, 6922110.8952501258 ]
      ]
    ]
  }
};
 
const polySundsvallFastland = {
  "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 157955.4226663618, 6921584.5555223934 ],
        [ 157885.6603588583, 6922571.335831604 ],
        [ 157684.7560187974, 6924483.6528266678 ],
        [ 157335.3471479722, 6926562.8470589751 ],
        [ 155490.1964881472, 6929651.815181369 ],
        [ 154754.6385443721, 6929444.8080197908 ],
        [ 153290.2880820321, 6929578.7686174884 ],
        [ 152055.1230678322, 6929208.7342264475 ],
        [ 151988.624556978, 6928019.8681859057 ],
        [ 149435.8076055279, 6926556.4369224422 ],
        [ 148630.519229097, 6926517.1713856207 ],
        [ 147255.8234156664, 6924117.3286088705 ],
        [ 147173.7119962424, 6923405.2160523282 ],
        [ 148127.9806916328, 6922842.3015696444 ],
        [ 149145.0264262276, 6921669.933595961 ],
        [ 148377.049308275, 6919450.0957011702 ],
        [ 147314.216028027, 6919278.3529911805 ],
        [ 147292.1721127044, 6917313.1552141318 ],
        [ 149469.5483385638, 6916383.3000036692 ],
        [ 153042.250120112, 6916363.8761058273 ],
        [ 157692.8485788232, 6916242.434207892 ],
        [ 157040.6387359928, 6919150.616764633 ],
        [ 157955.4226663618, 6921584.5555223934 ]
      ]
    ]
  }
};
       
const polySundsvallSodra = {
    "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 157692.8485788232, 6916242.434207892 ],
        [ 157040.6387359928, 6919150.616764633 ],
        [ 157418.8233615252, 6920159.1951987352 ],
        [ 153265.5152662564, 6920692.5133170839 ],
        [ 153259.0152462866, 6920786.4833113141 ],
        [ 153328.4212979423, 6920930.659146117 ],
        [ 153082.026033819, 6921223.2075127168 ],
        [ 152117.3833104453, 6921333.1516567655 ],
        [ 151763.1804016906, 6921345.9637030484 ],
        [ 151441.3216923937, 6921129.5925256526 ],
        [ 151159.226533215, 6921116.1085855085 ],
        [ 150434.1185483955, 6921090.3018620936 ],
        [ 150088.5761422684, 6921235.9649144113 ],
        [ 149826.9609768927, 6920674.5623338334 ],
        [ 148895.1696271425, 6920947.4744493784 ],
        [ 148377.049308275, 6919450.0957011702 ],
        [ 147314.216028027, 6919278.3529911805 ],
        [ 147292.1721127044, 6917313.1552141318 ],
        [ 149469.5483385638, 6916383.3000036692 ],
        [ 153042.250120112, 6916363.8761058273 ],
        [ 157692.8485788232, 6916242.434207892 ]
      ]
    ]
  }
};
        
const polySundsvallVastra = {
    "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 152117.3833104453, 6921333.1516567655 ],
        [ 152201.7456179532, 6921610.833277557 ],
        [ 152692.5105371946, 6922933.0045879111 ],
        [ 152480.9837403454, 6923279.3349650204 ],
        [ 152269.6533911052, 6924990.0246592909 ],
        [ 150228.3925465526, 6924839.1790325753 ],
        [ 150052.9013093087, 6925301.3208641103 ],
        [ 148299.2289329349, 6925938.8839989174 ],
        [ 147255.8234156664, 6924117.3286088705 ],
        [ 147173.7119962424, 6923405.2160523282 ],
        [ 148127.9806916328, 6922842.3015696444 ],
        [ 149145.0264262276, 6921669.933595961 ],
        [ 148895.1696271425, 6920947.4744493784 ],
        [ 149826.9609768927, 6920674.5623338334 ],
        [ 150088.5761422684, 6921235.9649144113 ],
        [ 150434.1185483955, 6921090.3018620936 ],
        [ 151159.226533215, 6921116.1085855085 ],
        [ 151441.3216923937, 6921129.5925256526 ],
        [ 151763.1804016906, 6921345.9637030484 ],
        [ 152117.3833104453, 6921333.1516567655 ]
      ]
    ]
  }
};       

const polySundsvallNorra = {
    "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 154754.6385443721, 6929444.8080197908 ],
        [ 153290.2880820321, 6929578.7686174884 ],
        [ 152055.1230678322, 6929208.7342264475 ],
        [ 151988.624556978, 6928019.8681859057 ],
        [ 149435.8076055279, 6926556.4369224422 ],
        [ 148630.519229097, 6926517.1713856207 ],
        [ 148299.2289329349, 6925938.8839989174 ],
        [ 150052.9013093087, 6925301.3208641103 ],
        [ 150228.3925465526, 6924839.1790325753 ],
        [ 152982.5801595529, 6925043.3025002368 ],
        [ 154119.2020278852, 6925540.2418606151 ],
        [ 156104.9582655922, 6924866.8645951487 ],
        [ 156419.75820316, 6924337.6977468524 ],
        [ 157694.3673448374, 6924375.2536239121 ],
        [ 157684.3448041903, 6924491.7210674174 ],
        [ 157335.3471479722, 6926562.8470589751 ],
        [ 156126.6669326475, 6928585.7693193024 ],
        [ 155490.1964881472, 6929651.815181369 ],
        [ 154754.6385443721, 6929444.8080197908 ]
      ]
    ]
  }
};

const polySundsvallOstra = {
    "type": "Feature",
  "crs" : {
    "type" : "name",
    "properties" : {
      "name" : "EPSG:3014"
    }
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 152201.7456179532, 6921610.833277557 ],
        [ 152117.3833104453, 6921333.1516567655 ],
        [ 153082.026033819, 6921223.2075127168 ],
        [ 153328.4212979423, 6920930.659146117 ],
        [ 153259.0152462866, 6920786.4833113141 ],
        [ 153265.5152662564, 6920692.5133170839 ],
        [ 157418.8233615252, 6920159.1951987352 ],
        [ 157955.4226663618, 6921584.5555223934 ],
        [ 157885.6603588583, 6922571.335831604 ],
        [ 157694.3673448374, 6924375.2536239121 ],
        [ 156419.75820316, 6924337.6977468524 ],
        [ 156104.9582655922, 6924866.8645951487 ],
        [ 154119.2020278852, 6925540.2418606151 ],
        [ 152982.5801595529, 6925043.3025002368 ],
        [ 152269.6533911052, 6924990.0246592909 ],
        [ 152480.9837403454, 6923279.3349650204 ],
        [ 152692.5105371946, 6922933.0045879111 ],
        [ 152201.7456179532, 6921610.833277557 ]
      ]
    ]
  }
};

// Export the module
module.exports = disturbances;

async function getUrl(req, res, service, url) {
  const arrGeojson = [];
  const categoryAll = {
    COMMUNICATION: 'KOMMUNIKATION',
    DISTRICT_COOLING: 'FJÄRRKYLA',
    DISTRICT_HEATING: 'FJÄRRVÄRME',
    ELECTRICITY: 'ELEKTRICITET',
    ELECTRICITY_TRADE: 'ELHANDEL',
    WASTE_MANAGEMENT: 'AVFALLSHANTERING',
    WATER: 'VATTEN'
  };
  const category = {
     ELECTRICITY: 'ELEKTRICITET'
  };
  const status = {
    OPEN: 'ÖPPEN',
    CLOSED: 'STÄNGD',
    PLANNED: 'PLANERAD'
  };
  let disturbancesOpenAlnon = 0;
  let disturbancesOpenCentrumAlnon = 0;
  let disturbancesOpenNordvastraAlnon = 0;
  let disturbancesOpenNordostraAlnon = 0;
  let disturbancesOpenSydvastraAlnon = 0;
  let disturbancesOpenSydostraAlnon = 0;
  let disturbancesOpenSundsvallFastland = 0;
  let disturbancesOpenSundsvallSodra = 0;
  let disturbancesOpenSundsvallVastra = 0;
  let disturbancesOpenSundsvallNorra = 0;
  let disturbancesOpenSundsvallOstra = 0;
  let disturbancesClosedAlnon = 0;
  let disturbancesClosedCentrumAlnon = 0;
  let disturbancesClosedNordvastraAlnon = 0;
  let disturbancesClosedNordostraAlnon = 0;
  let disturbancesClosedSydvastraAlnon = 0;
  let disturbancesClosedSydostraAlnon = 0;
  let disturbancesClosedSundsvallFastland = 0;
  let disturbancesClosedSundsvallSodra = 0;
  let disturbancesClosedSundsvallVastra = 0;
  let disturbancesClosedSundsvallNorra = 0;
  let disturbancesClosedSundsvallOstra = 0;
  let disturbancesPlannedAlnon = 0;
  let disturbancesPlannedCentrumAlnon = 0;
  let disturbancesPlannedNordvastraAlnon = 0;
  let disturbancesPlannedNordostraAlnon = 0;
  let disturbancesPlannedSydvastraAlnon = 0;
  let disturbancesPlannedSydostraAlnon = 0;
  let disturbancesPlannedSundsvallFastland = 0;
  let disturbancesPlannedSundsvallSodra = 0;
  let disturbancesPlannedSundsvallVastra = 0;
  let disturbancesPlannedSundsvallNorra = 0;
  let disturbancesPlannedSundsvallOstra = 0;
  let srid = '3006';
  var token = await simpleStorage.getToken(service);
  var urlResponse = await apiFunctions.getFromUrl(token, url, 'application/json');
  urlResponse.forEach((disturbance) => {
    disturbance.affecteds.forEach((affected) => {
      let updated = '';
      if ('updated' in disturbance) {
        updated = disturbance.updated;
      }
      if ('coordinates' in affected) {
        const coordArr = affected.coordinates.split(':')
        if (coordArr[0] === 'SWEREF 991715') {
          srid = '3014';
        }
        const crs =  "EPSG:" + srid;

        const point = {
          "type": "Feature",
          "crs" : {
            "type" : "name",
            "properties" : {
              "name" : crs
            }
          },
          "geometry": {
            "type": "Point",
            "coordinates": [Number(coordArr[2].replace('E', '')),Number(coordArr[1].replace('N', ''))]
          }
        };
 
        var ptsWithinAlnon = pointsWithinPolygon(point, polyAlnon);
        var ptsWithinCentrumAlnon = pointsWithinPolygon(point, polyCentrumAlnon);
        var ptsWithinSydvastraAlnon = pointsWithinPolygon(point, polySydvastraAlnon);
        var ptsWithinSydostraAlnon = pointsWithinPolygon(point, polySydostraAlnon);
        var ptsWithinNordostraAlnon = pointsWithinPolygon(point, polyNordostraAlnon);
        var ptsWithinNordvastraAlnon = pointsWithinPolygon(point, polyNordvastraAlnon);
        var ptsWithinSundsvallFastland = pointsWithinPolygon(point, polySundsvallFastland);
        var ptsWithinSundsvallSodra = pointsWithinPolygon(point, polySundsvallSodra);
        var ptsWithinSundsvallNorra = pointsWithinPolygon(point, polySundsvallNorra);
        var ptsWithinSundsvallVastra = pointsWithinPolygon(point, polySundsvallVastra);
        var ptsWithinSundsvallOstra = pointsWithinPolygon(point, polySundsvallOstra);

        if (ptsWithinAlnon.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedAlnon += 1;
              break;          
            case "OPEN":
              disturbancesOpenAlnon += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedAlnon += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinCentrumAlnon.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedCentrumAlnon += 1;
              break;          
            case "OPEN":
              disturbancesOpenCentrumAlnon += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedCentrumAlnon += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSydvastraAlnon.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSydvastraAlnon += 1;
              break;          
            case "OPEN":
              disturbancesOpenSydvastraAlnon += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSydvastraAlnon += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSydostraAlnon.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSydostraAlnon += 1;
              break;          
            case "OPEN":
              disturbancesOpenSydostraAlnon += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSydostraAlnon += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinNordostraAlnon.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedNordostraAlnon += 1;
              break;          
            case "OPEN":
              disturbancesOpenNordostraAlnon += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedNordostraAlnon += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinNordvastraAlnon.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedNordvastraAlnon += 1;
              break;          
            case "OPEN":
              disturbancesOpenNordvastraAlnon += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedNordvastraAlnon += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSundsvallFastland.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSundsvallFastland += 1;
              break;          
            case "OPEN":
              disturbancesOpenSundsvallFastland += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSundsvallFastland += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSundsvallSodra.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSundsvallSodra += 1;
              break;          
            case "OPEN":
              disturbancesOpenSundsvallSodra += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSundsvallSodra += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSundsvallNorra.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSundsvallNorra += 1;
              break;          
            case "OPEN":
              disturbancesOpenSundsvallNorra += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSundsvallNorra += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSundsvallVastra.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSundsvallVastra += 1;
              break;          
            case "OPEN":
              disturbancesOpenSundsvallVastra += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSundsvallVastra += 1;
              break;          
            default:
              break;
          }
        }
        if (ptsWithinSundsvallOstra.features.length > 0) {
          switch (disturbance.status) {
            case "CLOSED":
              disturbancesClosedSundsvallOstra += 1;
              break;          
            case "OPEN":
              disturbancesOpenSundsvallOstra += 1;
              break;          
            case "PLANNED":
              disturbancesPlannedSundsvallOstra += 1;
              break;          
            default:
              break;
          }
        }
        if (getPoints) {
          arrGeojson.push({
            category: category[disturbance.category],
            status: status[disturbance.status],
            properties: disturbance.title
          });
        }
      }
    });
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polyAlnon['geometry'],
    properties: {
      openDisturbances: disturbancesOpenAlnon,
      closedDisturbances: disturbancesClosedAlnon,
      plannedDisturbances: disturbancesPlannedAlnon,
      zon: 'Alnön'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polyCentrumAlnon['geometry'],
    properties: {
      openDisturbances: disturbancesOpenCentrumAlnon,
      closedDisturbances: disturbancesClosedCentrumAlnon,
      plannedDisturbances: disturbancesPlannedCentrumAlnon,
      zon: 'Centrum Alnön'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySydvastraAlnon['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSydvastraAlnon,
      closedDisturbances: disturbancesClosedSydvastraAlnon,
      plannedDisturbances: disturbancesPlannedSydvastraAlnon,
      zon: 'Sydvästra Alnön'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySydostraAlnon['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSydostraAlnon,
      closedDisturbances: disturbancesClosedSydostraAlnon,
      plannedDisturbances: disturbancesPlannedSydostraAlnon,
      zon: 'Sydöstra Alnön'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polyNordvastraAlnon['geometry'],
    properties: {
      openDisturbances: disturbancesOpenNordvastraAlnon,
      closedDisturbances: disturbancesClosedNordvastraAlnon,
      plannedDisturbances: disturbancesPlannedNordvastraAlnon,
      zon: 'Nordvästra Alnön'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polyNordostraAlnon['geometry'],
    properties: {
      openDisturbances: disturbancesOpenNordostraAlnon,
      closedDisturbances: disturbancesClosedNordostraAlnon,
      plannedDisturbances: disturbancesPlannedNordostraAlnon,
      zon: 'Nordöstra Alnön'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySundsvallFastland['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSundsvallFastland,
      closedDisturbances: disturbancesClosedSundsvallFastland,
      plannedDisturbances: disturbancesPlannedSundsvallFastland,
      zon: 'Sundsvall Fastland'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySundsvallSodra['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSundsvallSodra,
      closedDisturbances: disturbancesClosedSundsvallSodra,
      plannedDisturbances: disturbancesPlannedSundsvallSodra,
      zon: 'Sundsvall Södra'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySundsvallNorra['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSundsvallNorra,
      closedDisturbances: disturbancesClosedSundsvallNorra,
      plannedDisturbances: disturbancesPlannedSundsvallNorra,
      zon: 'Sundsvall Norra'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySundsvallVastra['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSundsvallVastra,
      closedDisturbances: disturbancesClosedSundsvallVastra,
      plannedDisturbances: disturbancesPlannedSundsvallVastra,
      zon: 'Sundsvall Västra'
    }
  });
  arrGeojson.push({
    type: 'Feature',
    geometry: polySundsvallOstra['geometry'],
    properties: {
      openDisturbances: disturbancesOpenSundsvallOstra,
      closedDisturbances: disturbancesClosedSundsvallOstra,
      plannedDisturbances: disturbancesPlannedSundsvallOstra,
      zon: 'Sundsvall Ostra'
    }
  });
  const geojson = createGeojsonPolygon(arrGeojson, 'Driftströrningar', srid);
  res.send(geojson);
}

function createGeojsonPolygon(objectArr, title, srid) {
  const result = {};
  let features = [];
  result['type'] = 'FeatureCollection';
  result['name'] = title;
  result['crs'] = {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:EPSG::' + srid }
  };

  objectArr.forEach((object) => {
    features.push(object);
  });

  result['features'] = features;
  return result;
}

function createGeojsonPoint(objectArr, title, srid) {
  const result = {};
  let features = [];
  result['type'] = 'FeatureCollection';
  result['name'] = title;
  result['crs'] = {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:EPSG::' + srid }
  };

  objectArr.forEach((object) => {
      const tempObject = {};
      let hasGeometry = false;
      tempObject['type'] = 'Feature';
      if ("coord" in object) {
        tempObject['geometry'] = {
  				"type" : "Point",
  				"coordinates" : [Number(object.coord[2].replace("E", "")),Number(object.coord[1].replace("N", ""))]
        };
        hasGeometry = true;
      } else {
        hasGeometry = false;
      }
      tempObject['properties'] = {
        category: object.category,
        status: object.status,
        description: object.description,
        plannedStartDate: object.plannedStartDate,
        plannedStopDate: object.plannedStopDate,
        created: object.created,
        updated: object.updated,
        reference: object.reference
      };
      if (hasGeometry) {
        features.push(tempObject);
      }
  });
  result['features'] = features;
  return result;
}
