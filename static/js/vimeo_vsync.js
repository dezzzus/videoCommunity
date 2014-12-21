// Vimeo playback sync
// 
// Loosely based on (http://larrywu.com/videosync/)

// ---
// roomId is the name of the channel you want to use.
// userId is an optional variable that will identify individual users of VideoSync.

function VideoSync(roomId, userId, player) {
    // If no userId is provided, generate a simple random one with Math.random.
    if (userId === undefined) {
        userId = Math.random().toString();
    }

    // Initializing PubNub with demo keys and our userId.
    var pubnub = PUBNUB.init({
        publish_key: 'pub-c-4dd374dc-c46a-40ee-9bbf-488f4f7449ef',
        subscribe_key: 'sub-c-170d058e-8726-11e4-a400-02ee2ddab7fe',
        uuid: userId
    });

    // Whether the connection to the channel has been established yet.
    var linkStart = false;

    // The contents of the most recently received message.
    var lastMsg;

    // A helper function that publishes state-change messages.
    var pub = function (type, time) {
        if (lastMsg !== "" + type + time) {
            pubnub.publish({
                channel: roomId,
                message: {
                    recipient: "",
                    sender: userId,
                    type: type,
                    time: time,
                }
            });
        }
    };

    var dontPublishNext = false;
    
    // The function that keeps the video in sync.
    var callPlayer = function(player, arg1, arg2, arg3) {
    	dontPublishNext = true;
    	player.api(arg1, arg2, arg3);
    };
    
    var keepSync = function (playerIn) {
        linkStart = true;

        var player = playerIn;
        
        // The initial starting time of the current video.
        player.api('getCurrentTime',
            function(time) {
            // Subscribing to our PubNub channel.
            pubnub.subscribe({
                channel: roomId,
                callback: function (m) {
                    lastMsg = m.recipient + m.type + m.time;
                    if ((m.recipient === userId || m.recipient === "") && m.sender !== userId) {
                        if (m.type === "updateRequest") {
                            var curTime =  player.api('getCurrentTime');
                            pubnub.publish({
                                channel: roomId,
                                message: {
                                    type: "updateResponse",
                                    time: curTime,
                                    recipient: m.sender
                                }
                            });
                        } else if (m.type === "pause" || m.type === "seek") {
                        	callPlayer(player, 'seekTo', m.time);
                            time = m.time;
                            if (m.type === "pause") {
                            	callPlayer(player, 'pause');
                            }
                        } else if (m.type === "play") {
                            if (m.time !== null) {
                            	callPlayer(player, 'seekTo', m.time);
                            }
                            callPlayer(player, 'play');
                        }
                    }
                },
                presence: function (m) {}
            });

            // Intermittently checks whether the video player has jumped ahead or
            // behind the current time.
            var z = setInterval(function () {
                player.api('getCurrentTime', function(curTime) {
                    if (Math.abs(curTime - time) > 1) {
                    	player.api('paused', function(paused){
                            if (paused) {
                                pub("pause", curTime);
                                player.api('pause');
                            } else if (!paused) {
                                player.api('pause');
                            }
                    	});
                    }
                    time = curTime;
                });
            }, 500);

        });

    };

    var onPlayerReady =  function (playerIn) {
            playerIn.api('play');
            playerIn.api('pause');
            keepSync(playerIn);
        };
        
        // Should be bound to the Vimeo player `onStateChange` event.
    var onPlayerStateChange = function (player, state) {
        	if (dontPublishNext) {
        		dontPublishNext = false;
        		return;
        	}
            if (linkStart) {
                // Play event.
                if (state == PLAY) {
                    pub("play", null);
                }
                // Pause event.
                else if (state == PAUSE) {
                	player.api('getCurrentTime',
                			function(time){pub("pause", time);});
                }
                else if (state == SEEK) {
                	player.api('getCurrentTime',
                			function(time){pub("seek", time);});
                }
            }
        };
        
        // Useful constants
        var PLAY = 1;
        var     PAUSE = 2;
        var   SEEK = 3;
        
    var onPause = function(id) {
        onPlayerStateChange(player, PAUSE);
    };

    var onFinish = function(id) {
        onPlayerStateChange(player, PAUSE);
    };
    
     var onSeek = function(id) {
        onPlayerStateChange(player, SEEK);
    };
    
    var onPlay  = function(id) {
        onPlayerStateChange(player, PLAY);
    };

    var onPlayProgress = function(data, id) {
    };

        
	// When the player is ready, add listeners for pause, finish, and playProgress
    player.addEvent('ready', function() {
        player.addEvent('pause', onPause);
        player.addEvent('finish', onFinish);
        player.addEvent('seek', onSeek);
        player.addEvent('play', onPlay);
        player.addEvent('playProgress', onPlayProgress);
        onPlayerReady(player);
    });
    
}