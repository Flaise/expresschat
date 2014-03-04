"use strict";

var express = require('express')
var app = express()
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


var settings = require('./default_settings.js')


/* *** Uncaught Exception Handling *** */
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

var reg_form = forms.create({
    username: fields.string({
        label: 'Username',
        required: true
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
    name: String,
    hashedPassword: String,
    email: String,
    joinDate: { type: Date, default: Date.now }
})
userAccountSchema.methods.isPassword = function(password) {
    return passwordHash.verify(password, this.hashedPassword)
}
userAccountSchema.methods.setPassword = function(cleartext) {
    this.hashedPassword = passwordHash.generate(cleartext)
}
//userAccountSchema.virtual('password').

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
//db.once('open', function() {


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
app.use(routeErrHandler(function errorHandler(err, req, res, next) {
    res.status(500)
    res.render('500.jade', {error: err, showStack: settings.debug})
}))
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
            return next()
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
                UserAccount.findOne({ name: form.data.username }, function(err, account) {
                    if(err)
                        render500(err, res)
                    else if(account && account.isPassword(form.data.password)) {
                        req.session.account = account
                        res.redirect('/chat')
                    }
                    else {
                        //req.flash('error', 'Invalid username/password combination.')

                        form.fields.password.error = 'Invalid username/password combination.'
                        res.render('login.jade', {log_form:form, messages:extractMessages(req)})
                    }
                })
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

            /*callAndErrHandle(res, function() {
                UserAccount.find({}, function(err, accounts) {
                    if(err)
                        render500(err, res)
                    else
                        console.log(accounts)
                })
            })*/

            callAndErrHandle(res, function() {
                UserAccount.find({ name: form.data.username }, function(err, accounts) {
                    if(err)
                        render500(err, res)
                    else if(accounts.length) {
                        form.fields.username.error = 'That name is already taken.'
                        //req.flash('error', 'That name is already taken.')
                        res.render('index.jade', {reg_form:form, messages:extractMessages(req)})
                    }
                    else {
                        var account = UserAccount({
                            name: form.data.username,
                            email: form.data.email
                        })
                        account.setPassword(form.data.password)
                        account.save(function(err) {
                            if(err)
                                render500(err, res)
                            else {
                                req.session.account = account
                                res.redirect('/chat')
                            }
                        })
                    }
                })
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
    res.render('chat.jade', {account:req.session.account, messages:extractMessages(req)})
}))
app.get('/throws', routeErrHandler(function(req, res) { // just for testing the 500 handler
    throw new Error('wat')
}))
app.get('/throws-async', routeErrHandler(function(req, res) {
    setTimeout(function() {
        throw new Error('ohai')
    }, 500)
}))
app.get('/throws-async-nested', routeErrHandler(function(req, res) {
    setTimeout(function() {
        setTimeout(function() {
            throw new Error('ohai')
        }, 500)
    }, 500)
}))

/* *** browserify and entry points *** */
var b = browserify()
b.add('./browserjs/uses_foo.js')
b.bundle({debug: settings.debug}).pipe(
    fs.createWriteStream('./static/bundle.js')
        .on('error', function(error) {
            console.error('Unable to bundle JS')
            console.error(error.stack)
        })
        .on('close', function() {

            // application starts

            var something = app.listen(settings.port)

            var sock = shoe(function (stream) {
                var cbOnChat

                var d = dnode({
                    onChat: function(cb) {
                        cbOnChat = cb
                        cb('system', 'you Are logged in')
                    },
                    say: function(message) {
                        if(cbOnChat)
                            cbOnChat('???', message)
                    }
                })//, {weak:false})
                d.pipe(stream).pipe(d)
            })
            //sock.install(app, '/dnode')
            sock.install(something, '/dnode')

            console.log('Started.')
        })
)



//})