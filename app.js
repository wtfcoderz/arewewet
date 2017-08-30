var restify = require('restify');
var request = require('request');
var redis = require("redis");

const server = restify.createServer({
  name: 'arewetwet',
  version: '1.0.0'
});

const redisCli = redis.createClient('redis://redis:6379');
redisCli.on("error", function (err) {
    console.log("Error " + err);
});

const constants = {
  'restEndpoint': 'http://www.meteofrance.com/mf3-rpc-portlet/rest/pluie/'
}

// Get data for city
function getRest(city) {
  return new Promise((resolve, reject) => {
    request(constants.restEndpoint + city, function (error, response, body) {
      if (error) reject(error);
      else resolve(JSON.parse(body));
    });
  });
}

// Store cache in redis
function redisCache(city) {
  return new Promise((resolve, reject) => {
    getRest(city)
    .then(function (data) {
      var obj = {};
      var a = 0;
      for (var i in data.dataCadran) {
        var key = a;
        var value = data.dataCadran[i].niveauPluie;
        obj[key] = value;
        a += 5;
      }
      console.log('Inserting ' + city + ' : ' + JSON.stringify(obj));
      redisCli.set(city, JSON.stringify(obj), 'EX', 300);
      resolve(data);
    }).catch(function (err) {
      reject(err);
    });
  });
}

// Get cities from redis
function redisGet(cities) {
  return new Promise((resolve, reject) => {
    redisCli.mget(cities, function(err, values) {
      if (err) reject(err);
      else {
        // Build object
        var obj = {};
        for (var i in cities) {
          obj[cities[i]] = JSON.parse(values[i]);
        }
        resolve(obj);
      }
    });
  });
}

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

// Get data for city
server.get('/api/rest/:city', function (req, res, next) {
  getRest(req.params.city)
  .then(function (data) {
    res.json(data);
  }).catch(function (err) {
    res.json(err);
  });
  return next();
});

// Get moving
server.get('/api/move/:move', function (req, res, next) {
  var move = req.params.move.split(',');
  var cities = [];
  var whereWeAre = {};
  for (var m in move) {
    var arr = move[m].split(':');
    var city = arr[0];
    var time = arr[1];
    cities.push(city);
    var i = parseInt(time, 10);
    while (i <= move[move.length-1].split(':')[1]) {
      whereWeAre[i] = city;
      i += 5;
    }
  }
  console.log(whereWeAre);
  // Get Meteo
  var redisCachePromises = cities.map(function (city) {
    return redisCache(city);
  });
  Promise.all(redisCachePromises)
  .then(function(results) {
    return redisGet(cities);
  }).then(function (results) {
    // Move compute
    var obj = {};
    // From departure city, for each 5min in the hour
    var i = 0;
    while (i < 60) {
      console.log("On part @" + i);
      obj[i] = {'run': {}};
      // Run
      for (var w in whereWeAre) {
        var city = whereWeAre[w];
        var when = parseInt(w, 10) + i;
        obj[i].run[w] = results[city][when];
      }
      i += 5;
    }
    res.json(obj);
  });
});


// Start
server.listen(1664, function () {
  console.log('%s listening at %s', server.name, server.url);
});
