/* Fernrow Bakehouse — site behaviour.
   Vanilla, no dependencies, deferred. Everything here is an enhancement:
   the page is complete and readable with this file blocked. */
(function () {
  'use strict';

  var TZ = 'America/Los_Angeles';

  /* Opening hours in minutes past midnight, indexed by JS day (0 = Sunday). */
  var WEEK = [
    [480, 960],  // Sun  8am – 4pm
    [420, 840],  // Mon  7am – 2pm
    null,        // Tue  closed
    [420, 900],  // Wed  7am – 3pm
    [420, 900],  // Thu  7am – 3pm
    [420, 900],  // Fri  7am – 3pm
    [480, 960]   // Sat  8am – 4pm
  ];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* The shop's local clock, not the visitor's. */
  function shopNow() {
    try {
      var p = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(new Date()).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
      var i = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
      var h = parseInt(p.hour, 10) % 24;
      return { day: i < 0 ? new Date().getDay() : i, mins: h * 60 + parseInt(p.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function clock(m) {
    var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + (mm ? ':' + (mm < 10 ? '0' : '') + mm : '') + ap;
  }

  function span(range) { return clock(range[0]) + ' – ' + clock(range[1]); }

  /* ---- Open / closed ----------------------------------------------------- */
  function state() {
    var n = shopNow(), t = WEEK[n.day];
    if (t && n.mins >= t[0] && n.mins < t[1]) {
      return {
        day: n.day, phase: 'open',
        head: (t[1] - n.mins) <= 45 ? 'Closing soon' : 'Open now',
        tail: 'until ' + clock(t[1])
      };
    }
    if (t && n.mins < t[0]) {
      return { day: n.day, phase: 'pre', head: 'Closed', tail: 'opens at ' + clock(t[0]) };
    }
    for (var i = 1; i <= 7; i++) {
      var d = (n.day + i) % 7, nx = WEEK[d];
      if (nx) {
        return {
          day: n.day, phase: t ? 'post' : 'off', head: 'Closed',
          tail: 'open ' + (i === 1 ? 'tomorrow' : DAYS[d]) + ' at ' + clock(nx[0])
        };
      }
    }
    return { day: n.day, phase: 'off', head: 'Closed', tail: '' };
  }

  var s = state();

  var badge = document.getElementById('status');
  if (badge) {
    badge.setAttribute('data-open', s.phase === 'open' ? 'yes' : 'no');
    var txt = document.getElementById('status-txt');
    if (txt) txt.innerHTML = '<b>' + s.head + '</b> <span>· ' + s.tail + '</span>';
  }

  var fact = document.getElementById('fact-today');
  if (fact) {
    var today = WEEK[s.day];
    fact.textContent = today
      ? DAYS[s.day] + ', ' + span(today) + ' · ' +
        (s.phase === 'open' ? s.head.toLowerCase() + ', ' + s.tail : s.tail)
      : 'Closed ' + DAYS[s.day] + 's · ' + s.tail;
  }

  ['hours', 'hours-foot'].forEach(function (id) {
    var list = document.getElementById(id);
    if (!list) return;
    var row = list.querySelector('li[data-day="' + s.day + '"]');
    if (row) row.setAttribute('data-today', '1');
  });

  /* ---- Sticky header + thumb-zone action bar -----------------------------
     Both used to key off a scroll listener, which meant reading scrollY on
     every frame. Read after the reveal observer below had dirtied style, that
     forced a synchronous layout of a 13,000px document — a profile put it at
     ~285ms across one visit. Two 1px markers let IntersectionObserver answer
     "are we past that point yet" with no geometry reads at all. They are
     created here rather than sitting in the HTML so a visitor without JS gets
     no stray elements, and they carry no inline styles: .sentinel lives in the
     stylesheet, which is also where the trigger offsets belong. */
  var hdr = document.getElementById('hdr');
  var bar = document.getElementById('actionbar');

  function sentinel(at, onPast) {
    if (!('IntersectionObserver' in window)) { onPast(true); return; }
    var mark = document.createElement('div');
    mark.className = 'sentinel';
    mark.setAttribute('data-at', at);
    mark.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mark);
    new IntersectionObserver(function (entries) {
      onPast(!entries[entries.length - 1].isIntersecting);
    }).observe(mark);
  }

  if (hdr) sentinel('hdr', function (past) { hdr.classList.toggle('is-stuck', past); });
  if (bar) sentinel('bar', function (past) { bar.setAttribute('data-show', past ? '1' : '0'); });

  /* ---- Reveal on scroll -------------------------------------------------- */
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rises = document.querySelectorAll('.rise');

  if (calm || !('IntersectionObserver' in window)) {
    for (var i = 0; i < rises.length; i++) rises[i].classList.add('rise-in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('rise-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    for (var j = 0; j < rises.length; j++) io.observe(rises[j]);
  }

  /* ---- Map: fetch Google's iframe only if someone asks for it ------------ */
  var more = document.getElementById('map-more');
  var mapCard = document.getElementById('map');
  if (more && mapCard) {
    more.addEventListener('click', function () {
      var live = document.getElementById('map-live');
      if (live) {
        live.remove();
        mapCard.hidden = false;
        more.textContent = 'Show the interactive map';
        return;
      }
      var f = document.createElement('iframe');
      f.id = 'map-live';
      f.className = 'map__live';
      f.title = 'Google map showing 1832 SE Division St, Portland OR';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = 'https://maps.google.com/maps?q=1832+SE+Division+St+Portland+OR+97202&z=15&output=embed';
      mapCard.hidden = true;
      mapCard.parentNode.insertBefore(f, more);
      more.textContent = 'Hide the interactive map';
    });
  }

  /* ---- Contact form -------------------------------------------------------
     Validates properly, then says plainly that nothing is sent. A concept
     project should not imply a message reached anyone. */
  var form = document.getElementById('contact-form');
  if (form) {
    var ok = document.getElementById('cf-ok');
    var rules = {
      'cf-name': function (v) { return v.trim().length >= 2 ? '' : 'Please add a name.'; },
      'cf-email': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please check the email address.'; },
      'cf-msg': function (v) { return v.trim().length >= 10 ? '' : 'A sentence or two is plenty.'; }
    };

    function check(id) {
      var el = document.getElementById(id);
      var out = form.querySelector('.field__err[data-for="' + id + '"]');
      var msg = rules[id](el.value);
      if (out) out.textContent = msg;
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    }

    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('blur', function () { check(id); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pass = Object.keys(rules).map(check).every(Boolean);
      if (!pass) {
        if (ok) ok.hidden = true;
        var bad = form.querySelector('[aria-invalid="true"]');
        if (bad) bad.focus();
        return;
      }
      if (ok) {
        ok.hidden = false;
        ok.textContent = 'That all looks valid — but this is a concept project, so nothing was sent. On a live build it would land in the owner’s inbox.';
      }
    });
  }
})();
