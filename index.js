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

var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var port = process.env.PORT || 3000;

var app = express();
app.collection = {};

function wwwRedirect(req, res, next) {
    if (req.headers.host.slice(0, 4) === 'www.') {
        var newHost = req.headers.host.slice(4);
        return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
    }
    next();
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

if (process.env.CLOUD_DIR) {
    app.use(express.static(process.env.CLOUD_DIR));
}


app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/contactus', function (req, res) {
    res.render('contactus');
});

app.get('/useterms', function (req, res) {
    res.render('useterms');
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


app.get('/tour', ensureAuthenticated, function (req, res) {
    app.collection.agent.findOne({'_id': ObjectID(req.user._id.toHexString())}, function (err, agent) {
        app.collection.property.find({'agent': req.user._id.toHexString()}).toArray(
            function (err, tours) {
                // A little wasteful to find all if it turns out that the current can only see itself
                app.collection.agent.find().toArray(
                    function (err, agents) {
                        res.render('tour', {
                            tours: tours,
                            agent: agent,
                            agents: agent.superuser ? agents : [agent]
                        });
                    }
                );
            }
        );
    });
});

app.post('/tour', ensureAuthenticated, function (req, res) {
    var newProperty = {
        playerType: req.body['playerType'],
        videoID: req.body['videoID'],
        address: req.body['address'],
        agent: req.body['agent']
    };
    app.collection.property.insert(newProperty, function (err, dbProp) {
        if (err) {
            console.log('DB err' + err);
        }

        if (req.files.videoFile) {
            fs.readFile(req.files.videoFile.path, function (err, data) {
                var newPath = path.join(process.env.CLOUD_DIR, dbProp[0]._id.toHexString() + '.mp4');
                fs.writeFile(newPath, data, function (err) {
                    console.log(err);
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
            res.render('tour_details', {
                property: property,
                mapQuery: property.address.split(' ').join('+'),
                agent: agent,
                isPresenting: req.isAuthenticated()
            });

        });
    });
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/tour',
    failureRedirect: '/login'
}));

app.get('/signup', function (req, res) {
    res.render('signup');
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

