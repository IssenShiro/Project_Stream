var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var usersSchema = new Schema({
	identity_number : Number,
	name : String,
	username : String,
	password : String,
	email : String,
	role : String,
	status : String
});

module.exports = mongoose.model('users', usersSchema, 'users');
