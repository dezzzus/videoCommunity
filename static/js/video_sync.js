// Video playback sync

/**
 * For now, both viewer and presenter modes implementations are in one place.
 * In a way, it's easier to comprehend it that way, to see both sides in one place.
 * In the future, when it all works well, we can separate into common code and two subclasses.
 *
 * @param roomId
 * @param player
 * @param isPresenter
 */

/**
 * Main function handling all registrations.
 * Depends on vvzzt.pubnub namespace being initialized!
 */
function videoSync(player, isPresenter, onPresenterChange) {
    var userId = vvzzt.pubnub.userId;
    
    var myCurDate = new Date();
    // To GMT:
    var myTimestamp = new Date(myCurDate.valueOf() + myCurDate.getTimezoneOffset() * 60000).getTime();
    
    var gaTrackPlayerEvent = function (event) {
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
            	vvzzt.pubnub.pubnubPublish({
                    type: type,
                    presenterTS : myTimestamp
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
    var lastKnownPresenterTS = 0;

    var callPlayer = function (player, state, time) {
        playerEventCounter[state] += 1;
        player.api(state, time);
    };

    var onPlayerReady = function () {
        vvzzt.pubnub.pubnubSubscribe(function (m, fromMyself) {
            var presenterTS = m.presenterTS || -1;
            
            if (isPresenter) {
                // inform the caller that there is another presenter that is active!
                if (presenterTS != -1 && presenterTS > myTimestamp) {
                    if (onPresenterChange) {
                        onPresenterChange(presenterTS);
                        onPresenterChange = null; // Once is enough
                    }
                }
                return;
            }
            
            if (!fromMyself && 
                (presenterTS >= lastKnownPresenterTS)) {
                lastKnownPresenterTS = presenterTS;
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
                    player.api('paused', function (isPaused) {
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
                else if (m.type === 'redirect_tour') {
                    // alert("redirecting to: " + m.tour);
                    window.location.href = "/tour/" + m.tour;
                }
            }
        });
    };

    var publishWithProcessing = function (event, processFuncIfUser) {
        gaTrackPlayerEvent(event);
        if (publishIfUserEvent(event)) {
            if (processFuncIfUser) {
                processFuncIfUser();
            }
        }
    };

    var onPause = function (id) {
        publishWithProcessing('pause', function () {
            // was a user event, but not a presenter, so counter-act the user action.
            if (!isPresenter) {
                callPlayer(player, 'play');
            }
        });
    };

    var onPlay = function (id) {
        publishWithProcessing('play', function () {
            // was a user event, but not a presenter, so counter-act the user action.
            if (!isPresenter) {
                callPlayer(player, 'pause');
            }
        });
    };

    var onSeek = function (id) {
        publishWithProcessing('seek', function () {
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
        player.api('getCurrentTime', function (curPos) {
            player.api('paused', function (isPaused) {
                // If this is the presenter, and either enough position changed or state changed, publish!
                if (isPresenter &&
                    (Math.abs(curPos - lastKnownPresenterPosition) > .5 || isPaused != lastKnownMyPaused)) {
                	vvzzt.pubnub.pubnubPublish({
                        type: 'presenterHeartbeat',
                        presenterTS : myTimestamp,
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

