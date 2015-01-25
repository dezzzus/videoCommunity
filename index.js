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
var lib = require('./lib');
var tourController = require('./controllers/tours');
var leadController = require('./controllers/leads');
var apiController = require('./controllers/api')
var nodemailer = require('nodemailer');
var aws_transcoder = require('./aws_transcode.js');

var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;



var app = express();
app.collection = {};
app.fs = require('fs');

app.AWS = require('aws-sdk');
app.AWS.config.update({
    accessKeyId: 'AKIAJZUHGBIVMAN6BKSA',
    secretAccessKey: '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',
    region: 'us-east-1'
});
app.awsMailer = nodemailer.createTransport({
    service: 'SES',
    auth: {
        user: 'AKIAIZSWZHH37TQL4JSQ',
        pass: 'Al622BfthhR2gRePM54XjwpXS6mnDaf45SdbjOQJ+k7s'
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

app.use(function(req, res, next){
    if(req.user){
        app.locals.user = req.user;
    }
    else{
        app.locals.user = null;
    }
    next();
});

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/contactus', function (req, res) {
    res.render('contactus');
});

app.get('/team', function (req, res) {
    res.render('team', {noindex: true});
});

app.get('/useterms', function (req, res) {
    res.render('useterms');
});

app.get('/beta_not_yet', function (req, res) {
    res.render('not_yet_approved');
});

app.get('/early_adopter', function (req, res) {
    res.render('early_adopter');
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
        res.render('advisor', {
            noindex: true,
            advisorFormalName: advisors[advname]
        });
    }
    else {
        res.redirect('/');
    }
});

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

tourController.addTourRoutes(app);

leadController.addLeadRoutes(app);
app.leadHeartbeatInterval = leadController.getHeartbeatInterval();

apiController.addAPIRoutes(app, app.awsMailer);

app.get('/login', function (req, res) {
    res.render('login');
});

app.post('/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
        if (err) { return next(err); }
        // Redirect if it fails
        if (!user) { return res.redirect('/login'); }
        req.logIn(user, function(err) {
            if (err) { return next(err); }
            
            // Redirect if it succeeds
            return res.redirect(req.session.returnTo || '/tour');
        });
    })(req, res, next);
});


app.get('/resetpass', function (req, res) {
    res.render('resetpass');
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
    res.render('signup');
});

app.post('/signup', function (req, res, next) {
    if (req.body['terms']) {
        lib.safeFindOne(app.collection.agent, {email: req.body['email']}, function (user) {
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

app.get('/profile', lib.ensureAuthenticated, function (req, res) {
    res.render('profile');
});

app.post('/profile', lib.ensureAuthenticated, function (req, res, next) {
    var updatedFields = {};
    lib.processReqField(req, req.user, 'name', updatedFields);
    lib.processReqField(req, req.user, 'email', updatedFields);
    lib.processReqField(req, req.user, 'phone', updatedFields);
    lib.processReqField(req, req.user, 'agency', updatedFields);
    lib.processReqField(req, req.user, 'photoURL', updatedFields);
    lib.processReqField(req, req.user, 'password', updatedFields,
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

//404 route should be always be last route
app.get('*', function (req, res) {
    res.status(404).render('404');
});

app.use(function (err, req, res, next) {
    lib.reportError(err);
    res.status(500).render('500');
});

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }

    app.collection.property = db.collection('property');
    app.collection.agent = db.collection('agent');
    app.collection.lead = db.collection('lead');
    app.collection.leadMsg = db.collection('leadMsg');

    app.listen(port, ipaddress, function () {
        console.log('Vizzit app listening at port:%s', port)
    });
});
