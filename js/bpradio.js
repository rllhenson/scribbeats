// ArtistGraph.js
//
// Author: Plamere
// 
// This is the main code for the Music Maze. It relies heavily on 
// the java infovis toolit (see thejit.org). The Music Maze relies
// on Echo Nest data for artist similarties, and for retrieving info
// on the hotttest songs for each artist.  Audio and album art are
// provided by the audio provider (in this case Rdio)


// Some constants used for communicating with The Echo Nest API
// and the link affiliate

var version = "v1.0";
var host = 'developer.echonest.com';
var std_params = "?api_key=GPMDLFZYI599QAAY8" + "&format=jsonp" + "&callback=?" ;
// var std_params = "?api_key=FAWSGYC7O4C3AYIUE" + "&format=jsonp" + "&callback=?" ;
var std_sim_params = std_params + "&bucket=id:rdio-US&limit=true";

// some global data
var artists = {};       // cache of artist data
var paused = false;     // is audio paused

var cur_artist_info = null;


// Neatly centers a message in the log area. We have different flavors
// of messages (error, warn, info). Currently there's no difference
// between them.

var Log = {
  elem: false,
  write: function(text){
    if (!this.elem) 
      this.elem = document.getElementById('log');
    this.elem.innerHTML = text;
    this.elem.style.left = (500 - this.elem.offsetWidth / 2) + 'px';
  }
};

function error(msg) {
    Log.write(msg);
}

function info(msg) {
    Log.write(msg);
}

function warn(msg) {
    Log.write(msg);
}

function log(msg) {
    Log.write(msg);
}

// Google analytics tracker
function ga_track(action, artist) {
    _gaq.push(['_trackEvent', 'maze', action, artist]);
}

function shuffle(arry) {
    for (var i in arry) {
        var o = Math.floor(Math.random() * arry.length);
        var tmp = arry[i];
        arry[i] = arry[o];
        arry[o] = tmp;
    }
}

// called when there's nothing more
// to play

function nothingMoreToPlay() {
    goToSimilarArtist(cur_artist_info);
}


function musicNotPlayable() {
    warn("Sorry, can't play music for you. You probably live somewhere that Rdio doesn't support yet.");
    audioPause();
}

function updateBuyMessage(subscribed, url) {
    if (subscribed) {
        $("#buy").attr('href', url);
    } else {
        $("#buy").attr('href', apiswf);
    }
}

function next() {
    nothingMoreToPlay();
    return false;
}


function newArtist() {
    var artist_name = $("#artist_name").val();
    fetchArtistByName(artist_name);
    ga_track('search', artist_name);
}

function searchClicked() {
    if ($("#artist_name").val() === "Enter artist name") {
        var artist_name = $("#artist_name").val("");
    }
}


function fetchArtistByName(name) {
    info('Searching for ' + name);
    var url ="http://" + host + "/api/v4/artist/search" + std_sim_params;

    cur_artist_info = null;
    $.getJSON(url, { name: name, results: 1 }, function(data) {
        if (checkResponse(data)) {
            var artists = data.response.artists;
            if (artists.length > 0) {
                var artist = artists[0];
                if (! (artist.id in artists)) {
                    artists[artist.id] = newArtistFromEnArtist(artist);
                } 
                switchToNewArtist(artists[artist.id]);
            } else {
                warn("Couldn't find " + name);
            }
        }
    });
}

function switchToNewArtist(artist_info) {
    cur_artist_info = artist_info;
    info("Playing a song by " + artist_info.name);
    fetchAllSongs(cur_artist_info, true);
    fetchSimilarArtists(cur_artist_info);
}

function goToSimilarArtist(artist_info) {
    if (artist_info !== null && artist_info.similars.length > 0) {
        shuffle(artist_info.similars);
        switchToNewArtist(artist_info.similars[0]);
    } else {
        // fall back artist
        fetchArtistByName("Weezer");
    }
}

function newArtistFromEnArtist(artist) {
    var a = { id : artist.id, name : artist.name, 
            songs : [], 
            similars : [],
            songsExhausted: false, 
            chill_index : 0, upbeat_index:0 };
    return a;
}

function fetchSimilarArtists(artist_info) {
    if (artist_info.similars.length === 0) {
        var url ="http://" + host + "/api/v4/artist/similar" + std_sim_params;

        $.getJSON(url, { id: artist_info.id, results: 10 }, function(data) {
            if (checkResponse(data)) {
                var artists = data.response.artists;
                for (var i = 0; i < artists.length; i++) {
                    artist_info.similars.push(newArtistFromEnArtist(artists[i]));
                }
            }
        });
    }
}


// Performs basic error checking on the return response from the JSONP call
function checkResponse(data) {
    if (data.response) {
        if (data.response.status.code !== 0) {
            error("Whoops... Unexpected error from server. " + data.response.status.message);
        } else {
            return true;
        }
    } else {
        error("Unexpected response from server");
    }
    return false;
}

function fetchAllSongs(artist_info, play) {
    if (! artist_info.songsExhausted) {
        var size = 30;
        var url = "http://" + host + "/api/v4/song/search" + std_params + 
            "&bucket=id:rdio-US&bucket=audio_summary&limit=true&sort=song_hotttnesss-desc&bucket=tracks";

        $.getJSON(url, { artist_id: artist_info.id, start: artist_info.songs.length, results: size }, function(data) {
            if (checkResponse(data)) {
                var songs = data.response.songs;
                for (var i in data.response.songs) {
                    var song = songs[i];
                    if (song.tracks.length > 0) {
                        var track = song.tracks[0];
                        s = {};
                        s.title = song.title;
                        s.id =  track.foreign_id;
                        s.audio_summary = song.audio_summary;
                        s.score = score(s.audio_summary);
                        artist_info.songs.push(s);
                    }
                }
                artist_info.upbeat_index = artist_info.songs.length - 1;
                updateTable(artist_info);
                if (play) {
                    playNormalSong();
                }
                artist_info.songsExhausted = songs.length === 0;
                fetchAllSongs(artist_info, false);
            }
        });
    } else {
        if (play) {
            playNormalSong();
        }
    }
}


