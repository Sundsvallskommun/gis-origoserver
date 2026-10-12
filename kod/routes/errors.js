var express = require('express');
var app = express();
// 500 error handler (middleware)
app.use(function(err, req, res, next) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Something went wrong', err });
    //res.render('500');
});

module.exports = app;
