// load up the clan model
var Clan = require('../app/models/clan');
// load up the User model
var User = require('../app/models/user');
// Search using the CoC api
var cocSearch = require('../app/cocSearch');
// load up the Player model
var Player = require('../app/models/player');
//load up the clanHistory
var clanHistory = require('../app/models/clanHistory');
// load up the Rank model
var Rank = require('../app/models/rank');


function saveClan(searched, callBack, callBackSearch) {
    Clan.findOneAndUpdate({ tag: searched.tag }, searched, { upsert: true, new: true, setDefaultsOnInsert: true }, function (err, clan) {
        if (err)
            throw err;
        if (callBack) {
            Clan.find({ tag: callBackSearch }, function (err, clans) {
                if (err)
                    throw err;
                callBack(clans);
            });
        }
    });
}

function getFirstMonday(date) {
    date.setDate(1);

    // Get the first Monday in the month
    while (date.getDay() !== 1) {
        date.setDate(date.getDate() + 1);
    }
    return date;
}

function getClanHistoryStartDate(){
    var date = new Date();
    if(getFirstMonday(date).getDate() >= date.getDate) 
        return getFirstMonday(date);
    else {
        date.setMonth(date.getMonth() - 1);
        return getFirstMonday(date);
    }        
}

module.exports =
    {
        updateClans: function (clansToFind, callBack) {
            this.searchUserClans(clansToFind, function (err, clansFound) {
                if (err)
                    throw err;
                var updated = 0;
                var clansFromDb = [];
                for (var index = 0; index < clansFound.length; index++) {
                    var searchedClan = clansFound[index];
                    if (searchedClan.tag)
                        Clan.findOneAndUpdate({ tag: searchedClan.tag }, searchedClan, { upsert: true, new: true, setDefaultsOnInsert: true }, function (err, clan) {
                            if (err)
                                throw err;
                            if (++updated == clansFound.length) {
                                callBack(null, clansFound);
                            }
                        });
                    else
                        Clan.find({ tag: clansToFind[updated] }, function (err, clans) {
                            if (err)
                                throw err;
                            if (clans.length > 0) {
                                clansFromDb[clansFromDb.length] = clans[0];
                                if (++updated == clans.length) {
                                    callBack(null, clansFromDb);
                                }
                            } else callBack(null, clansFound);
                        });


                }
            });
        },
        searchClans: function (searchType, tag, options, callBack) {
            cocSearch.searchClans(searchType, tag, options, function (err, returnedClans) {
                if (err)
                    throw err;
                if (returnedClans.items || returnedClans.tag)
                    if(searchType == "Tag")
                        callBack(null,returnedClans);
                    else
                        callBack(null,[], returnedClans);
                else {
                    var searchedClans = [];
                    if (searchType == "Tag")
                        Clan.find({ tag: "#" + tag }, function (err, clans) {
                            if (err)
                                throw err;
                            callBack(null, clans[0]);
                        });
                    else
                        Clan.find({ $or: [{ tag: "#" + tag }, { name: new RegExp(tag, "g") }] }, function (err, clans) {
                            if (err)
                                throw err;
                            callBack(null, [] ,{items:clans});
                        });
                }
            });
        },
        searchUserClans: function (clans, callBack) {
            var inserted = 0;
            var searchedClans = [];
            var index = 0;
            for (var i = 0; i < clans.length; i++) {
                cocSearch.searchClans('Tag', clans[i], null, function (err, returnedClans) {
                    if (err) {
                        callBack(err);
                        return;
                    }
                    searchedClans[searchedClans.length] = returnedClans;
                    if (++inserted == clans.length)
                        callBack(null, searchedClans);
                });
            }
        },
        searchPlayers: function (searchType, tag, options, callBack) {
            cocSearch.searchPlayers(searchType, tag, options, function (err, returnedPlayers) {
                if (err)
                    throw err;
                if (returnedPlayers){
                    returnedPlayers.playerSearch = true;
                    callBack(null, returnedPlayers);
                }
                else {                    
                    if (searchType == "Tag")
                        Player.find({ tag: "#" + tag }, function (err, players) {
                            if (err)
                                throw err;
                            callBack(null, players);
                        });
                }
            });
        },
        getClanHistory : function(tag, callBack){
            clanHistory.aggregate([
                { "$match": { tag: "#" + tag }},
                // Unwind the array to denormalize
                { "$unwind": "$history" },

                { "$match": { "history.date": { $gte: getClanHistoryStartDate() } } },

                // Group back to array form
                {
                    "$group": {
                        "_id": "$_id",
                        "history": { "$push": "$history" }
                    }
                }
            ], function (err, response) {
                if (err)
                    throw err;
                if (response.length > 0)
                    callBack(null, response[0].history);
            });

            // clanHistory.find({ tag: "#" + tag }, {"history":{$slice:28}}, function (err, response) {
            //         if (err)
            //             throw err;
            //         if(response.length > 0)
            //             callBack(null, response[0].history);
            //     });
        },
        getGlobalRank: function(callBack){
            var date = new Date("2017-07-06");
            date.setUTCHours(0);         
            date.setUTCMinutes(0);
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
            Rank.aggregate([
                { "$match": { "entries.date": { $gte: date } } },
                { "$unwind": "$entries" },
                { "$unwind": "$entries.items" },                

                //{ "$match": { "entries.items.clanPoints": { $gte: 59000 } } },
                { "$sort": {"entries.items.clanPoints":-1}},

                //{ "$group": {"_id": "$_id", "entries": { "$push": "$entries" }}},
                { "$group": { "_id": {"_id": "$_id", "date": "$entries.date", "entries":"$entries"} } },
                { "$sort": {"_id.date":1,"_id.entries.items.clanPoints":-1}},
                //{ "$group": { "_id" : { "_id":"$_id._id", "date": "$_id.entries.date"}, "items": { "$push": "$_id.entries.items" }} },
                {
                    "$group": {
                        "_id": { "date": "$_id.entries.date" },
                        "items": { "$push": {"name": "$_id.entries.items.name",
                                             "tag": "$_id.entries.items.tag",
                                             "clanPoints": "$_id.entries.items.clanPoints"} },
                        "top" : { $first: "$_id.entries.items.clanPoints" }
                    }
                },
                { "$sort": {"_id.date":1}},
                { "$project": {
                    "_id": 0,
                    "date": "$_id.date",
                    "items": { "$slice": ["$items",20] },
                    "top": "$top"
                }},

                /*{ "$project": {
                    "_id": 0,
                    "date": "$_id.date",
                    "tag": "$_id.entries.items.tag",
                    "val": "$_id.entries.items.clanPoints"//{ "$slice": ["$items",20] }
                }},*/

                //{"$limit": 10}
            ], function (err, response) {
                 var responseTotal = response.length;
                 var entriesTotal = response[0].entries.length
                 var itemnsTotal = response[0].entries[0].items.length;
                if (err)
                    throw err;
                if (response.length > 0)
                    callBack(null, response[0].entries);
            });
        }
    }

