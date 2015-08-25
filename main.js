'use strict';

(function(){
  var MANIFEST_URL = 'https://xeonchen.github.io/fxos-quick-hotspot/update.webapp';
  var HOTSPOT_KEY = 'tethering.wifi.enabled';
  var ELEMENT_ID = 'quick-hotspot';

  var $$ = document.getElementById.bind(document);

  function log(msg) {
    console.log('[HotSpot] ' + msg);
  }

  // Borrow from $(GAIA)/shared/js/settings_listener.js
  var SettingsListener = {
    _lock: null,
    _observers: [],
    setSetting: function(cset) {
      this.getSettingsLock().set(cset);
    },
    getSettingsLock: function sl_getSettingsLock() {
      if (this._lock && !this._lock.closed) {
        return this._lock;
      }
      var settings = window.navigator.mozSettings;
      return (this._lock = settings.createLock());
    },
    observe: function sl_observe(name, defaultValue, callback) {
      var settings = window.navigator.mozSettings;
      if (!settings) {
        window.setTimeout(function() { callback(defaultValue); });
        return;
      }
      var req;
      try {
        req = this.getSettingsLock().get(name);
      } catch (e) {
        this._lock = null;
        req = this.getSettingsLock().get(name);
      }
      req.addEventListener('success', (function onsuccess() {
        callback(typeof(req.result[name]) != 'undefined' ?
          req.result[name] : defaultValue);
      }));
      var settingChanged = function settingChanged(evt) {
        callback(evt.settingValue);
      };
      settings.addObserver(name, settingChanged);
      this._observers.push({
        name: name,
        callback: callback,
        observer: settingChanged
      });
    },
    unobserve: function sl_unobserve(name, callback) {
      var settings = window.navigator.mozSettings;
      var that = this;
      this._observers.forEach(function(value, index) {
        if (value.name === name && value.callback === callback) {
          settings.removeObserver(name, value.observer);
          that._observers.splice(index, 1);
        }
      });
    }
  };

  function HotSpot() {
    this.inited = false;
    this.hotSpotEnabled = false;
    this.callback = this.syncHotSpot.bind(this);
  }

  HotSpot.prototype.init = function() {
    if (this.inited) { return; }
    log('HotSpot.init');

    var existingContainerEl = $$(ELEMENT_ID);
    if (existingContainerEl) {
      existingContainerEl.parentNode.removeChild(existingContainerEl);
    }

    var containerEl = document.createElement('li');
    containerEl.setAttribute('id', ELEMENT_ID);
    containerEl.innerHTML = '<a aria-label="HotSpotSwitch" href="#" id="quick-hotspot-switch" class="icon bb-button" data-icon="tethering" data-enabled="true" role="button" data-l10n-id="wifi-hotspot"></a>';

    $$('quick-settings').children[0].appendChild(containerEl);

    SettingsListener.observe(HOTSPOT_KEY, false, this.callback);

    $$('quick-hotspot-switch').addEventListener('click', (function() {
      log('click');
      this.enableHotSpot(!this.hotSpotEnabled);
    }).bind(this));

    this.inited = true;
  };

  HotSpot.prototype.uninit = function() {
    if (!this.inited) { return; }
    log('HotSpot.uninit');

    var existingContainerEl = $$(ELEMENT_ID);
    if (existingContainerEl) {
      existingContainerEl.parentNode.removeChild(existingContainerEl);
    }

    SettingsListener.unobserve(HOTSPOT_KEY, this.callback);
    this.inited = false;
  };

  HotSpot.prototype.syncHotSpot = function(value) {
    log('HotSpot.syncHotSpot: ' + value);
    this.hotSpotEnabled = value;

    var e = $$('quick-hotspot-switch');
    if (value) {
      e.setAttribute('style', 'color: #008EAB;');
    } else {
      e.setAttribute('style', '');
    }
  };

  HotSpot.prototype.enableHotSpot = function(value) {
    log('HotSpot.enableHotSpot: ' + value + '(' + typeof value + ')');
    this.syncHotSpot(value);
    var cset = {};
    cset[HOTSPOT_KEY] = !!value;
    SettingsListener.setSetting(cset);
  };

  function AddOnMnmt() {
    if (document.documentElement.dataset.fxosQuickHotspot) {
      log('fxos-quick-hotspot is already injected');
      return;
    }

    this.hotSpotIcon = new HotSpot();
    this.hotSpotIcon.init();

    navigator.mozApps.mgmt.addEventListener('enabledstatechange', this);
    navigator.mozApps.mgmt.addEventListener('uninstall', this);

    document.documentElement.dataset.fxosQuickHotspot = true;
  }

  AddOnMnmt.prototype.handleEvent = function(e) {
    if (e.application.manifestURL !== MANIFEST_URL) {
      return;
    }

    switch (e.type) {
      case 'enabledstatechange':
        log('AddOnMnmt.enabledstatechange: ' + e.application.enabled);
        if (e.application.enabled) {
          this.hotSpotIcon.init();
        } else {
          this.hotSpotIcon.uninit();
        }
        break;
      case 'uninstall':
        log('AddOnMnmt.uninstall: ' + e.type);
        this.hotSpotIcon.uninit();
        navigator.mozApps.mgmt.removeEventListener('enabledstatechange', this);
        navigator.mozApps.mgmt.removeEventListener('uninstall', this);
        document.documentElement.removeAttribute('data-fxos-quick-hotspot');
        break;
    }
  };

  switch (document.readyState) {
    case 'loading':
      document.addEventListener('readystatechange', function onStateChanged() {
        if (document.readyState === 'interactive') {
          document.removeEventListener('readystatechange', onStateChanged);
          new AddOnMnmt();
        }
      });
      break;
    default:
      new AddOnMnmt();
      break;
  }
})();
