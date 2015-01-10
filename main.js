var requirejs = require("requirejs");
var express = require("express");
var handlebars = require("express-handlebars");
var mysql = require("mysql");
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

app.get("/hit/:id", function(request, response) {
	var visitorId = request.cookies.id;
	
	if(!visitorId) {
		visitorId = id();
		response.cookie("id", visitorId);
	}
	
	var hitId = id();
	
	response.render("confirm-hit", {
		hitId: hitId
	});
});

app.get("/confirm-hit/:id", function(request, response) {
	
	response.end("");
});

app.get("/", function(request, response) {
	response.render("home");
});

app.listen(3000);