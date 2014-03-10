"use strict";

var express = require('express')
var browserify = require('browserify')
var fs = require('fs')
var shoe = require('shoe')
var dnode = require('dnode')
var minifyify = require('minifyify')
var http = require('http')
var https = require('https')
var models = require('./models')
var dec = require('./decorators')
var settings = require('./settings')


var app = express()

require('./middleware')(express, app)
require('./routes')(app)


var httpServer = http.createServer(app)
var httpsServer = https.createServer({
    key: fs.readFileSync(settings.sslPrivateKeyFile).toString(),
    cert: fs.readFileSync(settings.sslCertificateFile).toString()
}, app)


browserify()
    .add('./client/client.js')
    .bundle({debug: settings.debug})

    .pipe(minifyify(dec.catchContErr(dec.consoleShowErr, function(src, map) {
        fs.writeFileSync('./static/bundle.js', src)
        fs.writeFileSync('./static/bundle.map.json', map)

        var clients = []
        var sock = shoe(function(stream) {
            var client

            var d = dnode({
                connect: dec.showStackTrace(function(name, token, api, next) {
                    models.UserAccount.findOne({name: name}, dec.catchContErr(dec.consoleShowErr, function(account) {
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
                say: dec.showStackTrace(function(message) {
                    if(!client) {
                        console.error('Tried to use say() without connect()')
                        stream.close()
                        return
                    }
                    message = message.split('<').join('&lt;').split('>').join('&gt;')
                    clients.forEach(function(other) { other.onChat(client.name, message) })
                })
            })
            d.on('error', dec.consoleShowErr)
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

        //var server = app.listen(settings.port)

        httpServer.listen(settings.port)
        httpsServer.listen(settings.sslPort)

        sock.install(httpsServer, '/dnode')

        console.log('Started.')
    })))
