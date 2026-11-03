/* =====================================================================
   MESCHERYAKOV.DESIGNER — interactions
   - прелоадер со счётчиком и «шторкой»
   - полноэкранная навигация по секциям (колесо / клавиши / индикатор)
   - маскированное появление заголовков, stagger-анимации
   - кастомный курсор, магнитные кнопки
   - 3D-наклон карточек и параллакс от курсора
   - плавающее превью в списке услуг
   ===================================================================== */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const lerp = (a, b, n) => a + (b - a) * n;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const body = document.body;
  const main = $('#main');
  const screens = $$('.screen');
  const sideItems = $$('.side-nav__item');
  const pills = $('#pills');
  const headerNote = $('#headerNote');

  /* ------------------------------------------------------------------
     1. PRELOADER
  ------------------------------------------------------------------ */
  const preloader = $('#preloader');
  const counterEl = $('#preCounter');
  const barEl = $('.preloader__bar span');

  // буквы логотипа появляются по очереди
  $$('.preloader__word span').forEach((l, i) => { l.style.animationDelay = `${0.05 * i + 0.1}s`; });

  function runPreloader() {
    const duration = reduced ? 10 : 1500;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(eased * 100);
      counterEl.textContent = v;
      barEl.style.width = v + '%';
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(finishPreloader, 250);
    };
    requestAnimationFrame(tick);
  }

  function finishPreloader() {
    preloader.classList.add('is-done');
    body.classList.add('loaded');
    // первый экран стартует чуть позже, чтобы шторка успела уйти
    setTimeout(() => {
      activate(0);
      preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
    }, 350);
  }

  /* ------------------------------------------------------------------
     2. SECTIONS: активация, индикатор, элементы шапки
  ------------------------------------------------------------------ */
  let current = -1;
  let ready = false;

  function activate(index) {
    if (index === current) return;
    current = index;
    screens.forEach((s, i) => s.classList.toggle('is-active', i === index));
    sideItems.forEach((b, i) => b.classList.toggle('is-active', i === index));
    pills.classList.toggle('is-hidden', index !== 0);
    headerNote.classList.toggle('is-visible', index === 2);

    // карточки получают «дыхание» после появления
    if (index === 1) {
      setTimeout(() => $$('.works .card').forEach(c => c.classList.add('is-settled')), 1400);
    } else {
      $$('.works .card').forEach(c => { c.classList.remove('is-settled'); c.style.transform = ''; delete c.dataset.tilting; });
    }
    ready = true;
  }

  // IntersectionObserver следит, какая секция в кадре (работает и для тач-скролла)
  const io = new IntersectionObserver((entries) => {
    if (!body.classList.contains('loaded')) return;
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio >= 0.55) {
        activate(Number(e.target.dataset.index));
      }
    });
  }, { root: isMobile() ? null : main, threshold: [0.55] });
  screens.forEach(s => io.observe(s));

  /* ------------------------------------------------------------------
     3. НАВИГАЦИЯ: колесо, клавиши, клики по якорям
  ------------------------------------------------------------------ */
  let locked = false;
  let wheelAcc = 0;
  let wheelTimer = null;

  function goTo(index) {
    index = Math.max(0, Math.min(screens.length - 1, index));
    if (locked && !isMobile()) return;
    locked = true;
    screens[index].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { locked = false; }, 1000);
  }

  main.addEventListener('wheel', (e) => {
    if (isMobile() || !body.classList.contains('loaded')) return;
    e.preventDefault();
    if (locked) return;
    wheelAcc += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelAcc = 0; }, 140);
    if (Math.abs(wheelAcc) > 40) {
      goTo(current + (wheelAcc > 0 ? 1 : -1));
      wheelAcc = 0;
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (isMobile()) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goTo(current + 1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(current - 1); }
    if (e.key === 'Home') goTo(0);
    if (e.key === 'End') goTo(screens.length - 1);
  });

  // свайпы на планшете
  let touchY = 0;
  main.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  main.addEventListener('touchend', (e) => {
    if (isMobile()) return;
    const dy = touchY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) goTo(current + (dy > 0 ? 1 : -1));
  }, { passive: true });

  sideItems.forEach((b) => b.addEventListener('click', () => {
    locked = false;
    goTo(screens.findIndex(s => s.id === b.dataset.target));
  }));

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    locked = false;
    goTo(screens.indexOf(target));
  }));

  /* ------------------------------------------------------------------
     4. КАСТОМНЫЙ КУРСОР
  ------------------------------------------------------------------ */
  const cursor = $('#cursor');
  const cursorLabel = $('.cursor__label');
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  const ring = { x: mouse.x, y: mouse.y };
  const dotEl = $('.cursor__dot');
  const ringEl = $('.cursor__ring');

  if (!isTouch) {
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor]');
      cursor.classList.remove('is-link', 'is-view');
      if (!t) return;
      const kind = t.dataset.cursor;
      cursor.classList.add('is-' + kind);
      cursorLabel.textContent = kind === 'view' ? 'Смотреть' : '';
    });

    (function loopCursor() {
      ring.x = lerp(ring.x, mouse.x, 0.18);
      ring.y = lerp(ring.y, mouse.y, 0.18);
      dotEl.style.left = mouse.x + 'px';
      dotEl.style.top = mouse.y + 'px';
      ringEl.style.left = ring.x + 'px';
      ringEl.style.top = ring.y + 'px';
      requestAnimationFrame(loopCursor);
    })();
  }

  /* ------------------------------------------------------------------
     5. МАГНИТНЫЕ КНОПКИ
  ------------------------------------------------------------------ */
  if (!isTouch && !reduced) {
    $$('.magnetic').forEach((el) => {
      const strength = 0.35;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty('--mx', `${dx * strength}px`);
        el.style.setProperty('--my', `${dy * strength}px`);
        el.style.translate = `${dx * strength}px ${dy * strength}px`;
        el.style.transition = 'translate 0.2s ease-out, opacity 0.9s var(--ease-out), transform 0.9s var(--ease-out)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'translate 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.9s var(--ease-out), transform 0.9s var(--ease-out)';
        el.style.translate = '0px 0px';
      });
    });
  }

  /* ------------------------------------------------------------------
     6. ПАРАЛЛАКС: портрет, водяные знаки, карточки с 3D-наклоном
  ------------------------------------------------------------------ */
  const photo = $('.hero__photo');
  const heroContent = $('.hero__content');
  const wmTop = $('.watermark--top');
  const wmBottom = $('.watermark--bottom');
  const stage = $('.works__stage');
  const cards = $$('.card.tilt');
  const px = () => innerWidth / 1440;

  let nx = 0, ny = 0;   // нормализованная позиция курсора -1..1
  let sx = 0, sy = 0;   // сглаженная

  if (!isTouch && !reduced) {
    window.addEventListener('mousemove', (e) => {
      nx = (e.clientX / innerWidth) * 2 - 1;
      ny = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });

    (function loopParallax() {
      sx = lerp(sx, nx, 0.06);
      sy = lerp(sy, ny, 0.06);
      if (!isMobile()) {
        photo.style.transform = `translate(${sx * 8 * px()}px, ${sy * 6 * px()}px)`;
        heroContent.style.transform = `translate(${sx * -6 * px()}px, ${sy * -4 * px()}px)`;
        wmTop.style.transform = `translateX(${sx * -14 * px()}px)`;
        wmBottom.style.transform = `translateX(${sx * 14 * px()}px)`;
        cards.forEach((c) => {
          if (!c.classList.contains('is-settled') || c.matches(':hover') || c.dataset.tilting) return;
          const d = parseFloat(c.dataset.depth || 1);
          c.style.transform = `translate(${sx * -12 * d * px()}px, ${sy * -10 * d * px()}px)`;
        });
      }
      requestAnimationFrame(loopParallax);
    })();

    // 3D tilt при наведении на карточку
    cards.forEach((c) => {
      c.addEventListener('mousemove', (e) => {
        const r = c.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -14;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 14;
        if (c.classList.contains('is-incoming') || c.classList.contains('is-outgoing') || !c.classList.contains('is-settled')) return;
        c.dataset.tilting = '1';
        c.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`;
      });
      c.addEventListener('mouseleave', () => {
        delete c.dataset.tilting;
        c.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------
     6b. ЛЕВАЯ СТОПКА ПРОЕКТОВ: наведение на размытую карточку
         «прокручивает» её на передний план, а передняя уходит на её место.
         Когда курсор покидает стопку, карточки возвращаются
         в исходный порядок (спереди — X'FLOW GYM)
  ------------------------------------------------------------------ */
  const stackWeb = $('#stackWeb');
  if (stackWeb && !isTouch) {
    let swapLock = false;
    let resetTimer = null;
    const SLOTS = ['slot-a', 'slot-b', 'slot-c'];
    const slotOf = (el) => SLOTS.find(s => el.classList.contains(s));

    // запоминаем исходный слот каждой карточки
    $$('.wcard', stackWeb).forEach((c) => { c.dataset.home = slotOf(c); });
    const isHome = () => $$('.wcard', stackWeb).every(c => slotOf(c) === c.dataset.home);
    const cancelReset = () => { if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; } };

    const resetToHome = () => {
      resetTimer = null;
      if (isMobile() || isHome()) return;
      if (swapLock) { resetTimer = setTimeout(resetToHome, 120); return; }
      const incoming = $$('.wcard', stackWeb).find(c => c.dataset.home === 'slot-b');
      const outgoing = $('.wcard.slot-b', stackWeb);
      swapLock = true;
      $$('.wcard', stackWeb).forEach((c) => {
        c.style.transform = '';
        delete c.dataset.tilting;
        delete c.dataset.armed;
        delete c.dataset.cooldown;
        c.classList.remove(...SLOTS);
        c.classList.add(c.dataset.home);
      });
      if (incoming && incoming !== outgoing) {
        incoming.classList.add('is-incoming');
        if (outgoing) outgoing.classList.add('is-outgoing');
      }
      setTimeout(() => {
        if (incoming) incoming.classList.remove('is-incoming');
        if (outgoing) outgoing.classList.remove('is-outgoing');
        swapLock = false;
      }, 1000);
    };

    // небольшая задержка, чтобы проход курсора между карточками
    // или случайный выход за край не дёргали стопку туда-обратно
    const scheduleReset = () => { cancelReset(); resetTimer = setTimeout(resetToHome, 600); };

    const bringToFront = (card) => {
      if (swapLock || isMobile()) return;
      const from = slotOf(card);
      if (from === 'slot-b') return;
      const front = $('.wcard.slot-b', stackWeb);
      swapLock = true;

      // сбрасываем инлайн-transform от tilt, чтобы движение было чистым
      [card, front].forEach(c => { c.style.transform = ''; delete c.dataset.tilting; });

      delete card.dataset.armed;
      front.dataset.cooldown = '1'; delete front.dataset.armed;
      card.classList.remove(from); card.classList.add('slot-b', 'is-incoming');
      front.classList.remove('slot-b'); front.classList.add(from, 'is-outgoing');

      setTimeout(() => {
        card.classList.remove('is-incoming');
        front.classList.remove('is-outgoing');
        swapLock = false;
      }, 1000);
    };

    // Карточка «взводится» при входе курсора и срабатывает на реальном движении мыши.
    // Передняя карточка, уехавшая под неподвижный курсор, получает cooldown до тех пор,
    // пока курсор её не покинет — иначе стопка прыгала бы туда-обратно.
    $$('.wcard', stackWeb).forEach((card) => {
      card.addEventListener('mouseenter', () => {
        cancelReset();
        if (!swapLock && !card.dataset.cooldown) card.dataset.armed = '1';
      });
      card.addEventListener('mouseleave', (e) => {
        delete card.dataset.armed; delete card.dataset.cooldown;
        // курсор ушёл за пределы стопки — возвращаемся в исходный порядок
        if (!e.relatedTarget || !stackWeb.contains(e.relatedTarget)) scheduleReset();
      });
      card.addEventListener('mousemove', () => {
        if (card.dataset.armed && slotOf(card) !== 'slot-b') bringToFront(card);
      });
    });
  }

  /* ------------------------------------------------------------------
     7. УСЛУГИ: плавающее превью следует за курсором
  ------------------------------------------------------------------ */
  const preview = $('#servicePreview');
  const previewImg = $('img', preview);
  const pv = { x: 0, y: 0, tx: 0, ty: 0, on: false };

  if (!isTouch) {
    $$('.service').forEach((row) => {
      row.addEventListener('mouseenter', (e) => {
        if (!pv.on) { pv.x = pv.tx = e.clientX + 40; pv.y = pv.ty = e.clientY; }
        previewImg.src = row.dataset.preview;
        preview.classList.add('is-visible');
        pv.on = true;
      });
      row.addEventListener('mouseleave', () => { preview.classList.remove('is-visible'); pv.on = false; });
      row.addEventListener('mousemove', (e) => { pv.tx = e.clientX + 40; pv.ty = e.clientY; });
    });
    (function loopPreview() {
      pv.x = lerp(pv.x, pv.tx, 0.12);
      pv.y = lerp(pv.y, pv.ty, 0.12);
      preview.style.left = pv.x + 'px';
      preview.style.top = pv.y + 'px';
      requestAnimationFrame(loopPreview);
    })();
  }

  /* ------------------------------------------------------------------
     8. КОНТАКТЫ: копирование по клику + тост
  ------------------------------------------------------------------ */
  const toast = $('#toast');
  let toastTimer;
  $$('[data-copy]').forEach((a) => {
    a.addEventListener('click', (e) => {
      // ссылка открывается штатно (почтовый клиент / звонок), а значение дополнительно копируется в буфер
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(a.dataset.copy).then(() => {
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1600);
      });
    });
  });

  /* ------------------------------------------------------------------
     9. START
  ------------------------------------------------------------------ */
  // на мобильном — все секции сразу активны по мере прокрутки
  if (isMobile()) {
    const ioM = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-active'); });
    }, { threshold: 0.08 });
    screens.forEach(s => ioM.observe(s));
    // страховка: через 4 секунды после старта показываем всё
    setTimeout(() => screens.forEach(s => s.classList.add('is-active')), 4000);
  }

  main.scrollTop = 0;
  window.addEventListener('load', () => { main.scrollTop = 0; });
  runPreloader();
})();
