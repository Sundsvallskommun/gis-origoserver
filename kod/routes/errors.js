var express = require('express');
var app = express();
// error handlers
// 404 catch-all handler (middleware)
app.use(function(err, req, res, next) {
    res.status(404).json({ error: 'Something went wrong', err });
    //res.render('404');
});

// 500 error handler (middleware)
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong', err });
    //res.render('500');
});

module.exports = app;
