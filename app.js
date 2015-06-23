var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var flash = require('connect-flash');
var port = 3000;

//PeerJS
var ExpressPeerServer = require('peer').ExpressPeerServer;

//var BinaryServer = require('binaryjs').BinaryServer
//var binaryServer = BinaryServer({port: 9000});

var routes = require('./routes/index');
//var users = require('./routes/users');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/learnvid');

      var app = express();
      // view engine setup
      app.set('views', path.join(__dirname, 'views'));
      app.set('view engine', 'ejs');
      app.use('/public', express.static('public'));
      app.use(flash());

      // uncomment after placing your favicon in /public
      //app.use(favicon(__dirname + '/public/favicon.ico'));
      app.use(logger('dev'));
      app.use(bodyParser.json());
      app.use(bodyParser.urlencoded({ extended: false }));
      app.use(cookieParser());
      app.use(express.static(path.join(__dirname, 'public')));

      app.use('/', routes);
      //app.use('/users', users);
      // catch 404 and forward to error handler
      app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
      });

      // error handlers

      // development error handler
      // will print stacktrace
      if (app.get('env') === 'development') {
        app.use(function(err, req, res, next) {
          res.status(err.status || 500);
          if(err.status == undefined) err.status = 'Implementation Error';
          //console.log(req.user);
          if(req.user == undefined) {
            var user = "general";
          }
          else
          {
            var user = req.user.role;
          }
          res.render('error', {
            message: err.message,
            error: err,
            status: err.status,
            user: user
          });
        });
      }

      // production error handler
      // no stacktraces leaked to user
      app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        //console.log(req.user);
        if(req.user == undefined) {
            var user = "general";
          }
        else
        {
          var user = req.user.role;
        }
        res.render('error', {
          message: err.message,
          error: {},
          status: err.status,
          user: user
        });
      });

      //var cert = fs.readFileSync('./certificate/server.crt', 'utf8');
      //var privateKey = fs.readFileSync('./certificate/server.key', 'utf8');
      //var ca = fs.readFileSync('./certificate/signing-ca.crt', 'utf8');
      //var credentials = { key: privateKey, cert: cert, ca: ca };

      /*
      var server = http.createServer(app).listen(port);

      binaryServer.on('connection', function(client) {

      client.on('stream', function(stream) {

          var responseStream = client.createStream('fromserver');
          stream.pipe(responseStream);

      });

    });
    */

      var server = app.listen(port);
      var options = {
          debug: true
      }
      app.use('/stream_server', ExpressPeerServer(server, options));
      //app.listen(port);
      //var server = https.createServer(credentials, app).listen(port);
      //var webRTC = require('webrtc.io').listen(server);
      //server.listen(port);

      console.log('Http Listening on port : %d', port);
      module.exports = app;

