/**
 * This module is for handling AWS transcoding, which has some complexity due to watermarks.
 */
var lib = require('./lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;

module.exports = {
    getTranscoderFunctions: function (app) {
        var watermarkId = 'vv_watermark_id';
        var transcoder = new app.AWS.ElasticTranscoder();

        var getAgentWatermarkName = function(agentId, callback, next) {
            lib.safeFindOne(app.collection.agent, {'_id': ObjectID(agentId)}, function (agent) {
                callback(agent.logoFileId);
            }, next);
        };

        /**
         * Find most recent preset with a given name.
         */
        var findPresetByName = function(presetName, callback) {
            transcoder.listPresets({
                Ascending: 'false'
            }, function(err, data) {
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

        var getPresetForWatermark = function(callback, onError) {
            var presetName = 'vv-preset-med-logo';
            findPresetByName(presetName, function(presetId) {
                if (!presetId) {
                    onError('no preset found: ' + presetName);
                }
                else {
                    callback(presetId);
                }
            });
        };

        return {
            transcode: function(agentId, videoId, onError, next) {
                getAgentWatermarkName(agentId, function(watermarkName) {

                    var forcePresetRecreation = false; // Set to true if playing with watermark settings

                    getPresetForWatermark(function(presetName) {
                        watermarks = [];
                        if (watermarkName && watermarkName !== '') {
                            watermarks.push({
                                InputKey: watermarkName,
                                PresetWatermarkId: watermarkId
                            });
                        }

                        transcoder.createJob(
                            {
                                PipelineId: '1490069281841-3vzlky',
                                Input: {
                                    Key: videoId
                                },
                                Output: {
                                    Key: videoId + '.mp4',
                                    PresetId: presetName,
                                    Watermarks: watermarks,
                                    ThumbnailPattern : videoId + "-thumb-{count}"
                                }
                            },
                            onError
                        );
                    }, onError);
                }, next);
            }
        };
    }
};