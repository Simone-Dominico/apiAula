require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');
const app = express();
var userProfile;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));
// Configure a sessão
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Configuração do Passport
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, cb) {
      userProfile=profile;
      return cb(null, userProfile);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});
// Crie um cliente OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.CALLBACK_URL
);

// Defina os escopos que precisamos acessar
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];


app.get('/', function(req, res) {
  res.render('pages/auth');
});
app.get('/success', (req, res) => {
  if (userProfile) {  // Verifique se o usuário está autenticado
    res.render('pages/success', { user: userProfile });  // Renderiza a view 'success' e passa o perfil do usuário
  } else {
    res.redirect('/');  // Se o usuário não estiver autenticado, redireciona para a página inicial
  }
});

//app.get('/success', (req, res) => res.send(userProfile));
app.get('/error', (req, res) => res.send("error logging in"));

app.get('/auth/google', 
  passport.authenticate('google', { scope : ['profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly'] }));
 
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/error' }),
  function(req, res) {
    // Successful authentication, redirect success.
    res.redirect('/success');
  });
// Rotas
app.get('/calendar', (req, res) => {
  if (!req.user) {
    // Se o usuário não estiver autenticado, redireciona para a página inicial
    res.redirect('/');
  } else {
    // Usando as credenciais do usuário para acessar a API do Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.CALLBACK_URL
    );

    oauth2Client.setCredentials({
      access_token: req.user.accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    }, (err, result) => {
      if (err) return console.log('The API returned an error: ' + err);
      const events = result.data.items;
      if (events.length) {
        res.render('calendar', { events });  // Renderiza a página 'calendar' e passa os eventos
      } else {
        console.log('No upcoming events found.');
      }
    });
  }
});

app.get('/auth/callback', (req, res) => {
  const code = req.query.code;
  if (code) {
    // Obter o token de acesso
    oauth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      req.session.token = token;
      res.redirect('/calendar');
    });
  }
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.listen(3000, () => {
  console.log('App listening on port 3000');
});

