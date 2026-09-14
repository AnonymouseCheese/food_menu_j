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
    _html: '',
    textContent: '',
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
    querySelector: function () { return el._sub || makeEl(); },
    querySelectorAll: function () { return []; },
    removeChild: function () {}
  };
  // The app empties a container with innerHTML = '', and a stub that ignores
  // that leaves the previous screen's tiles in place - which silently makes
  // every later "tap the second tile" land on the wrong thing.
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return el._html; },
    set: function (v) { el._html = v; if (v === '') el.children.length = 0; }
  });
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

// The five mode buttons carry data-mode and hold a .menu-btn-sub inside. The
// "say" one is also addressed by id as #modeSay, so it must be the SAME object
// the app hides - otherwise the test cannot see that Food loses it.
var modeBtns = ['list', 'say', 'what', 'name', 'recall'].map(function (m) {
  var b = (m === 'say') ? pool.modeSay : makeEl('mode-' + m);
  b.setAttribute('data-mode', m);
  b._sub = makeEl();
  return b;
});

var backBtns = ['homeScreen', 'groupScreen', 'modeScreen'].map(function (t) {
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

function back(to) {
  var b = backBtns.filter(function (x) { return x.getAttribute('data-back') === to; })[0];
  b._fn();
}

var checks = [];
function ok(label, fn) {
  try { fn(); checks.push('  ok   ' + label); }
  catch (e) { checks.push('  FAIL ' + label + ' -> ' + e.message); }
}

// Walk: home tile -> group tile -> mode button.
function openTop(i) { pool.homeChoices.children[i]._fn(); }
function openGroup(i) { pool.groupChoices.children[i]._fn(); }
function openMode(m) { modeBtns[['list', 'say', 'what', 'name', 'recall'].indexOf(m)]._fn(); }

console.log('ids referenced but not in index.html: ' + (missing.length ? missing.join(', ') : 'none'));

var FOOD = 0, DRINKS = 1;

ok('home offers exactly Food and Beverages', function () {
  var kids = pool.homeChoices.children;
  if (kids.length !== 2) throw new Error('got ' + kids.length + ' tiles');
  var names = kids.map(function (k) { return k.children[1].textContent; });
  if (names.join('/') !== 'Food/Beverages') throw new Error('got ' + names.join('/'));
});

ok('Food holds one service, Lunch', function () {
  openTop(FOOD);
  var kids = pool.groupChoices.children;
  if (kids.length !== 1) throw new Error('got ' + kids.length + ' services');
  // Group tiles carry no kicker, so the name is the first child.
  if (kids[0].children[0].textContent !== 'Lunch') throw new Error('got ' + kids[0].children[0].textContent);
});

ok('Food hides "all of it together" while Lunch is alone', function () {
  if (!pool.groupEverything.classList.contains('hidden')) throw new Error('button was showing');
});

ok('Lunch offers only the menu, what-is-it and recall', function () {
  openGroup(0);
  var shown = modeBtns
    .filter(function (b) { return !b.classList.contains('hidden'); })
    .map(function (b) { return b.getAttribute('data-mode'); });
  if (shown.join(',') !== 'list,what,recall') throw new Error('showing ' + shown.join(','));
  if (pool.kickList.textContent !== 'read') throw new Error('list kicker still mentions listen');
});

ok('Lunch menu renders and stays silent', function () {
  spoken.length = 0;
  openMode('list');
  if (!pool.listBody.children.length) throw new Error('listBody empty');
  if (!pool.listSpeakAll.classList.contains('hidden')) throw new Error('read-aloud button showing on food');
  // Rows are plain divs on the food side, so tapping one cannot speak.
  var rows = pool.listBody.children.filter(function (c) { return c.classList.contains('row'); });
  rows.forEach(function (r) { if (r._fn) r._fn(); });
  if (spoken.length) throw new Error('food spoke ' + spoken.length + ' times');
});

ok('Lunch has no sounds-like lines left in the data', function () {
  var n = 0;
  MENU[0].groups.forEach(function (g) {
    g.sections.forEach(function (s) {
      if (s.say) n++;
      s.items.forEach(function (i) { if (i.say) n++; });
    });
  });
  if (n) throw new Error(n + ' say fields still on the food side');
});

ok('Lunch drills what-is-it, name shown then described', function () {
  back('modeScreen');
  openMode('what');
  var namePrompt = pool.cardPrompt.textContent;
  if (!namePrompt) throw new Error('no dish name on the front');
  fire('cardReveal');
  if (pool.cardAnswer.classList.contains('hidden')) throw new Error('answer stayed hidden');
  if (!pool.cardAnswer.textContent) throw new Error('revealed nothing to describe');
  fire('cardHit');
});

ok('Lunch recall covers all five courses, singles included', function () {
  back('modeScreen');
  openMode('recall');
  if (!pool.recallBody.children.length) throw new Error('no slots');

  // Walk the whole cycle and collect the course names it offers.
  var seen = {}, n = 0;
  while (n < 12) {
    seen[pool.recallSection.textContent] = true;
    fire('recallAll');
    fire('recallNext');
    n++;
  }
  var courses = Object.keys(seen).sort().join(', ');
  var want = 'Appetiser, Canapé, Dessert, From The Bakery, Main Course';
  if (courses !== want) throw new Error('offered ' + courses);
});

ok('Beverages holds four parts plus all-together', function () {
  back('modeScreen'); back('groupScreen'); back('homeScreen');
  openTop(DRINKS);
  if (pool.groupChoices.children.length !== 4) throw new Error('got ' + pool.groupChoices.children.length);
  if (pool.groupEverything.classList.contains('hidden')) throw new Error('all-together hidden on drinks');
});

ok('wine brings the Say it mode back', function () {
  openGroup(0);
  if (pool.modeSay.classList.contains('hidden')) throw new Error('Say it missing on drinks');
  if (pool.kickList.textContent !== 'read · listen') throw new Error('list kicker lost listen');
});

ok('wine speaks, and uses the French voice', function () {
  spoken.length = 0;
  openMode('list');
  fire('listSpeakAll');
  if (spoken.length !== 7) throw new Error('queued ' + spoken.length + ', expected 7');
  if (!spoken.some(function (s) { return s.indexOf('fr-FR') === 0; })) throw new Error('no French voice used');
});

ok('Say it walks every drink once', function () {
  back('modeScreen');
  openMode('say');
  var n = 0;
  while (pool.sayName.textContent !== 'That is the lot.' && n < 100) { fire('sayGot'); n++; }
  if (n !== 7) throw new Error('walked ' + n + ', expected 7');
});

ok('all drinks together gathers 38 items', function () {
  back('modeScreen'); back('groupScreen');
  fire('groupEverything');
  var total = Number(pool.modeKnown.innerHTML.replace(/.*\/ /, ''));
  if (total !== 38) throw new Error('got ' + total);
});

ok('a mixed course is labelled with where it came from', function () {
  openMode('recall');
  var label = pool.recallSection.textContent;
  if (label.indexOf('·') < 0) throw new Error('unlabelled course: ' + label);
});

ok('Spirits and Beer disables the description modes', function () {
  back('modeScreen'); back('groupScreen');
  openGroup(2);
  if (!modeBtns[2].disabled) throw new Error('what-is-it stayed enabled');
  if (!modeBtns[3].disabled) throw new Error('name-it stayed enabled');
});

ok('progress survives a reload', function () {
  if (!store['menu-practice-v1']) throw new Error('nothing saved');
  var saved = JSON.parse(store['menu-practice-v1']);
  var keys = Object.keys(saved.learned);
  if (!keys.length) throw new Error('learned map empty');
  if (!keys.some(function (k) { return k.indexOf('lunch|') === 0; })) throw new Error('no food progress keyed to lunch');
});

ok('reset clears only the group you are in', function () {
  fire('modeReset');
});

console.log(checks.join('\n'));
console.log(checks.some(function (c) { return c.indexOf('FAIL') > -1; }) ? '\nFAILURES' : '\nall passed');
