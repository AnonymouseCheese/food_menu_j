// Runs app.js against a stub DOM built from the real ids in index.html, so a
// mistyped getElementById is a loud failure here instead of a dead button on a
// phone. Not part of the app and not loaded by it - run it after editing
// data.js or app.js:
//
//     node smoketest.js
var fs = require('fs');

var html = fs.readFileSync('index.html', 'utf8');
var ids = {};
html.replace(/id="([^"]+)"/g, function (_, id) { ids[id] = true; return _; });

var missing = [];
var listeners = {};

function makeEl(id) {
  var el = {
    id: id || '',
    _class: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    children: [],
    scrollTop: 0,
    classList: {
      _set: {},
      add: function (c) { this._set[c] = true; },
      remove: function (c) { delete this._set[c]; },
      toggle: function (c, on) {
        if (on === undefined) on = !this._set[c];
        if (on) this._set[c] = true; else delete this._set[c];
      },
      contains: function (c) { return !!this._set[c]; }
    },
    appendChild: function (c) { this.children.push(c); return c; },
    setAttribute: function (k, v) { this['_' + k] = v; },
    getAttribute: function (k) { return this['_' + k]; },
    addEventListener: function (ev, fn) {
      if (id) { listeners[id] = listeners[id] || {}; listeners[id][ev] = fn; }
      this._fn = fn;
    },
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    removeChild: function () {}
  };
  Object.defineProperty(el, 'className', {
    get: function () { return el._class; },
    set: function (v) {
      el._class = v;
      el.classList._set = {};
      String(v).split(/\s+/).forEach(function (c) { if (c) el.classList._set[c] = true; });
    }
  });
  return el;
}

var pool = {};
Object.keys(ids).forEach(function (id) { pool[id] = makeEl(id); });

// The five mode buttons carry data-mode and hold a .menu-btn-sub inside.
var modeBtns = ['list', 'say', 'what', 'name', 'recall'].map(function (m) {
  var b = makeEl('mode-' + m);
  b.setAttribute('data-mode', m);
  b._sub = makeEl();
  b.querySelector = function () { return b._sub; };
  return b;
});

var backBtns = ['homeScreen', 'modeScreen'].map(function (t) {
  var b = makeEl('back-' + t);
  b.setAttribute('data-back', t);
  return b;
});

global.document = {
  getElementById: function (id) {
    if (!pool[id]) { missing.push(id); pool[id] = makeEl(id); }
    return pool[id];
  },
  createElement: function () { return makeEl(); },
  addEventListener: function () {},
  querySelectorAll: function (sel) {
    if (sel === '[data-mode]') return modeBtns;
    if (sel === '[data-back]') return backBtns;
    return [];
  },
  querySelector: function () { return makeEl(); }
};

var store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = v; }
};

var spoken = [];
global.window = {
  speechSynthesis: {
    speaking: false,
    pending: false,
    getVoices: function () {
      return [{ lang: 'en-GB', name: 'stub en' }, { lang: 'fr-FR', name: 'stub fr' }];
    },
    speak: function (u) { if (u.text.trim()) spoken.push(u.lang + ': ' + u.text); },
    cancel: function () {}
  },
  SpeechSynthesisUtterance: function (t) { this.text = t; }
};

global.setTimeout = function (fn) { fn(); return 0; };

// ---- run it ----
eval(fs.readFileSync('data.js', 'utf8'));
eval(fs.readFileSync('app.js', 'utf8'));

function fire(id, ev) {
  if (!listeners[id] || !listeners[id][ev || 'click']) throw new Error('no handler bound on #' + id);
  listeners[id][ev || 'click']();
}

var checks = [];
function ok(label, fn) {
  try { fn(); checks.push('  ok   ' + label); }
  catch (e) { checks.push('  FAIL ' + label + ' -> ' + e.message); }
}

console.log('ids referenced but not in index.html: ' + (missing.length ? missing.join(', ') : 'none'));

ok('home built five categories', function () {
  if (pool.homeChoices.children.length !== 5) throw new Error('got ' + pool.homeChoices.children.length);
});

ok('everything button opens a category', function () { fire('homeEverything'); });

ok('the menu renders', function () {
  modeBtns[0]._fn();
  if (!pool.listBody.children.length) throw new Error('listBody empty');
});

ok('read it to me queues every item', function () {
  spoken.length = 0;
  fire('listSpeakAll');
  if (spoken.length !== 49) throw new Error('queued ' + spoken.length + ', expected 49');
  if (!spoken.some(function (s) { return s.indexOf('fr-FR') === 0; })) throw new Error('no French voice used');
});

ok('say it walks the whole category', function () {
  modeBtns[1]._fn();
  var n = 0;
  while (pool.sayName.textContent !== 'That is the lot.' && n < 200) { fire('sayGot'); n++; }
  if (n !== 49) throw new Error('walked ' + n + ' items, expected 49');
});

ok('practise again puts the item back', function () {
  modeBtns[1]._fn();
  var first = pool.sayName.textContent;
  fire('sayAgain');
  var n = 0;
  while (pool.sayName.textContent !== first && n < 200) { fire('sayGot'); n++; }
  if (n === 0 || n >= 200) throw new Error('item did not come back round');
});

ok('what is it? reveals and grades', function () {
  modeBtns[2]._fn();
  fire('cardReveal');
  if (pool.cardAnswer.classList.contains('hidden')) throw new Error('answer stayed hidden');
  fire('cardHit');
});

ok('name it shows the name as the answer', function () {
  modeBtns[3]._fn();
  var prompt = pool.cardPrompt.textContent;
  fire('cardReveal');
  if (!pool.cardAnswer.children.length) throw new Error('no name element in answer');
  if (!prompt) throw new Error('empty prompt');
  fire('cardMiss');
});

ok('recall lists slots and reveals them', function () {
  modeBtns[4]._fn();
  if (!pool.recallBody.children.length) throw new Error('no slots');
  fire('recallAll');
  fire('recallNext');
  if (!pool.recallSection.textContent) throw new Error('no section name');
});

ok('progress survives a reload', function () {
  if (!store['menu-practice-v1']) throw new Error('nothing saved');
  var saved = JSON.parse(store['menu-practice-v1']);
  if (!Object.keys(saved.learned).length) throw new Error('learned map empty');
});

ok('reset clears the category', function () {
  fire('modeReset');
});

ok('spirits disables the description modes', function () {
  // openCategory is internal; reach it the way a tap would - the 4th home tile.
  pool.homeChoices.children[3]._fn();
  if (!modeBtns[2].disabled) throw new Error('what-is-it stayed enabled on Spirits');
  if (!modeBtns[3].disabled) throw new Error('name-it stayed enabled on Spirits');
});

ok('food re-enables them', function () {
  pool.homeChoices.children[0]._fn();
  if (modeBtns[2].disabled) throw new Error('what-is-it stayed disabled on Food');
});

console.log(checks.join('\n'));
console.log(checks.some(function (c) { return c.indexOf('FAIL') > -1; }) ? '\nFAILURES' : '\nall passed');
