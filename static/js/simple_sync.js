SimpleSync = function (options) {
    var self = this;
    this.channel = options.channel;
    this.playMessageHandler = options.playMessageHandler;
    this.uuid = PUBNUB.uuid();

    var pubnub = PUBNUB.init({
        publish_key: 'pub-c-4dd374dc-c46a-40ee-9bbf-488f4f7449ef',
        subscribe_key: 'sub-c-170d058e-8726-11e4-a400-02ee2ddab7fe',
        uuid: this.uuid
    });

    this.publishPlay = function () {
        pubnub.publish({
            channel: this.channel,
            message: {
                event: 'play',
                uuid: this.uuid
            }
        });
    };

    pubnub.subscribe({
        channel: this.channel,
        message: function (m) {
            if (m.uuid == self.uuid) {
                return false;
            }
            if (m.event == 'play') {
                self.playMessageHandler(m);
            }
        }
    });

};

