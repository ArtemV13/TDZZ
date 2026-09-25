/* TDZZ prices.js — закупочные цены главной страницы.
   Данные: data/prices.json (редактируются в /admin/). Ничего не «генерируется» — что в файле, то и на сайте. */
(function () {
  'use strict';
  var root = (window.TDZZ && window.TDZZ.root) || '';
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
  var isEn = lang === 'en';
  var t = function (ru, en) { return isEn ? en : ru; };
  var L = function (obj) { return obj && (obj[lang] || obj.ru || '') || ''; };

  var $ = function (id) { return document.getElementById(id); };
  var table = $('priceTable');
  if (!table) return;

  var D = null;               // данные prices.json
  var vat = 0, activeCrop = 'wheat', pinned = null;

  var fmtNum = function (n) { return Math.round(n).toLocaleString(isEn ? 'en-US' : 'ru-RU').replace(/,/g, isEn ? ',' : ' '); };
  var withVat = function (n) { return n * (1 + vat / 100); };
  var fmt = function (n) { return fmtNum(withVat(n)); };
  var unit = t('₽/т', 'RUB/t');
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(isEn ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  /* ---------- режим главной: quiz | prices ---------- */
  function applyMode() {
    var mode = D.home_mode === 'prices' ? 'prices' : (D.home_mode === 'passport' ? 'passport' : 'quiz');
    document.documentElement.setAttribute('data-home', mode);
    var cta = $('heroCta');
    if (cta) {
      cta.href = '#' + (mode === 'prices' ? 'prices' : mode);
      cta.innerHTML = (mode === 'quiz' ? t('Продать зерно за 5 вопросов', 'Sell grain in 5 questions') : mode === 'passport' ? t('Оценить партию за 60 секунд', 'Assess your lot in 60 seconds') : t('Закупочные цены', 'Procurement prices')) + ' <svg class="icon"><use href="#i-arrow"></use></svg>';
    }
    return mode;
  }

  /* ---------- карточка в hero: «Закупаем сегодня» (цены) или «Закупаем сейчас» (квиз) ---------- */
  function renderHero(mode) {
    var box = $('heroPrice'), rows = $('heroPriceRows'), head = box && box.querySelector('.hero-price__head span');
    if (!box || !rows) return;
    if (mode !== 'prices') {
      if (head) head.textContent = t('Закупаем сейчас', 'Buying now');
      $('heroPriceDate').textContent = D.season ? t('сезон ', 'season ') + D.season : '';
      rows.innerHTML = D.crops.slice(0, 4).map(function (c) {
        var sub = c.hero_sub ? L(c.hero_sub) : c.qualities.slice(0, 2).map(function (q) { return L(q.name); }).join(' · ');
        return '<div class="hero-price__row"><div><b>' + esc(L(c.label)) + '</b><small>' + esc(sub) + '</small></div><a class="hero-price__go" href="#' + mode + '">' + (mode === 'quiz' ? t('Продать →', 'Sell →') : t('Оценить →', 'Assess →')) + '</a></div>';
      }).join('');
      box.hidden = false; return;
    }
    if (head) head.textContent = t('Закупаем сегодня', 'Buying today');
    var list = (D.featured || []).filter(function (f) { return f && f.price; });
    if (!list.length) { box.hidden = true; return; }
    rows.innerHTML = list.map(function (f) {
      return '<div class="hero-price__row"><div><b>' + esc(L(f.title)) + '</b><small>' + esc(L(f.sub)) + '</small></div><strong>' + fmtNum(f.price) + ' ' + unit + '</strong></div>';
    }).join('');
    $('heroPriceDate').textContent = fmtDate(D.updated);
    box.hidden = false;
  }

  /* ---------- таблица ---------- */
  function crop() { return D.crops.filter(function (c) { return c.id === activeCrop; })[0] || D.crops[0]; }
  function visibleElevators() {
    var region = $('regionSelect') ? $('regionSelect').value : 'all';
    return D.elevators.filter(function (e) { return region === 'all' || L(e.region) === region; });
  }

  function priceCell(q, e, max) {
    var p = q.prices && q.prices[e.id];
    if (p === null || p === undefined || p === '') {
      return '<td><span class="price-cell agreement" data-blur="00 000"><b>' + t('По согласованию', 'By agreement') + '</b></span></td>';
    }
    return '<td><button type="button" class="price-cell' + (p === max ? ' best' : '') + '" data-q="' + esc(q.id) + '" data-e="' + esc(e.id) + '" data-p="' + p + '"><b>' + fmt(p) + '</b><small>' + unit + ' · ' + esc(L(D.basis)).split(' ')[0] + '</small></button></td>';
  }

  function renderTable() {
    var c = crop(), els = visibleElevators();
    var h = '<thead><tr><th>' + t('Культура / качество', 'Crop / quality') + '</th>' +
      els.map(function (e) { return '<th><b>' + esc(L(e.name)) + '</b><span>' + esc(L(e.region)) + '</span></th>'; }).join('') + '</tr></thead><tbody>';
    c.qualities.forEach(function (q, i) {
      var nums = els.map(function (e) { return q.prices && q.prices[e.id]; }).filter(function (v) { return typeof v === 'number'; });
      var max = nums.length ? Math.max.apply(null, nums) : null;
      h += '<tr><th class="quality quality-trigger" tabindex="0" role="button" aria-label="' + esc(t('Показать подробные требования: ', 'Show detailed requirements: ') + L(q.name)) + '" data-row="' + i + '"><b>' + esc(L(q.name)) + '</b><span>' + esc(L(q.sub)) + '</span><em>' + t('Подробнее', 'Details') + '</em></th>' +
        els.map(function (e) { return priceCell(q, e, max); }).join('') + '</tr>';
    });
    table.innerHTML = h + '</tbody>';
    var mw = $('matrixWrap'); if (mw) { mw.scrollLeft = 0; mw.scrollTop = 0; }
    table.querySelectorAll('.price-cell[data-p]').forEach(function (b) { b.addEventListener('click', function () { selectPrice(b); }); });
    attachQuality();
    requestAnimationFrame(updateScrollState);
  }

  /* ---------- поповер с требованиями к качеству ---------- */
  function hideQuality() {
    var pop = $('qualityPopover'); if (pop) pop.classList.remove('show');
    document.querySelectorAll('.quality-trigger').forEach(function (x) { x.classList.remove('details-open'); });
  }
  function showQuality(i, anchor) {
    var q = crop().qualities[i]; if (!q) return;
    var pop = $('qualityPopover'), shell = document.querySelector('.price-shell'); if (!pop || !shell) return;
    $('qualityTitle').textContent = L(q.spec_title) || L(q.name);
    var tags = (q.spec && (q.spec[lang] || q.spec.ru)) || [L(q.sub)];
    $('qualityTags').innerHTML = tags.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
    $('qualityNote').textContent = t('Требования носят справочный характер. Финальная спецификация и допуски подтверждаются менеджером при согласовании партии.',
      'Requirements are indicative. The final specification and tolerances are confirmed by a manager when the lot is agreed.');
    if (!matchMedia('(max-width:640px)').matches) {
      var a = anchor.getBoundingClientRect(), sr = shell.getBoundingClientRect();
      var x = Math.max(260, Math.min(a.right - sr.left + 12, shell.clientWidth - 640)), y = Math.max(136, a.top - sr.top - 6);
      shell.style.setProperty('--quality-x', x + 'px'); shell.style.setProperty('--quality-y', y + 'px');
    }
    pop.classList.add('show');
    document.querySelectorAll('.quality-trigger').forEach(function (x) { x.classList.toggle('details-open', x === anchor); });
  }
  function attachQuality() {
    var hover = matchMedia('(hover:hover)').matches;
    table.querySelectorAll('.quality-trigger').forEach(function (el) {
      var i = +el.dataset.row, open = function () { showQuality(i, el); };
      el.addEventListener('mouseenter', function () { if (hover && pinned === null) open(); });
      el.addEventListener('mouseleave', function () { if (hover && pinned === null) hideQuality(); });
      el.addEventListener('click', function () { pinned = (pinned === i ? null : i); if (pinned === null) hideQuality(); else open(); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
  }

  /* ---------- выбор цены → форма заявки ---------- */
  function selectPrice(btn) {
    var c = crop(), q = c.qualities.filter(function (x) { return x.id === btn.dataset.q; })[0],
      e = D.elevators.filter(function (x) { return x.id === btn.dataset.e; })[0], p = fmt(+btn.dataset.p);
    if (!q || !e) return;
    document.querySelectorAll('.price-cell.selected').forEach(function (x) { x.classList.remove('selected'); });
    btn.classList.add('selected');
    var title = L(e.name) + ' · ' + L(c.label) + ' · ' + L(q.name);
    $('inlineTitle').textContent = title;
    $('inlineMeta').textContent = L(D.basis) + ' · ' + (vat ? t('с НДС', 'incl. VAT') : t('без НДС', 'excl. VAT'));
    $('inlinePrice').textContent = p + ' ' + unit;
    $('inlineSelection').classList.add('show');
    var sp = $('selectedPrice'); if (sp) sp.value = title + ' · ' + p + ' ' + unit + ' · ' + L(D.basis);
    var hint = $('selectedHint'); if (hint) hint.textContent = t('Выбрано из прайса: ', 'Selected from the price list: ') + title + ' · ' + p + ' ' + unit;
    var cropSel = $('crop');
    if (cropSel) {
      var want = L(c.label).split(' ')[0].toLowerCase();
      var opt = Array.prototype.filter.call(cropSel.options, function (o) { return o.value.toLowerCase().indexOf(want) === 0; })[0];
      if (opt) cropSel.value = opt.value;
    }
    var point = $('point');
    if (point) {
      var po = Array.prototype.filter.call(point.options, function (o) { return o.value === L(e.name); })[0];
      if (po) point.value = po.value;
    }
  }

  /* ---------- управление ---------- */
  document.querySelectorAll('#cropTabs .tab').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#cropTabs .tab').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); activeCrop = b.dataset.crop; pinned = null; hideQuality(); renderTable();
    });
  });
  document.querySelectorAll('#vatToggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#vatToggle button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); vat = +b.dataset.vat; renderTable();
    });
  });
  if ($('regionSelect')) $('regionSelect').addEventListener('change', renderTable);
  var matrixWrap = $('matrixWrap');
  function updateScrollState() {
    var l = $('scrollLeft'), r = $('scrollRight'); if (!l || !r || !matrixWrap) return;
    l.disabled = matrixWrap.scrollLeft < 4; r.disabled = matrixWrap.scrollLeft + matrixWrap.clientWidth >= matrixWrap.scrollWidth - 4;
  }
  function scrollCols(dir) {
    var cell = matrixWrap.querySelector('tbody td'), w = cell ? cell.getBoundingClientRect().width : 158;
    matrixWrap.scrollTo({ left: Math.max(0, Math.round((matrixWrap.scrollLeft + dir * w * 3) / w) * w), behavior: 'smooth' });
  }
  if ($('scrollLeft')) $('scrollLeft').addEventListener('click', function () { scrollCols(-1); });
  if ($('scrollRight')) $('scrollRight').addEventListener('click', function () { scrollCols(1); });
  if (matrixWrap) { matrixWrap.addEventListener('scroll', updateScrollState, { passive: true }); addEventListener('resize', updateScrollState); }
  if ($('inlineClose')) $('inlineClose').addEventListener('click', function () {
    $('inlineSelection').classList.remove('show');
    document.querySelectorAll('.price-cell.selected').forEach(function (x) { x.classList.remove('selected'); });
  });
  if ($('qualityClose')) $('qualityClose').addEventListener('click', function () { pinned = null; hideQuality(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { pinned = null; hideQuality(); } });

  /* ---------- загрузка ---------- */
  function init(data) {
    D = data;
    if (!D.vat_percent) D.vat_percent = 10;
    document.querySelectorAll('#vatToggle button[data-vat]').forEach(function (b) { if (+b.dataset.vat > 0) b.dataset.vat = D.vat_percent; });
    var upd = $('pricesUpdated'); if (upd) { upd.textContent = fmtDate(D.updated); upd.setAttribute('datetime', D.updated || ''); }
    // регионы в фильтре — из данных
    var rs = $('regionSelect');
    if (rs) {
      var regions = []; D.elevators.forEach(function (e) { var r = L(e.region); if (regions.indexOf(r) < 0) regions.push(r); });
      rs.innerHTML = '<option value="all">' + t('Все регионы', 'All regions') + '</option>' + regions.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
    }
    // вкладки культур — из данных
    var tabs = $('cropTabs');
    if (tabs) {
      tabs.innerHTML = D.crops.map(function (c, i) { return '<button type="button" class="tab' + (i === 0 ? ' active' : '') + '" data-crop="' + esc(c.id) + '">' + esc(L(c.label)) + '</button>'; }).join('');
      activeCrop = D.crops[0].id;
      tabs.querySelectorAll('.tab').forEach(function (b) {
        b.addEventListener('click', function () {
          tabs.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active'); activeCrop = b.dataset.crop; pinned = null; hideQuality(); renderTable();
        });
      });
    }
    var mode = applyMode();
    renderHero(mode);
    if (mode === 'prices') renderTable();
  }

  var inline = $('pricesData');   // резервная копия данных, встроенная в страницу при сборке
  fetch(root + 'data/prices.json?v=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () {
      if (inline) { try { init(JSON.parse(inline.textContent)); return; } catch (e) { /* ignore */ } }
      var shell = document.querySelector('.price-shell');
      if (shell) shell.innerHTML = '<p class="price-unavailable">' + t('Прайс временно недоступен. Позвоните нам или оставьте заявку ниже — менеджер назовёт актуальную цену.', 'The price list is temporarily unavailable. Call us or leave an enquiry below.') + '</p>';
    });
})();
