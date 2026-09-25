/* TDZZ quiz.js — «Продать зерно за 5 вопросов». Данные: data/quiz.json (встроены в страницу при сборке). */
(function () {
  'use strict';
  var root = (window.TDZZ && window.TDZZ.root) || '';
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
  var isEn = lang === 'en';
  var t = function (ru, en) { return isEn ? en : ru; };
  var L = function (o) { return o && (o[lang] || o.ru || '') || ''; };
  var $ = function (id) { return document.getElementById(id); };
  var box = $('quiz'); if (!box) return;
  var data; try { data = JSON.parse($('quizData').textContent); } catch (e) { return; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var Q = data.questions, ans = {}, extra = {}, files = [], i = 0, started = Date.now();
  var mgr = data.manager || {};
  $('qzAva').textContent = mgr.initials || '';
  $('qzMgr').textContent = L(mgr.name); $('qzMgrRole').textContent = L(mgr.role);
  $('qzMgrFirst').textContent = (L(mgr.name) || t('Менеджер', 'The manager')).split(' ')[0];


  function optLabel(q, v) { var o = q.options.filter(function (x) { return x.v === v; })[0]; return o ? L(o.t) : v; }
  function answered(q) { return q.multi ? (ans[q.key] || []).length > 0 : !!ans[q.key]; }

  function render() {
    var q = Q[i];
    $('qzStep').textContent = t('Вопрос ', 'Question ') + (i + 1) + t(' из ', ' of ') + Q.length;
    $('qzProg').style.width = ((i + 1) / Q.length * 100) + '%';
    $('qzTime').textContent = '≈ ' + Math.max(10, 60 - i * 12) + t(' секунд', ' sec');
    $('qzQ').textContent = L(q.q); $('qzSub').textContent = L(q.sub);
    var cards = $('qzCards');
    cards.className = 'qz__cards cols-' + (q.cols || 3);
    cards.innerHTML = q.options.map(function (o) {
      var sel = q.multi ? (ans[q.key] || []).indexOf(o.v) >= 0 : ans[q.key] === o.v;
      return '<button type="button" class="qc' + (sel ? ' on' : '') + '" data-v="' + esc(o.v) + '" aria-pressed="' + sel + '">' +
        (o.icon ? '<svg class="qc__ic"><use href="#c-' + esc(o.icon) + '"></use></svg>' : '') +
        '<b>' + esc(L(o.t)) + '</b>' + (L(o.s) ? '<span>' + esc(L(o.s)) + '</span>' : '') + '</button>';
    }).join('');
    cards.querySelectorAll('.qc').forEach(function (c) {
      c.addEventListener('click', function () {
        var v = c.dataset.v;
        if (q.multi) {
          var a = ans[q.key] || []; var k = a.indexOf(v); if (k >= 0) a.splice(k, 1); else a.push(v); ans[q.key] = a;
          c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on'));
        } else {
          ans[q.key] = v;
          cards.querySelectorAll('.qc').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
          c.classList.add('on'); c.setAttribute('aria-pressed', 'true');
          if (q.key === 'quality') { if (v !== 'approx') ['protein', 'gluten', 'moisture', 'trash', 'natura', 'oil'].forEach(function (k) { delete extra[k]; }); if (v === 'none') { files = []; delete extra.comment; } renderExtra(v); }
        }
        side();
      });
    });
    renderExtra(q.key === 'quality' ? ans.quality : null);
    $('qzBack').hidden = !i;
    side();
  }

  /* доп. поля для вопроса о качестве */
  function renderExtra(v) {
    var ex = $('qzExtra');
    if (!v || v === 'none') { ex.hidden = true; ex.innerHTML = ''; return; }
    var fields = '';
    if (v === 'approx') {
      fields = '<div class="qz__fields">' +
        fld('protein', t('Протеин, %', 'Protein, %'), '12,5') + fld('gluten', t('Клейковина, %', 'Gluten, %'), '23') +
        fld('moisture', t('Влажность, %', 'Moisture, %'), '14') + fld('trash', t('Сорная примесь, %', 'Foreign matter, %'), '2') +
        fld('natura', t('Натура, г/л', 'Test weight, g/l'), '750') + fld('oil', t('Масличность, %', 'Oil content, %'), '46') + '</div>';
    }
    ex.innerHTML = '<div class="qz__extra-in">' +
      '<b>' + (v === 'lab' ? t('Протокол анализа', 'Lab report') : t('Что знаете о качестве', 'What you know about the quality')) + '</b>' +
      '<span class="qz__extra-sub">' + (v === 'lab' ? t('Прикрепите PDF или фото протокола — так менеджер назовёт точную цену без уточняющих звонков.', 'Attach a PDF or photo of the report — the manager will quote an exact price without follow-up calls.')
        : t('Заполните, что знаете — остальное определим на элеваторе. Все поля необязательны.', 'Fill in what you know — the rest we test at the elevator. All fields are optional.')) + '</span>' +
      fields +
      '<label class="qz__file" id="qzFileLbl"><input type="file" id="qzFile" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.xls,.xlsx,.doc,.docx" multiple><svg class="icon" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg><span id="qzFileTxt">' + t('Прикрепить файл (PDF, фото, до 10 МБ, необязательно)', 'Attach a file (PDF, photo, up to 10 MB, optional)') + '</span></label>' +
      '<textarea class="input" id="qzDesc" rows="2" placeholder="' + (v === 'lab' ? t('Комментарий: сорт, год урожая, особенности партии', 'Comment: variety, crop year, lot specifics') : t('Комментарий: сорт, год урожая, что ещё важно', 'Comment: variety, crop year, anything else')) + '">' + esc(extra.comment || '') + '</textarea>' +
      '</div>';
    ex.hidden = false;
    ex.querySelectorAll('input[data-x]').forEach(function (inp) { inp.value = extra[inp.dataset.x] || ''; inp.addEventListener('input', function () { extra[inp.dataset.x] = inp.value; }); });
    $('qzDesc').addEventListener('input', function () { extra.comment = this.value; });
    $('qzFile').addEventListener('change', function () {
      files = Array.prototype.slice.call(this.files, 0, 5);
      $('qzFileTxt').textContent = files.length ? files.map(function (f) { return f.name; }).join(', ') : t('Прикрепить файл', 'Attach a file');
      $('qzFileLbl').classList.toggle('has', files.length > 0);
    });
    if (files.length) { $('qzFileTxt').textContent = files.map(function (f) { return f.name; }).join(', '); $('qzFileLbl').classList.add('has'); }
    function fld(k, label, ph) { return '<label><span>' + label + '</span><input class="input" inputmode="decimal" data-x="' + k + '" placeholder="' + ph + '"></label>'; }
  }

  function side() {
    $('qzNext').disabled = !answered(Q[i]);
    $('qzList').innerHTML = Q.map(function (x, n) {
      var v = x.multi ? (ans[x.key] || []).map(function (vv) { return optLabel(x, vv); }).join(', ') : (ans[x.key] ? optLabel(x, ans[x.key]) : '');
      return '<div class="' + (v ? 'on' : (n === i ? '' : 'next')) + '"><span>' + esc(L(x.label)) + '</span><b>' + (esc(v) || '—') + '</b></div>';
    }).join('');
  }
  function next() { if (!answered(Q[i])) return; if (i < Q.length - 1) { i++; render(); } else finish(); }

  function summary() {
    return Q.map(function (x) { return L(x.label) + ': ' + (x.multi ? (ans[x.key] || []).map(function (v) { return optLabel(x, v); }).join(', ') : optLabel(x, ans[x.key])); }).join('\n');
  }
  function qualityDetails() {
    var names = { protein: t('протеин', 'protein'), gluten: t('клейковина', 'gluten'), moisture: t('влажность', 'moisture'), trash: t('сор', 'foreign matter'), natura: t('натура', 'test weight'), oil: t('масличность', 'oil') };
    return Object.keys(names).filter(function (k) { return extra[k]; }).map(function (k) { return names[k] + ' ' + extra[k]; }).join(', ');
  }
  function finish() {
    $('qzQuiz').hidden = true; $('qzFinish').hidden = false;
    $('qzSum').innerHTML = Q.map(function (x) {
      var v = x.multi ? (ans[x.key] || []).map(function (vv) { return optLabel(x, vv); }).join(' · ') : optLabel(x, ans[x.key]);
      return '<i><b>' + esc(L(x.label)) + '</b>' + esc(v) + '</i>';
    }).join('') + (qualityDetails() ? '<i><b>' + t('Показатели', 'Parameters') + '</b>' + esc(qualityDetails()) + '</i>' : '') + (files.length ? '<i><b>' + t('Файлы', 'Files') + '</b>' + esc(files.map(function (f) { return f.name; }).join(', ')) + '</i>' : '');
    var near = (data.near || {})[ans.region] || (data.near || {})[Object.keys(data.near || {})[0]] || [];
    $('qzNear').innerHTML = near.map(function (e) { return '<div><b>' + esc(e[0]) + '</b><span>' + esc(e[1]) + '</span></div>'; }).join('');
    var text = t('Здравствуйте! Хочу продать зерно.\n', 'Hello! I would like to sell grain.\n') + summary() + (qualityDetails() ? '\n' + t('Показатели', 'Parameters') + ': ' + qualityDetails() : '');
    var wa = (window.TDZZ && window.TDZZ.whatsapp) || '', tg = (window.TDZZ && window.TDZZ.telegram) || '';
    $('qzWa').href = wa ? 'https://wa.me/' + wa.replace(/\D/g, '') + '?text=' + encodeURIComponent(text) : '#';
    $('qzTg').href = tg ? 'https://t.me/' + tg.replace('@', '') : '#';
    if (!wa) $('qzWa').style.display = 'none'; if (!tg) $('qzTg').style.display = 'none';
    if (!wa && !tg) document.querySelector('.qfc__or').style.display = 'none';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('qzNext').addEventListener('click', next);
  $('qzBack').addEventListener('click', function () { if (i) { i--; render(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || $('qzQuiz').hidden) return;
    var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'textarea') return;
    if (!box.contains(e.target) && document.activeElement !== document.body) return;
    next();
  });
  $('qzRestart').addEventListener('click', function (e) { e.preventDefault(); $('qzFinish').hidden = true; $('qzQuiz').hidden = false; i = 0; render(); });

  /* отправка */
  $('qzForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = this, phone = $('qzPhone').value.trim();
    if (phone.replace(/\D/g, '').length < 10) { $('qzPhone').focus(); $('qzPhone').classList.add('err'); return; }
    if (!form.querySelector('[name=privacy]').checked) return;
    var btn = form.querySelector('[type=submit]'); btn.disabled = true;
    var payload = { form_type: 'quiz', phone: phone, name: $('qzName').value.trim(), lang: lang, page: location.href, elapsed: Math.round((Date.now() - started) / 1000) };
    Q.forEach(function (x) { payload[x.key] = x.multi ? (ans[x.key] || []).map(function (v) { return optLabel(x, v); }).join(', ') : optLabel(x, ans[x.key]); });
    if (qualityDetails()) payload.quality_details = qualityDetails();
    if (extra.comment) payload.comment = extra.comment;
    var fd = new FormData(); fd.append('payload', JSON.stringify(payload));
    files.forEach(function (f) { fd.append('files[]', f, f.name); });
    fetch(root + 'api/form.php', { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'fail');
        form.classList.add('sent');
        $('qzOkText').textContent = t('Перезвоним на ' + phone + ' в течение 15 минут в рабочее время.', 'We will call ' + phone + ' within 15 minutes during business hours.');
        if (window.ym && window.TDZZ_METRIKA) ym(window.TDZZ_METRIKA, 'reachGoal', 'quiz_done');
      })
      .catch(function () { btn.disabled = false; alert(t('Не удалось отправить. Позвоните нам: +7 (8442) 59-97-32', 'Could not send. Please call +7 (8442) 59-97-32')); });
  });

  render();
})();
