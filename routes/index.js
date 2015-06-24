var express = require('express')();
var router = express;//express.Router();
var mongoose = require('mongoose');
var flash = require('connect-flash');
var busboy = require('connect-busboy');
var fs = require('fs');
var sys = require('sys');
var CronJob = require('cron').CronJob;
var paginate = require('express-paginate')
var hash = require('./pass').hash;
var regex = /^\w+$/;

var WebRTC_server = 'localhost';
var WebRTC_server_port = 3000;
var WebRTC_server_path = '/stream_server';

var session = require('express-session');

var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;

var User = require('../models/users');
var Video = require('../models/video');

var now_running = "none";

/*** FOR AUTHENTICATION ***/

express.use(session({secret: 'secretKey', saveUninitialized: true,
                 resave: true}));
express.use(passport.initialize());
express.use(passport.session());
//express.use(flash());
express.use(busboy());

passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  },function(username, password, done) {
    hash(password, username, function(err, hash_value) {
        User.findOne({username : username, password : hash_value.toString()}, function(err, user){
          if(user){
            User.update(
               { username: username },
               {
                  $set : { status: "Online" }    
               },
               { upsert: true },
               function(err, callback) {
                done(null, user);
               } 
            );
            //console.log("insert");
          }
          else
            done(null, false);
    })
	});
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// called in number 2 argument get
// registration using another function without passport
var authentication = function(req, res, done) 
{
  if(req.isAuthenticated())
  {
    //done();
  	done();
  }
  else
  {
  	res.redirect('/');
    //req.flash();
    // redirect to error page ex -> res.redirect('error page');
  }
}

var in_session = function(req, res, done) 
{
  if(req.isAuthenticated())
  {
    res.redirect('/authenticate');
  }
  else
  {
    done();
  }
}

// Function to load cron every restart server
Video.find({}, function(err, data) {
  for(var i = 0; i < data.length; i++) {

    var video_name = data[i].name;
    var type = data[i].type;
    var duration = data[i].duration;
    var status = data[i].status;

    if(status == "Not aired yet" || status == 'Not airing time' || status == 'Airing')
    {
      var job = new CronJob(data[i].cron, function() {
          var this_job = this;
          now_running = 'public/video/' + video_name;
          console.log('running video : ' + video_name);
          Video.update(
            { name: video_name },
            {
              $set : { status: "Airing" }    
            },
            { upsert: true },
            function(err, callback) {
              console.log("updating to airing");
            } 
          );
          if(type == 'onetime') {
            setTimeout(function(){
              this_job.stop();
            }, 10000);
          }
          else
          {
            setTimeout(function(){
              console.log('done running repeated video ' + video_name);
              now_running = "none";
              Video.update(
                { name: video_name },
                {
                  $set : { status: "Not airing time" }    
                },
                { upsert: true },
                function(err, callback) {
                  console.log("updating to not airing time");
                } 
              );
            }, 10000);
          }
        }, function() {
          console.log('done running onetime' + video_name);
          now_running = "none";
          Video.update(
            { name: video_name },
            {
              $set : { status: "Done airing" }    
            },
            { upsert: true },
            function(err, callback) {
              console.log("updating to done airing");
            } 
          );
        },
        true,
        'Asia/Jakarta' 
      );
    }
  }
});

// GET index page
router.get('/', in_session, function(req, res, next) {
  res.render('index');
});

// GET conference page
router.get('/conference', in_session, function(req, res, next) {
  User.find({role: "lecturer"}, function(err, data) {
    res.render('conference', {data: data});
  })
});

// GET conference stream page
router.get('/conference/:username', function(req, res, next) {
  res.render('conference_stream', {username: req.params.username, ip: WebRTC_server, port: WebRTC_server_port, path: WebRTC_server_path});
});

// GET streaming page
router.get('/streaming', in_session, function(req, res, next) {
  res.render('streaming');
});

// GET login page
router.get('/login_page', in_session, function(req, res, next) {
  if(req.query.error == 1)
  {
    res.render('login_page', {error: 'Login Failed'});
  }
  else
  {
    res.render('login_page', {error: 'none'});
  }
});

// GET admin user manage
router.get('/user_manage', authentication, function(req, res, next) {
  //console.log(req.user);
  if(req.user.role == "administrator") {
      User.find({}, function(err, data) {
      if(req.query.error_msg == 1)
      {
        res.render('user_manage', {data: data, error: "Duplicate data!"});
      }
      else
      if(req.query.error_msg == 2)
      {
        res.render('user_manage', {data: data, error: "Wrong format input!"});
      }
      else
      {
        res.render('user_manage', {data: data, error : "none"});

      }
    })
  }
  else
  {
    res.redirect('/video_upload');
  }
  
})

// GET admin video manage
router.get('/video_manage', authentication, function(req, res, next) {
  //console.log(req.user);
  if(req.user.role == "administrator") {
      Video.find({}, function(err, data) {
      if(req.query.message == 1)
      {
        res.render('video_manage', {data: data, message: "Duplicate data!"});
      }
      else
      if(req.query.message == 2)
      {
        res.render('video_manage', {data: data, message: "Wrong format input!"});
      }
      else
      {
        res.render('video_manage', {data: data, message : "none"});
      }
    })
  }
  else
  {
    res.redirect('/video_upload');
  }
  
})

// GET dosen video upload
router.get('/video_upload', authentication, function(req, res, next) {
  if(req.user.role == "lecturer") {
    Video.find({}, function(err, data) {
      if(req.query.error == 1) {
        res.render('video_upload', {data: data, name: req.user.username, error : 'Format must be "webm", "mp4", or "mkv"'})
      }
      else
      if(req.query.error == 2) {
        res.render('video_upload', {data: data, name: req.user.username, error : 'Name is already exist, use another name!'})
      }
      else
      if(req.query.error == 3) {
        res.render('video_upload', {data: data, name: req.user.username, error : 'Schedule has been booked, try another starting time'})
      }
      else
      {
        res.render('video_upload', {data: data, name: req.user.username, error: 'none'});
      }
    });
  }
  else
  {
    res.redirect('/user_manage');
  }
})

// GET conference page
router.get('/conference_master', authentication, function(req, res, next) {
  res.render('conference_master', {username: req.user.username, ip: WebRTC_server, port: WebRTC_server_port, path : WebRTC_server_path});
});

// GET dosen video upload
router.get('/authenticate', authentication, function(req, res, next) {
  if(req.user.role == "administrator") {
    res.redirect('/user_manage');
  }
  else
  if(req.user.role == "lecturer") {
    res.redirect('/video_upload');
  }
  else
  {
    res.redirect('/');
  }
})

// GET dosen video upload
router.get('/logout', authentication, function(req, res, next) {
  User.update(
  { username: req.user.username },
  {
    $set : { status: "Offline" }    
  },
  { upsert: true },
  function(err, callback) {
      req.logout();
      res.redirect('/');
    } 
  );
})

// GET user edit confirmation
router.get('/confirm_edit', authentication, function(req, res, next) {
  if(req.user.role == "administrator") {
    User.findOne({identity_number: req.query.id}, function(err, data) {
      if(!data) res.redirect('/user_manage');
      res.render('confirm_edit', {data: data});
    })
  }
  else
  {
    res.redirect('/video_upload');
  }
})

// GET user delete confirmation
router.get('/confirm_delete', authentication, function(req, res, next) {
  if(req.user.role == "administrator") {
      res.render('confirm_delete', {id: req.query.id});
  }
  else
  {
    res.redirect('/video_upload');
  }
})

// GET user delete commit
router.get('/delete_user', authentication, function(req, res, next) {
  if(req.user.role == "administrator") {
      User.remove( { identity_number: req.query.id }, true );
      res.redirect('/user_manage');
  }
  else
  {
    res.redirect('/video_upload');
  }
})

// GET test
router.get('/test', function(req, res, next) {
  res.render('test');
})

// POST login page
router.post('/login_page', passport.authenticate('local', { successRedirect: '/authenticate',
  failureRedirect: '/login_page?error=1' })
);

// POST upload video page
router.post('/upload_video', authentication, function(req, res, next) {
  var fstream;

  var name,
      frequent,
      schedule,
      hour_start = 0,
      minute_start = 0,
      duration,
      day = [];

  var time_start = new Date(); 
  var time_finish = new Date();
  
  req.pipe(req.busboy);

  req.busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
    if(fieldname == 'video_name') {
      name = val;
    }
    if(fieldname == 'frequent') {
      frequent = val;
    }

    if(fieldname == 'schedule') {
      if(val != "")
      {
        schedule = val;
        var temp = val;
        var date = temp.split(" ")[0];
        date = date.split("-");
        var time = temp.split(" ")[1];

        var year = date[2];
        var month = date[1];
        var now = date[0];

        var date_in_format = new Date(year + '-' + month + '-' + now);
        time_start = date_in_format;
        //console.log(date_in_format);

        var hour = time.split(":")[0];
        var minute = time.split(":")[1];
        hour_start = parseInt(hour);
        minute_start = parseInt(minute);
        time_start.setHours(hour_start, minute_start);
      }
    }

    if(fieldname == 'hour_start') {
      hour_start = val;
      //time_start.setHours(hour_start, minute_start);
    }

    if(fieldname == 'minute_start') {
      minute_start = val;
      //time_start.setHours(hour_start, minute_start);
    }    


    if(fieldname == 'duration_onetime' || fieldname == 'duration_repeated') {
      if(val != 'none') {
        duration = parseFloat(val);
        //time_finish = time_start;
        time_start.setHours(hour_start, minute_start, 0);
        time_finish.setTime(time_start.getTime() + (duration*3600*1000));
        //console.log('duration : ' + duration);
        //console.log('time_start : ' + time_start);
        //console.log('time_finish : '  + time_finish);
      }
    }

    if(fieldname == 'monday') {
      day.push(val);
    }

    if(fieldname == 'tuesday') {
      day.push(val);
    }

    if(fieldname == 'wednesday') {
      day.push(val);
    }

    if(fieldname == 'thursday') {
      day.push(val);
    }
    if(fieldname == 'friday') {
      day.push(val)
    }

    if(fieldname == 'saturday') {
      day.push(val);
    }

    if(fieldname == 'sunday') {
      day.push(val);
    }
    
    //console.log('fieldname : ' + fieldname + '\nvalue : ' + val);
    //console.log('array : ' + day);
    
  })
  
  req.busboy.on('file', function(fieldname, file, filename) {
    var format = filename.split('.');
    var last = format.length - 1;
    //console.log(fieldname);

    if(format[last] == 'webm' || format[last] == 'mp4' || format[last] == 'gif') {
      
      var listdir = fs.readdirSync('./public/video/');
      //console.log(listdir.indexOf(name + '.' + format[last]));
      if(listdir.indexOf(name + '.' + format[last]) == -1)
      {
        Video.find({}, function(err, data) {
          var conflict = 0;
          for(var i = 0; i < data.length; i++) {
            
              if((data[i].schedule_finish.getHours() == time_start.getHours() || data[i].schedule_start.getHours() == time_start.getHours()) ||
                 (data[i].schedule_finish.getHours() == time_finish.getHours() || data[i].schedule_start.getHours() == time_finish.getHours())) 
              {
                console.log("yay");
                if(data[i].type == "onetime" && frequent == "onetime")
                {
                  if((data[i].schedule_finish >= time_start && data[i].schedule_start <= time_start) ||
                     (data[i].schedule_finish >= time_finish && data[i].schedule_start <= time_finish))
                  {
                    conflict = 1;
                  }                 
                }
                else
                if(data[i].type == "onetime" && frequent == "repeated") 
                { 
                  // Forgiven
                  /*
                  var dayStartInDB = data[i].schedule_start.getDay();
                  //var dayFinishInDB = data[i].schedule_finish.getDay();
                  for(var j = 0; j < day.length; j++)
                  {
                    if(dayStartInDB == day[j])
                    {
                      //console.log("hello");
                      conflict = 1;
                    }
                  }
                  */
                }
                else
                if(data[i].type == "repeated" && frequent == "onetime") 
                {
                  var dayStartInForm = time_start.getDay();
                  if(data[i].day.indexOf(dayStartInForm.toString()) != -1)
                  {
                    conflict = 1;
                  }
                }
                else
                if(data[i].type == "repeated" && frequent == "repeated")
                {
                  for(var j = 0; j < day.length; j++)
                  {
                    if(data[i].day.indexOf(day[j].toString()) != -1)
                    {
                      //console.log("hello");
                      conflict = 1;
                    }
                  }
                }
              }
            
          }

          if(conflict == 0)
          {
            fstream = fs.createWriteStream('./public/video/' + name + '.' + format[last]);
            file.pipe(fstream);
            fstream.on('close', function() {
              /*
              console.log('duration : ' + duration);
              console.log('time_start : ' + time_start);
              console.log('time_finish : '  + time_finish);
              console.log('array : ' + day);
              */
              ///*
              var cron_command = "";
              if(day == "")
              {
                cron_command = '0 ' + time_start.getMinutes() + ' ' 
                + time_start.getHours() + ' ' + time_start.getDate() + ' '
                + time_start.getMonth() + ' ' + '*';
              }
              else
              {
                cron_command = '0 ' + time_start.getMinutes() + ' ' 
                + time_start.getHours() + ' ' + '*' + ' '
                + '*' + ' ' + day;
              }

              var status_now;
              if (frequent == 'onetime')
              {
                status_now = "Not aired yet";
              }
              else
              {
                status_now = "Not airing time";
              }

              var uploaded_video = Video ({
                                              name : name,
                                              uploader : req.user.username,
                                              type : frequent,
                                              duration : duration,
                                              day: day,
                                              schedule_start: time_start,
                                              schedule_finish: time_finish,
                                              status: status_now,
                                              cron : cron_command
                                          });
              uploaded_video.save();

              var job = new CronJob(cron_command, function() {
                var this_job = this;
                now_running = 'public/video/' + name;
                console.log('running video : ' + name);
                Video.update(
                  { name: name },
                  {
                    $set : { status: "Airing" }    
                  },
                  { upsert: true },
                  function(err, callback) {
                    console.log("updating to airing");
                  }  
                );
                if(frequent == 'onetime') {
                  setTimeout(function(){
                    this_job.stop();
                  }, 10000);
                }
                else
                {
                  setTimeout(function(){
                    console.log('done running repeated video ' + name);
                    now_running = "none";
                    Video.update(
                      { name: name },
                      {
                        $set : { status: "Not airing time" }    
                      },
                      { upsert: true },
                      function(err, callback) {
                        console.log("updating to not airing time");
                      } 
                    );
                  }, 10000);
                }
              }, function() {
                console.log('done running onetime video ' + name);
                now_running = "none";
                Video.update(
                  { name: name },
                  {
                    $set : { status: "Done airing" }    
                  },
                  { upsert: true },
                  function(err, callback) {
                    console.log("updating to done airing");
                  }  
                );
              },
              true,
              'Asia/Jakarta' 
            );

              //*/
              res.redirect('/video_upload');
            })
          }
          else
          {
            file.resume();
            res.redirect('/video_upload?error=3');
          }
        })
        
      }
      else
      {
        file.resume();
        res.redirect('/video_upload?error=2');
      }
    }
    else
    {
      file.resume();
      res.redirect('/video_upload?error=1');
    }
  })

  /*
  req.busboy.on('finish', function() {
    
  })
  */

});

// POST user page
router.post('/user_manage', authentication, function(req, res, next) {
  
  if( !isNaN(req.body.number) && 
      regex.test(req.body.username) == true
    )
  {
    hash(req.body.password, req.body.username, function(err, hash_value) {
      if (err) return hash_value(err);

      User.findOne({$or : [ {identity_number: req.body.number}, {username: req.body.username} ] }, function(err, data) {
        if(!data) 
        {
          var new_user = User ({
                                identity_number : req.body.number,
                                name : req.body.name,
                                username : req.body.username,
                                password : hash_value.toString(),
                                email : req.body.email,
                                role : req.body.role,
                                status : "Offline"
                            });

          //console.log(new_user);
          console.log("berhasil");
          new_user.save();
          res.redirect('/user_manage');
        }
        else
        {
          console.log("gagal " + req.body.number + " "  + req.body.username );
          res.redirect('/user_manage?error_msg=1');
        }
      })
    })
  }
  else
  {
    res.redirect('/user_manage?error_msg=2');
    console.log("Data tidak dimasukkan");
  }
});

module.exports = router;
