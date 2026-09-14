/* Menu practice.
 *
 * Five ways through the same list of items, because memorising a menu is really
 * three different jobs wearing one coat: saying the names, knowing what each
 * dish is, and being able to produce the whole list on request. The modes are
 * split along those lines rather than by which part of the menu they cover.
 *
 * No build step and no libraries - open index.html and it runs. */

(function () {
  'use strict';

  var STORE = 'menu-practice-v1';

  function $(id) { return document.getElementById(id); }

  // ---------- what has been learned ----------
  // A flat map of "category|name" -> true. Keyed by name rather than by index
  // so that adding the missing menu sections later does not shuffle the keys
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

  function keyOf(item) { return item.catId + '|' + item.name; }
  function isLearned(item) { return learned[keyOf(item)] === true; }

  function markLearned(item, yes) {
    if (yes) learned[keyOf(item)] = true;
    else delete learned[keyOf(item)];
    save();
  }

  // ---------- the item list ----------
  // MENU is nested category -> section -> item, which is right for reading and
  // wrong for drilling. Everything below works off a flat list where each item
  // remembers where it came from.
  function flatten(cat) {
    var out = [];
    cat.sections.forEach(function (sec) {
      sec.items.forEach(function (item) {
        out.push({
          name: item.name,
          say: item.say || '',
          desc: item.desc || '',
          speak: item.speak || item.name,
          lang: item.lang || 'en-GB',
          partial: !!item.partial,
          section: sec.name,
          catId: cat.id,
          catName: cat.name
        });
      });
    });
    return out;
  }

  var EVERYTHING = {
    id: 'all',
    name: 'Everything',
    sub: 'The whole menu',
    sections: []
  };

  MENU.forEach(function (cat) {
    cat.sections.forEach(function (sec) {
      // Section names repeat across categories only as "Cocktails"/"Spirits",
      // which are already distinct. Prefixing with the category keeps the
      // combined list readable without renaming anything.
      EVERYTHING.sections.push({
        name: sec.name,
        say: sec.say,
        items: sec.items,
        from: cat.name
      });
    });
  });

  // The flat list of a category is built once and reused - nothing in the app
  // edits an item, only the `learned` map beside it.
  var flatByCat = {};
  MENU.forEach(function (cat) { flatByCat[cat.id] = flatten(cat); });
  flatByCat.all = flatten(EVERYTHING);

  function catById(id) {
    if (id === 'all') return EVERYTHING;
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return MENU[0];
  }

  var current = { cat: MENU[0], items: flatByCat[MENU[0].id] };

  function learnedCount(items) {
    var n = 0;
    items.forEach(function (it) { if (isLearned(it)) n++; });
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
  var SCREENS = ['homeScreen', 'modeScreen', 'listScreen', 'sayScreen', 'cardScreen', 'recallScreen'];

  function show(id) {
    SCREENS.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    stopReading();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (btn) {
    btn.addEventListener('click', function () {
      show(btn.getAttribute('data-back'));
      if (btn.getAttribute('data-back') === 'modeScreen') paintModeMenu();
    });
  });

  // ---------- saying things out loud ----------
  // The browser's own speech synthesis: nothing to host, nothing to license,
  // works with the phone in flight mode. Where a device has no speech at all the
  // buttons simply do not appear - the written "sounds like" is the real guide
  // and the voice is only ever a second opinion.
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
  // If the phone has no French voice the English one still gets the text, which
  // is wrong but harmless - the written guide is what you are learning from.
  function voiceFor(lang) {
    if (!speech.voices.length) loadVoices();
    var want = lang.slice(0, 2).toLowerCase();
    var i;
    for (i = 0; i < speech.voices.length; i++) {
      if (speech.voices[i].lang && speech.voices[i].lang.slice(0, 2).toLowerCase() === want) {
        return speech.voices[i];
      }
    }
    return null;
  }

  // Two things stop the first syllable being clipped, both learned the hard way
  // on the hiragana app:
  //
  //   1. A silent utterance is queued in front. The audio session takes a moment
  //      to open and swallows whatever is playing while it does, so let it
  //      swallow silence instead of the front of the word.
  //   2. Cancelling and speaking in the same tick drops the new utterance on
  //      several engines, so a cancel is given a moment to land.
  //
  // Rate is below normal because these are names you are trying to copy, not
  // sentences you are trying to follow.
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
    if (!speech.ok || !text) return;
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

  // Reading the whole menu aloud queues every item at once. The queue is the
  // engine's, so stopping means cancelling it.
  var reading = false;

  function stopReading() {
    if (!reading) return;
    reading = false;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    $('listSpeakAll').textContent = 'Read it to me';
  }

  function readAll() {
    if (!speech.ok) return;
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

  // ---------- home ----------
  function buildHome() {
    $('homeFlight').textContent = MENU_FLIGHT;

    var box = $('homeChoices');
    box.innerHTML = '';

    MENU.forEach(function (cat) {
      var items = flatByCat[cat.id];
      var btn = document.createElement('button');
      btn.className = 'menu-btn';

      var k = document.createElement('span');
      k.className = 'menu-btn-kicker';
      k.textContent = cat.taste;

      var m = document.createElement('span');
      m.className = 'menu-btn-main';
      m.textContent = cat.name;

      var s = document.createElement('span');
      s.className = 'menu-btn-sub';
      var done = learnedCount(items);
      s.textContent = cat.sub + ' · ' + items.length + ' items' +
        (done ? ' · ' + done + ' learned' : '');

      btn.appendChild(k);
      btn.appendChild(m);
      btn.appendChild(s);
      btn.addEventListener('click', function () { openCategory(cat.id); });
      box.appendChild(btn);
    });

    var all = flatByCat.all;
    $('homeCount').textContent = all.length + ' items ›';
  }

  $('homeEverything').addEventListener('click', function () { openCategory('all'); });

  function openCategory(id) {
    current.cat = catById(id);
    current.items = flatByCat[id];
    paintModeMenu();
    show('modeScreen');
  }

  // ---------- mode menu ----------
  function describedItems() {
    return current.items.filter(function (it) { return it.desc; });
  }

  function paintModeMenu() {
    $('modeTitle').textContent = current.cat.name;
    var done = learnedCount(current.items);
    $('modeKnown').innerHTML = '<b>' + done + '</b> / ' + current.items.length;

    // Spirits and Beer is a list of brand names with no descriptions at all, so
    // the two description modes have nothing to work with there. Rather than
    // letting them open onto an empty screen they are switched off and say why.
    var described = describedItems().length;
    Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (btn) {
      var mode = btn.getAttribute('data-mode');
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
    buildHome();
    $('modeReset').querySelector('span').textContent = 'Cleared';
    setTimeout(function () {
      $('modeReset').querySelector('span').textContent = 'Reset what I have learned';
    }, 1500);
  });

  // ---------- the menu, to read ----------
  function startList() {
    var body = $('listBody');
    body.innerHTML = '';

    $('listSpeakAll').classList.toggle('hidden', !speech.ok);
    $('listHint').textContent = speech.ok
      ? 'Tap a line to hear it and see the whole description.'
      : 'Tap a line to see the whole description. This browser has no speech, so the written guide is all there is.';

    var cat = current.cat;

    cat.sections.forEach(function (sec) {
      var head = document.createElement('div');
      head.className = 'sec-head';
      head.textContent = (sec.from ? sec.from + ' · ' : '') + sec.name;
      if (sec.say) {
        var s = document.createElement('span');
        s.className = 'sec-say';
        s.textContent = '  ' + sec.say;
        head.appendChild(s);
      }
      body.appendChild(head);

      sec.items.forEach(function (raw) {
        // Find the flattened twin so the row shares one `learned` key with the
        // drill modes.
        var item = null;
        for (var i = 0; i < current.items.length; i++) {
          if (current.items[i].name === raw.name) { item = current.items[i]; break; }
        }
        if (!item) return;

        var row = document.createElement('button');
        row.className = 'row' + (isLearned(item) ? ' done' : '');

        var n = document.createElement('div');
        n.className = 'row-name';
        n.textContent = item.name;
        row.appendChild(n);

        if (item.say) {
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

        row.addEventListener('click', function () { sayItem(item); });
        body.appendChild(row);
      });
    });

    // The apologies line under the drinks sections is part of what you are
    // expected to know, so it is shown rather than tidied away.
    var seen = {};
    (cat.id === 'all' ? MENU.map(function (c) { return c.id; }) : [cat.id]).forEach(function (id) {
      if (!MENU_NOTES[id] || seen[MENU_NOTES[id]]) return;
      seen[MENU_NOTES[id]] = true;
      var note = document.createElement('div');
      note.className = 'note';
      note.textContent = MENU_NOTES[id];
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
  var sayItemNow = null;

  function startSay() {
    sayQ = shuffle(current.items);
    nextSay();
    show('sayScreen');
  }

  function nextSay() {
    if (!sayQ.length) {
      sayItemNow = null;
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

    sayItemNow = sayQ.shift();
    $('sayShow').disabled = false;
    $('sayHear').disabled = !speech.ok;
    $('sayGot').disabled = false;
    $('sayAgain').disabled = false;

    $('sayWhere').textContent = (sayItemNow.catId === current.cat.id || current.cat.id !== 'all')
      ? sayItemNow.section
      : sayItemNow.catName + ' · ' + sayItemNow.section;

    $('sayName').textContent = sayItemNow.name;

    var guide = $('sayGuide');
    guide.textContent = sayItemNow.say || 'Nothing tricky here — it reads as it looks.';
    guide.classList.add('hidden');

    $('sayFeedback').textContent = 'Say it out loud first.';
    paintSayScore();
  }

  function paintSayScore() {
    var done = learnedCount(current.items);
    $('sayScore').innerHTML = '<b>' + done + '</b> / ' + current.items.length;
  }

  $('sayShow').addEventListener('click', function () {
    $('sayGuide').classList.toggle('hidden');
  });

  $('sayHear').addEventListener('click', function () {
    if (sayItemNow) sayItem(sayItemNow);
  });

  $('sayGot').addEventListener('click', function () {
    if (!sayItemNow) return;
    markLearned(sayItemNow, true);
    nextSay();
  });

  $('sayAgain').addEventListener('click', function () {
    if (!sayItemNow) return;
    markLearned(sayItemNow, false);
    sayQ.push(sayItemNow);
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

    $('cardWhere').textContent = current.cat.id === 'all'
      ? cardNow.catName + ' · ' + cardNow.section
      : cardNow.section;

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
      if (cardNow.say) {
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
    var cat = current.cat;
    recallSecs = cat.sections.filter(function (s) { return s.items.length > 1; });
    // A section with one item is not worth recalling, but if that is all there
    // is, fall back to the lot rather than showing an empty screen.
    if (!recallSecs.length) recallSecs = cat.sections.slice();
    recallSecs = shuffle(recallSecs);
    recallAt = 0;
    paintRecall();
    show('recallScreen');
  }

  function paintRecall() {
    var sec = recallSecs[recallAt];
    recallShown = 0;

    $('recallSection').textContent = (sec.from ? sec.from + ' · ' : '') + sec.name;
    $('recallCount').textContent = sec.items.length === 1
      ? 'one item'
      : sec.items.length + ' items';

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
  if (!speech.ok) {
    $('sayHear').disabled = true;
    $('listSpeakAll').classList.add('hidden');
  }

  buildHome();
  show('homeScreen');

})();
