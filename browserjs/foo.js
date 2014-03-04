exports = module.exports = function(r) {
    return r + 1
}


var $ = require('jquery')
var shoe = require('shoe')
var dnode = require('dnode')
var stream = shoe('/dnode')

$(function() {
    "use strict";

    var d = dnode()
    d.on('remote', function (remote) {
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

        remote.onChat(function(name, message) {
            //$('.chatbox').html(name + '| ' + message)
            $('.chatbox').append(
                '<div class="chatentry">'
                    + '<div class="chatname">' + name + '</div>'
                    + '<div class="chatmessage">' + message + '</div>'
                + '</div>'
            )
        })
    })
    d.pipe(stream).pipe(d)
})
