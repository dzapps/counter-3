var requirejs = require("requirejs");
var express = require("express");
var handlebars = require("express-handlebars");
var limitString = require("./limitString");
var cookieParser = require("cookie-parser");
var redis = require("redis");
require("amdefine/intercept");
var id = require("js/id");

const URL_MAX_LENGTH = 255;

var app = express();
var redisClient = redis.createClient();

app.engine("handlebars", handlebars());
app.set("view engine", "handlebars");
app.use(cookieParser());
app.use(express.static("./"));

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
		
		redisClient.hmset("hits:" + hitId, {
			project: projectId,
			visitor: visitorId,
			time: new Date().valueOf(),
			ip: request.connection.remoteAddress,
			url: url,
			userAgent: request.headers["user-agent"]
		});
		
		response.render("confirm-hit", {
			id: hitId
		});
	}
	
});

app.get("/confirm-hit/:id", function(request, response) {
	response.end("");
});

app.get("/", function(request, response) {
	response.render("home");
});

app.listen(3000);