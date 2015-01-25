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
        
        var getAgentWatermarkName = function(agentId, callback) {
            lib.safeFindOne(app.collection.agent, {'_id': ObjectID(agentId)}, function (agent) {
                callback("logo.jpg");
            });
        };
        
        var findPresetById = function(presetId, callback) {
            transcoder.readPreset({
                Id: presetId
            }, function(err, preset) {
                callback(preset);
            });  
        };
        
        var findPresetByName = function(presetName, callback) {
            transcoder.listPresets({
                Ascending: 'false'
                // PageToken: 'STRING_VALUE'
            }, function(err, data) {
                if (data) {
                    var presets = data.Presets;
                    console.log("found presets: " + presets.length);
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
        
        var createWatermarkPresetFromBaseline = function(presetName, callback) {
            findPresetById('1422061863164-aap2z3', function(fdata) {
                if (fdata) {
                    var preset = fdata.Preset;
                    delete preset.Id;
                    delete preset.Arn;
                    delete preset.Type;
                    preset.Description = 'preset for watermark settings';
                    preset.Name = presetName;
                    preset.Video.Watermarks = [{
                        Id: watermarkId,
                        HorizontalAlign: 'Right',
                        HorizontalOffset: '2%',
                        MaxHeight: '20%',
                        MaxWidth: '30%',
                        Opacity: '100',
                        SizingPolicy: 'Fit',
                        Target: 'Content',
                        VerticalAlign: 'Bottom',
                        VerticalOffset: '2%'
                    }];

                    transcoder.createPreset(preset, function(err, data) {
                        if (!err) {
                            callback(data.Preset.Id);
                        }
                        else {
                            console.log(err);
                        }
                    });
                }
            });
        };
        
        var getPresetForWatermark = function(forceCreation, callback) {
            // check to see if it exists
            var presetName = 'vv_tc_preset_watermark';
            findPresetByName(presetName, function(presetId) {
                if (forceCreation && presetId) {
                    // not implemented yet - delete existing and re-create.
                    transcoder.deletePreset({
                        Id: presetId
                    }, function(err, preset) {
                        if (!err) {
                            console.log("deleted and now recreating preset.");
                            createWatermarkPresetFromBaseline(presetName, callback);
                        }
                    }); 
                }
                else if (!presetId) {
                    // if not, create one with watermark using the current standard as a baseline
                    createWatermarkPresetFromBaseline(presetName, callback);
                }
                else {
                    console.log("found preset " + presetId);
                    callback(presetId);
                }
            });
            
            
        };
        
        return {
            transcode: function(agentId, videoId, onError) {
                getAgentWatermarkName(agentId, function(watermark){
                    getPresetForWatermark(true, function(presetName) {
                        console.log("transcoding: " + presetName);
                        transcoder.createJob(
                            {
                                PipelineId: '1419791970323-1aherg',
                                Input: {
                                    Key: videoId
                                },
                                Output: {
                                    Key: videoId + '.mp4',
                                    PresetId: presetName,
                                    Watermarks: [{
                                        InputKey: watermark,
                                        PresetWatermarkId: watermarkId
                                    }]
                                }
                            },
                            onError
                        );                    
                    });
                });
            }
        };
    }
};