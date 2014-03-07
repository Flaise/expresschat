"use strict";

var express = require('express')
var browserify = require('browserify')
var fs = require('fs')
var forms = require('forms')
var fields = forms.fields
var validators = forms.validators
var mongoose = require('mongoose')
var passwordHash = require('password-hash')
var domain = require('domain')
var flash = require('connect-flash')
var MongoStore = require('connect-mongo')(express)
//var passport = require('passport')
var shoe = require('shoe')
var dnode = require('dnode')
var minifyify = require('minifyify')
var crypto = require('crypto')
var http = require('http')
var https = require('https')

var default_settings = require('./default_settings.js')
var settings = {}
try {
    settings = require('./settings.js')
}
catch(err) {
    if(err.code !== 'MODULE_NOT_FOUND')
        throw err
}
settings.__proto__ = default_settings

var app = express()


var httpServer = http.createServer(app)
//var httpsServer = https.createServer({key: settings.sslPrivateKey, cert: settings.sslCertificate}, app)



/* *** Error Handling *** */
function render500(err, res) {
    try {
        console.error(err.stack)
        res.status(500)
        res.render('500.jade', {error: err, showStack: settings.debug})
    }
    catch(fail) {
        console.error('Unable to render 500 page.')
        console.error(fail.stack)
    }
}
function render500res(res) {
    return function(err) {
        render500(err, res)
    }
}

function routeErrHandler(target) {
    return function(req, res, next) {
        var d = domain.create()
        d.on('error', function(err) {
            render500(err, res)
        })
        d.run(function() {
            try {
                target(req, res, next)
            }
            catch(err) {
                render500(err, res)
            }
        })
    }
}

function showStackTrace(target) {
    return function() {
        var d = domain.create()
        d.on('error', function(err) {
            console.error(err.stack)
        })

        var args = arguments
        d.run(function() {
            target.apply(null, args)
        })
    }
}

/*
 * Calls handler with the first argument if that argument indicates there was an error, otherwise calls the target
 * function with the rest of the arguments.
 */
function catchContErr(handler, target) {
    return function(err) {
        if(err)
            handler(err)
        else
            target.apply(null, Array.prototype.splice.call(arguments, 1))
    }
}
function consoleShowErr(err) {
    if(err)
        console.error(err.stack || err)
    else
        console.error('Undefined/null error')
}

/*
 * For forcing Mongoose queries to not crash the entire server; Mongoose does not support domains properly.
 */
function callAndErrHandle(res, target) {
    var d = domain.create()
    d.on('error', function(err) {
        render500(err, res)
    })
    d.run(function() {
        // This function can be allowed to throw if already calling from within a domain
        try {
            target()
        }
        catch(err) {
            render500(err, res)
        }
    })
}


/* *** Forms *** */

var validator_matchField = function (match_field, message) {
    if (!message) { message = 'Does not match %s.'; }
    return function (form, field, callback) {
        if (form.fields[match_field].data !== field.data) {
            if(message.lastIndexOf('%') >= 0)
                callback(util.format(message, match_field))
            else
                callback(message)
        } else {
            callback()
        }
    }
}

var validator_alphanumeric = function(message) {
    return validators.regexp(/^[a-zA-Z0-9]*$/, message || 'Letters and numbers only.');
}

var reg_form = forms.create({
    username: fields.string({
        label: 'Username',
        required: true,
        validators: [validator_alphanumeric()]
    }),
    password: fields.password({
        label: 'Password',
        required: true
    }),
    password2: fields.password({
        label: 'Confirm Password',
        required: true,
        validators: [validator_matchField('password', "Passwords didn't match. Try again.")]
    }),
    email: fields.email({
        label: 'Email'
    })
})

var log_form = forms.create({
    username: fields.string({
        label: 'Username',
        required: true
    }),
    password: fields.password({
        label: 'Password',
        required: true
    })
})


/* *** Schemata *** */
var userAccountSchema = mongoose.Schema({
    name: {type:String, required:true},
    hashedPassword: String,
    email: String,
    joinDate: {type:Date, default:Date.now, required:true},
    hashedAuthToken: String
})
userAccountSchema.methods.isPassword = function(password) {
    return passwordHash.verify(password, this.hashedPassword)
}
userAccountSchema.methods.setPassword = function(cleartext) {
    this.hashedPassword = passwordHash.generate(cleartext)
}
userAccountSchema.methods.isAuthToken = function(token) {
    return passwordHash.verify(token, this.hashedAuthToken)
}
userAccountSchema.methods.genAuthToken = function(cb) {
    try {
        var token = crypto.randomBytes(256).toString('base64')
    }
    catch(err) {
        console.warn(err.stack || err)
        // If the entropy buffer isn't full, just generate some data anyway.
        // This is itself going to be a fairly random occurrence so the security impact should be minimal.
        token = crypto.pseudoRandomBytes(256).toString('base64')
    }
    this.hashedAuthToken = passwordHash.generate(token)
    cb(null, token)
}

var UserAccount = mongoose.model('UserAccount', userAccountSchema)


/* *** Middleware *** */

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

app.use(routeErrHandler(function logger(req, res, next) {
    console.log('%s %s %s', req.method, req.url, req.ip)
    next()
}))
app.use(app.router) // Must be after session management
app.use(express.static(__dirname + '/static'))
//app.use(routeErrHandler(function errorHandler(err, req, res, next) {
//    res.status(500)
//    res.render('500.jade', {error: err, showStack: settings.debug})
//}))
app.use(routeErrHandler(function(req, res, next) {
    res.status(404)
    res.render('404.jade', {})
}))


