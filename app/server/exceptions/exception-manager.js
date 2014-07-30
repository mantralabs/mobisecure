AuthenticationException = function(response, data, status_code){
	console.log('invalid credentials');
	response.send(data, status_code);
}

module.exports = {
	/* establish the database connection */
	AuthenticationException : AuthenticationException
}