var DBManager   = require('./db-manager');
var fs			= require('fs');
/* Entity Collections */
var profiles = DBManager.DB.collection('profiles');
var accounts = DBManager.DB.collection('accounts');

/* login validation methods */

exports.fetchProfileForUser = function(user_id, callback){
	accounts.findOne({_id:user_id}, function(e, o) {
		if (o){
			console.log('profile found');
			console.log(o);
			callback(null, o);
		}	else{
			console.log('no profile found');
			callback(null);
		}
	});
}

exports.updateProfile = function(user, callback){
	accounts.findOne({_id:user._id}, function(e,o){
		if(o){
			if(user.fullname)
				o.fullname = user.fullname;
			if(user.mobile)
				o.mobile = user.mobile;
			if(user.address_line_1)
				o.address_line_1 = user.address_line_1;
			if(user.address_line_2)
				o.address_line_2 = user.address_line_2;
			if(user.landmark)
				o.landmark = user.landmark;
			if(user.city)	
				o.city = user.city;
			if(user.state)
				o.state = user.state;
			if(user.country)
				o.country = user.country;
			if(user.pincode)
				o.pincode = user.pincode;
			
			accounts.update({_id:o._id}, o, callback);
		}else{
			callback(400, e);
		}
	});
}

exports.uploadAvatar = function(temp_path, save_path, callback){
	fs.rename(temp_path, save_path, function(error){
     	if(error) callback(error);
     	
     	fs.unlink(temp_path, function(){
     		if(error) callback(error);
     		callback(null, "File uploaded");
     	});
     });
}
