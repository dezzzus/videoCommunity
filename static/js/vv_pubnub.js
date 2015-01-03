/**
 * Single place for Pubnub integration
 */

/**
 * Global namespace for easier access
 */
var vvzzt = vvzzt || {};
vvzzt.pubnub = vvzzt.pubnub || {};
vvzzt.pubnub.userId = PUBNUB.uuid();

/**
 * Somewhat lazy init:
 */
vvzzt.pubnub.init = function(roomId) {
	vvzzt.pubnub.roomId = roomId;
	vvzzt.pubnub.pubnub = PUBNUB.init({
	    publish_key: 'pub-c-4dd374dc-c46a-40ee-9bbf-488f4f7449ef',
	    subscribe_key: 'sub-c-170d058e-8726-11e4-a400-02ee2ddab7fe',
	    uuid: vvzzt.pubnub.userId
	});
};


vvzzt.pubnub.pubnubPublish = function (message) {
    message.sender = vvzzt.pubnub.userId;
    message.recipient = '';
    vvzzt.pubnub.pubnub.publish({
        channel: vvzzt.pubnub.roomId,
        message: message
    });
};

vvzzt.pubnub.pubnubSubscribe = function (callback) {
	if (vvzzt.pubnub.pubnub) {
		vvzzt.pubnub.pubnub.subscribe({
	        channel: vvzzt.pubnub.roomId,
	        callback: callback
		});
	}
};



