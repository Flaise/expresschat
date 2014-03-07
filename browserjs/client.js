var $ = require('jquery')
var shoe = require('shoe')
var dnode = require('dnode')

;(function() {
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
            var $chatbox = $('.chatbox')
            var scrollBottom = $chatbox.scrollTop() + $chatbox.innerHeight()
            var atBottom = scrollBottom === $chatbox[0].scrollHeight
            $chatbox.append(
                '<div class="chatentry">'
                    + '<div class="chatname">' + name + '</div>'
                    + '<div class="chatmessage">' + message + '</div>'
                + '</div>'
            )
            if(atBottom)
                $chatbox.scrollTop($chatbox[0].scrollHeight)
        },
        onConnect: function(name) {
            api.onSysMsg('<strong>' + name + '</strong> has connected.')
        },
        onDisconnect: function(name) {
            api.onSysMsg('<strong>' + name + '</strong> has disconnected.')
        }
    }

    var d = dnode()
    d.on('remote', function(remote) {
        remote.connect(g_name, g_token, api, function(err, otherClients) {
            if(err)
                console.error(err)
            else {
                otherClients.forEach(function(other) {
                    api.onSysMsg('<strong>' + other + '</strong> is already connected.')
                })
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
            }
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
})()
