/**
 * This module is for handling AWS transcoding
 */
var lib = require('./lib');


module.exports = {
    getTranscoderFunctions: function (app) {
        var transcoder = new app.AWS.ElasticTranscoder();

        /**
         * Find most recent preset with a given name.
         */
        var findPresetByName = function (presetName, callback) {
            transcoder.listPresets({
                Ascending: 'false'
            }, function (err, data) {
                if (data) {
                    var presets = data.Presets;
                    for (var ii = 0; ii < presets.length; ii++) {
                        if (presets[ii].Name === presetName) {
                            callback(presets[ii].Id);
                            return;
                        }
                    }
                }

                callback(null);
            });
        };

        return {
            transcode: function (videoId, onError, next) {
                var presetName = 'vv-current-preset';
                findPresetByName(presetName, function (presetId) {
                    if (!presetId) {
                        onError('no preset found: ' + presetName);
                    }
                    else {
                        transcoder.createJob(
                            {
                                PipelineId: '1419791970323-1aherg',
                                Input: {
                                    Key: videoId
                                },
                                Output: {
                                    Key: videoId + '.mp4',
                                    PresetId: presetId,
                                    ThumbnailPattern: videoId + "-thumb-{count}"
                                }
                            },
                            onError
                        );
                    }
                });
            }
        };
    }
};