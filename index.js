var express = require('express');
var mongodb = require('mongodb');
var bodyParser = require('body-parser');
var MongoClient = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');
var cookieParser = require('cookie-parser');
var fs = require('fs');
var multer = require('multer');
var AWS = require('aws-sdk');
var nodemailer = require('nodemailer');
var awsMailer = nodemailer.createTransport({
    service: 'SES',
    auth: {
        user: 'AKIAIZSWZHH37TQL4JSQ',
        pass: 'Al622BfthhR2gRePM54XjwpXS6mnDaf45SdbjOQJ+k7s'
    }
});


var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;


AWS.config.update({
    accessKeyId: 'AKIAJZUHGBIVMAN6BKSA',
    secretAccessKey: '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',
    region: 'us-east-1'
});

var app = express();
app.collection = {};

function saltedHash(original) {
    var salt = bcrypt.genSaltSync(10);
    var newHash = bcrypt.hashSync(original, salt);
    return newHash;
}

function renderWithUser(req, res, viewName, data) {
    if (!data) {
        data = {};
    }

    data.user = req.user; // always init
    res.render(viewName, data);
}

function isEmptyObject(obj) {
    return !Object.keys(obj).length;
}

function safeFindOne(collection, query, callback, next) {
    collection.findOne(query, function (err, result) {
        if (err) {
            next(err);
        }

        callback(result);
    })

}

function reportError(err) {
    if (!process.env.OPENSHIFT_NODEJS_IP) {
        console.log(err);
        console.log(err.stack);
    }
    else {
        awsMailer.sendMail({
            from: 'noreply@virtualvizzit.com',
            to: 'shikolay@gmail.com',
            subject: 'Virtualvizzit errors',
            text: JSON.stringify(err) + '\n' + err.stack
        }, function (email_err, info) {
            if (email_err) {
                console.log(email_err);
            }
        });
    }
}

app.set('trust proxy', true);

app.use(bodyParser.urlencoded({'extended': true}));
app.use(cookieParser());
app.use(session({
    secret: 'VizzitSessionSecret',
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
        url: mongoURI
    })
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
    done(null, user._id.toHexString());
});

passport.deserializeUser(function (id, done) {
    app.collection.agent.findOne({'_id': ObjectID(id)}, function (err, user) {
        done(err, user);
    });
});

passport.use(new LocalStrategy({
        usernameField: 'email'
    },
    function (email, password, done) {
        app.collection.agent.findOne({email: email}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, {message: 'Incorrect username.'});
            }
            if (!bcrypt.compareSync(password, user.passwordHash)) {
                return done(null, false, {message: 'Incorrect password.'});
            }
            return done(null, user);
        });
    }
));


app.use(express.static(__dirname + '/static'));

app.use(multer({
    dest: __dirname,
    limits: {
        fileSize: 1.5e9
    }
}));

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    renderWithUser(req, res, 'index');
});

app.get('/contactus', function (req, res) {
    renderWithUser(req, res, 'contactus');
});

app.get('/team', function (req, res) {
    renderWithUser(req, res, 'team', {noindex: true});
});

app.get('/useterms', function (req, res) {
    renderWithUser(req, res, 'useterms');
});

app.get('/beta_not_yet', function (req, res) {
    renderWithUser(req, res, 'not_yet_approved');
});

app.get('/early_adopter', function (req, res) {
    renderWithUser(req, res, 'early_adopter');
});

// The stuff below is to handle special pages for promotion to advisors.
// Dictionary key is the page name that is enabled and value is the formal name to use in the page.
// Can put in DB if needed over time.  Or in the future these will 
// likely not be needed once we are in the next phase.
var advisors = {
    'jen': 'Jennifer'
};

