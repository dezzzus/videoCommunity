function SyncWrapper(flowplayer) {
    var self = this;
    this.flplayer = flowplayer;

    this.executeEnsureEnabled = function(func) {
        var disabled = self.flplayer.disabled;
        if (disabled) {
            self.flplayer.disable(false);
        }
        
        func();
        
        if (disabled) {
            self.flplayer.disable(true);
        }
    };

    this.api = function (state, data) {
        if (state == 'play') {
            self.executeEnsureEnabled(self.flplayer.resume);
        }
        if (state == 'pause') {
            self.executeEnsureEnabled(self.flplayer.pause);
        }
        if (state == 'seekTo') {
            self.flplayer.seek(data);
        }
        if (state == 'paused') {
            data(self.flplayer.paused);
        }
        if (state == 'getCurrentTime') {
            data(self.flplayer.video.time);
        }
    };

    this.addEvent = function (eventname, handler) {
        if (eventname == 'ready') {
            self.flplayer.bind('ready', function () {
                handler();
            });
        }

        if (eventname == 'play') {
            self.flplayer.bind('resume', function () {
                handler();
            });
        }

        if (eventname == 'pause') {
            self.flplayer.bind('pause', function () {
                handler();
            });
        }

        if (eventname == 'seek') {
            self.flplayer.bind('seek', function () {
                handler();
            });
        }
    };

}