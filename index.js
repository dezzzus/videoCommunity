var express = require('express');
var mongodb = require('mongodb');
var bodyParser = require('body-parser');
var MongoClient = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');
var cookieParser = require('cookie-parser');
var lib = require('./lib');
var tourController = require('./controllers/tours');
var nodemailer = require('nodemailer');
var aws_transcoder = require('./aws_transcode.js');
var Busboy = require('busboy');
var backup = require('mongodb-backup');

var mongoURI = 'mongodb://admin:66pM9A398qY9UdxL@cluster0-shard-00-00-tmrfr.mongodb.net:27017,cluster0-shard-00-01-tmrfr.mongodb.net:27017,cluster0-shard-00-02-tmrfr.mongodb.net:27017/tour?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';
var port = process.env.VCAP_APP_PORT || 3000;

var usePhotoFileInsteadOfURL = true;
var upload_youtube = require('./scripts/upload_youtube');

var app = express();
app.collection = {};
app.fs = require('fs');

app.AWS = require('aws-sdk');
app.AWS.config.update({
    accessKeyId: 'AKIAJBIBF4XSPP2F7OQQ',
    secretAccessKey: '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',
    region: 'us-east-1'
});
app.awsMailer = nodemailer.createTransport({
    service: 'SES',
    auth: {
        user: 'AKIAJOTCJD56LQPNX5EA',
        pass: 'AnubT6ISxxXBv2fGMpXrmUOzgbFy9fZkPqplle9UgadE'
    }
});
app.s3Stream = require('s3-upload-stream')(new app.AWS.S3());

app.transcoder = aws_transcoder.getTranscoderFunctions(app);

function saltedHash(original) {
    var salt = bcrypt.genSaltSync(10);
    var newHash = bcrypt.hashSync(original, salt);
    return newHash;
}

app.set('trust proxy', true);

app.use(bodyParser.urlencoded({'extended': true}));
app.use(cookieParser());
app.use(session({
    secret: 'VizzitSessionSecret',
    resave: false,
    saveUninitialized: false,
    store: new RedisStore({
        host: 'redis-18881.c9.us-east-1-2.ec2.cloud.redislabs.com',
        port: 18881,
        ttl: 3600,
        //pass: 'tizziv'
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
        app.collection.agent.findOne({email: email.toLowerCase()}, function (err, user) {
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
app.use(express.static(__dirname + '/bower_components'));

app.use(function (req, res, next) {
    if (req.user) {
        app.locals.user = req.user;
    }
    else {
        app.locals.user = null;
    }
    next();
});

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('index', {bAuth: req.bAuth});
});

app.get('/contactus', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('contactus', {bAuth: req.bAuth});
});

app.get('/team', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('team', {noindex: true, bAuth: req.bAuth});
});

app.get('/useterms', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('useterms', {bAuth: req.bAuth});
});

app.get('/early_adopter', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('early_adopter', {bAuth: req.bAuth});
});


app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

tourController.addTourRoutes(app);

app.get('/login', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('login', {bAuth: req.bAuth});
});

app.post('/login', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
        if (err) {
            return next(err);
        }
        // Redirect if it fails
        if (!user) {
            return res.redirect('/login');
        }
        req.logIn(user, function (err) {
            if (err) {
                return next(err);
            }

            // Redirect if it succeeds
            return res.redirect(req.session.returnTo || '/tour');
        });
    })(req, res, next);
});


