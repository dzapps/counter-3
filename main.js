var requirejs = require("requirejs");
var express = require("express");
var session = require("express-session");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var expressValidator = require("express-validator");
var bcrypt = require("bcrypt");
var redis = require("redis");
var request = require("request");
var _ = require("underscore");
var async = require("async");
require("amdefine/intercept");
var id = require("js/id");

var app = express();
var redisClient = redis.createClient();

app.use(function(request, response, next) {
	response.locals.css = [];
	next();
});

app.set("view engine", "jade");
app.use(cookieParser());
app.use(express.static("./"));

app.use(session({
	resave: false,
	store: new session.MemoryStore(),
	saveUninitialized: false,
	secret: "ad6d3aa4ad0f"
}));

app.use(function(request, response, next) {
	response.locals.user = {
		loggedIn: request.session.loggedIn,
		username: request.session.username
	};
	
	next();
});

app.use(bodyParser.urlencoded({
	extended: false
}));

app.use(expressValidator({}));

function recordInitialHit(projectId, hitId, details) {
	redisClient.hmset("hits:" + hitId, details);
	redisClient.lpush("projectHits:" + projectId, hitId);
}

function recordIpInfo(id) {
	var hitKey = "hits:" + id;
	
	redisClient.hget(hitKey, "ip", function(error, ip) {
		if(ip) {
			request("http://ipinfo.io/" + ip + "/json", function(error, response, body) {
				var ipInfo = JSON.parse(body);
				
				if(_.isObject(ipInfo)) {
					redisClient.hmset(hitKey, {
						isp: ipInfo.org || "",
						country: ipInfo.country || "",
						region: ipInfo.region || "",
						city: ipInfo.city || ""
					});
				}
			});
		}
		
		else {
			console.log("Error getting IP for " + hitKey + ": " + error);
		}
	});
}

function recordUserAgent(id, details) {
	redisClient.hmset("hits:" + id, details);
}

function renderIndex(response, data) {
	response.locals.css = ["index"];
	response.render("index", data || {});
}

function renderHome(request, response, data) {
	data = data || {};
	response.locals.css = ["home"];
	
	redisClient.lrange("userProjects:" + request.session.username, 0, -1, function(error, ids) {
		if(error) {
			render500(response, "Error retrieving projects from database", error);
		}
		
		else {
			async.map(ids, function(id, callback) {
				redisClient.hgetall("projects:" + id, function(error, project) {
					callback(error, project);
				});
			}, function(error, results) {
				if(error) {
					render500(response, "Error retrieving projects from database", error);
				}
				
				else {
					data.projects = results;
					response.render("home", data);
				}
			});
		}
	});
}

function render500(response, errorSummary, errorDetails) {
	response.locals.css = ["500"];
	
	response.status(500).render("500", {
		summary: errorSummary,
		details: errorDetails
	});
}

function createProject(username, name, id) {
	redisClient.hmset("projects:" + id, {
		name: name,
		user: username,
		id: id
	});
	
	redisClient.lpush("userProjects:" + username, id);
}

function login(request, response, username) {
	request.session.loggedIn = true;
	request.session.username = username;
	
	response.locals.user = {
		loggedIn: true,
		username: username
	};
}

app.get("/hit/:projectId", function(request, response) {
	var url = request.headers.referer;
	var projectId = request.params.projectId;
	
	if(url) {
		var visitorId = request.cookies.id;
		var hitId = id();
		
		if(!visitorId) {
			visitorId = id();
			response.cookie("id", visitorId);
		}
		
		recordInitialHit(projectId, hitId, {
			project: projectId,
			visitor: visitorId,
			time: new Date().valueOf(),
			ip: request.connection.remoteAddress,
			url: url,
			userAgent: request.headers["user-agent"] || ""
		});
		
		recordIpInfo(hitId);
		
		response.render("hit-js", {
			callbackUrl: request.protocol + "://" + request.headers.host + "/hit-callback/" + hitId
		});
	}
});

