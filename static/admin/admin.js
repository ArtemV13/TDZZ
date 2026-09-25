/* Редактор закупочных цен. Работает с ../api/prices.php (нужен пароль) или, для просмотра, с ../data/prices.json. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = null, activeCrop = null, dirty = false;
  var API = '../api/prices.php', PUBLIC = '../data/prices.json';

  function notice(msg, type) {
    var n = $('notice'); n.textContent = msg; n.dataset.type = type || 'ok'; n.hidden = !msg;
  }
  function pw() { return $('password').value.trim(); }
  function setDirty(v) { dirty = v; $('btnSave').disabled = !v || !D; document.title = (v ? '● ' : '') + 'Редактор цен — Зерно Заволжья'; }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var slug = function (s) {
    var m = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(s).toLowerCase().split('').map(function (c) { return m[c] !== undefined ? m[c] : c; }).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('id' + Date.now());
  };
  var uniq = function (base, list) { var id = base, i = 2; while (list.some(function (x) { return x.id === id; })) id = base + '-' + (i++); return id; };

  /* ---------- загрузка / сохранение ---------- */
  function load() {
    notice('Загружаем…', 'info');
    var p = pw();
    var req = p ? fetch(API, { headers: { 'X-Admin-Password': p }, cache: 'no-store' }) : fetch(PUBLIC, { cache: 'no-store' });
    req.then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) {
        D = j; render(); $('app').hidden = false; setDirty(false);
        notice(p ? 'Данные загружены. Можно редактировать.' : 'Загружено без пароля — только просмотр. Введите пароль и нажмите «Загрузить с сайта», чтобы сохранять.', p ? 'ok' : 'info');
        try { sessionStorage.setItem('tdzz-admin-pw', p); } catch (e) { /* ignore */ }
      })
      .catch(function (e) { notice('Не удалось загрузить: ' + e.message, 'error'); });
  }
  function save() {
    if (!pw()) { notice('Введите пароль.', 'error'); return; }
    collect();
    notice('Сохраняем…', 'info');
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw() }, body: JSON.stringify(D) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function () { setDirty(false); notice('Сохранено. Изменения уже на сайте (обновите страницу сайта, чтобы увидеть).', 'ok'); })
      .catch(function (e) { notice('Ошибка сохранения: ' + e.message + '. Можно скачать файл и загрузить его по FTP.', 'error'); });
  }
  function download() {
    collect();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' }));
    a.download = 'prices.json'; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ---------- сбор значений из формы в D ---------- */
  function collect() {
    D.updated = $('fUpdated').value || D.updated;
    D.home_mode = $('fMode').value; D.season = $('fSeason').value.trim();
    D.vat_percent = +$('fVat').value || 0;
    D.basis = { ru: $('fBasisRu').value, en: $('fBasisEn').value };
    D.featured = Array.prototype.map.call($('featured').querySelectorAll('tbody tr'), function (tr) {
      var i = tr.querySelectorAll('input');
      return { title: { ru: i[0].value, en: i[1].value }, sub: { ru: i[2].value, en: i[3].value }, price: i[4].value === '' ? null : +i[4].value };
    }).filter(function (f) { return f.title.ru || f.title.en; });
    var c = crop();
    $('matrix').querySelectorAll('tbody tr').forEach(function (tr, qi) {
      var q = c.qualities[qi]; if (!q) return;
      tr.querySelectorAll('input[data-e]').forEach(function (inp) { q.prices[inp.dataset.e] = inp.value === '' ? null : +inp.value; });
    });
  }
  function crop() { return D.crops.filter(function (c) { return c.id === activeCrop; })[0] || D.crops[0]; }

  /* ---------- отрисовка ---------- */
  function render() {
    $('fUpdated').value = D.updated || '';
    $('fMode').value = ['prices','passport','quiz'].indexOf(D.home_mode) >= 0 ? D.home_mode : 'quiz'; $('fSeason').value = D.season || '';
    $('fVat').value = D.vat_percent || 10;
    $('fBasisRu').value = (D.basis && D.basis.ru) || 'CPT элеватор';
    $('fBasisEn').value = (D.basis && D.basis.en) || 'CPT elevator';
    renderFeatured();
    if (!activeCrop) activeCrop = D.crops[0].id;
    $('cropTabs').innerHTML = D.crops.map(function (c) { return '<button type="button" class="tab' + (c.id === activeCrop ? ' active' : '') + '" data-crop="' + esc(c.id) + '">' + esc(c.label.ru) + '</button>'; }).join('');
    $('cropTabs').querySelectorAll('.tab').forEach(function (b) { b.addEventListener('click', function () { collect(); activeCrop = b.dataset.crop; render(); }); });
    renderMatrix();
  }
  function renderFeatured() {
    var tb = $('featured').querySelector('tbody');
    tb.innerHTML = (D.featured || []).map(function (f) {
      return '<tr><td><input value="' + esc(f.title.ru) + '"></td><td><input value="' + esc(f.title.en) + '"></td><td><input value="' + esc(f.sub.ru) + '"></td><td><input value="' + esc(f.sub.en) + '"></td><td class="num"><input type="number" step="50" value="' + (f.price == null ? '' : f.price) + '"></td><td><button type="button" class="icon-btn" title="Удалить">×</button></td></tr>';
    }).join('');
    tb.querySelectorAll('.icon-btn').forEach(function (b) { b.addEventListener('click', function () { b.closest('tr').remove(); setDirty(true); }); });
  }
  function renderMatrix() {
    var c = crop(), t = $('matrix');
    t.querySelector('thead').innerHTML = '<tr><th>Качество</th>' + D.elevators.map(function (e) { return '<th class="num">' + esc(e.name.ru) + '<span>' + esc(e.region.ru) + '</span></th>'; }).join('') + '</tr>';
    t.querySelector('tbody').innerHTML = c.qualities.map(function (q, qi) {
      return '<tr><td><button type="button" class="qbtn" data-q="' + qi + '"><b>' + esc(q.name.ru) + '</b><span>' + esc(q.sub.ru) + '</span></button></td>' +
        D.elevators.map(function (e) { var v = q.prices ? q.prices[e.id] : null; return '<td class="num"><input type="number" step="50" min="0" placeholder="согл." data-e="' + esc(e.id) + '" value="' + (v == null ? '' : v) + '"></td>'; }).join('') + '</tr>';
    }).join('');
    t.querySelectorAll('.qbtn').forEach(function (b) { b.addEventListener('click', function () { editRow(+b.dataset.q); }); });
  }
  document.addEventListener('input', function (e) { if (e.target.closest('#app')) setDirty(true); });
  // Enter в ячейке — переход к ячейке ниже
  $('matrix').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    var td = e.target.closest('td'), tr = td.parentNode, idx = Array.prototype.indexOf.call(tr.children, td), next = tr.nextElementSibling;
    if (next) { var inp = next.children[idx].querySelector('input'); if (inp) { inp.focus(); inp.select(); } }
  });

  /* ---------- строки качества ---------- */
  var editing = null;
  function editRow(qi) {
    collect();
    var c = crop(), q = qi == null ? null : c.qualities[qi];
    editing = { crop: c, index: qi };
    $('rName').value = q ? q.name.ru : ''; $('rNameEn').value = q ? q.name.en : '';
    $('rSub').value = q ? q.sub.ru : ''; $('rSubEn').value = q ? q.sub.en : '';
    $('rSpecTitle').value = q && q.spec_title ? q.spec_title.ru : ''; $('rSpecTitleEn').value = q && q.spec_title ? q.spec_title.en : '';
    $('rSpec').value = q && q.spec ? (q.spec.ru || []).join(', ') : ''; $('rSpecEn').value = q && q.spec ? (q.spec.en || []).join(', ') : '';
    $('rDelete').hidden = !q;
    $('dlgRow').showModal();
  }
  $('dlgRow').querySelector('form').addEventListener('submit', function () {
    var c = editing.crop, q = editing.index == null ? null : c.qualities[editing.index];
    var split = function (s) { return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
    var nq = {
      id: q ? q.id : uniq(c.id + '-' + slug($('rName').value || 'row'), c.qualities),
      name: { ru: $('rName').value.trim(), en: $('rNameEn').value.trim() || $('rName').value.trim() },
      sub: { ru: $('rSub').value.trim(), en: $('rSubEn').value.trim() || $('rSub').value.trim() },
      spec_title: { ru: $('rSpecTitle').value.trim(), en: $('rSpecTitleEn').value.trim() },
      spec: { ru: split($('rSpec').value), en: split($('rSpecEn').value) },
      prices: q ? q.prices : {}
    };
    if (!nq.name.ru) return;
    if (q) c.qualities[editing.index] = nq; else c.qualities.push(nq);
    setDirty(true); renderMatrix();
  });
  $('rCancel').addEventListener('click', function () { $('dlgRow').close(); });
  $('rDelete').addEventListener('click', function () {
    if (!confirm('Удалить строку «' + $('rName').value + '» из прайса?')) return;
    editing.crop.qualities.splice(editing.index, 1); $('dlgRow').close(); setDirty(true); renderMatrix();
  });
  $('btnAddRow').addEventListener('click', function () { editRow(null); });

  /* ---------- элеваторы ---------- */
  function renderElev() {
    $('elevTable').querySelector('tbody').innerHTML = D.elevators.map(function (e, i) {
      return '<tr data-i="' + i + '"><td><input value="' + esc(e.name.ru) + '"></td><td><input value="' + esc(e.name.en) + '"></td><td><input value="' + esc(e.region.ru) + '"></td><td><input value="' + esc(e.region.en) + '"></td><td><button type="button" class="icon-btn" title="Удалить">×</button></td></tr>';
    }).join('');
    $('elevTable').querySelectorAll('.icon-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.closest('tr').dataset.i, e = D.elevators[i];
        if (!confirm('Удалить элеватор «' + e.name.ru + '» и все его цены?')) return;
        collectElev(); D.elevators.splice(i, 1);
        D.crops.forEach(function (c) { c.qualities.forEach(function (q) { delete q.prices[e.id]; }); });
        setDirty(true); renderElev();
      });
    });
  }
  function collectElev() {
    $('elevTable').querySelectorAll('tbody tr').forEach(function (tr) {
      var e = D.elevators[+tr.dataset.i], i = tr.querySelectorAll('input');
      e.name = { ru: i[0].value.trim(), en: i[1].value.trim() || i[0].value.trim() };
      e.region = { ru: i[2].value.trim(), en: i[3].value.trim() || i[2].value.trim() };
    });
  }
  $('btnElevators').addEventListener('click', function () { collect(); renderElev(); $('dlgElev').showModal(); });
  $('eAdd').addEventListener('click', function () {
    collectElev();
    var name = prompt('Название нового элеватора (RU):'); if (!name) return;
    D.elevators.push({ id: uniq(slug(name), D.elevators), name: { ru: name, en: name }, region: { ru: '', en: '' } });
    setDirty(true); renderElev();
  });
  $('dlgElev').querySelector('form').addEventListener('submit', function () { collectElev(); setDirty(true); renderMatrix(); });

  /* ---------- массовое изменение ---------- */
  $('btnBulk').addEventListener('click', function () {
    var d = +$('bulkDelta').value; if (!d) return;
    $('matrix').querySelectorAll('input[data-e]').forEach(function (inp) { if (inp.value !== '') inp.value = Math.max(0, +inp.value + d); });
    setDirty(true); $('bulkDelta').value = '';
  });

  /* ---------- «Закупаем сегодня» ---------- */
  $('btnAddFeatured').addEventListener('click', function () {
    collect(); D.featured.push({ title: { ru: '', en: '' }, sub: { ru: '', en: '' }, price: null }); renderFeatured(); setDirty(true);
  });

  /* ---------- файл ---------- */
  $('btnDownload').addEventListener('click', download);
  $('fileImport').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { var j = JSON.parse(r.result); if (!j.crops || !j.elevators) throw new Error('нет crops/elevators'); D = j; activeCrop = null; render(); $('app').hidden = false; setDirty(true); notice('Файл загружен в редактор. Нажмите «Сохранить на сайт», чтобы опубликовать.', 'info'); }
      catch (e) { notice('Файл не похож на prices.json: ' + e.message, 'error'); }
    };
    r.readAsText(f);
  });

  $('btnLoad').addEventListener('click', load);
  $('btnSave').addEventListener('click', save);
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') load(); });
  try { var saved = sessionStorage.getItem('tdzz-admin-pw'); if (saved) $('password').value = saved; } catch (e) { /* ignore */ }
  load();
})();
