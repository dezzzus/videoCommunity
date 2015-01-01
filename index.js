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
var path = require('path');
var multer = require('multer')
var AWS = require('aws-sdk');

var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var port = process.env.PORT || 3000;

AWS.config.update({
    accessKeyId: 'AKIAJZUHGBIVMAN6BKSA',
    secretAccessKey: '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',
    region: 'us-east-1'
});

var app = express();
app.collection = {};

function wwwRedirect(req, res, next) {
    if (req.headers.host.slice(0, 4) === 'www.') {
        var newHost = req.headers.host.slice(4);
        return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
    }
    next();
}

function renderWithUser(req, res, viewName, data) {
    if (!data) {
        data = {};
    }

    data.user = null; // always init

    if (req.user) {
        app.collection.agent.findOne({'_id': ObjectID(req.user._id.toHexString())}, function (err, agent) {
            data.user = agent;
            res.render(viewName, data);
        });
    }
    else {
        res.render(viewName, data);
    }
}

app.set('trust proxy', true);
app.use(wwwRedirect);

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

if (process.env.TEMP_DIR) {
    app.use(multer({dest: process.env.TEMP_DIR}));
}
else {
    app.use(multer({dest: __dirname}));
}

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    renderWithUser(req, res, 'index');
});

app.get('/contactus', function (req, res) {
    renderWithUser(req, res, 'contactus');
});

app.get('/useterms', function (req, res) {
    renderWithUser(req, res, 'useterms');
});


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

function processAgentTours(req, res, agent) {
    app.collection.property.find({'agent': agent._id.toHexString()}).toArray(
        function (err, tours) {
            // A little wasteful to find all if it turns out that the current can only see itself
            app.collection.agent.find().toArray(
                function (err, agents) {
                    renderWithUser(req, res, 'tour', {
                        tours: tours,
                        agent: agent,
                        agents: agent.superuser ? agents : [agent]
                    });
                }
            );
        }
    );
}

app.get('/tour', ensureAuthenticated, function (req, res) {
    app.collection.agent.findOne({'_id': ObjectID(req.user._id.toHexString())}, function (err, agent) {
        if (agent.superuser && req.param('userid')) {
            // super-user is asking for another agent's contents
            app.collection.agent.findOne({'_id': ObjectID(req.param('userid'))}, function (err, agent_override) {
                processAgentTours(req, res, agent_override);
            });
        }
        else {
            processAgentTours(req, res, agent);
        }
    });
});

app.post('/tour', ensureAuthenticated, function (req, res) {
    var newProperty = {
        playerType: 'flowplayer',
        address: req.body['address'],
        agent: req.body['agent']
    };
    app.collection.property.insert(newProperty, function (err, dbProp) {
        if (err) {
            console.log('DB err' + err);
        }

        if (req.files.videoFile) {
            var fileStream = fs.createReadStream(req.files.videoFile.path);
            fileStream.on('error', function (err) {
                if (err) {
                    throw err;
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
                        throw err;
                    }

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
                                throw err;
                            }
                        }
                    );
                });
            });
        }
    });
    res.redirect('/tour');
});

app.get('/tour/:pid', function (req, res) {
    var pid = req.param('pid');
    app.collection.property.findOne({'_id': ObjectID(pid)}, function (err, property) {
        app.collection.agent.findOne({'_id': ObjectID(property.agent)}, function (err, agent) {
            renderWithUser(req, res, 'tour_details', {
                property: property,
                mapQuery: property.address.split(' ').join('+'),
                agent: agent,
                isPresenting: req.isAuthenticated()
            });

        });
    });
});

app.get('/tour/:pid/del', ensureAuthenticated, function (req, res) {
    var pid = req.param('pid');
    app.collection.property.findOne({'_id': ObjectID(pid)}, function (err, property) {
        if (err) {
            throw err;
        }
        if (property) {
            if (req.user._id.toHexString() == property.agent) {
                app.collection.property.remove({'_id': ObjectID(pid)}, function () {
                    res.redirect('/tour');
                });
            }
            else {
                res.redirect('/tour');
            }
        }
        else {
            res.redirect('/tour');
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

app.get('/signup', function (req, res) {
    renderWithUser(req, res, 'signup');
});

app.post('/signup', function (req, res) {
    if (req.body['terms']) {
        app.collection.agent.findOne({email: req.body['email']}, function (err, user) {
            if (err) {
                throw err;
            }
            if (user) {
                res.redirect('/signup');
            }
            else {
                var salt = bcrypt.genSaltSync(10);
                var hash = bcrypt.hashSync(req.body['password'], salt);
                app.collection.agent.insert({
                    email: req.body['email'],
                    name: req.body['name'],
                    agency: req.body['agency'],
                    photoURL: req.body['photoURL'],
                    passwordHash: hash,
                    superuser: false // for now, every new user is NOT a super user unless manually changed in DB
                }, function (err, agent) {
                    if (err) {
                        throw err;
                    }

                    res.redirect('/login');
                });
            }
        });
    }
    else {
        res.redirect('/signup');
    }
});

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) throw dbErr;

    app.collection.property = db.collection('property');
    app.collection.agent = db.collection('agent');

    app.listen(port, function () {
        console.log('Vizzit app listening at port:%s', port)
    });
});

