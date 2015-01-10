module.exports = function(string, maxLength, separator, startLength, endLength) {
	separator = separator || "...";
	startLength = startLength || Math.floor(maxLength / 2);
	endLength = endLength || (maxLength - startLength - separator.length);
	
	return ""
		+ string.substr(0, startLength)
		+ separator
		+ string.substr(string.length - endLength);
};