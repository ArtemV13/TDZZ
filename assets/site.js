/* TDZZ site.js — навигация, вкладки, формы, параллакс. Без зависимостей. */
(function () {
  'use strict';
  var root = (window.TDZZ && window.TDZZ.root) || '';
  var isEn = document.documentElement.lang === 'en';
  var t = function (ru, en) { return isEn ? en : ru; };

  /* ---------- мобильное меню ---------- */
  var burger = document.getElementById('burger'), menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    var setMenu = function (on) {
      burger.setAttribute('aria-expanded', String(on));
      menu.classList.toggle('open', on);
      document.body.classList.toggle('menu-open', on);
    };
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- вкладки форм (контакты, экспорт) ---------- */
  var tabs = document.querySelectorAll('[data-tab]');
  if (tabs.length) {
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var v = b.dataset.tab;
        document.querySelectorAll('input[data-form-type]').forEach(function (e) { e.value = v; });
        var f = document.getElementById('contactForm');
        if (f) f.dataset.formType = v;
      });
    });
    document.querySelectorAll('[data-route]').forEach(function (a) {
      a.addEventListener('click', function () {
        var tb = document.querySelector('[data-tab="' + a.dataset.route + '"]');
        if (tb) tb.click();
      });
    });
  }

  /* ---------- формы: отправка на api/form.php ---------- */
  function status(form, msg, type) {
    var el = form.querySelector('.tdzz-form-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tdzz-form-status';
      el.setAttribute('aria-live', 'polite');
      form.appendChild(el);
    }
    el.textContent = msg;
    el.dataset.type = type || 'info';
  }
  function payload(form) {
    var fd = new FormData(form), obj = {};
    fd.forEach(function (v, k) { if (k !== 'privacy') obj[k] = String(v).trim().slice(0, 2000); });
    obj.form_type = form.dataset.formType || obj.form_type || 'contact';
    obj.lang = document.documentElement.lang || 'ru';
    obj.page = location.href;
    return obj;
  }
  document.querySelectorAll('form[data-tdzz-form]').forEach(function (form) {
    // honeypot: поле, которое заполняют только боты
    var hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    form.appendChild(hp);
    var started = Date.now();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = payload(form), btn = form.querySelector('[type="submit"]');
      data.website = hp.value;
      data.elapsed = Math.round((Date.now() - started) / 1000);
      if (btn) btn.disabled = true;
      status(form, t('Отправляем…', 'Sending…'), 'info');
      fetch(root + 'api/form.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j && res.j.error || 'send failed');
          status(form, t('Спасибо. Заявка отправлена — менеджер свяжется с вами в рабочее время.', 'Thank you. Your enquiry has been sent — a manager will contact you during business hours.'), 'success');
          form.reset();
          if (window.ym && window.TDZZ_METRIKA) ym(window.TDZZ_METRIKA, 'reachGoal', 'form_' + data.form_type);
        })
        .catch(function () {
          var mail = (window.TDZZ && window.TDZZ.email) || 'info@tdzz.ru';
          status(form, t('Не удалось отправить форму. Напишите нам на ' + mail + ' или позвоните — контакты в подвале сайта.',
            'The form could not be sent. Please e-mail ' + mail + ' or call us — see the footer for contacts.'), 'error');
        })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  });

  /* ---------- лёгкий параллакс (только desktop, без reduced-motion) ---------- */
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var rules = [['.hero__photo', 10], ['.v7-about-hero__media img', 9], ['.v7-story-grid img', 7], ['.v7-proof__mosaic img', 6],
      ['.v7-export-hero>img', 9], ['.v7-modes .v7-mode>img', 7], ['.contact-v15-hero .contact-card', 5], ['.v15-files-grid', 4]];
    var nodes = [], seen = new Set();
    rules.forEach(function (r) {
      document.querySelectorAll(r[0]).forEach(function (n) {
        if (seen.has(n)) return;
        seen.add(n); n.dataset.parallax = ''; n.dataset.parallaxMax = String(r[1]); nodes.push(n);
      });
    });
    var raf = 0;
    var update = function () {
      raf = 0;
      if (innerWidth < 760) { nodes.forEach(function (n) { n.style.setProperty('--parallax-y', '0px'); }); return; }
      var vh = innerHeight;
      nodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var delta = ((r.top + r.height / 2) - vh / 2) / vh, max = Number(n.dataset.parallaxMax || 6);
        n.style.setProperty('--parallax-y', Math.max(-max, Math.min(max, -delta * max)).toFixed(1) + 'px');
      });
    };
    var request = function () { if (!raf) raf = requestAnimationFrame(update); };
    if (nodes.length) {
      addEventListener('scroll', request, { passive: true });
      addEventListener('resize', request);
      update();
    }
  }
})();
