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

app.engine("handlebars", handlebars());
app.set("view engine", "handlebars");
app.use(cookieParser());
app.use(express.static("./"));

app.get("/hit/:projectId", function(request, response) {
	var url = request.headers.referer;
	
	if(url) {
		var visitorId = request.cookies.id;
		var hitId = id();
		
		if(!visitorId) {
			visitorId = id();
			response.cookie("id", visitorId);
		}
		
		
		
		response.render("confirm-hit", {
			hitId: hitId
		});
	}
});

app.get("/confirm-hit/:hitId", function(request, response) {
	
	response.end("");
});

app.get("/", function(request, response) {
	response.render("home");
});

app.listen(3000);