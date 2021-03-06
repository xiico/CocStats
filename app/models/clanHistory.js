// load the things we need
var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our user model
var clanHistorySchema = mongoose.Schema({
    tag: String,
    history: [{
        clanLevel: Number,
        warWins: Number,
        warWinStreak: Number,
        clanPoints: Number,
        trophies: Number,
        members: Number,
        date: Date
    }]
});

// create the model for users and expose it to our app
module.exports = mongoose.model('clanHistory', clanHistorySchema);
