var lib = require('../lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;

exports.addTourRoutes = function (app) {
    function processAgentTours(req, res, next, agent) {
        app.collection.property.find({'agent': agent._id.toHexString()}).toArray(
            function (err, tours) {
                if (err) {
                    next(err);
                    return false;
                }
                app.collection.agent.find().toArray(
                    function (agent_err, agents) {
                        if (agent_err) {
                            next(agent_err);
                            return false;
                        }
                        res.render('tour', {
                            tours: tours.sort(function (a, b) {
                                return a.address.localeCompare(b.address);
                            }),
                            agent: agent,
                            agents: agent.superuser ? agents : [agent]
                        });
                    }
                );
            }
        );
    }

    app.get('/tour', lib.ensureAuthenticated, function (req, res, next) {
        lib.safeFindOne(app.collection.agent, {'_id': ObjectID(req.user._id.toHexString())}, function (agent) {
            if (agent.superuser && req.param('userid')) {
                // super-user is asking for another agent's contents
                lib.safeFindOne(app.collection.agent, {'_id': ObjectID(req.param('userid'))}, function (agent_override) {
                    processAgentTours(req, res, next, agent_override);
                }, next);
            }
            else {
                processAgentTours(req, res, next, agent);
            }
        }, next);
    });

    app.post('/tour', lib.ensureAuthenticated, function (req, res, next) {
        var newProperty = {
            playerType: 'flowplayer',
            address: req.body['address'],
            agent: req.body['agent'],
            note: req.body['note']
        };
        app.collection.property.insert(newProperty, function (err, dbProp) {
            if (err) {
                next(err);
            }

            if (req.files.videoFile) {
                var fileStream = app.fs.createReadStream(req.files.videoFile.path);
                fileStream.on('error', function (err) {
                    if (err) {
                        reportError(err);
                    }
                });
                fileStream.on('open', function () {
                    var s3 = new app.AWS.S3();
                    s3.putObject({
                        Bucket: 'vizzitupload',
                        Key: req.files.videoFile.name,
                        Body: fileStream
                    }, function (err) {
                        if (err) {
                            reportError(err);
                        }

                        app.fs.unlink(req.files.videoFile.path, function (del_err) {
                            if (del_err) {
                                reportError(del_err);
                            }
                        });


                        var transcoder = new app.AWS.ElasticTranscoder();
                        transcoder.createJob(
                            {
                                PipelineId: '1419791970323-1aherg',
                                Input: {
                                    Key: req.files.videoFile.name
                                },
                                Output: {
                                    Key: dbProp[0]._id.toHexString() + '.mp4',
                                    PresetId: '1351620000001-100070'
                                }
                            },
                            function (err) {
                                if (err) {
                                    reportError(err);
                                }
                            }
                        );

                        transcoder.createJob(
                            {
                                PipelineId: '1419791970323-1aherg',
                                Input: {
                                    Key: req.files.videoFile.name
                                },
                                Output: {
                                    Key: dbProp[0]._id.toHexString() + '.webm',
                                    PresetId: '1420142016747-83m02n'
                                }
                            },
                            function (err) {
                                if (err) {
                                    reportError(err);
                                }
                            }
                        );
                    });
                });
            }
        });
        res.redirect('/tour');
    });

    function renderDetails(templateName, res, property, agent,
                           isAgent, allAgentProperties, leadID, agentInteractive) {
        res.render(templateName, {
            property: property,
            mapQuery: property.address.split(' ').join('+'),
            agent: agent,
            allProperties: allAgentProperties,
            isAgent: isAgent,
            videoID: property.videoID || property._id,
            leadID: leadID || null,
            leadHeartbeatInterval: app.leadHeartbeatInterval || null,
            agentInteractive: agentInteractive
        });
    }

    function handlePropertyDetails(req, res, next, templateName, alwaysInteractive) {
        var leadID = req.param('lead');
        var agentInteractive = alwaysInteractive || !!leadID;
        var pid = req.param('pid');
        if (pid.length >= 12) {
            lib.safeFindOne(app.collection.property, {'_id': ObjectID(pid)}, function (property) {
                if (property) {
                    lib.safeFindOne(app.collection.agent, {'_id': ObjectID(property.agent)}, function (agent) {
                        var isAgent = req.isAuthenticated() && agent._id.equals(req.user._id);
                        if (isAgent) {
                            // Find and send in all agent's tours, to allow redirect
                            app.collection.property.find({'agent': agent._id.toHexString()}).toArray(
                                function (allprop_err, tours) {
                                    if (allprop_err) {
                                        next(allprop_err);
                                    }
                                    renderDetails(templateName, res, property, agent,
                                        isAgent, tours, leadID, agentInteractive);
                                });
                        }
                        else {
                            renderDetails(templateName, res, property, agent, isAgent, null, leadID,
                                agentInteractive);
                        }
                    }, next);
                }
                else {
                    res.status(404).render('404');
                }
            }, next);
        }
        else {
            res.status(404).render('404');
        }
    }

    app.get('/tour/:pid', function (req, res, next) {
        handlePropertyDetails(req, res, next, 'tour_details', true);
    });

    app.get('/video/:pid', function (req, res, next) {
        handlePropertyDetails(req, res, next, 'video', false);
    });

    app.get('/video_lead/:pid', lib.ensureAuthenticated, function (req, res, next) {
        handlePropertyDetails(req, res, next, 'video', false);
    });


    function tourManageAction(req, res, next, actionFunc) {
        var pid = req.param('pid');
        lib.safeFindOne(app.collection.property, {'_id': ObjectID(pid)}, function (property) {
            if (property) {
                if (req.user._id.toHexString() == property.agent) {
                    actionFunc(property, pid);
                }
                else {
                    res.redirect('/tour');
                }
            }
            else {
                res.redirect('/tour');
            }
        }, next);
    }

    app.get('/tour/:pid/del', lib.ensureAuthenticated, function (req, res, next) {
        tourManageAction(req, res, next, function (property, pid) {
            app.collection.property.remove({'_id': ObjectID(pid)}, function () {
                res.redirect('/tour');
            });
        });
    });

    app.get('/tour/:pid/edit', lib.ensureAuthenticated, function (req, res, next) {
        tourManageAction(req, res, next, function (property, pid) {
            res.render('tour_edit', {tour: property});
        });
    });

    app.post('/tour/:pid/edit', lib.ensureAuthenticated, function (req, res, next) {
        tourManageAction(req, res, next, function (property, pid) {
            var updatedFields = {};
            lib.processReqField(req, property, 'address', updatedFields);

            if (!lib.isEmptyObject(updatedFields)) {
                app.collection.property.update({_id: ObjectID(pid)}, {'$set': updatedFields}, function (err, updatedProp) {
                    if (err) {
                        next(err);
                    }
                    res.redirect('/tour');
                });
            }
            else {
                res.redirect('/tour');
            }
        });
    });

    app.post('/tour/:pid/share', lib.ensureAuthenticated, function (req, res, next) {
        var reqEmail = req.body['email'];
        var pid = req.param('pid');
        app.awsMailer.sendMail({
            from: 'noreply@virtualvizzit.com',
            to: reqEmail,
            subject: 'VirtualVizzit tour invitation',
            text: req.user.name + ' invited you to see virtual tour:\n http://virtualvizzit.com/tour/' + pid
        }, function (err, info) {
            if (err) {
                next(err);
            }
            else {
                res.send({'status': 'OK'});
            }
        });

    });

};