app.get('/resetpass', function (req, res) {
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('resetpass', {bAuth: req.bAuth});
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

    lib.safeFindOne(app.collection.agent, {email: reqMail}, function (agent) {
        if (agent) {
            var newPass = generateRandomPass();
            var newPassHash = saltedHash(newPass);
            app.collection.agent.update({'_id': agent._id}, {'$set': {'passwordHash': newPassHash}},
                function (err, upagent) {
                    if (err) {
                        next(err);
                    }

                    app.awsMailer.sendMail({
                        from: 'info@virtualvizzit.com',
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
    req.bAuth = false;
    if (req.isAuthenticated()) {
        req.bAuth = true;
    }
    res.render('signup', {usePhotoFile: usePhotoFileInsteadOfURL, bAuth: req.bAuth});
});

var createBusboyForAgent = function (req, res, next) {
    var busboy = new Busboy({headers: req.headers});
    busboy.currentAgent = {}; // safer to keep here than in session

    busboy.on('file', function (fieldname, file, filename) {
        if (fieldname !== 'photoFile' && fieldname !== 'logoFile') {
            next(new Error('unknown file field in agent: ' + fieldname));
            return;
        }

        var photoFileType = fieldname + 'Id';
        var photoFileName = !filename || filename === '' ?
            '' : photoFileType + lib.randomInt(10000, 99999) + Date.now() + filename.toLowerCase();
        busboy.currentAgent[photoFileType] = photoFileName;

        var upload = app.s3Stream.upload({
            Bucket: fieldname === 'photoFile' ? 'vizzitvideo' : 'vizzitupload',
            Key: photoFileName
        });

        upload.on('error', function (err) {
            if (err) {
                next(err);
            }
        });

        file.pipe(upload);
    });

    busboy.on('field', function (fieldname, val) {
        busboy.currentAgent[fieldname] = val;
    });
    return busboy;
};

app.post('/signup', function (req, res, next) {
    var busboy = createBusboyForAgent(req, res, next);
    busboy.on('finish', function () {
        if (!busboy.currentAgent['terms']) {
            res.redirect('/signup');
        }
        else {
            lib.safeFindOne(app.collection.agent, {email: busboy.currentAgent['email'].toLowerCase()}, function (user) {
                if (user) {
                    res.redirect('/signup');
                }
                else {
                    var hash = saltedHash(busboy.currentAgent['password']);
                    app.collection.agent.insert({
                        email: busboy.currentAgent['email'].toLowerCase(),
                        name: busboy.currentAgent['name'],
                        phone: busboy.currentAgent['phone'],
                        agency: busboy.currentAgent['agency'],
                        photoFileId: busboy.currentAgent['photoFileId'],
                        photoURL: req.body['photoURL'],
                        logoFileId: busboy.currentAgent['logoFileId'],
                        passwordHash: hash,
                        superuser: false, // new user is NOT a super user unless manually changed in DB
                        creationDate: new Date() // for ease of tracking
                    }, function (err, agent) {
                        if (err) {
                            next(err);
                        }

                        res.redirect('/login');
                    });
                }
            }, next);
        }
    });

    return req.pipe(busboy);
});

app.get('/profile', lib.ensureAuthenticated, function (req, res) {
    lib.fixupAgentPhotoURL(req.user);
    res.render('profile', {usePhotoFile: usePhotoFileInsteadOfURL, bAuth: req.bAuth});
});

app.post('/upload_youtube', lib.ensureAuthenticated, function (req, res, next) {
    upload_youtube (app.collection.property, app.collection.agent, req.body);
    return res.json({uploading: "successed!"});
});

app.post('/profile', lib.ensureAuthenticated, function (req, res, next) {
    var busboy = createBusboyForAgent(req, res, next);
    busboy.on('finish', function () {
        var updatedFields = {};
        lib.processReqField(busboy.currentAgent, req.user, 'name', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'email', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'phone', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'agency', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'photoFileId', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'photoURL', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'logoFileId', updatedFields);
        lib.processReqField(busboy.currentAgent, req.user, 'password', updatedFields,
            function (user, reqPassword) {
                return !bcrypt.compareSync(reqPassword, user.passwordHash);
            },
            function (fields, reqPassword) {
                console.log("setting new password: " + reqPassword);
                var newHash = saltedHash(reqPassword);
                fields.passwordHash = newHash;
            }
        );

        if (!lib.isEmptyObject(updatedFields)) { // $set does not like empty!
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

    return req.pipe(busboy);


});

app.get('/approve', lib.ensureAuthenticated, function (req, res, next) { //Will blow up if we will have tons of agents
    if (req.user.superuser) {
        app.collection.agent.find({}).toArray(
            function (err, agents) {
                if (err) {
                    next(err);
                    return false;
                }

                res.render('approve', {
                    agents: agents, bAuth: req.bAuth
                });
            }
        );
    }

    else {
        res.status(404).render('404', {bAuth: req.bAuth});
    }
});

//404 route should be always be last route
app.get('*', function (req, res) {
    res.status(404).render('404', {bAuth: req.bAuth});
});

app.use(function (err, req, res, next) {
    lib.reportError(err, app.awsMailer);
    res.status(500).render('500', {bAuth: req.bAuth});
});

function backup_db() {
    backup({
        uri: 'mongodb://admin:66pM9A398qY9UdxL@cluster0-shard-00-00-tmrfr.mongodb.net:27017,cluster0-shard-00-01-tmrfr.mongodb.net:27017,cluster0-shard-00-02-tmrfr.mongodb.net:27017/tour?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin',
        root: './backup',
        tar: new Date().toISOString()+'.tar',
        callback: function(err) {
            if (err) {
                console.error(err);
            } else {
                console.log('backup db is successed!');
            }
        }
    });
    setTimeout (backup_db, 24*3600*1000);
}

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }

    app.collection.property = db.collection('property');
    app.collection.agent = db.collection('agent');

    app.listen(port, function () {
        console.log('Vizzit app listening at port:%s', port)
        //backup_db();
    });
});

