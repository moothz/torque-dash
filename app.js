// Add module dependencies
const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
// const logger = require('morgan');
const { sequelize } = require('./models');
const config = require('./config/config');
const { engine } = require('express-handlebars');
const flash = require('connect-flash');
const session = require('cookie-session');
const passport = require('passport');
const User = require('./models').User;
require('./config/passport')(passport); 

// Configure middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// app.use(logger('combined'));
app.use(session({
    keys: config.session.keys,
    maxAge: 24 * 60 * 60 * 1000
}));
// Compatibility middleware for Passport v0.6+ and cookie-session
app.use((req, res, next) => {
    if (req.session && !req.session.regenerate) {
        req.session.regenerate = (cb) => { cb(); };
    }
    if (req.session && !req.session.save) {
        req.session.save = (cb) => { cb(); };
    }
    next();
});
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Set templating engine
const fs = require('fs');
const translations = {
    en: JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/en.json'), 'utf8')),
    'pt-br': JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/pt-br.json'), 'utf8'))
};

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    
    if (req.query.lang) {
        req.session.lang = req.query.lang;
    }
    
    const lang = req.session.lang || 'en';
    res.locals.lang = lang;
    res.locals.isPtBr = (lang === 'pt-br');
    res.locals.isEn = (lang === 'en');
    res.locals.translations = translations[lang] || translations['en'];
    next();
});

app.engine('hbs', engine({
    defaultLayout: 'main', 
    extname: 'hbs',
    helpers: {
        __: function (key, options) {
            const root = (options && options.data && options.data.root) || {};
            const translationsMap = root.translations || {};
            return translationsMap[key] !== undefined ? translationsMap[key] : key;
        },
        json: function (context) {
            return JSON.stringify(context);
        }
    }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '/views'));

// Define routes
app.use('/', require('./routes/web.js'));
app.use('/api', require('./routes/api.js'));
// Since this is the last middleware used, assume 404, as nothing else responded.
app.use('*', require('./routes/404.js'));

// Connect to database and sync models
sequelize.sync(
    // {force:true}
    )
    .then(() => {
        console.log('Connection to database successfully established');  
        
        // User.create({
        //     email: 'test@contoso.com',
        //     password : 'heslo'
        // });

        // Start server
        app.listen(config.port, () => console.log(`Listening on port ${config.port}`));

    }).catch((err) => {
        console.log('Error connecting to the database:', err.message);
});


