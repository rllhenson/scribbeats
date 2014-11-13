// Based on the RDIO hello player at
// https://github.com/rdio/hello-web-playback

//var playback_token = "GBFNoGkZ_____2hmc3MyamVoY25hZWV1cG1nOWo5Z3J0cWxhYnMuZWNob25lc3QuY29tZHCxJ4jv3W9-QvtUFR_sSQ==";
//var domain = "labs.echonest.com";
// GAlUW73h_____2R2cHlzNHd5ZXg3Z2M0OXdoaDY3aHdrbmxvY2FsaG9zdEnAdoqzwGv9VuA-PgK12aE=

// var playback_token = "GAlUW73h_____2R2cHlzNHd5ZXg3Z2M0OXdoaDY3aHdrbmxvY2FsaG9zdEnAdoqzwGv9VuA-PgK12aE=";
// var domain = "localhost";
var playback_token = "GBJUW8Wt_____2R2cHlzNHd5ZXg3Z2M0OXdoaDY3aHdrbnN1bGxleS5jYWgudWNmLmVkdUos6ccCFWlXiEygggw5tVg=";
var domain = "sulley.cah.ucf.edu";


// a global variable that will hold a reference to the api swf once it has loaded
var apiswf = null;
var autoPause = false;
var fullTrackCount = 0;
var reverseTime = false;
var curDuration = 0;

var rdioAffiliateLink = 'http://click.linksynergy.com/fs-bin/click?id=C4uB5cRj/Ro&offerid=221756.10000004&type=3&subid=0';
var rdioAffiliateDeepLink = 'http://click.linksynergy.com/fs-bin/click?id=C4uB5cRj/Ro&subid=&offerid=221756.1&type=10&tmpid=7950&RD_PARM1=';

function initRdioPlayer() {
    var url ="http://labs.echonest.com/MusicMazeServer/token?callback=?" ;
    $.getJSON(url, { domain: domain}, function(data) {
        if (data) {
            playback_token = data.token;
        } 
        loadPlayer();
    });
}

function loadPlayer() {
  // on page load use SWFObject to load the API swf into div#apiswf
  var flashvars = {
    'playbackToken': playback_token, // from token.js
    'domain': domain,                // from token.js
    'listener': 'callback_object'    // the global name of the object that will receive callbacks from the SWF
    };
  var params = {
    'allowScriptAccess': 'always'
  };
  var attributes = {};
  swfobject.embedSWF('http://www.rdio.com/api/swf/', // the location of the Rdio Playback API SWF
      'apiswf', // the ID of the element that will be replaced with the SWF
      1, 1, '9.0.0', 'expressInstall.swf', flashvars, params,
      attributes, flashLoadedCheck);
}


function flashLoadedCheck(e) {
    if (!e.success) {
        error("Sorry, this application requires flash");
    }
}

function playID(id, pauseImmediately) {
    if (apiswf) {
        autoPause = pauseImmediately;

        id = getTinyId(id);
        apiswf.rdio_play(id);
    }
}

function audioStop() {
    apiswf.rdio_stop();
}

function audioPause() {
    apiswf.rdio_pause();
}

function audioResume() {
    apiswf.rdio_play();
}

function audioMute() {
    apiswf.rdio_setMute(true);
}

function audioUnMute() {
    apiswf.rdio_setMute(false);
}

function getTinyId(id) {
    var idx = id.lastIndexOf(":");
    if (idx >=0) {
        return id.substring(idx + 1);
    } else {
        return id;
    }
}

// the global callback object
var callback_object = {};

callback_object.ready = function ready() {
  // Called once the API SWF has loaded and is ready to accept method calls.

  // find the embed/object element
  apiswf = $('#apiswf').get(0);
  audioReady();
};

callback_object.playStateChanged = function playStateChanged(playState) {
  // The playback state has changed.
  // The state can be: 0 - paused, 1 - playing, 2 - stopped, 3 - buffering or 4 - paused.
    if (playState === 0 || playState === 2) {
        setPlaying(false);
    } else {
        setPlaying(true);
    }

    if (autoPause && playState == 1) {
        autoPause = false;
        apiswf.rdio_pause();
    }

};



