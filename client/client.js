"use strict";

var $ = require('jquery')
var shoe = require('shoe')
var dnode = require('dnode')


function scrolledToBottom() {
    var $chatbox = $('.chatbox')
    var scrollBottom = $chatbox.scrollTop() + $chatbox.innerHeight()
    return scrollBottom === $chatbox[0].scrollHeight
}
function scrollToBottom() {
    var $chatbox = $('.chatbox')
    $chatbox.scrollTop($chatbox[0].scrollHeight)
}
function append(markup) {
    var atBottom = scrolledToBottom()
    $('.chatbox').append(markup)
    if(atBottom)
        scrollToBottom()
}

var api = {
    onSysMsg: function(message) {
        append(
            '<div class="chatentry">'
                + '<div class="chatname system">system</div>'
                + '<div class="chatmessage">' + message + '</div>'
            + '</div>'
        )
    },
    onChat: function(name, message) {
        append(
            '<div class="chatentry">'
                + '<div class="chatname">' + name + '</div>'
                + '<div class="chatmessage">' + message + '</div>'
            + '</div>'
        )
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