app.get('/advisor/:advname', function (req, res, next) {
    var advname = req.param('advname');
    if (advname && (advname in advisors)) {
        renderWithUser(req, res, 'advisor', {
            noindex: true,
            advisorFormalName: advisors[advname]
        });
    }
    else {
        res.redirect('/');
    }
});


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user && req.user.approved) {
            return next();
        }
        else {
            res.redirect('/beta_not_yet');
            return;
        }
    }
    res.redirect('/login');
}

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

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
                    renderWithUser(req, res, 'tour', {
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

app.get('/tour', ensureAuthenticated, function (req, res, next) {
    safeFindOne(app.collection.agent, {'_id': ObjectID(req.user._id.toHexString())}, function (agent) {
        if (agent.superuser && req.param('userid')) {
            // super-user is asking for another agent's contents
            safeFindOne(app.collection.agent, {'_id': ObjectID(req.param('userid'))}, function (agent_override) {
                processAgentTours(req, res, next, agent_override);
            }, next);
        }
        else {
            processAgentTours(req, res, next, agent);
        }
    }, next);
});

app.post('/tour', ensureAuthenticated, function (req, res, next) {
    var newProperty = {
        playerType: 'flowplayer',
        address: req.body['address'],
        agent: req.body['agent']
    };
    app.collection.property.insert(newProperty, function (err, dbProp) {
        if (err) {
            next(err);
        }

        if (req.files.videoFile) {
            var fileStream = fs.createReadStream(req.files.videoFile.path);
            fileStream.on('error', function (err) {
                if (err) {
                    reportError(err);
                }
            });
            fileStream.on('open', function () {
                var s3 = new AWS.S3();
                s3.putObject({
                    Bucket: 'vizzitupload',
                    Key: req.files.videoFile.name,
                    Body: fileStream
                }, function (err) {
                    if (err) {
                        reportError(err);
                    }

                    fs.unlink(req.files.videoFile.path, function (del_err) {
                        if (del_err) {
                            reportError(del_err);
                        }
                    });


                    var transcoder = new AWS.ElasticTranscoder();
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

function renderTourDetails(req, res, property, agent, isPresenting, allAgentProperties) {
    renderWithUser(req, res, 'tour_details', {
        property: property,
        mapQuery: property.address.split(' ').join('+'),
        agent: agent,
        allProperties: allAgentProperties,
        isPresenting: isPresenting,
        videoID: property.videoID || property._id
    });
}

app.get('/tour/:pid', function (req, res, next) {
    var pid = req.param('pid');
    if (pid.length >= 12) {
        safeFindOne(app.collection.property, {'_id': ObjectID(pid)}, function (property) {
            if (property) {
                safeFindOne(app.collection.agent, {'_id': ObjectID(property.agent)}, function (agent) {
                    var isPresenting = req.isAuthenticated() && agent._id.equals(req.user._id);
                    if (isPresenting) {
                        // Find and send in all agent's tours, to allow redirect
                        app.collection.property.find({'agent': agent._id.toHexString()}).toArray(
                            function (allprop_err, tours) {
                                if (allprop_err) {
                                    next(allprop_err);
                                }
                                renderTourDetails(req, res, property, agent, isPresenting, tours);
                            });
                    }
                    else {
                        renderTourDetails(req, res, property, agent, isPresenting, null);
                    }
                }, next);
            }
            else {
                res.status(404);
                renderWithUser(req, res, '404');
            }
        }, next);
    }
    else {
        res.status(404)
        renderWithUser(req, res, '404');
    }
});

function tourManageAction(req, res, next, actionFunc) {
    var pid = req.param('pid');
    safeFindOne(app.collection.property, {'_id': ObjectID(pid)}, function (property) {
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

app.get('/tour/:pid/del', ensureAuthenticated, function (req, res, next) {
    tourManageAction(req, res, next, function (property, pid) {
        app.collection.property.remove({'_id': ObjectID(pid)}, function () {
            res.redirect('/tour');
        });
    });
});

app.get('/tour/:pid/edit', ensureAuthenticated, function (req, res, next) {
    tourManageAction(req, res, next, function (property, pid) {
        renderWithUser(req, res, 'tour_edit', {tour: property});
    });
});

function processReqField(req, obj, fieldName, updatedFields, conditionFunc, setFunc) {
    var reqValue = req.body[fieldName];
    if (reqValue !== '' &&
        (!conditionFunc && reqValue !== obj[fieldName] ||
        conditionFunc && conditionFunc(obj, reqValue))) {
        if (!setFunc) {
            updatedFields[fieldName] = reqValue;
        }
        else {
            setFunc(updatedFields, reqValue);
        }
    }

}

app.post('/tour/:pid/edit', ensureAuthenticated, function (req, res, next) {
    tourManageAction(req, res, next, function (property, pid) {
        var updatedFields = {};
        processReqField(req, property, 'address', updatedFields);

        if (!isEmptyObject(updatedFields)) {
            app.collection.property.update({_id: ObjectID(pid)}, {'$set': updatedFields}, function (err, updatedProp) {
                if (err) {
                    next(err);
                }
                res.redirect('/tour');
            })
        }
        else {
            res.redirect('/tour');
        }
    });
});

app.post('/tour/:pid/share', ensureAuthenticated, function (req, res, next) {
    var reqEmail = req.body['email'];
    var pid = req.param('pid');
    awsMailer.sendMail({
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

app.get('/login', function (req, res) {
    renderWithUser(req, res, 'login');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/tour',
    failureRedirect: '/login'
}));

app.get('/resetpass', function (req, res) {
    renderWithUser(req, res, 'resetpass');
});

app.post('/resetpass', function (req, res, next) {
    var reqMail = req.body['email'];

    function generateRandomPass() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 5; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    safeFindOne(app.collection.agent, {email: reqMail}, function (agent) {
        if (agent) {
            var newPass = generateRandomPass();
            var newPassHash = saltedHash(newPass);
            app.collection.agent.update({'_id': agent._id}, {'$set': {'passwordHash': newPassHash}},
                function (err, upagent) {
                    if (err) {
                        next(err);
                    }

                    awsMailer.sendMail({
                        from: 'noreply@virtualvizzit.com',
                        to: reqMail,
                        subject: 'Virtualvizzit password reset',
                        text: 'Your new password: ' + newPass
                    }, function (err, info) {
                        if (err) {
                            next(err);
                        }
                    });

                    res.redirect('/login');
                });
        }
        else {
            res.redirect('/signup');
        }
    }, next);
});

app.get('/signup', function (req, res) {
    renderWithUser(req, res, 'signup');
});

app.post('/signup', function (req, res, next) {
    if (req.body['terms']) {
        safeFindOne(app.collection.agent, {email: req.body['email']}, function (user) {
            if (user) {
                res.redirect('/signup');
            }
            else {
                var hash = saltedHash(req.body['password']);
                app.collection.agent.insert({
                    email: req.body['email'],
                    name: req.body['name'],
                    phone: req.body['phone'],
                    agency: req.body['agency'],
                    photoURL: req.body['photoURL'],
                    passwordHash: hash,
                    superuser: false, // for now, every new user is NOT a super user unless manually changed in DB
                    approved: false // every user must be approved in order to access functions.  When not approved, 
                                    // we are just collecting them for future engagement.
                }, function (err, agent) {
                    if (err) {
                        next(err);
                    }

                    res.redirect('/login');
                });
            }
        }, next);
    }
    else {
        res.redirect('/signup');
    }
});

app.get('/profile', ensureAuthenticated, function (req, res) {
    renderWithUser(req, res, 'profile');
});

app.post('/profile', ensureAuthenticated, function (req, res, next) {
    var updatedFields = {};
    processReqField(req, req.user, 'name', updatedFields);
    processReqField(req, req.user, 'email', updatedFields);
    processReqField(req, req.user, 'phone', updatedFields);
    processReqField(req, req.user, 'agency', updatedFields);
    processReqField(req, req.user, 'photoURL', updatedFields);
    processReqField(req, req.user, 'password', updatedFields,
        function (user, reqPassword) {
            return !bcrypt.compareSync(reqPassword, user.passwordHash);
        },
        function (fields, reqPassword) {
            console.log("setting new password: " + reqPassword);
            var newHash = saltedHash(reqPassword);
            fields.passwordHash = newHash;
        }
    );

    if (!isEmptyObject(updatedFields)) { // $set does not like empty!
        app.collection.agent.update({_id: req.user._id}, {'$set': updatedFields}, function (err, updatedUser) {
            if (err) {
                next(err);
            }
            res.redirect('/profile');
        })
    }
    else {
        res.redirect('/profile');
    }
});

app.use(function (err, req, res, next) {
    reportError(err);
    res.status(500).render('500');
});

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }

    app.collection.property = db.collection('property');
    app.collection.agent = db.collection('agent');

    app.listen(port, ipaddress, function () {
        console.log('Vizzit app listening at port:%s', port)
    });
});
