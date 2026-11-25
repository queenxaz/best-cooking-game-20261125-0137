// The Golden Ladle — Rush Hour Kitchen
// Original game, written for make.fun best-cooking-game-20261125-0137.
// No network, no libraries: plain DOM + CSS + WebAudio. Mouse + keyboard.
(function () {
  'use strict';

  // ---------------- data ----------------
  var INGREDIENTS = [
    { id: 'tomato',   name: 'Tomato',   emoji: '🍅', prep: 'chop', key: '1' },
    { id: 'lettuce',  name: 'Lettuce',  emoji: '🥬', prep: 'chop', key: '2' },
    { id: 'cucumber', name: 'Cucumber', emoji: '🥒', prep: 'chop', key: '3' },
    { id: 'mushroom', name: 'Mushroom', emoji: '🍄', prep: 'chop', key: '4' },
    { id: 'pasta',    name: 'Pasta',    emoji: '🍝', prep: 'cook', key: '5', cookTime: 6 },
    { id: 'patty',    name: 'Patty',    emoji: '🥩', prep: 'cook', key: '6', cookTime: 7 },
    { id: 'egg',      name: 'Egg',      emoji: '🥚', prep: 'cook', key: '7', cookTime: 5 },
    { id: 'cheese',   name: 'Cheese',   emoji: '🧀', prep: 'ready', key: '8' },
    { id: 'bun',      name: 'Bun',      emoji: '🍞', prep: 'ready', key: '9' },
  ];
  var ING = {};
  INGREDIENTS.forEach(function (i) { ING[i.id] = i; });

  var DISHES = [
    { id: 'salad',    name: 'Garden Salad',      emoji: '🥗', needs: ['lettuce', 'tomato', 'cucumber'], price: 12 },
    { id: 'pasta',    name: 'Tomato Pasta',      emoji: '🍝', needs: ['pasta', 'tomato', 'cheese'],    price: 18 },
    { id: 'burger',   name: 'Sizzling Burger',   emoji: '🍔', needs: ['bun', 'patty', 'lettuce'],     price: 22 },
    { id: 'omelette', name: 'Mushroom Omelette', emoji: '🍳', needs: ['egg', 'mushroom', 'cheese'],   price: 16 },
  ];
  var DISH = {};
  DISHES.forEach(function (d) { DISH[d.id] = d; });

  var SHIFT_SECONDS = 180;
  var TARGET_COINS = 150;
  var ORDER_PATIENCE = 45;      // seconds per order
  var ORDER_SPAWN_EVERY = 11;   // seconds
  var MAX_ORDERS = 4;
  var CHOPS_NEEDED = 3;
  var BURN_AFTER = 4;           // seconds past done before it burns

  // ---------------- state ----------------
  var S = null;
  function freshState() {
    return {
      running: false, paused: false, over: false,
      timeLeft: SHIFT_SECONDS, coins: 0, served: 0, streak: 0,
      hand: null,                 // {ing, state:'raw'|'chopped'|'cooked'|'ready'}
      board: null,                // {ing, chops}
      pans: [null, null],         // {ing, t, done, burnt}
      plate: [],                  // [{ing, state}]
      orders: [],                 // {id, dish, patience}
      nextOrderId: 1, spawnIn: 2,
      muted: false, startedAt: 0,
    };
  }

  // ---------------- dom ----------------
  function $(id) { return document.getElementById(id); }
  var el = {};
  ['timer','coins','served','combo','target','tickets','bins','hand','hand-item',
   'btn-trash','board','board-slot','board-progress','plate','plate-items','plate-match',
   'btn-clear-plate','btn-serve','serve-status','bell','streak','log','overlay',
   'overlay-card','btn-start','btn-sound','btn-pause','btn-restart'].forEach(function (id) {
    el[id] = $(id);
  });

  // ---------------- audio (synthesised, no files) ----------------
  var AC = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, vol, when) {
    if (!S || S.muted) return;
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    var t = c.currentTime + (when || 0);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol) {
    if (!S || S.muted) return;
    var c = ac(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain(); g.gain.value = vol || 0.15;
    src.connect(g); g.connect(c.destination); src.start();
  }
  var sfx = {
    grab: function () { tone(520, 0.07, 'triangle', 0.10); },
    chop: function () { noiseBurst(0.08, 0.22); tone(180, 0.06, 'square', 0.06); },
    place: function () { tone(340, 0.08, 'triangle', 0.10); },
    sizzle: function () { noiseBurst(0.25, 0.10); },
    done: function () { tone(880, 0.12, 'sine', 0.12); tone(1174, 0.18, 'sine', 0.10, 0.1); },
    serve: function () { tone(784, 0.12, 'sine', 0.14); tone(1046, 0.12, 'sine', 0.14, 0.1); tone(1318, 0.25, 'sine', 0.14, 0.2); },
    error: function () { tone(160, 0.18, 'sawtooth', 0.08); },
    expire: function () { tone(220, 0.3, 'sawtooth', 0.10); tone(165, 0.4, 'sawtooth', 0.10, 0.18); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.25, 'sine', 0.14, i * 0.13); }); },
  };

  // ---------------- helpers ----------------
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }
  function log(msg, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = msg;
    el.log.insertBefore(d, el.log.firstChild);
    while (el.log.children.length > 5) el.log.removeChild(el.log.lastChild);
  }
  function itemLabel(it) {
    var ing = ING[it.ing];
    var suffix = it.state === 'chopped' ? ' (chopped)' : it.state === 'cooked' ? ' (cooked)' : it.state === 'raw' ? ' (raw)' : '';
    return ing.emoji + ' ' + ing.name + suffix;
  }
  function dishForPlate(plate) {
    if (plate.length !== 3) return null;
    var ids = plate.map(function (p) { return p.ing; }).sort().join(',');
    for (var i = 0; i < DISHES.length; i++) {
      if (DISHES[i].needs.slice().sort().join(',') === ids) return DISHES[i];
    }
    return null;
  }
  function mult() { return 1 + Math.min(S.streak, 10) * 0.1; }

  // ---------------- rendering ----------------
  function renderTop() {
    el.timer.textContent = fmtTime(S.timeLeft);
    el.timer.classList.toggle('low', S.timeLeft <= 30 && S.running);
    el.coins.textContent = '🪙 ' + S.coins;
    el.served.textContent = String(S.served);
    el.combo.textContent = '×' + mult().toFixed(1);
    el.target.textContent = TARGET_COINS + ' 🪙';
    el.streak.textContent = S.streak > 1
      ? '🔥 ' + S.streak + '-dish streak! Tips pay ×' + mult().toFixed(1) + ' — keep it going!'
      : 'Serve dishes quickly to grow your tip multiplier!';
  }
  function renderHand() {
    if (S.hand) {
      el.hand.classList.add('full');
      el['hand-item'].textContent = itemLabel(S.hand);
    } else {
      el.hand.classList.remove('full');
      el['hand-item'].textContent = '—';
    }
    var held = S.hand ? S.hand.ing : null;
    document.querySelectorAll('.bin').forEach(function (b) {
      b.classList.toggle('selected', b.dataset.ing === held);
    });
  }
  function renderBoard() {
    var slot = el['board-slot'], bar = el['board-progress'];
    if (!S.board) {
      slot.className = 'slot empty'; slot.textContent = 'empty';
      bar.className = 'progress'; bar.firstElementChild.style.width = '0%';
    } else {
      slot.className = 'slot';
      slot.textContent = ING[S.board.ing].emoji + (S.board.chops >= CHOPS_NEEDED ? ' ✓ chopped' : ' · chop ' + S.board.chops + '/' + CHOPS_NEEDED);
      var pct = Math.round(100 * S.board.chops / CHOPS_NEEDED);
      bar.className = 'progress' + (S.board.chops >= CHOPS_NEEDED ? ' done' : '');
      bar.firstElementChild.style.width = pct + '%';
    }
  }
  function renderPans() {
    document.querySelectorAll('.pan').forEach(function (panEl, i) {
      var p = S.pans[i];
      var food = panEl.querySelector('.pan-food');
      var bar = panEl.querySelector('.pan-progress .bar');
      panEl.classList.remove('cooking', 'burnt');
      bar.classList.remove('burnt');
      if (!p) { food.textContent = '·'; bar.style.width = '0%'; return; }
      var ing = ING[p.ing];
      food.textContent = ing.emoji;
      if (p.burnt) {
        panEl.classList.add('burnt'); bar.classList.add('burnt');
        food.textContent = '🔥'; bar.style.width = '100%';
      } else if (p.done) {
        bar.style.width = '100%'; bar.style.background = '#2ecc71';
        food.textContent = ing.emoji + ' ✓';
      } else {
        panEl.classList.add('cooking');
        bar.style.background = '#ff8c1a';
        bar.style.width = Math.round(100 * p.t / ing.cookTime) + '%';
      }
    });
  }
  function renderPlate() {
    var circle = document.querySelector('.plate-circle');
    var box = el['plate-items'];
    if (!S.plate.length) {
      circle.classList.remove('ready');
      box.textContent = 'Empty plate';
      el['plate-match'].textContent = 'Add ingredients to match an order…';
      el['plate-match'].className = 'plate-match';
    } else {
      box.innerHTML = '';
      S.plate.forEach(function (it) {
        var s = document.createElement('span');
        s.className = 'pi'; s.textContent = ING[it.ing].emoji;
        box.appendChild(s);
      });
      var dish = dishForPlate(S.plate);
      var wanted = S.orders.some(function (o) { return dish && o.dish === dish.id; });
      if (dish && wanted) {
        circle.classList.add('ready');
        el['plate-match'].textContent = '✅ ' + dish.emoji + ' ' + dish.name + ' — ready to serve!';
        el['plate-match'].className = 'plate-match good';
      } else if (dish) {
        circle.classList.remove('ready');
        el['plate-match'].textContent = dish.emoji + ' ' + dish.name + ' built — but no order wants it right now.';
        el['plate-match'].className = 'plate-match bad';
      } else {
        circle.classList.remove('ready');
        el['plate-match'].textContent = 'Building… ' + S.plate.length + '/3 ingredients on the plate.';
        el['plate-match'].className = 'plate-match';
      }
    }
    var dish = dishForPlate(S.plate);
    var canServe = !!dish && S.orders.some(function (o) { return o.dish === dish.id; });
    el['btn-serve'].disabled = !canServe || !S.running || S.paused;
    el.bell.classList.toggle('ready', canServe);
    el['serve-status'].textContent = canServe
      ? '✅ ' + dish.emoji + ' ' + dish.name + ' ready!'
      : (S.plate.length ? 'Keep building the dish…' : 'No dish ready');
  }
  function renderOrders() {
    el.tickets.innerHTML = '';
    S.orders.forEach(function (o) {
      var d = DISH[o.dish];
      var t = document.createElement('div');
      t.className = 'ticket' + (o.patience <= 10 ? ' urgent' : '');
      var frac = Math.max(0, o.patience / ORDER_PATIENCE);
      var pclass = frac < 0.25 ? 'patience crit' : frac < 0.5 ? 'patience warn' : 'patience';
      var needHtml = d.needs.map(function (n) {
        var onPlate = S.plate.some(function (p) { return p.ing === n; });
        return '<span class="' + (onPlate ? 'done' : '') + '">' + ING[n].emoji + ' ' + ING[n].name + '</span>';
      }).join(' · ');
      t.innerHTML = '<div class="t-name"><span class="dish-emoji">' + d.emoji + '</span>' + d.name + '</div>' +
        '<div class="t-need">' + needHtml + '</div>' +
        '<div class="' + pclass + '"><div style="width:' + Math.round(100 * frac) + '%"></div></div>' +
        '<div class="t-price">🪙 ' + d.price + ' + tip · ' + Math.ceil(o.patience) + 's patience</div>';
      el.tickets.appendChild(t);
    });
    for (var i = S.orders.length; i < 2; i++) {
      var s = document.createElement('div');
      s.className = 'ticket-slot';
      s.textContent = 'Next order incoming…';
      el.tickets.appendChild(s);
    }
  }
  function renderAll() { renderTop(); renderHand(); renderBoard(); renderPans(); renderPlate(); renderOrders(); }

  // ---------------- actions ----------------
  function grab(ingId) {
    if (!S.running || S.paused || S.over) return;
    if (S.hand) { log('Hands full — use or trash what you hold first.', 'bad'); sfx.error(); return; }
    var ing = ING[ingId];
    S.hand = { ing: ingId, state: ing.prep === 'ready' ? 'ready' : 'raw' };
    sfx.grab(); renderHand(); renderPlate();
  }
  function clickBoard() {
    if (!S.running || S.paused || S.over) return;
    if (S.board) {
      if (S.board.chops < CHOPS_NEEDED) {
        S.board.chops++; sfx.chop();
        if (S.board.chops >= CHOPS_NEEDED) { log('🔪 ' + ING[S.board.ing].name + ' chopped! Click the board to pick it up.', 'good'); sfx.done(); }
        renderBoard(); return;
      }
      if (S.hand) { log('Hands full — put the chopped ' + ING[S.board.ing].name + ' down first.', 'bad'); sfx.error(); return; }
      S.hand = { ing: S.board.ing, state: 'chopped' };
      S.board = null; sfx.grab(); renderBoard(); renderHand(); renderPlate(); return;
    }
    if (!S.hand) { log('Chopping board is empty — grab something choppable first.', 'bad'); sfx.error(); return; }
    var ing = ING[S.hand.ing];
    if (ing.prep !== 'chop' || S.hand.state !== 'raw') { log('The ' + ing.name + ' does not need chopping.', 'bad'); sfx.error(); return; }
    S.board = { ing: S.hand.ing, chops: 0 };
    S.hand = null; sfx.place(); renderBoard(); renderHand();
  }
  function clickPan(i) {
    if (!S.running || S.paused || S.over) return;
    var p = S.pans[i];
    if (p && p.burnt) {
      S.pans[i] = null; log('🗑 Burnt food tossed. Watch the pan timer!', 'bad'); sfx.error(); renderPans(); return;
    }
    if (p && p.done) {
      if (S.hand) { log('Hands full — make room for the cooked ' + ING[p.ing].name + '.', 'bad'); sfx.error(); return; }
      S.hand = { ing: p.ing, state: 'cooked' };
      S.pans[i] = null; sfx.grab(); renderPans(); renderHand(); renderPlate(); return;
    }
    if (p) { log('Still cooking… wait for the green check.', ''); return; }
    if (!S.hand) { log('Pan is empty — grab something cookable first.', 'bad'); sfx.error(); return; }
    var ing = ING[S.hand.ing];
    if (ing.prep !== 'cook' || S.hand.state !== 'raw') { log('The ' + ing.name + ' does not go on the stove.', 'bad'); sfx.error(); return; }
    S.pans[i] = { ing: S.hand.ing, t: 0, done: false, burnt: false };
    S.hand = null; sfx.sizzle(); renderPans(); renderHand();
  }
  function clickPlate() {
    if (!S.running || S.paused || S.over) return;
    if (!S.hand) { log('Nothing in hand — grab an ingredient first.', 'bad'); sfx.error(); return; }
    if (S.plate.length >= 3) { log('Plate is full — serve it or clear it.', 'bad'); sfx.error(); return; }
    if (S.plate.some(function (p) { return p.ing === S.hand.ing; })) {
      log('That is already on the plate.', 'bad'); sfx.error(); return;
    }
    var ing = ING[S.hand.ing];
    if (S.hand.state === 'raw') { log('The ' + ing.name + ' is still raw — chop or cook it first!', 'bad'); sfx.error(); return; }
    S.plate.push(S.hand);
    S.hand = null; sfx.place();
    var dish = dishForPlate(S.plate);
    if (dish) log('🍽️ ' + dish.name + ' assembled on the plate!', 'good');
    renderHand(); renderPlate(); renderOrders();
  }
  function serve() {
    if (!S.running || S.paused || S.over) return;
    var dish = dishForPlate(S.plate);
    if (!dish) { log('Plate does not match any dish yet — check the menu.', 'bad'); sfx.error(); return; }
    var idx = -1;
    for (var i = 0; i < S.orders.length; i++) if (S.orders[i].dish === dish.id) { idx = i; break; }
    if (idx < 0) { log('No open order wants a ' + dish.name + ' right now.', 'bad'); sfx.error(); return; }
    var order = S.orders[idx];
    var patienceFrac = Math.max(0, order.patience / ORDER_PATIENCE);
    var tip = Math.round(dish.price * 0.5 * patienceFrac) + Math.min(S.streak, 10) * 2;
    var earned = Math.round((dish.price + tip) * mult());
    S.coins += earned; S.served++; S.streak++;
    S.orders.splice(idx, 1);
    S.plate = [];
    el.bell.classList.remove('ring'); void el.bell.offsetWidth; el.bell.classList.add('ring');
    sfx.serve();
    log('🔔 Served ' + dish.emoji + ' ' + dish.name + ' — +' + earned + ' 🪙 (tip ' + tip + ')', 'good');
    renderAll();
  }
  function trashHand() {
    if (!S.hand) return;
    log('🗑 Tossed the ' + ING[S.hand.ing].name + '.', '');
    S.hand = null; renderHand(); renderPlate();
  }
  function clearPlate() {
    if (!S.plate.length) return;
    S.plate = []; log('🍽️ Plate cleared.', ''); renderPlate(); renderOrders();
  }

  // ---------------- orders ----------------
  function spawnOrder(dishId) {
    var id = dishId;
    if (!id) {
      // Prefer a dish that is not already on the board, so tickets stay varied.
      var avail = DISHES.filter(function (d) {
        return !S.orders.some(function (o) { return o.dish === d.id; });
      });
      var pool = avail.length ? avail : DISHES;
      id = pool[Math.floor(Math.random() * pool.length)].id;
    }
    S.orders.push({ id: S.nextOrderId++, dish: id, patience: ORDER_PATIENCE });
    log('📋 New order: ' + DISH[id].emoji + ' ' + DISH[id].name, '');
    renderOrders();
  }

  // ---------------- game loop (interval-driven: works even where rAF never
  // fires, e.g. headless shells / background tabs) ----------------
  var lastTick = 0;
  function tick(now) {
    if (!S || !S.running || S.over) return;
    var dt = Math.min(0.5, (now - lastTick) / 1000 || 0);
    lastTick = now;
    if (S.paused) return;
    S.timeLeft -= dt;
    S.spawnIn -= dt;
    if (S.spawnIn <= 0 && S.orders.length < MAX_ORDERS) {
      spawnOrder(); S.spawnIn = ORDER_SPAWN_EVERY;
    }
    for (var i = S.orders.length - 1; i >= 0; i--) {
      S.orders[i].patience -= dt;
      if (S.orders[i].patience <= 0) {
        var d = DISH[S.orders[i].dish];
        S.orders.splice(i, 1);
        S.coins = Math.max(0, S.coins - 10);
        S.streak = 0;
        log('😠 A customer walked out — ' + d.name + ' too slow! −10 🪙', 'bad');
        sfx.expire();
      }
    }
    S.pans.forEach(function (p) {
      if (!p || p.done) return;
      p.t += dt;
      var ing = ING[p.ing];
      if (p.t >= ing.cookTime && !p.done) { p.done = true; log('✅ ' + ing.name + ' is cooked — grab it off the pan!', 'good'); sfx.done(); }
      if (p.t >= ing.cookTime + BURN_AFTER) { p.burnt = true; log('🔥 The ' + ing.name + ' burned!', 'bad'); sfx.expire(); }
    });
    if (S.timeLeft <= 0) { endShift(); return; }
    renderTop(); renderPans(); renderOrders();
  }

  function endShift() {
    S.timeLeft = 0; S.over = true; S.running = false;
    if (S._timer) { clearInterval(S._timer); S._timer = null; }
    renderAll();
    var won = S.coins >= TARGET_COINS;
    var stars = S.coins >= 300 ? 3 : S.coins >= 220 ? 2 : won ? 1 : 0;
    if (won) sfx.win(); else sfx.expire();
    showEnd(won, stars);
  }

  // ---------------- overlays ----------------
  function showOverlay(html) {
    el['overlay-card'].innerHTML = html;
    el.overlay.classList.add('show');
    var start = $('btn-start'), again = $('btn-again');
    if (start) start.addEventListener('click', startShift);
    if (again) again.addEventListener('click', function () { location.hash = ''; startShift(); });
  }
  function showEnd(won, stars) {
    var starRow = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    showOverlay(
      '<div class="ov-emoji">' + (won ? '🏆' : '⏰') + '</div>' +
      '<h1>' + (won ? 'SHIFT COMPLETE!' : "TIME'S UP!") + '</h1>' +
      '<p class="ov-sub">' + (won ? 'The Golden Ladle survives another rush hour.' : 'The dinner rush beat you this time — run it back!') + '</p>' +
      '<div class="stars">' + starRow + '</div>' +
      '<p class="final-stats">🪙 ' + S.coins + ' coins (target ' + TARGET_COINS + ') · 🍽️ ' + S.served +
      ' dishes served · 🔥 best streak ' + S.streak + '</p>' +
      '<p>' + (won
        ? 'The regulars are already asking for you by name. Same time tomorrow, chef?'
        : 'Tip: chop ahead while things cook, and serve fast — patience pays the tip!') + '</p>' +
      '<button id="btn-again">↻ PLAY AGAIN</button>' +
      '<p class="ov-keys">Mouse + keyboard · works fully offline · original game</p>'
    );
  }
  function showPause() {
    showOverlay(
      '<div class="ov-emoji">⏸</div><h1>PAUSED</h1>' +
      '<p class="ov-sub">The kitchen waits for no one… except right now.</p>' +
      '<p>🪙 ' + S.coins + ' coins · 🍽️ ' + S.served + ' served · ' + fmtTime(S.timeLeft) + ' left</p>' +
      '<button id="btn-start">▶ RESUME</button>' +
      '<p class="ov-keys">Press P to resume</p>'
    );
  }

  // ---------------- start / pause ----------------
  function startShift() {
    var keepMuted = S ? S.muted : false;
    S = freshState();
    S.muted = keepMuted;
    S.running = true;
    el.overlay.classList.remove('show');
    el.log.innerHTML = '';
    log('👨‍🍳 Shift started! First orders are in — good luck, chef!', 'good');
    spawnOrder(); spawnOrder();
    S.spawnIn = ORDER_SPAWN_EVERY;
    renderAll();
    lastTick = performance.now();
    if (S._timer) clearInterval(S._timer);
    S._timer = setInterval(function () { tick(performance.now()); }, 250);
  }
  function togglePause() {
    if (!S || !S.running || S.over) return;
    S.paused = !S.paused;
    el['btn-pause'].textContent = S.paused ? '▶' : '⏸';
    if (S.paused) { showPause(); }
    else { el.overlay.classList.remove('show'); lastTick = performance.now(); }
    renderAll();
  }
  function toggleMute() {
    if (!S) S = freshState();
    S.muted = !S.muted;
    el['btn-sound'].textContent = S.muted ? '🔇' : '🔊';
  }

  // ---------------- demo states (for screenshots: real game states) ----------------
  function applyDemo(mode) {
    startShift();
    if (mode === 'title') { S.running = false; S.over = true; S = freshState(); renderAll(); location.hash = ''; showTitle(); return; }
    if (mode === 'board') { S.timeLeft = 167; S.coins = 34; S.served = 2; S.streak = 2; }
    if (mode === 'assembly') {
      S.timeLeft = 142; S.coins = 58; S.served = 3; S.streak = 3;
      S.plate = [{ ing: 'bun', state: 'ready' }, { ing: 'patty', state: 'cooked' }];
      S.hand = { ing: 'lettuce', state: 'chopped' };
      S.board = { ing: 'tomato', chops: 3 };
      if (!S.orders.some(function (o) { return o.dish === 'burger'; })) S.orders.push({ id: S.nextOrderId++, dish: 'burger', patience: 30 });
    }
    if (mode === 'cook') {
      S.timeLeft = 151; S.coins = 46; S.served = 2; S.streak = 1;
      S.pans[0] = { ing: 'patty', t: 5.2, done: false, burnt: false };
      S.pans[1] = { ing: 'pasta', t: 4.6, done: false, burnt: false };
      S.board = { ing: 'lettuce', chops: 2 };
      if (!S.orders.some(function (o) { return o.dish === 'burger'; })) S.orders.push({ id: S.nextOrderId++, dish: 'burger', patience: 26 });
    }
    if (mode === 'serve') {
      S.timeLeft = 118; S.coins = 74; S.served = 4; S.streak = 4;
      S.plate = [{ ing: 'bun', state: 'ready' }, { ing: 'patty', state: 'cooked' }, { ing: 'lettuce', state: 'chopped' }];
      if (!S.orders.some(function (o) { return o.dish === 'burger'; })) S.orders.push({ id: S.nextOrderId++, dish: 'burger', patience: 38 });
      log('🔔 Served 🍔 Sizzling Burger — +31 🪙 (tip 9)', 'good');
    }
    renderAll();
  }
  function showTitle() {
    // Restore the original title card (it is replaced by pause/end overlays).
    el['overlay-card'].innerHTML = TITLE_HTML;
    el.overlay.classList.add('show');
    $('btn-start').addEventListener('click', startShift);
  }

  // ---------------- build bins + wire events ----------------
  var TITLE_HTML = '';
  function init() {
    TITLE_HTML = el['overlay-card'].innerHTML;
    S = freshState();
    INGREDIENTS.forEach(function (ing) {
      var b = document.createElement('div');
      b.className = 'bin'; b.dataset.ing = ing.id;
      b.innerHTML = '<span class="key">' + ing.key + '</span><span class="emoji">' + ing.emoji +
        '</span><span class="bname">' + ing.name + '</span><span class="bprep">' +
        (ing.prep === 'chop' ? '🔪 chop' : ing.prep === 'cook' ? '🔥 cook ' + ing.cookTime + 's' : '✓ ready') + '</span>';
      b.addEventListener('click', function () { grab(ing.id); });
      el.bins.appendChild(b);
    });
    el.board.addEventListener('click', clickBoard);
    document.querySelectorAll('.pan').forEach(function (p, i) {
      p.addEventListener('click', function () { clickPan(i); });
    });
    el.plate.addEventListener('click', clickPlate);
    el['btn-serve'].addEventListener('click', serve);
    el.bell.addEventListener('click', serve);
    el['btn-trash'].addEventListener('click', trashHand);
    el['btn-clear-plate'].addEventListener('click', clearPlate);
    el['btn-start'].addEventListener('click', startShift);
    el['btn-sound'].addEventListener('click', toggleMute);
    el['btn-pause'].addEventListener('click', togglePause);
    el['btn-restart'].addEventListener('click', function () { startShift(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === ' ' ) { e.preventDefault(); serve(); return; }
      if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
      if (e.key === 'r' || e.key === 'R') { startShift(); return; }
      if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
      var ing = INGREDIENTS.filter(function (x) { return x.key === e.key; })[0];
      if (ing) grab(ing.id);
    });
    renderAll();
    var m = /[?&]demo=(board|assembly|cook|serve|title)/.exec(location.search);
    if (m) { setTimeout(function () { applyDemo(m[1]); }, 50); }
    window.__gameReady = true;
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
