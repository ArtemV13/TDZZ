/* TDZZ passport.js — «Оцените партию за 60 секунд». Данные: data/passport.json (встроены в страницу при сборке), элеваторы — из prices.json. */
(function () {
  'use strict';
  var root = (window.TDZZ && window.TDZZ.root) || '';
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
  var isEn = lang === 'en';
  var t = function (ru, en) { return isEn ? en : ru; };
  var L = function (o) { return o && (o[lang] || o.ru || '') || ''; };
  var $ = function (id) { return document.getElementById(id); };
  var box = $('passport'); if (!box) return;
  var P, prices;
  try { P = JSON.parse($('passportData').textContent); prices = JSON.parse($('pricesData').textContent); } catch (e) { return; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var f1 = function (n, step) { var d = (String(step).split('.')[1] || '').length; var s = (+n).toFixed(d); return isEn ? s : s.replace('.', ','); };
  var unitOf = function (p) { return isEn && p.unit_en ? p.unit_en : p.unit; };

  var step = 1, crop = P.crops[0], v = {}, region = '', volume = '', started = Date.now();
  var regions = []; prices.elevators.forEach(function (e) { var r = L(e.region); if (regions.indexOf(r) < 0) regions.push(r); });
  region = regions[0];

  /* ---------- шаг 1: культура ---------- */
  $('ppCrops').innerHTML = P.crops.map(function (c, n) {
    return '<button type="button" class="qc' + (n === 0 ? ' on' : '') + '" data-id="' + esc(c.id) + '"><svg class="qc__ic"><use href="#c-' + esc(c.icon) + '"></use></svg><b>' + esc(L(c.label)) + '</b><span>' + esc(L(c.sub)) + '</span></button>';
  }).join('');
  $('ppCrops').querySelectorAll('.qc').forEach(function (b) {
    b.addEventListener('click', function () {
      $('ppCrops').querySelectorAll('.qc').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
      crop = P.crops.filter(function (c) { return c.id === b.dataset.id; })[0]; v = {}; buildSliders(); calc();
      setTimeout(function () { go(2); }, 200);
    });
  });

  /* ---------- шаг 2: ползунки ---------- */
  function buildSliders() {
    $('ppSliders').innerHTML = crop.params.map(function (p) {
      var val = v[p.k] != null ? v[p.k] : p.default; v[p.k] = val;
      var marks = (p.marks || []).map(function (m) { return '<em style="left:' + ((m - p.min) / (p.max - p.min) * 100) + '%">' + f1(m, p.step) + '</em>'; }).join('');
      return '<div class="sl"><b>' + esc(L(p.label)) + '<small>' + esc(unitOf(p).trim() || '%') + (p.basis != null ? ' · ' + t('норма', 'limit') + ' ' + (p.dir === 'low' ? '≤ ' : '≥ ') + f1(p.basis, p.step) : '') + '</small></b>' +
        '<div class="rng"><div class="rng__marks">' + marks + '</div><input type="range" class="' + (p.dir === 'low' ? 'inv' : '') + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + val + '" data-k="' + p.k + '" aria-label="' + esc(L(p.label)) + '"></div>' +
        '<div class="val" id="pv-' + p.k + '">' + f1(val, p.step) + '</div></div>';
    }).join('');
    $('ppSliders').querySelectorAll('input[type=range]').forEach(function (r) {
      r.addEventListener('input', function () { v[r.dataset.k] = +r.value; calc(); });
    });
  }

  function passes(cond) {
    return Object.keys(cond).every(function (k) { var c = cond[k], x = v[k]; if (x == null) return true; if (c.min != null && x < c.min) return false; if (c.max != null && x > c.max) return false; return true; });
  }
  function calc() {
    var gi = 0; for (; gi < crop.grades.length; gi++) if (passes(crop.grades[gi].cond)) break;
    var g = crop.grades[Math.min(gi, crop.grades.length - 1)];
    var ok = [L(g.ok)], warn = [];
    // что не хватает до градации выше
    if (gi > 0) {
      var up = crop.grades[gi - 1], gaps = [];
      Object.keys(up.cond).forEach(function (k) {
        var p = crop.params.filter(function (x) { return x.k === k; })[0]; if (!p) return;
        var c = up.cond[k], x = v[k];
        if (c.min != null && x < c.min) gaps.push(f1(c.min - x, p.step) + unitOf(p).replace(/^ /, ' ') + ' ' + L(p.label).toLowerCase());
        if (c.max != null && x > c.max) gaps.push(L(p.label).toLowerCase() + ' ' + t('до', 'to') + ' ' + f1(c.max, p.step) + unitOf(p));
      });
      if (gaps.length) warn.push(t('До «', 'To reach “') + L(up.name) + t('» не хватает: ', '” you need: ') + gaps.join(', '));
    }
    // базисные нормы
    crop.params.forEach(function (p) {
      if (p.basis == null) return;
      var bad = p.dir === 'low' ? v[p.k] > p.basis : v[p.k] < p.basis;
      if (bad) {
        var tpl = L((P.notes || {})[p.k] || (P.notes || {}).default || {}) || '';
        warn.push(L(p.label) + ' ' + f1(v[p.k], p.step) + unitOf(p) + ': ' + tpl.replace('{basis}', f1(p.basis, p.step)).replace('{unit}', unitOf(p)));
      }
    });
    $('ppClass').textContent = L(g.name);
    $('ppNotes').innerHTML = ok.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + warn.map(function (x) { return '<li class="w">' + esc(x) + '</li>'; }).join('');
    crop.params.forEach(function (p) {
      var el = $('pv-' + p.k); if (!el) return; el.textContent = f1(v[p.k], p.step);
      var bad = p.basis != null && (p.dir === 'low' ? v[p.k] > p.basis : v[p.k] < p.basis);
      el.className = 'val ' + (bad ? 'warn' : 'ok');
    });
    renderCard(g);
  }

  /* ---------- шаг 3: регион и объём ---------- */
  $('ppRegion').innerHTML = regions.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
  $('ppRegion').addEventListener('change', function () { region = this.value; renderNear(); renderCard(); });
  $('ppVolume').addEventListener('input', function () { volume = this.value; renderCard(); });
  function nearList() { return prices.elevators.filter(function (e) { return L(e.region) === region; }); }
  function renderNear() {
    var n = nearList();
    $('ppNear').innerHTML = n.length ? n.map(function (e) { return '<div><b>' + esc(L(e.name)) + '</b><span>' + esc(L(e.region)) + '</span></div>'; }).join('') : '<div><b>' + t('Подберём ближайшую площадку', 'We will find the nearest site') + '</b></div>';
  }

  /* ---------- карточка-паспорт ---------- */
  var lastGrade = null;
  function renderCard(g) {
    if (g) lastGrade = g;
    $('ppTitle').textContent = L(crop.label) + (lastGrade ? ' · ' + L(lastGrade.name) : '');
    $('ppParams').innerHTML = crop.params.map(function (p) { return '<div><dt>' + esc(L(p.label)) + '</dt><dd>' + f1(v[p.k], p.step) + esc(unitOf(p)) + '</dd></div>'; }).join('') +
      '<div><dt>' + t('Объём', 'Volume') + '</dt><dd>' + (volume ? '~ ' + esc(volume) + ' ' + t('т', 't') : '—') + '</dd></div><div><dt>' + t('Регион', 'Region') + '</dt><dd>' + (step >= 3 ? esc(region) : '—') + '</dd></div>';
    var n = nearList().slice(0, 3);
    $('ppEl').innerHTML = step >= 3 ? n.map(function (e) { return '<div><b>' + esc(L(e.name)) + '</b><span>' + esc(L(e.region)) + '</span></div>'; }).join('') : '';
    $('ppEl').hidden = step < 3;
  }

  /* ---------- шаги ---------- */
  function go(n) {
    step = Math.max(1, Math.min(4, n));
    box.querySelectorAll('#ppSteps span').forEach(function (s) {
      var k = +s.dataset.step; s.className = k === step ? 'on' : (k < step ? 'done' : '');
    });
    box.querySelectorAll('.pp__pane').forEach(function (p) { p.hidden = +p.dataset.pane !== step; });
    $('ppBack').style.visibility = step > 1 ? 'visible' : 'hidden';
    $('ppNext').hidden = step >= 4; $('ppVerdict').hidden = step < 2;
    $('ppHint').hidden = step >= 4; $('ppForm').hidden = step < 4;
    $('ppHint').textContent = step === 1 ? t('Выберите культуру — паспорт начнёт заполняться', 'Pick a crop — the passport starts filling in')
      : step === 2 ? t('Двигайте ползунки. Запрос цены откроется после 4 шага', 'Move the sliders. Price request opens after step 4')
      : t('Ещё один шаг — и можно запросить цену', 'One more step and you can request a price');
    if (step >= 3) renderNear();
    renderCard();
    if (step === 4) $('ppPhone').focus();
  }
  $('ppNext').addEventListener('click', function () { go(step + 1); });
  $('ppBack').addEventListener('click', function () { go(step - 1); });
  box.querySelectorAll('#ppSteps span').forEach(function (s) { s.addEventListener('click', function () { if (+s.dataset.step <= step + 1) go(+s.dataset.step); }); });

  /* ---------- отправка ---------- */
  $('ppForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var phone = $('ppPhone').value.trim(); if (phone.replace(/\D/g, '').length < 10) { $('ppPhone').classList.add('err'); $('ppPhone').focus(); return; }
    if (!this.querySelector('[name=privacy]').checked) return;
    var btn = this.querySelector('[type=submit]'); btn.disabled = true;
    var payload = { form_type: 'passport', phone: phone, name: $('ppName').value.trim(), lang: lang, page: location.href, elapsed: Math.round((Date.now() - started) / 1000),
      commodity: L(crop.label), quality: lastGrade ? L(lastGrade.name) : '', region: region, volume: volume,
      quality_details: crop.params.map(function (p) { return L(p.label) + ' ' + f1(v[p.k], p.step) + unitOf(p); }).join(', '),
      point: nearList().slice(0, 3).map(function (e) { return L(e.name); }).join(', ') };
    var form = this;
    fetch(root + 'api/form.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'fail');
        form.classList.add('sent'); $('ppOkText').textContent = t('Перезвоним на ' + phone + ' в течение 15 минут в рабочее время.', 'We will call ' + phone + ' within 15 minutes during business hours.');
        if (window.ym && window.TDZZ_METRIKA) ym(window.TDZZ_METRIKA, 'reachGoal', 'passport_done');
      })
      .catch(function () { btn.disabled = false; alert(t('Не удалось отправить. Позвоните нам: +7 (8442) 59-97-32', 'Could not send. Please call +7 (8442) 59-97-32')); });
  });

  buildSliders(); calc(); go(1);
})();
