
var forms = require('forms')
var fields = forms.fields
var validators = forms.validators
var dec = require('./decorators')
var models = require('./models')

var reg_form = forms.create({
    username: fields.string({
        label: 'Username',
        required: true,
        validators: [
            validators.alphanumeric(),
            validators.maxlength(20, 'Pick a name at most %s characters long.')
        ],
        attrs: {
            classes: ['asdf'],
            maxlength: 20
        }
    }),
    password: fields.password({
        label: 'Password',
        required: true,
        validators: [
            validators.minlength(5, 'Your password must be at least %s characters long, preferably longer.'),
            validators.maxlength(300)
        ],
        attrs: {
            maxlength: 300
        }
    }),
    password2: fields.password({
        label: 'Confirm Password',
        required: true,
        validators: [
            validators.matchField('password', "Passwords didn't match. Try again.")
        ],
        attrs: {
            maxlength: 300
        }
    }),
    email: fields.email({
        label: 'Email'
    })
})

var log_form = forms.create({
    username: fields.string({
        label: 'Username',
        required: true,
        attrs: {
            maxlength: 300
        }
    }),
    password: fields.password({
        label: 'Password',
        required: true,
        attrs: {
            maxlength: 300
        }
    })
})

function extractMessages(req) {
    return {
        error: req.flash('error'),
        warning: req.flash('warning'),
        info: req.flash('info')
    }
}

function loginRequired(req, res, next) {
    if(req.session.account) {
        next()
    }
    else {
        req.flash('error', 'You must log in to access that page.')
        res.redirect('/login')
    }
}

function redirectIfLoggedIn(dest) {
    return function(req, res, next) {
        if(req.session.account)
            res.redirect(dest)
        else
            next()
    }
}

module.exports = function(app) {
    app.post('/logout', dec.routeErrHandler(function(req, res) {
        req.session.account = null
        req.flash('info', 'Logged out!1')
        res.redirect('/login')
    }))
    app.get('/login', redirectIfLoggedIn('/chat'), dec.routeErrHandler(function(req, res) {
        res.render('login.jade', {log_form:log_form, messages:extractMessages(req)})
    }))
    app.post('/login', dec.routeErrHandler(function(req, res) {
        log_form.handle(req, {
            success: function(form) {
                dec.callAndErrHandle(res, function() {
                    models.UserAccount.findOne(
                        { name: form.data.username.trim() },
                        dec.catchContErr(dec.render500res(res), function(account) {
                            if(account && account.isPassword(form.data.password)) {
                                req.session.account = account
                                res.redirect('/chat')
                            }
                            else {
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
    app.get('/', redirectIfLoggedIn('/chat'), dec.routeErrHandler(function(req, res) {
        res.render('index.jade', {reg_form:reg_form, messages:extractMessages(req)})
    }))
    app.post('/', dec.routeErrHandler(function(req, res) {
        reg_form.handle(req, {
            success: function(form) {
                // there is a request and the form is valid
                // form.data contains the submitted data

                dec.callAndErrHandle(res, function() {
                    models.UserAccount.find(
                        {name: form.data.username.trim()},
                        dec.catchContErr(dec.render500res(res), function(accounts) {
                            if(accounts.length) {
                                form.fields.username.error = 'That name is already taken.'
                                res.render('index.jade', {reg_form:form, messages:extractMessages(req)})
                            }
                            else {
                                var account = models.UserAccount({
                                    name: form.data.username.trim(),
                                    email: form.data.email
                                })
                                account.setPassword(form.data.password)
                                account.save(dec.catchContErr(dec.render500res(res), function() {
                                    req.session.account = account
                                    res.redirect('/chat')
                                }))
                            }
                        })
                    )
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
    app.get('/chat', loginRequired, dec.routeErrHandler(function(req, res) {
        models.UserAccount.findOne(
            {name: req.session.account.name},
            dec.catchContErr(dec.render500res(res), function(account) {
                account.genAuthToken(dec.catchContErr(dec.render500res(res), function(token) {
                    account.save(dec.catchContErr(dec.render500res(res), function() {
                        res.render('chat.jade', {
                            account:req.session.account,
                            messages:extractMessages(req),
                            token:token
                        })
                    }))
                }))
            })
        )
    }))
}
