
//var passport = require('passport')
var mongoose = require('mongoose')
var flash = require('connect-flash')
var dec = require('./decorators')
var settings = require('./settings')

module.exports = function(express, app) {
    var MongoStore = require('connect-mongo')(express)

    app.use(express.cookieParser(settings.cookie_key))
    app.use(express.session({
        secret: settings.session_key,
        store: new MongoStore({
            db: settings.database_name,
            url: settings.database_path
        })
    }))

    mongoose.connect(settings.database_path)
    var db = mongoose.connection
    db.on('error', function(err) {
        console.error(err.message)
        console.error(err.stack)
    })


    //app.use(passport.initialize())
    //app.use(passport.session())
    app.use(flash())

    /*passport.use(new passport.Strategy(
        function(username, password, done) {
            User.findOne({ username: username, password: password }, function (err, user) {
                done(err, user);
            });
        }
    ));*/

    app.use(dec.routeErrHandler(function logger(req, res, next) {
        console.log('[%s] %s %s %s', new Date(), req.method, req.url, req.ip)
        next()
    }))
    app.use(app.router) // Must be after session management
    app.use(express.static(__dirname + '/static'))
    //app.use(routeErrHandler(function errorHandler(err, req, res, next) {
    //    res.status(500)
    //    res.render('500.jade', {error: err, showStack: settings.debug})
    //}))
    app.use(dec.routeErrHandler(function(req, res, next) {
        res.status(404)
        res.render('404.jade', {})
    }))
}
