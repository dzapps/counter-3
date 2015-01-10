var requirejs = require("requirejs");
var express = require("express");
var handlebars = require("express-handlebars");
var limitString = require("./limitString");
var cookieParser = require("cookie-parser");
var redis = require("redis");
var request = require("request");
var _ = require("underscore");
require("amdefine/intercept");
var id = require("js/id");

const URL_MAX_LENGTH = 255;

var app = express();
var redisClient = redis.createClient();

app.engine("handlebars", handlebars());
app.set("view engine", "handlebars");
app.use(cookieParser());
app.use(express.static("./"));

function recordInitialHit(id, details) {
	redisClient.hmset("hits:" + id, details);
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
		
		recordInitialHit(hitId, {
			project: projectId,
			visitor: visitorId,
			time: new Date().valueOf(),
			ip: request.connection.remoteAddress,
			url: url,
			userAgent: request.headers["user-agent"] || ""
		});
		
		recordIpInfo(hitId);
		
		response.render("confirm-hit", {
			id: hitId
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

app.get("/", function(request, response) {
	response.render("home");
});

app.listen(3000);