app.get("/hit-callback/:id", function(request, response) {
	recordUserAgent(request.params.id, {
		referrer: request.query.referrer,
		resolution: request.query.resolution
	});
	
	response.end("");
});

app.post("/start", function(request, response) {
	request.checkBody("project", "Project name must be between 1 and 50 characters").len(1, 50);
	request.checkBody("username", "Username must be between 1 and 50 characters").len(1, 50);
	request.checkBody("password", "Password must be between 1 and 256 characters").len(1, 256);
	
	var errors = request.validationErrors();
	
	if(errors) {
		renderIndex(response, {
			start: {
				errors: errors,
				values: request.body
			}
		});
	}
	
	else {
		var projectName = request.body.project;
		var projectId = id();
		var username = request.body.username;
		var password = request.body.password;
		var userKey = "users:" + username;
		
		async.series({
			checkUsernameAvailable: function(callback) {
				redisClient.exists(userKey, function(error, keyExists) {
					if(keyExists) {
						callback("user exists");
					}
					
					else {
						callback();
					}
				});
			},
			
			getPasswordHash: function(callback) {
				bcrypt.hash(password, 8, function(error, hash) {
					callback(error, hash);
				});
			}
		}, function(error, results) {
			if(error) {
				if(error === "user exists") {
					renderIndex(response, {
						start: {
							errors: [{
								param: "username",
								msg: "The username " + username + " is already registered",
								value: username
							}],
							values: request.body,
						}
					});
				}
				
				else {
					render500("Internal server error", error);
				}
			}
			
			else {
				redisClient.hmset(userKey, {
					username: username,
					password: results.getPasswordHash
				});
				
				createProject(username, projectName, projectId);
				login(request, response, username);
		
				renderHome(request, response, {
					justRegistered: true
				});
			}
		});
	}
});

app.get("/project/:id", function(request, response) {
	var projectId = request.params.id;
	
	async.waterfall([
		function(callback) {
			redisClient.hget("projects:" + projectId, "name", function(error, projectName) {
				callback(error, projectName);
			});
		},
		
		function(projectName, callback) {
			redisClient.lrange("projectHits:" + projectId, 0, -1, function(error, ids) {
				if(error) {
					callback(error);
				}
				
				else {
					async.map(ids, function(id, callback) {
						redisClient.hgetall("hits:" + id, function(error, hit) {
							callback(error, hit);
						});
					}, function(error, results) {
						callback(error, {
							projectName: projectName,
							hits: results
						});
					});
				}
			});
		}
	], function(error, data) {
		if(error) {
			render500(response, "Error retrieving hits from database", error);
		}
		
		else {
			response.render("project", data);
		}
	});
});

app.post("/home", function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	
	async.waterfall([
		function(callback) {
			redisClient.hgetall("users:" + username, function(error, userDetails) {
				if(error) {
					callback(error);
				}
				
				else {
					if(userDetails) {
						callback(null, userDetails);
					}
					
					else {
						callback("user not found");
					}
				}
			});
		},
		
		function(userDetails, callback) {
			bcrypt.compare(password, userDetails.password, function(error, result) {
				callback(error, result);
			});
		}
	], function(error, isValidCombination) {
		if(error && error !== "user not found") {
			render500(response, "Error checking details on server", error);
		}
		
		else {
			if(error || !isValidCombination) {
				renderIndex(response, {
					login: {
						errors: [{
							param: "username",
							msg: "Username/password combination incorrect",
							value: username
						}],
						values: request.body,
					}
				});
			}
			
			else {
				login(request, response, username);
				renderHome(request, response);
			}
		}
	});
});

app.get("/home", function(request, response) {
	if(request.session.loggedIn) {
		renderHome(request, response);
	}
	
	else {
		renderIndex(response);
	}
});

app.use(function(request, response) {
	renderIndex(response);
});

app.listen(3000);