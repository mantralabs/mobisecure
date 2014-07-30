var Mongo 		= require('mongodb'); 
var MongoDB 	= Mongo.Db;
var Server 		= require('mongodb').Server;

var dbPort 		= 27017;
var dbHost 		= 'localhost';
var dbName 		= 'mobisecure';

var db_con = new MongoDB(dbName, new Server(dbHost, dbPort, {auto_reconnect: true}), {w: 1});
	db_con.open(function(e, d){
		if (e) {
			console.log(e);
		}	else{
			console.log('connected to database :: ' + dbName);
		}
	});

module.exports = {
	/* establish the database connection */
	DB : db_con,
	Mongo : Mongo
}