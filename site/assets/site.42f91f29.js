/* site.js */
/* RANZHOU site interactions — vanilla JS, no dependencies. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var $ = function (sel, el) { return (el || doc).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  var hasIO = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------------- */
  /* Header: transparent over hero, hides on scroll down               */
  /* ---------------------------------------------------------------- */
  var header = $('[data-header]');
  if (header) {
    var lastY = window.scrollY;
    var ticking = false;
    var update = function () {
      var y = window.scrollY;
      var scrolled = y > 24;
      header.classList.toggle('is-scrolled', scrolled);
      if (!root.classList.contains('menu-open')) {
        var goingDown = y > lastY;
        var hide = goingDown && y > 160;
        if (Math.abs(y - lastY) > 4) {
          header.classList.toggle('is-hidden', hide);
          root.classList.toggle('header-shown', !hide && y > 160);
        }
        if (y <= 160) root.classList.remove('header-shown');
      }
      lastY = y;
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------- */
  /* Mobile menu                                                       */
  /* ---------------------------------------------------------------- */
  var toggle = $('[data-menu-toggle]');
  var menu = $('[data-mobile-menu]');
  if (toggle && menu) {
    var setMenu = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
      root.classList.toggle('menu-open', open);
      root.style.overflow = open ? 'hidden' : '';
      if (header) header.classList.remove('is-hidden');
      if (open) {
        var first = $('a', menu);
        if (first) first.focus({ preventScroll: true });
      }
    };
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1023 && !menu.hidden) setMenu(false);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Reveal on enter (content stays visible at rest)                   */
  /* ---------------------------------------------------------------- */
  if (hasIO && !reduceMotion) {
    var vh = window.innerHeight;
    var pending = $$('[data-reveal]').filter(function (el) {
      var r = el.getBoundingClientRect();
      return r.top > vh; // only things below the first screen animate
    });
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var group = el.parentElement && el.parentElement.closest('[data-reveal-group]');
        if (group) {
          var siblings = $$('[data-reveal]', group);
          var i = Math.max(0, siblings.indexOf(el));
          el.style.setProperty('--d', Math.min(i * 90, 360) + 'ms');
        }
        el.classList.add('is-revealing');
        revealIO.unobserve(el);
      });
    }, { rootMargin: '0px 0px 6% 0px' });
    pending.forEach(function (el) { revealIO.observe(el); });
  }

  /* ---------------------------------------------------------------- */
  /* Videos: lazy load + play only while visible                       */
  /* ---------------------------------------------------------------- */
  var allowAutoplay = !reduceMotion && !saveData;

  function loadVideo(v) {
    if (v.dataset.loaded) return;
    $$('source[data-src]', v).forEach(function (s) {
      s.src = s.getAttribute('data-src');
      s.removeAttribute('data-src');
    });
    v.dataset.loaded = '1';
    v.load();
  }

  function playVideo(v) {
    if (!allowAutoplay) return;
    loadVideo(v);
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  var bgVideos = $$('video[data-autoplay]');
  bgVideos.forEach(function (v) {
    if (!allowAutoplay) {
      v.removeAttribute('autoplay');
      try { v.pause(); } catch (e) {}
    }
  });

  if (hasIO) {
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadVideo(entry.target);
          near.unobserve(entry.target);
        }
      });
    }, { rootMargin: '300px 0px' });
    $$('video[data-lazy]').forEach(function (v) { near.observe(v); });

    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        // Carousel videos are driven by the carousel itself
        if (v.closest('[data-carousel]')) return;
        if (entry.isIntersecting) playVideo(v);
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.25 });
    bgVideos.forEach(function (v) { vis.observe(v); });
  } else {
    bgVideos.forEach(playVideo);
  }

  // WeChat's in-app browser (especially on iPhone) blocks autoplay that the page starts on its own;
  // calling play() once its JS bridge is ready is allowed.
  doc.addEventListener('WeixinJSBridgeReady', function () {
    bgVideos.forEach(function (v) {
      var r = v.getBoundingClientRect();
      var onScreen = r.bottom > 0 && r.top < (window.innerHeight || root.clientHeight);
      var inactiveSlide = v.closest('[data-carousel]') && !v.closest('.is-active');
      if (onScreen && !inactiveSlide) playVideo(v);
    });
  }, false);

  /* ---------------------------------------------------------------- */
  /* 3D capability carousel                                            */
  /* ---------------------------------------------------------------- */
  $$('[data-carousel]').forEach(function (car) {
    var items = $$('[data-carousel-item]', car);
    var dots = $$('[data-carousel-dot]', car);
    var n = items.length;
    if (!n) return;
    var active = 0;
    var timer = null;
    var inView = false;
    var hover = false;
    car.classList.add('is-ready');

    function offset(i) {
      var o = i - active;
      if (o > n / 2) o -= n;
      if (o < -n / 2) o += n;
      return o;
    }

    function render() {
      items.forEach(function (it, i) {
        var o = offset(i);
        var ao = Math.abs(o);
        it.style.setProperty('--o', o);
        it.style.setProperty('--ao', ao);
        it.classList.toggle('is-active', o === 0);
        it.classList.toggle('is-far', ao > 2);
        it.setAttribute('aria-hidden', o === 0 ? 'false' : 'true');
        var v = $('video', it);
        if (v) {
          if (ao <= 1) loadVideo(v);
          if (o === 0 && inView) playVideo(v);
          else if (!v.paused) v.pause();
        }
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === active);
        d.setAttribute('aria-current', i === active ? 'true' : 'false');
      });
    }

    function go(i) {
      active = (i + n) % n;
      render();
      restart();
    }

    function restart() {
      clearInterval(timer);
      if (reduceMotion || !inView || hover) return;
      timer = setInterval(function () { go(active + 1); }, 5200);
    }

    var prev = $('[data-carousel-prev]', car);
    var next = $('[data-carousel-next]', car);
    if (prev) prev.addEventListener('click', function () { go(active - 1); });
    if (next) next.addEventListener('click', function () { go(active + 1); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
    items.forEach(function (it, i) {
      it.addEventListener('click', function () { if (i !== active) go(i); });
    });
    car.addEventListener('mouseenter', function () { hover = true; restart(); });
    car.addEventListener('mouseleave', function () { hover = false; restart(); });
    car.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') go(active - 1);
      if (e.key === 'ArrowRight') go(active + 1);
    });

    // swipe
    var startX = null;
    var track = $('.carousel__track', car);
    track.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    track.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
    });

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        render();
        restart();
      }, { threshold: 0.3 }).observe(car);
    } else {
      inView = true;
    }
    render();
  });

  /* ---------------------------------------------------------------- */
  /* Tabs (home product showcase)                                      */
  /* ---------------------------------------------------------------- */
  $$('[data-tabs]').forEach(function (box) {
    var tabs = $$('[data-tab]', box);
    var groups = [];
    $$('[data-tab-panel]', box).forEach(function (p) {
      var g = groups.filter(function (x) { return x.parent === p.parentElement; })[0];
      if (!g) groups.push((g = { parent: p.parentElement, panels: [] }));
      g.panels.push(p);
    });
    function select(i, focus) {
      tabs.forEach(function (t, k) {
        t.classList.toggle('is-active', k === i);
        t.setAttribute('aria-selected', k === i ? 'true' : 'false');
        t.tabIndex = k === i ? 0 : -1;
      });
      groups.forEach(function (g) {
        g.panels.forEach(function (p, k) { p.classList.toggle('is-active', k === i); });
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') select((i + 1) % tabs.length, true);
        if (e.key === 'ArrowLeft') select((i - 1 + tabs.length) % tabs.length, true);
      });
    });
    select(0);
  });

  /* ---------------------------------------------------------------- */
  /* Gait stepper                                                      */
  /* ---------------------------------------------------------------- */
  $$('[data-stepper]').forEach(function (box) {
    var steps = $$('[data-step]', box);
    var frames = $$('[data-step-panel]', box);
    var bar = $('[data-step-bar]', box);
    var active = 0;
    var timer = null;
    var userControlled = false;
    var inView = false;
    var DURATION = 3600;

    function animateBar() {
      if (!bar || !bar.animate) return;
      bar.getAnimations && bar.getAnimations().forEach(function (a) { a.cancel(); });
      if (userControlled || reduceMotion || !inView) {
        bar.style.width = ((active + 1) / steps.length) * 100 + '%';
        return;
      }
      bar.style.width = '';
      bar.animate([{ width: '0%' }, { width: '100%' }], { duration: DURATION, easing: 'linear', fill: 'forwards' });
    }

    function show(i) {
      active = (i + steps.length) % steps.length;
      steps.forEach(function (s, k) {
        s.classList.toggle('is-active', k === active);
        s.setAttribute('aria-pressed', k === active ? 'true' : 'false');
      });
      frames.forEach(function (f, k) { f.classList.toggle('is-active', k === active); });
      animateBar();
    }

    function schedule() {
      clearInterval(timer);
      if (userControlled || reduceMotion || !inView) return;
      timer = setInterval(function () { show(active + 1); }, DURATION);
    }

    steps.forEach(function (s, i) {
      s.addEventListener('click', function () {
        userControlled = true;
        clearInterval(timer);
        show(i);
      });
    });

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        animateBar();
        schedule();
      }, { threshold: 0.4 }).observe(box);
    }
    show(0);
  });

  /* ---------------------------------------------------------------- */
  /* Toggle media (chassis drive / rotate)                             */
  /* ---------------------------------------------------------------- */
  $$('[data-toggle-media]').forEach(function (box) {
    var btns = $$('[data-toggle]', box);
    var panels = $$('[data-toggle-panel]', box);
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () {
        btns.forEach(function (x, k) {
          x.classList.toggle('is-active', k === i);
          x.setAttribute('aria-pressed', k === i ? 'true' : 'false');
        });
        panels.forEach(function (p, k) { p.classList.toggle('is-active', k === i); });
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /* Gallery arrows                                                    */
  /* ---------------------------------------------------------------- */
  $$('[data-gallery]').forEach(function (g) {
    var track = $('[data-gallery-track]', g);
    var step = function (dir) {
      var item = $('.gallery__item', track);
      var w = item ? item.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * w, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    var p = $('[data-gallery-prev]', g);
    var nx = $('[data-gallery-next]', g);
    if (p) p.addEventListener('click', function () { step(-1); });
    if (nx) nx.addEventListener('click', function () { step(1); });
  });

  /* ---------------------------------------------------------------- */
  /* Product sub-navigation: highlight the section in view             */
  /* ---------------------------------------------------------------- */
  var subnav = $('[data-subnav]');
  if (subnav && hasIO) {
    var links = $$('a[href^="#"]', subnav);
    var map = {};
    links.forEach(function (a) {
      var target = doc.getElementById(a.getAttribute('href').slice(1));
      if (target) map[target.id] = a;
    });
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var a = map[entry.target.id];
        if (a) {
          a.classList.add('is-active');
          if (a.scrollIntoView && subnav.scrollWidth > subnav.clientWidth) {
            a.parentElement.parentElement.scrollLeft = a.offsetLeft - 24;
          }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { secIO.observe(doc.getElementById(id)); });
  }

  /* ---------------------------------------------------------------- */
  /* Film dialog                                                       */
  /* ---------------------------------------------------------------- */
  var dialog = $('[data-film-dialog]');
  var lastTrigger = null;
  if (dialog) {
    var video = $('video', dialog);
    var closeBtn = $('.film-dialog__close', dialog);
    var openFilm = function (btn) {
      lastTrigger = btn;
      video.src = btn.getAttribute('data-film');
      var poster = btn.getAttribute('data-film-poster');
      if (poster) video.poster = poster;
      dialog.setAttribute('aria-label', btn.getAttribute('data-film-title') || '');
      dialog.hidden = false;
      root.style.overflow = 'hidden';
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      closeBtn.focus({ preventScroll: true });
    };
    var closeFilm = function () {
      if (dialog.hidden) return;
      video.pause();
      video.removeAttribute('src');
      video.load();
      dialog.hidden = true;
      root.style.overflow = '';
      if (lastTrigger) lastTrigger.focus({ preventScroll: true });
    };
    doc.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-film]');
      if (btn && btn.tagName !== 'VIDEO') {
        e.preventDefault();
        openFilm(btn);
        return;
      }
      if (e.target.closest('[data-film-close]')) closeFilm();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFilm();
      if (e.key === 'Tab' && !dialog.hidden) {
        // keep focus inside the dialog
        var focusables = [video, closeBtn];
        var idx = focusables.indexOf(doc.activeElement);
        if (e.shiftKey && idx <= 0) { e.preventDefault(); closeBtn.focus(); }
        else if (!e.shiftKey && idx === focusables.length - 1) { e.preventDefault(); video.focus(); }
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Copy buttons                                                      */
  /* ---------------------------------------------------------------- */
  function copyText(text, btn) {
    var done = function () {
      var label = $('span', btn);
      if (!label) return;
      var original = label.textContent;
      label.textContent = btn.getAttribute('data-copied-label') || 'Copied';
      setTimeout(function () { label.textContent = original; }, 2000);
    };
    var fallback = function () {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      try { doc.execCommand('copy'); done(); } catch (e) {}
      doc.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (btn) copyText(btn.getAttribute('data-copy'), btn);
  });

  /* ---------------------------------------------------------------- */
  /* Contact form                                                      */
  /* ---------------------------------------------------------------- */
  var form = $('[data-contact-form]');
  if (form) {
    var status = $('[data-form-status]', form);
    var setStatus = function (html, isError) {
      status.innerHTML = html;
      status.hidden = false;
      status.classList.toggle('is-error', Boolean(isError));
    };
    var esc = function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      $$('input, select, textarea', form).forEach(function (el) { data[el.name] = el.value.trim(); });
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '');
      var phoneOk = (data.phone || '').replace(/\D/g, '').length >= 7;
      var nameEl = $('#cf-name', form);
      var emailEl = $('#cf-email', form);
      nameEl.setAttribute('aria-invalid', data.name ? 'false' : 'true');
      emailEl.setAttribute('aria-invalid', emailOk || phoneOk ? 'false' : 'true');
      if (!data.name || !(emailOk || phoneOk)) {
        setStatus(esc(form.getAttribute('data-msg-invalid')), true);
        (data.name ? emailEl : nameEl).focus();
        return;
      }
      var endpoint = form.getAttribute('data-endpoint');
      var email = form.getAttribute('data-email');
      if (endpoint) {
        var submit = $('button[type="submit"]', form);
        submit.disabled = true;
        setStatus(esc(form.getAttribute('data-msg-sending')));
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        }).then(function (res) {
          if (!res.ok) throw new Error(res.status);
          setStatus(esc(form.getAttribute('data-msg-success')));
          form.reset();
        }).catch(function () {
          setStatus(esc(form.getAttribute('data-msg-error')), true);
        }).then(function () { submit.disabled = false; });
        return;
      }
      // No form service configured yet: hand the message to the visitor to email.
      var labels = {};
      $$('.field__label', form).forEach(function (l) {
        labels[l.getAttribute('for').replace('cf-', '')] = l.childNodes[0].textContent.trim();
      });
      var text = Object.keys(data).filter(function (k) { return data[k]; }).map(function (k) {
        return (labels[k] || k) + ': ' + data[k];
      }).join('\n');
      // Prefer email; otherwise the co-founders' WeChat IDs.
      var wechat = form.getAttribute('data-wechat');
      var to = email
        ? '<strong>' + esc(email) + '</strong>'
        : wechat && wechat.split(' / ').map(function (id) { return '<strong class="nowrap">' + esc(id) + '</strong>'; }).join(' / ');
      if (to) {
        setStatus(
          '<p>' + esc(form.getAttribute(email ? 'data-msg-manual' : 'data-msg-manual-wechat')) + ' ' + to + '</p>' +
          '<pre>' + esc(text) + '</pre>' +
          '<button type="button" class="copy-btn" data-copy="' + esc(text) + '" data-copied-label="' + esc(form.getAttribute('data-copied-label')) + '"><span>' + esc(form.getAttribute('data-copy-label')) + '</span></button>'
        );
      } else {
        setStatus(esc(form.getAttribute('data-msg-manual-none')));
      }
    });
  }
})();
