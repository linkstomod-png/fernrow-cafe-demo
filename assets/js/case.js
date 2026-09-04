/* Fernrow — /case/ only. Fits the two live device frames to their column.
   The iframes are laid out at their real widths (375 and 1180) so the site
   inside picks the same layout a visitor at that width would get; this only
   scales the finished result down. A transformed element still occupies its
   pre-transform space, so the wrapper's height is set to match.
   The page reads fine with this file blocked — see .no-js .fit in pages.css. */
(function () {
  'use strict';

  var fits = [].slice.call(document.querySelectorAll('.fit'));
  if (!fits.length) return;

  /* Read every width first, then write every height. Interleaving the two —
     measure, set, measure, set — makes the second measurement force a fresh
     layout of the whole document, and Lighthouse rightly charges for it. */
  function fitAll(boxes) {
    var plan = boxes.map(function (box) {
      var w = parseFloat(box.getAttribute('data-w'));
      var h = parseFloat(box.getAttribute('data-h'));
      var avail = box.clientWidth;
      if (!w || !h || !avail) return null;
      return { box: box, k: Math.min(1, avail / w), h: h };
    });
    plan.forEach(function (p) {
      if (!p) return;
      p.box.style.setProperty('--k', p.k);
      p.box.style.height = Math.round(p.h * p.k) + 'px';
    });
  }

  /* The observer hands us a width, so this path needs no measurement at all. */
  function fitTo(box, avail) {
    var w = parseFloat(box.getAttribute('data-w'));
    var h = parseFloat(box.getAttribute('data-h'));
    if (!w || !h || !avail) return;
    var k = Math.min(1, avail / w);
    box.style.setProperty('--k', k);
    box.style.height = Math.round(h * k) + 'px';
  }

  fitAll(fits);

  /* Watch width only. Reacting to height would loop, because setting the
     height above is itself a resize of the observed element. */
  if ('ResizeObserver' in window) {
    var seen = new WeakMap();
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) {
        var w = e.contentRect.width;
        if (seen.get(e.target) === w) return;
        seen.set(e.target, w);
        fitTo(e.target, w);
      });
    });
    fits.forEach(function (box) { ro.observe(box); });
  } else {
    window.addEventListener('resize', function () { fitAll(fits); }, { passive: true });
  }
})();