callback_object.playingTrackChanged = function playingTrackChanged(playingTrack, sourcePosition) {
  // The currently playing track has changed.
  // Track metadata is provided as playingTrack and the position within the playing source as sourcePosition.
  if (playingTrack !== null) {
    curDuration = playingTrack['duration'];
    $("#song-title").html(playingTrack['name']);
    //$("#song-title").html(getLink(playingTrack['name'], playingTrack['url']));

    $("#artist-name").html(playingTrack['artist']);
    //$("#artist-name").html(getLink(playingTrack['artist'], 
     //   playingTrack['artistUrl']));

    var url = 'http://rdio.com' + playingTrack['albumUrl'];
    var fullUrl = rdioAffiliateDeepLink +  encodeURIComponent(url);
    $("#album-art").html("<a href='" + fullUrl +"' target='rdio'><img id='album-art-img' src='"+playingTrack['icon']+"'/></a>");

    var can_sample = playingTrack['can_sample'];
    var can_stream = playingTrack['duration'] > 30;

    // we need to see two full duration tracks in a row to be considered subscribed
    var subscribed = false;

    if (playingTrack['duration'] === 30) {
        fullTrackCount = 0;
    } else  {
        if (++fullTrackCount >= 2) {
            subscribed = true;
        }
    }

    if ( ! (can_sample || can_stream)) {
        musicNotPlayable();    
    }

    updateSubscribeMessage( subscribed );
    updateBuyMessage( subscribed, url);
  }
};




callback_object.playingSourceChanged = function playingSourceChanged(playingSource) {
  // The currently playing source changed.
  // The source metadata, including a track listing is inside playingSource.
  if (playingSource === null) {
      nothingMoreToPlay();
    }
};

callback_object.volumeChanged = function volumeChanged(volume) {
  // The volume changed to volume, a number between 0 and 1.
};

callback_object.muteChanged = function muteChanged(mute) {
  // Mute was changed. mute will either be true (for muting enabled) or false (for muting disabled).
};

callback_object.positionChanged = function positionChanged(position) {
  //The position within the track changed to position seconds.
  // This happens both in response to a seek and during playback.

  if (reverseTime) {
       if (curDuration > position) {
           position = curDuration - position; 
       }
  }
  $('#track-time').text(fmtTime(position));
};

// Reverses how we display time. When reversed we
// show the amount of time remaining in the song
//
function toggleReverseTime() {
    reverseTime = !reverseTime;
}

function fmtTime(position) {
    var mins = Math.floor(position / 60);
    var secs = Math.floor(position - mins * 60);

    if (mins < 10) {
        mins = "0" + mins;
    }

    if (secs < 10) {
        secs = "0" + secs;
    }

    return mins + ":" + secs;
}

callback_object.queueChanged = function queueChanged(newQueue) {
  // The queue has changed to newQueue.
};

callback_object.shuffleChanged = function shuffleChanged(shuffle) {
  // The shuffle mode has changed.
  // shuffle is a boolean, true for shuffle, false for normal playback order.
};

callback_object.repeatChanged = function repeatChanged(repeatMode) {
  // The repeat mode change.
  // repeatMode will be one of: 0: no-repeat, 1: track-repeat or 2: whole-source-repeat.
};

callback_object.playingSomewhereElse = function playingSomewhereElse() {
  warn("Stopped playing, because you are using Rdio somewhere else");
  // If playback begins somewhere else then playback will stop and this callback will be called.
};


// constructs a anchor link with text and linkshare affiliate link

function getLink(title, urlFragment) {
    var url = 'http://rdio.com/' + urlFragment;
    var fullUrl = rdioAffiliateDeepLink +  encodeURIComponent(url);
    return "<a href='" + fullUrl + "' target='rdio'>" +  title + "</a>";
}

