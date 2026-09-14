/* Menu practice.
 *
 * Three levels: Food or Beverages, then a service within it, then how you want
 * to practise. Food and drinks are different jobs and get different tools -
 * the drinks have to be said out loud to a passenger, the food only has to be
 * remembered. `speech: false` on the Food half strips out the Say it mode, the
 * listen buttons and the written "sounds like" lines, so the food side stays a
 * plain memory drill.
 *
 * No build step and no libraries - open index.html and it runs. */

(function () {
  'use strict';

  var STORE = 'menu-practice-v1';

  function $(id) { return document.getElementById(id); }

  // ---------- what has been learned ----------
  // A flat map of "group|name" -> true. Keyed by name rather than by index so
  // that adding Delectables and Light Dinner later does not shuffle the keys
  // and wipe out progress.
  var learned = {};

  try {
    var saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && saved.learned) learned = saved.learned;
  } catch (e) { learned = {}; }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ learned: learned }));
    } catch (e) { /* private browsing, a full disk - not worth a message */ }
  }

  function keyOf(item) { return item.groupId + '|' + item.name; }
  function isLearned(item) { return learned[keyOf(item)] === true; }

  function markLearned(item, yes) {
    if (yes) learned[keyOf(item)] = true;
    else delete learned[keyOf(item)];
    save();
  }

  // ---------- the item list ----------
  // The data is nested for reading and wrong for drilling, so each group also
  // gets a flat list where every item remembers where it came from.
  function flatten(group) {
    var out = [];
    group.sections.forEach(function (sec) {
      sec.items.forEach(function (item) {
        out.push({
          name: item.name,
          say: item.say || '',
          desc: item.desc || '',
          speak: item.speak || item.name,
          lang: item.lang || 'en-GB',
          partial: !!item.partial,
          section: sec.name,
          from: sec.from || '',
          groupId: group.id,
          groupName: group.name
        });
      });
    });
    return out;
  }

  // Each half that has more than one group gets an "all of it together" group,
  // built by gluing the real groups' sections end to end. Sections carry a
  // `from` label so a course reads as "Champagne and Wine · Red" once mixed.
  MENU.forEach(function (top) {
    top.groups.forEach(function (g) { g.top = top; });

    if (top.groups.length > 1) {
      var all = { id: top.id + '-all', name: 'All ' + top.name.toLowerCase(), sub: 'Everything at once', sections: [], top: top };
      top.groups.forEach(function (g) {
        g.sections.forEach(function (sec) {
          all.sections.push({ name: sec.name, say: sec.say, items: sec.items, from: g.name });
        });
      });
      top.everything = all;
    }
  });

  var flatCache = {};

  function itemsOf(group) {
    if (!flatCache[group.id]) flatCache[group.id] = flatten(group);
    return flatCache[group.id];
  }

  // What is on screen right now.
  var current = { top: MENU[0], group: null, items: [] };

  function speechOn() { return current.top.speech !== false && speech.ok; }

  function learnedCount(items) {
    var n = 0;
    items.forEach(function (it) { if (isLearned(it)) n++; });
    return n;
  }

  function countIn(top) {
    var n = 0;
    top.groups.forEach(function (g) { n += itemsOf(g).length; });
    return n;
  }

  function learnedIn(top) {
    var n = 0;
    top.groups.forEach(function (g) { n += learnedCount(itemsOf(g)); });
    return n;
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- screens ----------
  var SCREENS = ['homeScreen', 'groupScreen', 'modeScreen', 'listScreen', 'sayScreen', 'cardScreen', 'recallScreen'];

  function show(id) {
    SCREENS.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    stopReading();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (btn) {
    btn.addEventListener('click', function () {
      var to = btn.getAttribute('data-back');
      show(to);
      if (to === 'homeScreen') buildHome();
      if (to === 'groupScreen') paintGroups();
      if (to === 'modeScreen') paintModeMenu();
    });
  });

  // ---------- saying things out loud ----------
  // The browser's own speech synthesis: nothing to host, nothing to license,
  // works with the phone in flight mode. Where a device has no speech at all
  // the buttons do not appear - the written "sounds like" is the real guide and
  // the voice is only ever a second opinion.
  var speech = { ok: false, voices: [] };

  try {
    speech.ok = !!(window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function');
  } catch (e) { speech.ok = false; }

  function loadVoices() {
    if (!speech.ok) return;
    try { speech.voices = window.speechSynthesis.getVoices() || []; } catch (e) { speech.voices = []; }
  }

  if (speech.ok) {
    loadVoices();
    try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
  }

  // A French voice for the French wines, an English one for everything else.
  function voiceFor(lang) {
    if (!speech.voices.length) loadVoices();
    var want = lang.slice(0, 2).toLowerCase();
    for (var i = 0; i < speech.voices.length; i++) {
      if (speech.voices[i].lang && speech.voices[i].lang.slice(0, 2).toLowerCase() === want) {
        return speech.voices[i];
      }
    }
    return null;
  }

  // Two things stop the first syllable being clipped:
  //
  //   1. A silent utterance is queued in front. The audio session takes a
  //      moment to open and swallows whatever is playing while it does, so let
  //      it swallow silence instead of the front of the word.
  //   2. Cancelling and speaking in the same tick drops the new utterance on
  //      several engines, so a cancel is given a moment to land.
  function utter(text, lang, volume) {
    var u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang || 'en-GB';
    var v = voiceFor(u.lang);
    if (v) u.voice = v;
    u.rate = 0.82;
    u.pitch = 0.95;
    u.volume = (typeof volume === 'number') ? volume : 0.8;
    return u;
  }

  // The very first speak of a page's life is often dropped outright, which is
  // why a listen button can need tapping twice. Opening the session silently on
  // the first touch anywhere means it is warm before you ask for audio.
  var primed = false;

  function prime() {
    if (!speech.ok || primed) return;
    primed = true;
    try { window.speechSynthesis.speak(utter(' ', 'en-GB', 0)); } catch (e) {}
  }

  if (speech.ok) {
    try {
      document.addEventListener('pointerdown', prime, true);
      document.addEventListener('click', prime, true);
    } catch (e) {}
  }

  function say(text, lang) {
    if (!speechOn() || !text) return;
    prime();
    try {
      var go = function () {
        window.speechSynthesis.speak(utter(' ', lang, 0));
        window.speechSynthesis.speak(utter(text, lang));
      };
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        setTimeout(go, 80);
      } else {
        go();
      }
    } catch (e) { /* not worth interrupting practice over */ }
  }

  function sayItem(item) { say(item.speak, item.lang); }

  var reading = false;

  function stopReading() {
    if (!reading) return;
    reading = false;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    $('listSpeakAll').textContent = 'Read it to me';
  }

  function readAll() {
    if (!speechOn()) return;
    if (reading) { stopReading(); return; }
    prime();
    reading = true;
    $('listSpeakAll').textContent = 'Stop';
    try {
      window.speechSynthesis.cancel();
      setTimeout(function () {
        if (!reading) return;
        window.speechSynthesis.speak(utter(' ', 'en-GB', 0));
        current.items.forEach(function (it) {
          window.speechSynthesis.speak(utter(it.speak, it.lang));
        });
        var tail = utter(' ', 'en-GB', 0);
        tail.onend = function () { stopReading(); };
        window.speechSynthesis.speak(tail);
      }, 80);
    } catch (e) { stopReading(); }
  }

  // ---------- a menu tile ----------
  function tile(kicker, main, sub, onTap) {
    var btn = document.createElement('button');
    btn.className = 'menu-btn';

    if (kicker) {
      var k = document.createElement('span');
      k.className = 'menu-btn-kicker';
      k.textContent = kicker;
      btn.appendChild(k);
    }

    var m = document.createElement('span');
    m.className = 'menu-btn-main';
    m.textContent = main;
    btn.appendChild(m);

    var s = document.createElement('span');
    s.className = 'menu-btn-sub';
    s.textContent = sub;
    btn.appendChild(s);

    btn.addEventListener('click', onTap);
    return btn;
  }

  // ---------- home: food or beverages ----------
  function buildHome() {
    $('homeFlight').textContent = MENU_FLIGHT;

    var box = $('homeChoices');
    box.innerHTML = '';

    MENU.forEach(function (top) {
      var total = countIn(top);
      var done = learnedIn(top);
      var sub = top.sub + ' · ' + total + ' items' + (done ? ' · ' + done + ' learned' : '');
      box.appendChild(tile(top.taste, top.name, sub, function () { openTop(top); }));
    });
  }

  function openTop(top) {
    current.top = top;
    paintGroups();
    show('groupScreen');
  }

  // ---------- which service ----------
  function paintGroups() {
    var top = current.top;
    $('groupTitle').textContent = top.name;
    $('groupKnown').innerHTML = '<b>' + learnedIn(top) + '</b> / ' + countIn(top);

    var box = $('groupChoices');
    box.innerHTML = '';

    top.groups.forEach(function (g) {
      var items = itemsOf(g);
      var done = learnedCount(items);
      var sub = g.sub + ' · ' + items.length + ' items' + (done ? ' · ' + done + ' learned' : '');
      box.appendChild(tile('', g.name, sub, function () { openGroup(g); }));
    });

    // Only worth offering once there is more than one thing to combine. Food
    // has just Lunch for now, so the button stays hidden until Delectables and
    // Light Dinner arrive.
    var all = top.everything;
    $('groupEverything').classList.toggle('hidden', !all);
    if (all) {
      $('groupCount').textContent = itemsOf(all).length + ' items ›';
    }
  }

  $('groupEverything').addEventListener('click', function () {
    if (current.top.everything) openGroup(current.top.everything);
  });

  function openGroup(group) {
    current.group = group;
    current.items = itemsOf(group);
    paintModeMenu();
    show('modeScreen');
  }

  // ---------- mode menu ----------
  function describedItems() {
    return current.items.filter(function (it) { return it.desc; });
  }

  function paintModeMenu() {
    $('modeTitle').textContent = current.group.name;
    var done = learnedCount(current.items);
    $('modeKnown').innerHTML = '<b>' + done + '</b> / ' + current.items.length;

    var voice = speechOn();
    $('kickList').textContent = voice ? 'read · listen' : 'read';
    $('subList').textContent = voice
      ? 'Everything in order, tap any line to hear it'
      : 'Everything in order, as it is printed';

    // A half can name the modes that suit it. Food lists only the three that
    // are a memory job; anything it leaves out is gone from the screen rather
    // than greyed out, because it is never coming back for that half.
    var allowed = current.top.modes || null;
    var described = describedItems().length;

    Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (btn) {
      var mode = btn.getAttribute('data-mode');

      var offered = allowed ? allowed.indexOf(mode) > -1 : true;
      if (mode === 'say' && !voice) offered = false;
      btn.classList.toggle('hidden', !offered);
      if (!offered) return;

      // Spirits and Beer is brand names with no descriptions, so the two
      // description modes have nothing to work with there. Rather than opening
      // onto an empty screen they switch off and say why.
      if (mode !== 'what' && mode !== 'name') return;
      var sub = btn.querySelector('.menu-btn-sub');
      if (described < 2) {
        btn.disabled = true;
        sub.textContent = 'This part of the menu has no descriptions to learn';
      } else {
        btn.disabled = false;
        sub.textContent = mode === 'what'
          ? 'You see the name. Describe it from memory'
          : 'You see the description. Give it its name';
      }
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-mode');
      if (mode === 'list') startList();
      else if (mode === 'say') startSay();
      else if (mode === 'recall') startRecall();
      else startCards(mode);
    });
  });

  $('modeReset').addEventListener('click', function () {
    current.items.forEach(function (it) { delete learned[keyOf(it)]; });
    save();
    paintModeMenu();
    $('modeReset').querySelector('span').textContent = 'Cleared';
    setTimeout(function () {
      $('modeReset').querySelector('span').textContent = 'Reset what I have learned';
    }, 1500);
  });

  // ---------- the menu, to read ----------
  function startList() {
    var voice = speechOn();
    var body = $('listBody');
    body.innerHTML = '';

    $('listSpeakAll').classList.toggle('hidden', !voice);
    $('listHint').textContent = voice
      ? 'Tap a line to hear it said out loud.'
      : 'The whole service, in the order it is printed.';

    var group = current.group;
    var byName = {};
    current.items.forEach(function (it) { byName[it.name] = it; });

    group.sections.forEach(function (sec) {
      var head = document.createElement('div');
      head.className = 'sec-head';
      head.textContent = (sec.from ? sec.from + ' · ' : '') + sec.name;
      if (sec.say && voice) {
        var s = document.createElement('span');
        s.className = 'sec-say';
        s.textContent = '  ' + sec.say;
        head.appendChild(s);
      }
      body.appendChild(head);

      sec.items.forEach(function (raw) {
        var item = byName[raw.name];
        if (!item) return;

        // Only a tappable button where tapping does something.
        var row = document.createElement(voice ? 'button' : 'div');
        row.className = 'row' + (isLearned(item) ? ' done' : '');

        var n = document.createElement('div');
        n.className = 'row-name';
        n.textContent = item.name;
        row.appendChild(n);

        if (item.say && voice) {
          var g = document.createElement('div');
          g.className = 'row-say';
          g.textContent = item.say;
          row.appendChild(g);
        }

        if (item.desc) {
          var d = document.createElement('div');
          d.className = 'row-desc';
          d.textContent = item.desc + (item.partial ? ' …' : '');
          row.appendChild(d);

          if (item.partial) {
            var c = document.createElement('div');
            c.className = 'row-cut';
            c.textContent = 'cut off in the screenshot';
            row.appendChild(c);
          }
        }

        if (voice) row.addEventListener('click', function () { sayItem(item); });
        body.appendChild(row);
      });
    });

    // The apologies line under the drinks sections is part of what you are
    // expected to know, so it is shown rather than tidied away.
    var notes = {};
    (group.top.groups).forEach(function (g) {
      var mine = (group.id === g.id) || (current.top.everything && group.id === current.top.everything.id);
      if (mine && g.note) notes[g.note] = true;
    });
    Object.keys(notes).forEach(function (text) {
      var note = document.createElement('div');
      note.className = 'note';
      note.textContent = text;
      body.appendChild(note);
    });

    body.scrollTop = 0;
    show('listScreen');
  }

  $('listSpeakAll').addEventListener('click', readAll);

  // ---------- say it ----------
  // A queue rather than a random pick each time, so one pass covers everything
  // once. "Practise again" puts the item back at the end instead of dropping it.
  var sayQ = [];
  var sayNow = null;

  function startSay() {
    sayQ = shuffle(current.items);
    nextSay();
    show('sayScreen');
  }

  function nextSay() {
    if (!sayQ.length) {
      sayNow = null;
      $('sayWhere').textContent = '';
      $('sayName').textContent = 'That is the lot.';
      $('sayGuide').classList.add('hidden');
      $('sayFeedback').textContent = 'Go back and pick another part of the menu.';
      $('sayShow').disabled = true;
      $('sayHear').disabled = true;
      $('sayGot').disabled = true;
      $('sayAgain').disabled = true;
      paintSayScore();
      return;
    }

    sayNow = sayQ.shift();
    $('sayShow').disabled = false;
    $('sayHear').disabled = !speechOn();
    $('sayGot').disabled = false;
    $('sayAgain').disabled = false;

    $('sayWhere').textContent = whereOf(sayNow);
    $('sayName').textContent = sayNow.name;

    var guide = $('sayGuide');
    guide.textContent = sayNow.say || 'Nothing tricky here — it reads as it looks.';
    guide.classList.add('hidden');

    $('sayFeedback').textContent = 'Say it out loud first.';
    paintSayScore();
  }

  function whereOf(item) {
    return item.from ? item.from + ' · ' + item.section : item.section;
  }

  function paintSayScore() {
    $('sayScore').innerHTML = '<b>' + learnedCount(current.items) + '</b> / ' + current.items.length;
  }

  $('sayShow').addEventListener('click', function () {
    $('sayGuide').classList.toggle('hidden');
  });

  $('sayHear').addEventListener('click', function () {
    if (sayNow) sayItem(sayNow);
  });

  $('sayGot').addEventListener('click', function () {
    if (!sayNow) return;
    markLearned(sayNow, true);
    nextSay();
  });

  $('sayAgain').addEventListener('click', function () {
    if (!sayNow) return;
    markLearned(sayNow, false);
    sayQ.push(sayNow);
    nextSay();
  });

  // ---------- what is it? / name it ----------
  // One screen, two directions. `cardMode` is 'what' (name on the front) or
  // 'name' (description on the front).
  var cardMode = 'what';
  var cardQ = [];
  var cardNow = null;

  function startCards(mode) {
    cardMode = mode;
    $('cardTitle').textContent = mode === 'what' ? 'What is it?' : 'Name it';
    cardQ = shuffle(describedItems());
    nextCard();
    show('cardScreen');
  }

  function nextCard() {
    $('cardAnswer').classList.add('hidden');
    $('cardCut').classList.add('hidden');
    $('cardRevealRow').classList.remove('hidden');
    $('cardGradeRow').classList.add('hidden');

    if (!cardQ.length) {
      cardNow = null;
      $('cardWhere').textContent = '';
      $('cardPrompt').textContent = 'That is the lot.';
      $('cardFeedback').textContent = 'Go back and pick another part of the menu.';
      $('cardReveal').disabled = true;
      paintCardScore();
      return;
    }

    cardNow = cardQ.shift();
    $('cardReveal').disabled = false;
    $('cardWhere').textContent = whereOf(cardNow);

    if (cardMode === 'what') {
      $('cardPrompt').textContent = cardNow.name;
      $('cardFeedback').textContent = 'What is in it? Say it as you would to a passenger.';
    } else {
      $('cardPrompt').textContent = cardNow.desc + (cardNow.partial ? ' …' : '');
      $('cardFeedback').textContent = 'Which item is this?';
    }

    paintCardScore();
  }

  function paintCardScore() {
    $('cardScore').textContent = cardQ.length + ' to go';
  }

  $('cardReveal').addEventListener('click', function () {
    if (!cardNow) return;

    var box = $('cardAnswer');
    box.innerHTML = '';

    if (cardMode === 'what') {
      box.textContent = cardNow.desc;
    } else {
      var n = document.createElement('span');
      n.className = 'ans-name';
      n.textContent = cardNow.name;
      box.appendChild(n);
      if (cardNow.say && speechOn()) {
        var g = document.createElement('span');
        g.className = 'ans-say';
        g.textContent = cardNow.say;
        box.appendChild(g);
      }
    }

    box.classList.remove('hidden');
    $('cardCut').classList.toggle('hidden', !(cardMode === 'what' && cardNow.partial));
    $('cardRevealRow').classList.add('hidden');
    $('cardGradeRow').classList.remove('hidden');
    $('cardFeedback').textContent = 'Did you have it?';
    sayItem(cardNow);
  });

  $('cardHit').addEventListener('click', function () {
    if (cardNow) markLearned(cardNow, true);
    nextCard();
  });

  $('cardMiss').addEventListener('click', function () {
    if (cardNow) {
      markLearned(cardNow, false);
      cardQ.push(cardNow);
    }
    nextCard();
  });

  // ---------- recall a whole course ----------
  // The one mode that tests the shape of the menu rather than any single item:
  // you are told the course and how many things are on it, and have to produce
  // them before looking.
  var recallSecs = [];
  var recallAt = 0;
  var recallShown = 0;

  function startRecall() {
    // Every course, including the ones holding a single item. "Canapé - one
    // item" is still a fair question: you have to know there is exactly one and
    // what it is. Dropping them would quietly hide three of Lunch's five
    // courses.
    recallSecs = shuffle(current.group.sections.slice());
    recallAt = 0;
    paintRecall();
    show('recallScreen');
  }

  function paintRecall() {
    var sec = recallSecs[recallAt];
    recallShown = 0;

    $('recallSection').textContent = (sec.from ? sec.from + ' · ' : '') + sec.name;
    $('recallCount').textContent = sec.items.length === 1 ? 'one item' : sec.items.length + ' items';
    // Hide the whole row, not just the button - an empty .actions row would
    // still take up its padding above the reveal buttons.
    $('recallNextRow').classList.toggle('hidden', recallSecs.length < 2);

    var body = $('recallBody');
    body.innerHTML = '';

    sec.items.forEach(function (item, i) {
      var slot = document.createElement('div');
      slot.className = 'slot';
      slot.setAttribute('data-i', String(i));

      var num = document.createElement('div');
      num.className = 'slot-num';
      num.textContent = (i + 1) + '.';

      var text = document.createElement('div');
      text.className = 'slot-text';
      text.textContent = '— — —';

      slot.appendChild(num);
      slot.appendChild(text);
      body.appendChild(slot);
    });

    body.scrollTop = 0;
    $('recallReveal').disabled = false;
  }

  function revealSlot(i) {
    var sec = recallSecs[recallAt];
    if (i >= sec.items.length) return;
    var slot = $('recallBody').querySelector('.slot[data-i="' + i + '"]');
    if (!slot) return;
    slot.classList.add('shown');
    slot.querySelector('.slot-text').textContent = sec.items[i].name;
  }

  $('recallReveal').addEventListener('click', function () {
    var sec = recallSecs[recallAt];
    if (recallShown >= sec.items.length) return;
    revealSlot(recallShown);
    var item = sec.items[recallShown];
    say(item.speak || item.name, item.lang || 'en-GB');
    recallShown++;
    if (recallShown >= sec.items.length) $('recallReveal').disabled = true;
  });

  $('recallAll').addEventListener('click', function () {
    var sec = recallSecs[recallAt];
    for (var i = recallShown; i < sec.items.length; i++) revealSlot(i);
    recallShown = sec.items.length;
    $('recallReveal').disabled = true;
  });

  $('recallNext').addEventListener('click', function () {
    recallAt = (recallAt + 1) % recallSecs.length;
    paintRecall();
  });

  // ---------- go ----------
  buildHome();
  show('homeScreen');

})();
