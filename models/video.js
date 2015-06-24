var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var videoSchema = new Schema({
	name : String,
	uploader : String,
	type : String,
	duration : Number,
	day: Array,
	schedule_start: Date,
	schedule_finish: Date,
	status: String,
	queue: Number, 
	cron : String
});

module.exports = mongoose.model('video', videoSchema, 'video');
