
var domain = require('domain')
var settings = require('./settings')

var decorators = {
    render500: function(err, res) {
        try {
            console.error(err.stack)
            res.status(500)
            res.render('500.jade', {error: err, showStack: settings.debug})
        }
        catch(fail) {
            console.error('Unable to render 500 page.')
            console.error(fail.stack)
        }
    },
    render500res: function(res) {
        return function(err) {
            decorators.render500(err, res)
        }
    },
    routeErrHandler: function(target) {
        return function(req, res, next) {
            var d = domain.create()
            d.on('error', function(err) {
                decorators.render500(err, res)
            })
            d.run(function() {
                try {
                    target(req, res, next)
                }
                catch(err) {
                    decorators.render500(err, res)
                }
            })
        }
    },
    showStackTrace: function(target) {
        return function(__varargs__) {
            var d = domain.create()
            d.on('error', function(err) {
                console.error(err.stack)
            })

            var args = arguments
            d.run(function() {
                target.apply(null, args)
            })
        }
    },

    /*
     * Calls handler with the first argument if that argument indicates there was an error, otherwise calls the target
     * function with the rest of the arguments.
     */
    catchContErr: function(handler, target) {
        return function(err, __varargs__) {
            if(err)
                handler(err)
            else
                target.apply(null, Array.prototype.splice.call(arguments, 1))
        }
    },

    consoleShowErr: function(err) {
        if(err)
            console.error(err.stack || err)
        else
            console.error('Undefined/null error')
    },

    /*
     * For forcing Mongoose queries to not crash the entire server; Mongoose does not support domains properly.
     */
    callAndErrHandle: function(res, target) {
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
                decorators.render500(err, res)
            }
        })
    }
}

module.exports = decorators
