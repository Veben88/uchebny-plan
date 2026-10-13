(function () {
  // режим «крупный шрифт и контраст»
  var root = document.documentElement, btn = document.getElementById('acc');
  try { if (localStorage.getItem('access') === '1') root.classList.add('access'); } catch (e) {}
  if (btn) {
    btn.setAttribute('aria-pressed', root.classList.contains('access'));
    btn.addEventListener('click', function () {
      var on = root.classList.toggle('access'); btn.setAttribute('aria-pressed', on);
      try { localStorage.setItem('access', on ? '1' : '0'); } catch (e) {}
    });
  }
  var g = document.getElementById('grid'); if (!g) return;
  var cards = [].slice.call(g.querySelectorAll('.card')), q = document.getElementById('q'),
      cnt = document.getElementById('count'), empty = document.getElementById('empty'), F = {};
  function run() {
    var t = q.value.trim().toLowerCase(), n = 0;
    cards.forEach(function (c) {
      var ok = (!t || c.dataset.text.indexOf(t) >= 0) && (!F.sem || c.dataset.sem === F.sem) && (!F.group || c.dataset.group === F.group) &&
               (!F.kr || c.dataset.kr === '1') && (!F.lab || c.dataset.lab === '1');
      c.hidden = !ok; if (ok) n++;
    });
    cnt.textContent = 'Показано: ' + n + ' из ' + cards.length; empty.hidden = n > 0;
    [].forEach.call(document.querySelectorAll('[data-f]'), function (b) { b.setAttribute('aria-pressed', F[b.dataset.f] === b.dataset.v); });
  }
  [].forEach.call(document.querySelectorAll('[data-f]'), function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.f, v = b.dataset.v;
      if (F[f] === v) delete F[f]; else F[f] = v;
      run();
      if (b.classList.contains('tile')) document.getElementById('list').scrollIntoView({ behavior: 'smooth' });
    });
  });
  q.addEventListener('input', run);
  var p = new URLSearchParams(location.search); ['group', 'sem'].forEach(function (k) { if (p.get(k)) F[k] = p.get(k); });
  run();
})();