function score(as) {
    return (3 * nloudness(as.loudness) + 2 * as.energy + as.danceability + 0.5 * ntempo(as.tempo)) / 4;
}

function nloudness(l) {
    l = l < -50 ? -50 : l > 0 ? 0 : l;
    return 1 - l / -50;
}

function ntempo(t) {
    var min = 50;
    var max =  200;
    t = t < min ? min : t > max ? max : t;
    return (t - min) / (max - min);
}

function playSong(song) {
    playID(song.id, false);
}


function updateTable(artist_info) {
    var html = "<table>";
    var songs = artist_info.songs;
    songs.sort( function(a, b) {
        return a.score - b.score;
    });

    var cool = Math.ceil(artist_info.songs.length * 0.10);
    var hot = Math.ceil(artist_info.songs.length * 0.90);
    for (var i = 0; i < artist_info.songs.length; i++) {
        var s = artist_info.songs[i];
        var song_row = td(i) + 
                        td(PC(s.score)) +
                        td(Math.round(s.audio_summary.loudness)) +
                        td(PC(s.audio_summary.energy)) +
                        td(PC(s.audio_summary.danceability)) +
                        td(Math.round(s.audio_summary.tempo)) + td(s.title);
        var cls = "normal";
        if (i <= cool) {
            cls = "cool";
        } else if (i >= hot) {
            cls = "hot";
        }

        html += tr(cls, song_row);
    }

    html += "</table>";

    $("#song-table").html(html);
}

function th(s) {
    return "<th> " + s + " </th>";
}
 
function td(s) {
    return "<td> " + s + " </td>";
}

function tr(cls, s) {
    return "<tr class='" + cls + "'> " + s + " </tr>";
}

function PC(val) {
    return " " + Math.round(val * 100) + " " ;
}

function toggleMute() {
    if (isMuted()) {
        audioUnMute();
        $("#mute_img").attr('src', 'img/sound.png');
    }  else {
        audioMute();
        $("#mute_img").attr('src', 'img/mute.png');
    }
    return false;
}

function togglePauseResume(event) {
    if (isPaused()) {
        audioResume();
    } else {
        audioPause();
    }
    return false;
}

function setPlaying(playing) {
    if (playing) {
        paused = false;
       $('#pause img').attr('src', 'img/pause.png');
    } else {
        paused = true;
       $('#pause img').attr('src', 'img/play.png');
    }
}

function isPaused() {
    return paused;
}

function isMuted() {
    return $("#mute_img").attr('src') === 'img/mute.png';
}


function playUpbeatSong() {
    if (noSongsCheck()) {
        return;
    }

    var idx = cur_artist_info.upbeat_index;
    if (--cur_artist_info.upbeat_index < cur_artist_info.songs.length * 0.75) {
        cur_artist_info.upbeat_index = cur_artist_info.songs.length - 1;
    }
    var song = cur_artist_info.songs[idx];
    info("Playing an upbeat song by " + cur_artist_info.name);
    playID(song.id, false);
}

function playChillSong() {
    if (noSongsCheck()) {
        return;
    }
    var idx = cur_artist_info.chill_index;
    if (++cur_artist_info.chill_index > cur_artist_info.songs.length * 0.25) {
        cur_artist_info.chill_index = 0;
    }
    var song = cur_artist_info.songs[idx];
    info("Playing a chilled song by " + cur_artist_info.name);
    playID(song.id, false);
}

function playNormalSong() {
    if (noSongsCheck()) {
        return;
    }
    info("Playing a normal song by " + cur_artist_info.name);
    selectSong(cur_artist_info, 0.30, 0.70);
}

function noSongsCheck() {
    if (cur_artist_info === null || cur_artist_info.songs.length === 0) {
        nothingMoreToPlay();
        return true;
    }
    return false;
}


function selectRandomSong(ai, min, max) {
    var minIndex = Math.floor(ai.songs.length * min);
    var maxIndex = Math.floor(ai.songs.length * max);
    var delta = maxIndex - minIndex;
    var index  = Math.floor(Math.random() * delta) + minIndex;
    var song = ai.songs[index];
    playID(song.id, false);
}

function selectSong(ai, min, max) {
    var minIndex = Math.floor(ai.songs.length * min);
    var maxIndex = Math.floor(ai.songs.length * max);
    var delta = maxIndex - minIndex;
    var index  = Math.floor(Math.random() * delta) + minIndex;
    var song = ai.songs[index];
    playID(song.id, false);
}

function configureButtons() {
    $("#pause").click(togglePauseResume);
    $("#next").click(next);
    $("#mute").click(toggleMute);
    $("#upbeat").click(playUpbeatSong);
    $("#chill").click(playChillSong);
    $("#midrange").click(playNormalSong);
    $("#track-time").click(toggleReverseTime);
}


function rowCallback() {
}


function initTable() {
}

function audioReady() {
    init();
}

$(document).ready(function() {
    // this setting affects how array params are sent via getJSON calls
    jQuery.ajaxSettings.traditional = true;  

    $("#song-table").hide();
    configureButtons();
    initTable();
    setPlaying(false);
    initRdioPlayer();
});
