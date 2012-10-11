var Core = require('Core');
var Class = Core.Class;
var Events = Core.Events;
var Options = Core.Options;

var Notice = require('UI/Notice');

module.exports = new Class({

  Implements: [Class.Singleton, Class.Binds, Events, Options],

  options: {
    selector: '[data-media]',
    playSelector: 'a.play',
    waveformSelector: 'div.waveform',
    positionSelector: 'div.waveform div.position'
  },

  isPlaying: false,
  mediaIsAvailable: false,
  fileIndex: 0,
  position: 0,

  initialize: function(element, options) {
    return this.check(element) || this.setup(element, options);
  },

  setup: function(element, options) {
    this.setOptions(options);

    element = this.element = document.id(element);
    this.playButton = element.getElement(this.options.playSelector);
    this.waveform = element.getElement(this.options.waveformSelector);
    this.positionIndicator = element.getElement(this.options.positionSelector);
    this.mediaFiles = JSON.parse(element.getElement(this.options.selector).get('html'));
    this.mediaFile = this.pickMediaFile();

    this.playButton.addEvent('click', this.bound('toggle'));
    this.waveform.addEvent('touchstart', this.bound('seek'));
    this.waveform.addEvent('touchmove', this.bound('seek'));

    this.fireEvent('setup');
  },

  toggle: function(event) {
    if (event) event.preventDefault();

    if (this.isPlaying) this.pause();
    else this.play();
  },

  play: function() {
    if (this.isPlaying) return;
    if (!this.mediaIsAvailable) {
      // Cordova: Allow the UI to Update because play() freezes the browser.
      this.fireEvent('load');
      this._play.delay(100, this);
      return;
    }

    this._play();
  },

  _play: function() {
    this.getMedia().play();
    // Cordova: Show the frozen loading indicator until the browser unfreezes "later"
    (function() {
      this.fireEvent('loadFinished');
    }).delay(100, this);
    this.startTimer();
    this.playButton.addClass('pause');
    this.isPlaying = true;
    this.mediaIsAvailable = true;
  },

  pause: function() {
    if (!this.isPlaying) return;
    this.getMedia().pause();
    this.stopTimer();
    this.playButton.removeClass('pause');
    this.isPlaying = false;
  },

  stop: function() {
    if (!this.isPlaying) return;
    if (this.mediaFile) this.getMedia().stop();
    this.stopTimer();
    this.playButton.removeClass('pause');
    this.isPlaying = false;
    this.position = 0;
    this.updateIndicator(0);
  },

  seek: function(event) {
    if (!this.mediaFile) return;
    event.preventDefault();

    this.stopTimer();
    this.previousPosition = event.page.x;
    this.position = this.convertPixelToDuration(this.previousPosition);
    this.updateIndicator(this.convertDurationToPixel(this.position));
    this.waveform.addEvent('touchend:once', this.bound('seekTo'));
  },

  seekTo: function(event) {
    // Recalculate after the media file has been loaded.
    if (!this.mediaIsAvailable) {
      this.play();
      // Cordova: Even though play() is synchronous, the duration will only be available using a delay.
      (function() {
        // In case all media files are unsupported, ignore
        if (!this.mediaFile) return;
        this.position = this.convertPixelToDuration(this.previousPosition);
        this.getMedia().seekTo(this.position);
      }).delay(0, this);
      return;
    }

    if (!this.isPlaying) this.play();
    else this.startTimer();

    this.getMedia().seekTo(this.position);
  },

  getMedia: function() {
    return (this.media) ? this.media : this.media = new Media(this.mediaFile, this.bound('onSuccess'), this.bound('onLoadError'));
  },

  pickMediaFile: function() {
    return this.mediaFiles[this.fileIndex++];
  },

  onSuccess: function() {
    this.stop();
  },

  onLoadError: function(error) {
    console.log(error.code);
    console.log(error.message);

    this.media.stop();
    this.media.release();
    this.media = null;
    this.mediaFile = this.pickMediaFile();
    if (this.mediaFile) this.getMedia().play();
    else this.onError();
  },

  onError: function() {
    this.stop();

    if (!this.notice) this.notice = new Notice('Sorry, your device does not support playback of this audio file. :(', {
      type: 'error'
    });
    else this.notice.push();
  },

  startTimer: function() {
    var period = 250;
    this.stopTimer();
    this.timer = (function() {
      this.position += period;
      this.updateIndicator(this.convertDurationToPixel(this.position));
    }).periodical(period, this);
  },

  stopTimer: function() {
    clearInterval(this.timer);
  },

  updateIndicator: function(position) {
    this.positionIndicator.setStyle('width', position);
  },

  convertPixelToDuration: function(position) {
    var duration = this.getMedia().getDuration();
    var waveform = this.waveform;
    var left = waveform.offsetLeft;
    var width = waveform.offsetWidth;
    var touchPosition = Math.min(Math.max(0, position - left), width);
    return touchPosition / width * duration * 1000;
  },

  convertDurationToPixel: function(position) {
    var duration = this.getMedia().getDuration();
    var width = this.waveform.offsetWidth;
    return position / duration * width / 1000;
  }

});
