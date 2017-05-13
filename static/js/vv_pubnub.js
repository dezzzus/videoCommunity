/**
 * Single place for Pubnub integration
 */

/**
 * Global namespace for easier access
 */
var vvzzt = vvzzt || {};
vvzzt.pubnub = vvzzt.pubnub || {};
vvzzt.pubnub.userId = PUBNUB.uuid();
vvzzt.pubnub.allSubCallbacks = [];
vvzzt.pubnub.subscribed = false;

/**
 * Somewhat lazy init:
 */
vvzzt.pubnub.init = function() {
    // support 'lazy':
    if (!vvzzt.pubnub.roomId) {
        vvzzt.pubnub.roomId = vv_pubnub_room_id;
        vvzzt.pubnub.pubnub = PUBNUB.init({
            publish_key: 'pub-c-12a6b0b0-a153-4f54-acb1-f275eace11a2',
            subscribe_key: 'sub-c-07093d7c-368a-11e7-9843-0619f8945a4f',
            uuid: vvzzt.pubnub.userId
        });
    }
};


vvzzt.pubnub.pubnubPublish = function (message, onSuccess) {
    vvzzt.pubnub.init();
    
    message.sender = vvzzt.pubnub.userId;
    message.recipient = '';
    vvzzt.pubnub.pubnub.publish({
        channel: vvzzt.pubnub.roomId,
        message: message
    });
    
    // For now, always success, assume pubnub did not fail.
    if (onSuccess) {
        onSuccess();
    }
};

vvzzt.pubnub.pubnubSubscribe = function (callback) {
    vvzzt.pubnub.init();
    
    // Seems like only one subscribe is supported in some browsers, so collect callbacks here instead
    vvzzt.pubnub.allSubCallbacks.push(callback);
    
    if (vvzzt.pubnub.pubnub && !vvzzt.pubnub.subscribed) {
        vvzzt.pubnub.subscribed = true;
        vvzzt.pubnub.pubnub.subscribe({
            channel: vvzzt.pubnub.roomId,
            callback: function(m) {
                var isFromMyself = m.sender === vvzzt.pubnub.userId;
                jQuery.each(vvzzt.pubnub.allSubCallbacks, function(i, cb) {cb(m, isFromMyself);});
            }
        });
    }
};