function extractMessages(req) {
    return {
        error: req.flash('error'),
        warning: req.flash('warning'),
        info: req.flash('info')
    }
}

/* *** Decorators *** */
function loginRequired(req, res, next) {
    //if (req.isAuthenticated())
    //    return next()
    if(req.session.account)
        return next()

    req.flash('error', 'You must log in to access that page.')
    res.redirect('/login')
}

function redirectIfLoggedIn(dest) {
    return function(req, res, next) {
        if(req.session.account)
            res.redirect(dest)
        else
            next()
    }
}


/* *** Routes *** */
app.post('/logout', routeErrHandler(function(req, res) {
    req.session.account = null
    req.flash('info', 'Logged out!1')
    res.redirect('/login')
}))
app.get('/login', redirectIfLoggedIn('/chat'), routeErrHandler(function(req, res) {
    res.render('login.jade', {log_form:log_form, messages:extractMessages(req)})
}))
app.post('/login', routeErrHandler(function(req, res) {
    log_form.handle(req, {
        success: function(form) {
            callAndErrHandle(res, function() {
                UserAccount.findOne(
                    { name: form.data.username.trim() },
                    catchContErr(render500res(res), function(account) {
                        if(account && account.isPassword(form.data.password)) {
                            req.session.account = account
                            res.redirect('/chat')
                        }
                        else {
                            //req.flash('error', 'Invalid username/password combination.')

                            form.fields.password.error = 'Invalid username/password combination.'
                            res.render('login.jade', {log_form:form, messages:extractMessages(req)})
}
                    })
                )
            })
        },
        error: function(form) {
            res.render('login.jade', {log_form:form, messages:extractMessages(req)})
        },
        empty: function(form) {
            res.render('login.jade', {log_form:form, messages:extractMessages(req)})
        }
    })
}))
app.get('/', redirectIfLoggedIn('/chat'), routeErrHandler(function(req, res) {
    res.render('index.jade', {reg_form:reg_form, messages:extractMessages(req)})
}))
app.post('/', routeErrHandler(function(req, res) {
    reg_form.handle(req, {
        success: function(form) {
            // there is a request and the form is valid
            // form.data contains the submitted data

            callAndErrHandle(res, function() {
                UserAccount.find({name: form.data.username.trim()}, catchContErr(render500res(res), function(accounts) {
                    if(accounts.length) {
                        form.fields.username.error = 'That name is already taken.'
                        res.render('index.jade', {reg_form:form, messages:extractMessages(req)})
                    }
                    else {
                        var account = UserAccount({
                            name: form.data.username.trim(),
                            email: form.data.email
                        })
                        account.setPassword(form.data.password)
                        account.save(catchContErr(render500res(res), function() {
                            req.session.account = account
                            res.redirect('/chat')
                        }))
                    }
                }))
            })

        },
        error: function(form) {
            // the data in the request didn't validate;
            // calling form.toHTML() again will render the error messages
            res.render('index.jade', {reg_form:form, messages:extractMessages(req)})
        },
        empty: function(form) {
            // there was no form data in the request
            res.render('index.jade', {reg_form:form, messages:extractMessages(req)})
        }
    })
}))
app.get('/chat', loginRequired, routeErrHandler(function(req, res) {
    UserAccount.findOne({name: req.session.account.name}, catchContErr(render500res(res), function(account) {
        account.genAuthToken(catchContErr(render500res(res), function(token) {
            account.save(catchContErr(render500res(res), function() {
                res.render('chat.jade', {
                    account:req.session.account,
                    messages:extractMessages(req),
                    token:token
                })
            }))
        }))
    }))
}))

/* *** browserify and entry points *** */
browserify()
    .add('./browserjs/client.js')
    .bundle({debug: settings.debug})

    .pipe(minifyify(catchContErr(consoleShowErr, function(src, map) {
        fs.writeFileSync('./static/bundle.js', src)
        fs.writeFileSync('./static/bundle.map.json', map)

        var clients = []
        var sock = shoe(function(stream) {
            var client

            var d = dnode({
                connect: showStackTrace(function(name, token, api, next) {
                    UserAccount.findOne({name: name}, catchContErr(consoleShowErr, function(account) {
                        if(!account || !account.isAuthToken(token))
                            next('Authentication failed.')
                        else {
                            client = api
                            client.name = name
                            clients.forEach(function(other) { other.onConnect(client.name) })
                            client.onSysMsg('you Are logged in')
                            next(null, clients.map(function(client) { return client.name }))
                            clients.push(client)
                        }
                    }))
                }),
                say: showStackTrace(function(message) {
                    if(!client) {
                        console.error('Tried to use say() without connect()')
                        stream.close()
                        return
                    }
                    clients.forEach(function(other) { other.onChat(client.name, message) })
                })
            })//, {weak:false})
            d.on('error', consoleShowErr)
            d.pipe(stream).pipe(d)

            stream.on('close', function() {
                var i = clients.indexOf(client)

                if(i < 0)
                    console.error('Client "' + client.name + '" not found in client list.')
                else {
                    clients.splice(i, 1)
                    clients.forEach(function(other) { other.onDisconnect(client.name) })
                }
            })
        })

        // application starts

        //var something = app.listen(settings.port)

        var something = httpServer.listen(settings.port)
        //httpsServer.listen(443)

        sock.install(something, '/dnode')

        console.log('Started.')
    })))
