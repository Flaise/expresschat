var $ = require('jquery')
var shoe = require('shoe')
var dnode = require('dnode')

$(function() {
    "use strict";

    var api = {
        onSysMsg: function(message) {
            $('.chatbox').append(
                '<div class="chatentry">'
                    + '<div class="chatname system">system</div>'
                    + '<div class="chatmessage">' + message + '</div>'
                + '</div>'
            )
        },
        onChat: function(name, message) {
            $('.chatbox').append(
                '<div class="chatentry">'
                    + '<div class="chatname">' + name + '</div>'
                    + '<div class="chatmessage">' + message + '</div>'
                + '</div>'
            )
        },
        onConnect: function(name) {
            api.onSysMsg('<strong>' + name + '</strong> has connected.')
        }
    }

    var d = dnode()
    d.on('remote', function(remote) {
        remote.connect(g_name, g_token, api, function(err) {
            if(err)
                console.error(err)
            else
                $('.chatinput')
                    .bind("enter", function(e) {
                        var $input = $('.chatinput')
                        remote.say($input.val())
                        $input.val('')
                    })
                    .keydown(function(e) {
                        if(e.keyCode === 13) {
                            $(this).trigger("enter")
                        }
                    })
        })
    })
    d.on('error', function(err) {
        console.error(err.stack)
    })
    d.on('close', function() {
        console.log('close')
    })

    var stream = shoe('/dnode')
    d.pipe(stream).pipe(d)
})
