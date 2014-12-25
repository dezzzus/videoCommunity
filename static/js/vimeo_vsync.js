// Vimeo playback sync
// 
// Loosely based on (http://larrywu.com/videosync/)

// ---
// roomId is the name of the channel you want to use.
// userId is an optional variable that will identify individual users of VideoSync.

function VideoSync(roomId, userId, player, syncAsWeGo, isPresenter, debug) {
    // If no userId is provided, generate a simple random one with Math.random.
    if (userId === undefined) {
        userId = Math.random().toString();
    }
    
    var debugOut = function() {
    	if (debug) {
    		console.log.apply(console, arguments);
    	}
    };
    
    debugOut("PresenterMode: " + isPresenter);

    // Initializing PubNub with demo keys and our userId.
    var pubnub = PUBNUB.init({
        publish_key: 'pub-c-4dd374dc-c46a-40ee-9bbf-488f4f7449ef',
        subscribe_key: 'sub-c-170d058e-8726-11e4-a400-02ee2ddab7fe',
        origin: 'pubsub.pubnub.com',
        uuid: userId
    });

    // Whether the connection to the channel has been established yet.
    var linkStart = false;

    // The contents of the most recently received message.
    var lastMsg;

    // A helper function that publishes state-change messages.
    var pub = function (type, time) {
        if (lastMsg !== "" + type + time) {
        	debugOut("sent event: ", type, " ", time);
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

    var isStateChangeEvent = function(event) {
    	return event === "play" || event === "pause" || event === "seekTo";
    };
     
    var pubIncomingEventQueue = [];
    
    // Hack to keep secondary events from echoing
    var callPlayer = function(player, arg1, arg2, arg3) {
    	if (isStateChangeEvent(arg1)) {
    		pubIncomingEventQueue.push(arg1);
        }
    	
    	player.api(arg1, arg2, arg3);
    };
    
    // The function that keeps the video in sync.
    var keepSync = function (playerIn) {
        linkStart = true;

        var player = playerIn;
        var time;
        
        // The initial starting time of the current video.
        player.api('getCurrentTime',
            function(playerTime) {
        	
        	time = playerTime;
        	
            // Subscribing to our PubNub channel.
            pubnub.subscribe({
                channel: roomId,
                callback: function (m) {
                    lastMsg = m.recipient + m.type + m.time;
                    if ((m.recipient === userId || m.recipient === "") && m.sender !== userId) {
                    	debugOut("received event: ", m.type);

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
                        } else if (m.type === "pause") {
                            callPlayer(player, 'pause');
                        } else if (m.type === "play") {
                            callPlayer(player, 'play');
                        } else if (m.type === 'seek') {
                        	callPlayer(player, 'seekTo', m.time);
                        }
                    }
                },
                presence: function (m) {}
            });

            // Intermittently checks whether the video player has jumped ahead or
            // behind the current time.
            // At the moment, this is not recommended to use (and in fact syncAsWeGo is false when called from tour_details.ejs, 
            // because it's not working well with Vimeo, especially under slow network.
            // Other known problems:
            // - is that Vimeo "eats" certain events, e.g. when user performs them, API is not notified.
            // - Vimeo sends event notifications out of order (!)
            // 
            // The only hope we might have is, after all, to differentiate presenter and viewer.
            // This is not yet implemented, but we can do something like this:
            //  - Presenter starts play
            //  - Viewer checks in from time to time
            //  - If Viewer is ahead, it pauses.  If Viewer is behind, then Presenter is notified and it pauses
            //  - Viewer can pause and ask questions
            //  - If Viewer seeks, then both viewer and presenter must stop
            //  - If Presenter seeks and keeps playing, Viewer keeps playing            
            if (syncAsWeGo) {
                var z = setInterval(function () {
                    player.api('getCurrentTime', function(curTime) {
                        if (Math.abs(curTime - time) > 1) {
                        	callPlayer(player, 'paused', function(paused){
                                if (paused) {
                                    pub("pause", curTime);
                                    callPlayer(player, 'pause');
                                } else if (!paused) {
                                	callPlayer(player, 'pause');
                                }
                        	});
                        }
                        time = curTime;
                    });
                }, 500);
            }
        });
    };

    var onPlayerReady =  function (playerIn) {
            //callPlayer(playerIn, 'play');
            //callPlayer(playerIn, 'pause');
            keepSync(playerIn);
        };
        
    // Should be bound to the Vimeo player `onStateChange` event.
    var onPlayerStateChange = function (player, state) {
    	    //var oldestPubEvent = pubIncomingEventQueue.size() > 0 ? pubIncomingEventQueue.get(0) : null;
    	    var oldestPubEvent = pubIncomingEventQueue.shift();
    	    if (oldestPubEvent) {
    	    	debugOut("In processing " + state + ", found pub event: " + oldestPubEvent + ", so not publishing.");
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
        var PAUSE = 2;
        var SEEK = 3;
        
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

