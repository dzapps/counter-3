var requirejs = require("requirejs");
var express = require("express");
var handlebars = require("express-handlebars");
var mysql = require("mysql");
var limitString = require("./limitString");
var cookieParser = require("cookie-parser");

/*
NOTE amdefine is best right between all the requires that don't need it
and those that do, as it can mess things up.
*/

require("amdefine/intercept");

var id = require("js/id");

var app = express();

const URL_MAX_LENGTH = 255;

app.engine("handlebars", handlebars());
app.set("view engine", "handlebars");
app.use(cookieParser());
app.use(express.static("./"));

app.get("/hit/:id", function(request, response) {
	var theId;
	
	if(!request.cookies.id) {
		theId = id();
		console.log("setting cookie " + theId);
		response.cookie("id", theId);
		request.cookies.id = theId;
	}
	
	console.log(request.cookies.id);
	
	response.render("confirm-hit", {
		id: request.params.id
	});
});

app.get("/confirm-hit/:id", function(request, response) {
	
	response.end("");
});

app.get("/", function(request, response) {
	response.render("home");
});

app.listen(3000);