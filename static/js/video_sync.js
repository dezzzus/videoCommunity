// Vimeo playback sync

/**
 * For now, both viewer and presenter modes implementations are in one place.
 * In a way, it's easier to comprehend it that way, to see both sides in one place.
 * In the future, when it all works well, we can separate into common code and two subclasses.
 * 
 * @param roomId
 * @param player
 * @param isPresenter
 */
function videoSync(roomId, player, isPresenter) {
    var userId = PUBNUB.uuid();

    var pubnub = PUBNUB.init({
        publish_key: 'pub-c-4dd374dc-c46a-40ee-9bbf-488f4f7449ef',
        subscribe_key: 'sub-c-170d058e-8726-11e4-a400-02ee2ddab7fe',
        uuid: userId
    });

    var pubnubPublish = function(message) {
    	message.sender = userId;
    	message.recipient = '';
        pubnub.publish({
            channel: roomId,
            message: message
        });    	
    };
    
    var gaTrackPlayerEvent = function(event) {
        _gaq.push(['_trackEvent',
                   'player',
                   event,
                   String(isPresenter)
                ]);
    };
    
    /**
     * If this is a presenter instance, and the event was user generated, publishes the event.
     * returns whether this was a user event.
     */
    var publishIfUserEvent = function (type) {
    	var wasUserEvent = false;
    	
        if (playerEventCounter[type] == 0) {
        	if (isPresenter) {
        		pubnubPublish({
                    type: type
                });
        	}
            wasUserEvent = true;
        }
        else {
            playerEventCounter[type] -= 1;
            wasUserEvent = false;
        }
        
        return wasUserEvent;
    };

    var playerEventCounter = {
        play: 0,
        pause: 0,
        seekTo: 0
    };
    
    var lastKnownMyPosition = 0;
    var lastKnownMyPaused = false;
    var lastKnownPresenterPosition = 0;
    var lastKnownPresenterWasPlaying = false;

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
                    else if (m.type === 'play') {
                        callPlayer(player, 'play');
                    }
                    else if (m.type === 'presenterHeartbeat') {
                    	// First sync the clock if off by more than 1 second
                    	if (Math.abs(lastKnownMyPosition - m.position) > 1) {
                    		callPlayer(player, 'seekTo', m.position);
                    	}
                    	
                    	// Now sync the state
                		player.api('paused', function(isPaused) {
                        	if (!isPaused && !m.isPlaying) {
                        		callPlayer(player, 'pause');
                        	}
                        	else if (isPaused && m.isPlaying) {
                        		callPlayer(player, 'play');
                        	}                    	
                		});	
                    }
                    else if (m.type === 'seek') {
                    	// Not supporting seek at the moment. 
                    	// Relying on the heartbeat instead.  It is simpler that way, at least for now.
                    }
                }
            }
        });
    };

    var publishWithProcessing = function(event, processFuncIfUser) {
        gaTrackPlayerEvent(event);
        if (publishIfUserEvent(event)) {
            if (processFuncIfUser) {
                processFuncIfUser();
            }
        }
    };
    
    var onPause = function (id) {
        publishWithProcessing('pause', function() {
            // was a user event, but not a presenter, so counter-act the user action.
            if (!isPresenter) {
                callPlayer(player, 'play');
            }
        });
    };

    var onPlay = function (id) {
        publishWithProcessing('play', function() {
            // was a user event, but not a presenter, so counter-act the user action.
            if (!isPresenter) {
                callPlayer(player, 'pause');
            }
        });
    };
    
    var onSeek = function (id) {
        publishWithProcessing('seek', function() {
            // was a user event, but not a presenter, so counter-act the user action.
            if (!isPresenter) {
                callPlayer(player, 'seekTo', lastKnownPresenterPosition);
                // make sure keeps playing or pausing
                callPlayer(player, lastKnownPresenterWasPlaying ? 'play' : 'pause');
            }
        });
    };
                
    player.addEvent('ready', function () {
        player.addEvent('pause', onPause);
        player.addEvent('play', onPlay);
        player.addEvent('seek', onSeek);
        onPlayerReady();
    });
    
    /**
     * 
     * Publish presenter heartbeat every second or so, if anything changes
     * In addition, this also serves important function of maintaining my own position record, whether I am presenter or viewer
     */
    var z = setInterval(function () {
    	player.api('getCurrentTime', function(curPos) {
    		player.api('paused', function(isPaused) {
    			// If this is the presenter, and either enough position changed or state changed, publish!
    	    	if (isPresenter && 
    	    			(Math.abs(curPos - lastKnownPresenterPosition) > .5 || isPaused != lastKnownMyPaused)) {
            		pubnubPublish({
                        type: 'presenterHeartbeat',
                        position: curPos,
                        isPlaying: !isPaused
                    });
    	    	}
    	    	lastKnownMyPaused = isPaused;
    	    	lastKnownPresenterPosition = curPos;
    		});	
    		lastKnownMyPosition = curPos;
    	});
    }, 1000);

}

