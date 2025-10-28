const lmservices = require('./lmservices.js');

const checkAccess = async function checkAccess(req){
	return true;
}

const getStuff = async (req, res) => {
  const service = req.query.service;
  const fastighet = req.query.fastighet;
  const id = req.query.id ?? '';
  const hasAccess = await checkAccess(req);
  if (hasAccess) {
    try {
      const response = await lmservices({ typ: service, fastighet, id, includeData: 'total' });
      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  } else {
    console.log("No access");
	  res.status(403).send("No access");
  }
}

module.exports = { getStuff };