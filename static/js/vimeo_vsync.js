// Vimeo playback sync

function videoSync(roomId, player) {
    var userId = PUBNUB.uuid();

    var pubnub = PUBNUB.init({
        publish_key: 'pub-c-4dd374dc-c46a-40ee-9bbf-488f4f7449ef',
        subscribe_key: 'sub-c-170d058e-8726-11e4-a400-02ee2ddab7fe',
        uuid: userId
    });


    var pub = function (type, time) {
        if (playerEventCounter[type] == 0) {
            pubnub.publish({
                channel: roomId,
                message: {
                    recipient: '',
                    sender: userId,
                    type: type,
                    time: time,
                }
            });
        }
        else {
            playerEventCounter[type] -= 1;
        }

    };

    var playerEventCounter = {
        play: 0,
        pause: 0,
        seekTo: 0
    };

    var callPlayer = function (player, state, time) {
        playerEventCounter[state] += 1;
        player.api(state, time);
    };

    var onPlayerReady = function () {
        pubnub.subscribe({
            channel: roomId,
            callback: function (m) {
                if ((m.recipient === userId || m.recipient === '') && m.sender !== userId) {
                    if (m.type === 'pause') {
                        callPlayer(player, 'pause');
                    }
                    if (m.type === 'play') {
                        callPlayer(player, 'play');
                    }
                    if (m.type === 'seekTo') {
                        callPlayer(player, 'seekTo', m.time);
                    }
                }
            }
        });
    };

    var onPause = function (id) {
        pub('pause');
    };

    var onSeek = function (position) {
        pub('seekTo', position.seconds);
    };

    var onPlay = function (id) {
        pub('play');
    };

    player.addEvent('ready', function () {
        player.addEvent('pause', onPause);
        player.addEvent('seek', onSeek);
        player.addEvent('play', onPlay);
        onPlayerReady();
    });

}

