/* ==========================================================================
   测试 · 企业官网 — 交互脚本
   1) 深浅色模式切换（localStorage 持久化）
   2) 动态光圈（自动注入所有带背景模糊的组件，光斑跟随鼠标）
   3) 移动端汉堡菜单
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 主题切换 ---------- */
  var THEME_KEY = 'ceshi-theme';
  var THEME_MANUAL_KEY = 'ceshi-theme-manual';   // '1' = 用户手动选择过，覆盖系统跟随

  function applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function initTheme() {
    var saved = null, manual = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
      manual = localStorage.getItem(THEME_MANUAL_KEY);
    } catch (e) {}

    // 跨平台跟随系统深浅色：未手动选择时跟随 prefers-color-scheme，并实时响应切换
    var media = null;
    try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) {}
    function systemTheme() { return media && media.matches ? 'dark' : 'light'; }

    var isExplicit = (manual === '1' && (saved === 'light' || saved === 'dark'));
    if (isExplicit) {
      applyTheme(saved);
    } else {
      // 自动模式：用系统偏好；清掉旧存的"自动写入"主题，保持自动跟随
      applyTheme(systemTheme());
      try {
        localStorage.removeItem(THEME_KEY);
        localStorage.removeItem(THEME_MANUAL_KEY);
      } catch (e) {}
      if (media && media.addEventListener) {
        media.addEventListener('change', function () {
          var m = null;
          try { m = localStorage.getItem(THEME_MANUAL_KEY); } catch (e) {}
          if (m !== '1') applyTheme(systemTheme());
        });
      }
    }

    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        // 手动选择 → 保存并标记，之后不再跟随系统
        try {
          localStorage.setItem(THEME_KEY, next);
          localStorage.setItem(THEME_MANUAL_KEY, '1');
        } catch (e) {}
      });
    });
  }

  /* ---------- 动态光圈：自动识别所有玻璃组件（含 backdrop-filter/blur） ----------
     复用原有光斑逻辑：rAF 节流 + transform 位移，仅触发合成层（GPU 加速）。
     目标范围：[data-glow] 显式声明 + 自动扫描所有带 backdrop-filter 的元素
     （含 ::before/::after 折射层上的 backdrop，如卡片、导航）。 */
  function initCardGlow() {
    // 触摸设备没有悬停交互，跳过光斑层注入与监听
    if (window.matchMedia('(hover: none)').matches) return;

    // 判断元素（或其伪元素）是否应用了背景模糊
    function hasBackdropBlur(el) {
      try {
        var s = getComputedStyle(el);
        if ((s.backdropFilter && s.backdropFilter !== 'none') ||
            (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none')) return true;
        var b = getComputedStyle(el, '::before');
        if (b.backdropFilter && b.backdropFilter !== 'none') return true;
        var a = getComputedStyle(el, '::after');
        if (a.backdropFilter && a.backdropFilter !== 'none') return true;
      } catch (e) {}
      return false;
    }

    // 光圈宿主准备：提供定位上下文 + 裁剪光圈溢出
    function prepareHost(el) {
      var cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      // 若宿主内含下拉目录，不能裁剪溢出，否则下拉面板会被整个切成不可见
      if (el.classList.contains('nav-capsule-right') || el.querySelector('.nav-dir')) return;
      if (cs.overflow === 'visible' || cs.overflowX === 'visible') el.style.overflow = 'hidden';
    }

    function attachGlow(host) {
      if (host.hasAttribute('data-glow-host')) return;
      host.setAttribute('data-glow-host', '');
      prepareHost(host);

      // 注入光斑元素
      var glow = document.createElement('span');
      glow.className = 'glow';
      glow.setAttribute('aria-hidden', 'true');
      host.appendChild(glow);

      var raf = null;
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      host.addEventListener('mouseenter', function () {
        if (reduced) return;
        glow.style.opacity = '1';
      });

      host.addEventListener('mousemove', function (e) {
        if (reduced) return;
        var rect = host.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          glow.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
          raf = null;
        });
      });

      host.addEventListener('mouseleave', function () {
        if (reduced) return;
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = null;
        }
        glow.style.opacity = '0';
      });
    }

    // 显式声明 + 自动识别（只扫描带 class 的元素，性能友好）。
    // 抽成可重复执行的函数：初始扫一次，其它脚本（schedule.js 渲染 mini 课表）在
    // DOMContentLoaded 后才创建元素，故补扫两次保证晚出现的玻璃元素也有光效。
    // attachGlow 幂等（data-glow-host 判重），重复扫描无副作用。
    function scanGlowHosts() {
      document.querySelectorAll('[data-glow], body [class]').forEach(function (el) {
        if (el.hasAttribute('data-glow') || hasBackdropBlur(el)) attachGlow(el);
      });
    }
    scanGlowHosts();
    setTimeout(scanGlowHosts, 0);
    window.addEventListener('load', scanGlowHosts);
  }

  /* ---------- 导航栏：静态双胶囊 + <details> 原生目录按钮 ---------- */
  function initNavCapsules() {
    var inner = document.querySelector('.nav-inner');
    if (!inner) return;

    // 清理导航根节点上可能残留的旧光斑，并禁止再给导航根注入光斑（光效由各胶囊承载）
    var navEl = inner.closest('.nav');
    if (navEl) {
      var staleGlow = navEl.querySelector(':scope > .glow');
      if (staleGlow) staleGlow.remove();
      navEl.setAttribute('data-glow-host', '');
    }
    // 移除旧汉堡按钮（由 <details> 目录按钮取代）
    var burger = inner.querySelector('[data-burger]');
    if (burger) burger.remove();

    // 新版页面：HTML 已内置双胶囊 + <details>，此处把目录改造成"变形生长"菜单
    var dir = inner.querySelector('.nav-dir');
    if (dir) {
      var dlinks = dir.querySelector('[data-nav-links]');
      var dsum = dir.querySelector('summary');
      var actions = inner.querySelector('.nav-actions');
      var right = dir.parentNode;   // 右胶囊

      // 1) 生成"变形生长"菜单（作为 nav-inner 直接子元素，磨砂才能采样页面背景）
      var morph = document.createElement('div');
      morph.className = 'morph-menu';
      morph.setAttribute('role', 'menu');
      var cta = document.createElement('a');
      cta.className = 'morph-item cta';
      cta.href = 'service-detail.html?id=consult';
      cta.textContent = '立即咨询';
      morph.appendChild(cta);
      if (dlinks) {
        dlinks.querySelectorAll('a').forEach(function (a) {
          var it = document.createElement('a');
          it.className = 'morph-item';
          it.href = a.getAttribute('href');
          it.textContent = a.textContent;
          morph.appendChild(it);
        });
      }
      var divider = document.createElement('div');
      divider.className = 'morph-divider';
      morph.appendChild(divider);

      // 2) 壁纸按钮移入菜单（保留原按钮元素与图标，initUserBackground 的监听仍有效）
      function toMenuItem(btn, label) {
        if (!btn) return;
        btn.classList.remove('theme-toggle');
        btn.classList.add('morph-item', 'morph-btn');
        var icon = btn.innerHTML;
        btn.innerHTML = icon + '<span>' + label + '</span>';
        morph.appendChild(btn);
      }
      toMenuItem(inner.querySelector('[data-bg-upload]'), '设置本地背景');
      toMenuItem(inner.querySelector('[data-bg-reset]'), '清除本地背景');
      inner.appendChild(morph);

      // 3) 移除旧目录链接与 CTA；右胶囊内仅保留 主题切换 + ☰ 触发，主题按钮在左
      if (dlinks) dlinks.remove();
      var ctaOld = inner.querySelector('.nav-actions .btn-primary');
      if (ctaOld) ctaOld.remove();
      if (actions && right) right.insertBefore(actions, dir);

      // 4) 对齐：菜单右缘对齐触发按钮右缘，从该锚点（右上角）生长
      function alignMenu() {
        if (!dsum || !morph) return;
        var tr = dsum.getBoundingClientRect();
        var ir = inner.getBoundingClientRect();
        morph.style.right = Math.max(0, Math.round(ir.right - tr.right)) + 'px';
      }
      var setOpen = function (open) {
        if (open) alignMenu();
        morph.classList.toggle('open', open);
        dir.toggleAttribute('open', open);   // 状态标记（配合 initHeaderScroll 保持导航可见）
        if (dsum) dsum.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      window.addEventListener('resize', alignMenu);
      if (dsum) {
        dsum.addEventListener('click', function (e) {
          e.preventDefault();   // 原生自动切换交由下面单次统一处理，避免双触发
          setOpen(!dir.hasAttribute('open'));
        });
      }
      // 点击触发按钮/菜单之外的区域收起
      document.addEventListener('click', function (e) {
        if (dir.hasAttribute('open') && !dir.contains(e.target) && !morph.contains(e.target)) {
          setOpen(false);
        }
      });
      // ESC 关闭
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && dir.hasAttribute('open')) setOpen(false);
      });
      // 点击菜单项后收起（链接跳转 / 壁纸按钮都先收起）
      morph.querySelectorAll('a, button').forEach(function (el) {
        el.addEventListener('click', function () { setOpen(false); });
      });

      console.log('[导航] 变形生长菜单已就绪');
      return;
    }

    // 旧版页面兜底：用 JS 动态构建双胶囊 + 触发按钮
    var brand = inner.querySelector('.brand');
    var links = inner.querySelector('[data-nav-links]');
    var actions = inner.querySelector('.nav-actions');
    if (!brand || !links || !actions) return;

    // 左胶囊：品牌（Logo + 标题）
    var left = document.createElement('div');
    left.className = 'nav-capsule nav-capsule-left';
    left.appendChild(brand);

    // 右胶囊：目录触发按钮 + 页面目录 + 功能按钮
    var right = document.createElement('div');
    right.className = 'nav-capsule nav-capsule-right';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-dir-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', '展开页面目录');
    trigger.title = '页面目录';
    trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

    right.appendChild(trigger);
    right.appendChild(links);   // 移动到右胶囊
    right.appendChild(actions);

    var setOpen = function (open) {
      links.classList.toggle('open', open);
      // 内联样式强制显示/隐藏，不受任何 CSS 优先级影响（修复展开无效）
      links.style.display = open ? 'flex' : 'none';
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    // 点击目录链接后收起
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });

    // 目录展开/收起：单一事件委托处理（不依赖按钮直接绑定，最可靠）
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('.nav-dir-trigger')) {
        setOpen(!links.classList.contains('open'));
        return;
      }
      if (!right.contains(t)) setOpen(false);
    });

    inner.appendChild(left);
    inner.appendChild(right);
    console.log('[导航] 双胶囊已由 JS 构建');
  }

  /* ---------- 移动端汉堡菜单（导航重构后由目录触发按钮取代，此处保留兼容） ---------- */
  function initBurger() {
    var burger = document.querySelector('[data-burger]');
    var menu = document.querySelector('[data-nav-links]');
    if (!burger || !menu) return;

    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // 点击链接后收起
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Header 动态显隐（滚动方向控制 + rAF 节流 + 壁纸安全区） ---------- */
  function initHeaderScroll() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var menu = document.querySelector('[data-nav-links]');

    // 读取 CSS 变量：--nav-safe 壁纸顶部安全区（默认 12px）、--nav-h 导航高度（默认 72px）
    var safe = 12;
    var navH = 72;
    try {
      var cs = getComputedStyle(document.documentElement);
      var v1 = parseFloat(cs.getPropertyValue('--nav-safe'));
      var v2 = parseFloat(cs.getPropertyValue('--nav-h'));
      if (!isNaN(v1)) safe = v1;
      if (!isNaN(v2)) navH = v2;
    } catch (e) {}

    var lastY = window.pageYOffset || 0;
    var acc = 0;                         // 方向累计位移（迟滞，防抖）
    var hidden = false;
    var hoverReveal = false;             // 鼠标靠近顶部 → 强制显示
    var ticking = false;
    var SCROLL_TRIGGER = 24;              // 触发阈值：累计滚动 24px 才切换显隐
    var HIDE_OFFSET = -(navH + safe);     // 隐藏位：完全滑出视图，不遮挡壁纸
    var HOVER_REVEAL_Y = 100;             // 鼠标距视口顶部 100px 内视为"靠近"

    function applyVisibility() {
      // 拖拽胶囊中强制可见（鼠标可能已移出顶部显示区）
      var draggingCapsule = document.querySelector('.spring-drag');
      var shouldHide = hidden && !hoverReveal && !draggingCapsule;
      nav.style.setProperty('--nav-top', shouldHide ? HIDE_OFFSET + 'px' : safe + 'px');
    }
    function setState(nextHidden) {
      if (nextHidden === hidden) return;
      hidden = nextHidden;
      applyVisibility();
    }
    function setHover(active) {
      if (active === hoverReveal) return;
      hoverReveal = active;
      applyVisibility();
    }

    function update() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var delta = y - lastY;
      lastY = y;

      // 移动端下拉菜单展开或胶囊拖拽中时强制可见，避免菜单孤立悬空/拖拽时缩回
      var dirEl = document.querySelector('.nav-dir');
      if ((menu && menu.classList.contains('open')) || (dirEl && dirEl.hasAttribute('open')) ||
          document.querySelector('.spring-drag')) {
        acc = 0;
        setState(false);
        return;
      }

      // 初始状态：位于顶部安全区内 → 始终可见
      if (y <= safe) {
        acc = 0;
        setState(false);
        return;
      }

      // 滚动方向反转时清零累计
      if ((delta > 0 && acc < 0) || (delta < 0 && acc > 0)) acc = 0;
      acc += delta;

      // 向下滚动累计超过阈值 → 隐藏；向上滚动累计超过阈值 → 显示
      if (acc > SCROLL_TRIGGER) { setState(true); acc = 0; }
      else if (acc < -SCROLL_TRIGGER) { setState(false); acc = 0; }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // 鼠标靠近顶部：自动显示导航（离开顶部后按滚动状态隐藏）
    window.addEventListener('mousemove', function (e) {
      setHover(e.clientY <= HOVER_REVEAL_Y);
    });
    window.addEventListener('mouseleave', function () {
      setHover(false);
    });

    update();
  }

  /* ---------- 高亮当前导航 ---------- */
  function initActiveNav() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .morph-menu .morph-item').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });
  }

  /* ---------- toggle 演示控件 ---------- */
  function initDemoToggles() {
    document.querySelectorAll('.toggle').forEach(function (t) {
      t.setAttribute('role', 'switch');
      t.setAttribute('tabindex', '0');
      t.addEventListener('click', function () {
        var checked = t.getAttribute('aria-checked') === 'true';
        t.setAttribute('aria-checked', String(!checked));
      });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          t.click();
        }
      });
    });
  }

  /* ---------- 用户本地背景（纯前端，图片不上传服务器） ---------- */
  function initUserBackground() {
    var DB_NAME = 'ceshi-bg-db';
    var STORE = 'kv';
    var KEY = 'bg';
    if (!window.indexedDB) return;

    var aurora = document.querySelector('.aurora');
    var navActions = document.querySelector('.nav-actions');
    if (!aurora || !navActions) return;

    function openDB(cb) {
      var req;
      try { req = window.indexedDB.open(DB_NAME, 1); } catch (e) { cb(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { cb(req.result); };
      req.onerror = function () { cb(null); };
    }

    function storeSave(dataUrl, done) {
      openDB(function (db) {
        if (!db) { done(false); return; }
        var tx;
        try { tx = db.transaction(STORE, 'readwrite'); } catch (e) { done(false); return; }
        tx.objectStore(STORE).put(dataUrl, KEY);
        tx.oncomplete = function () { done(true); };
        tx.onerror = function () { done(false); };
        tx.onabort = function () { done(false); };
      });
    }

    function storeLoad(done) {
      openDB(function (db) {
        if (!db) { done(null); return; }
        var tx = db.transaction(STORE, 'readonly');
        var rq = tx.objectStore(STORE).get(KEY);
        rq.onsuccess = function () { done(rq.result || null); };
        rq.onerror = function () { done(null); };
      });
    }

    function storeRemove(done) {
      openDB(function (db) {
        if (!db) { done(false); return; }
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = function () { done(true); };
        tx.onerror = function () { done(false); };
      });
    }

    // 优先复用页面 HTML 里已写好的按钮；找不到时再动态注入（保证全站一致）
    var uploadBtn = document.querySelector('[data-bg-upload]');
    var resetBtn = document.querySelector('[data-bg-reset]');

    if (!uploadBtn) {
      uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.className = 'theme-toggle bg-btn';
      uploadBtn.setAttribute('data-bg-upload', '');
      uploadBtn.setAttribute('aria-label', '设置本地背景图片');
      uploadBtn.title = '设置本地背景图片';
      uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 17l5-5 3 3 3-3 7 7"/></svg>';
    }

    if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'theme-toggle bg-btn';
      resetBtn.setAttribute('data-bg-reset', '');
      resetBtn.setAttribute('aria-label', '清除本地背景');
      resetBtn.title = '清除本地背景';
      resetBtn.style.display = 'none';
      resetBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
    }

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    var bgImg = null;

    // data: URL 加载失败时的兜底：转成 blob: URL 再试一次
    function dataUrlToBlobUrl(dataUrl) {
      try {
        var comma = dataUrl.indexOf(',');
        if (comma < 0) return null;
        var head = dataUrl.slice(0, comma);
        var mime = (head.match(/^data:([^;]+)/) || [])[1] || 'image/png';
        var bin = atob(dataUrl.slice(comma + 1));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
      } catch (e) {
        return null;
      }
    }

    // 用独立 <img> 图层铺满全屏（object-fit: cover），比 CSS background-image 更稳定
    function apply(dataUrl) {
      if (!bgImg) {
        bgImg = document.createElement('img');
        bgImg.className = 'user-bg-img';
        bgImg.alt = '';
        bgImg.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bgImg);
        bgImg.addEventListener('error', function onErr() {
          var blobUrl = dataUrlToBlobUrl(bgImg.src);
          if (blobUrl) {
            bgImg.removeEventListener('error', onErr);
            bgImg.src = blobUrl;
          }
        });
      }
      bgImg.src = dataUrl;
      aurora.classList.add('has-user-bg');
      resetBtn.style.display = 'inline-flex';
    }

    function clear() {
      if (bgImg) {
        bgImg.removeAttribute('src');
        bgImg.remove();
        bgImg = null;
      }
      aurora.classList.remove('has-user-bg');
      resetBtn.style.display = 'none';
    }

    uploadBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        apply(reader.result);
        storeSave(reader.result, function (ok) {
          if (!ok) console.warn('[背景] 已应用，但无法持久化保存，刷新后可能失效');
        });
      };
      reader.onerror = function () { alert('读取图片失败，请重试。'); };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    resetBtn.addEventListener('click', function () {
      clear();
      storeRemove(function () {});
    });

    // 仅当按钮是动态创建、尚未挂到 DOM 时，才把它们放到主题切换按钮旁边
    if (!uploadBtn.parentNode) {
      var themeToggle = navActions.querySelector('[data-theme-toggle]');
      if (themeToggle) {
        navActions.insertBefore(uploadBtn, themeToggle);
      } else {
        navActions.appendChild(uploadBtn);
      }
    }
    if (!resetBtn.parentNode) {
      uploadBtn.insertAdjacentElement('afterend', resetBtn);
    }

    storeLoad(function (dataUrl) {
      if (dataUrl) apply(dataUrl);
    });
  }

  /* ---------- Liquid Glass 折射滤镜（参考 liquid-glass-react 的 feDisplacementMap 方案） ----------
     调参（HyperOS 4 预设 soft_glass_global_refraction = 0，即预设本身未开启折射；
          按你的要求保留边缘折射，但幅度调小）：
       LG_REFRACT     = 卡片边缘折射强度（位移幅度，单位 px），0 = 关闭，推荐 30 ~ 70
       LG_REFRACT_NAV = 导航折射强度，默认 0 = 关闭（导航是 sticky，滚动时每帧
                        重算滤镜会明显掉帧；需要时改回 20 左右即自动挂载）
     原理：位移贴图是“左上白 → 右下黑”的对角渐变 + 中心 0.5 灰平台段：
       中心平台 → 位移 0（中间区域完全不动，只作配合）；
       越靠近四边位移越大，且四边都向卡片内部取样 → 只有边缘一圈被折射掰弯，
       不会出现透明缺角。
     说明：与参考项目一致，Chromium（Chrome/Edge）完整支持；
           Firefox 自动跳过（仅保留模糊），Safari 部分支持。 */
  var LG_REFRACT = 0;   // 0 = 关闭液态折射（普通磨砂玻璃）
  var LG_REFRACT_NAV = 0;

  function injectRefractionFilter() {
    if (LG_REFRACT <= 0 && LG_REFRACT_NAV <= 0) return;
    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') !== -1;
    if (isFirefox) return;
    // 触摸设备跳过折射滤镜注入（手机 GPU 上 SVG 滤镜是滚动掉帧主因；
    // CSS 侧另有小屏降级兜底）
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    if (document.getElementById('liquid-glass-svg')) return;

    // 位移贴图：对角线性渐变（左上白 → 右下黑），48%~52% 为 0.5 灰零位移平台
    var map = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>" +
      "<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0%' stop-color='#ffffff'/>" +
      "<stop offset='25%' stop-color='#e6e6e6'/>" +
      "<stop offset='48%' stop-color='#808080'/>" +
      "<stop offset='52%' stop-color='#808080'/>" +
      "<stop offset='75%' stop-color='#191919'/>" +
      "<stop offset='100%' stop-color='#000000'/>" +
      "</linearGradient>" +
      "<rect width='256' height='256' fill='url(#g)'/>" +
      "</svg>"
    );

    function buildFilter(id, scale) {
      return '<filter id="' + id + '" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
        '<feImage href="' + map + '" xlink:href="' + map + '" result="MAP" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="MAP" scale="' + scale + '" xChannelSelector="R" yChannelSelector="B"/>' +
      '</filter>';
    }

    var wrap = document.createElement('div');
    wrap.id = 'liquid-glass-svg';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    wrap.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0">' +
        '<defs>' +
          buildFilter('lg-refract', LG_REFRACT) +
          (LG_REFRACT_NAV > 0 ? buildFilter('lg-refract-nav', LG_REFRACT_NAV) : '') +
        '</defs>' +
      '</svg>';
    document.body.appendChild(wrap);

    // CSS 侧按类挂载滤镜：卡片常开，导航仅在 LG_REFRACT_NAV > 0 时挂载
    document.documentElement.classList.add('lg-refract');
    if (LG_REFRACT_NAV > 0) document.documentElement.classList.add('lg-refract-nav');
  }

  /* ---------- 覆盖式滚动条：叠加在背景之上，滚动渐显、静止渐隐，可拖拽 ---------- */
  function initScrollbarAutoHide() {
    var HIDE_DELAY = 500;   // 停止滚动多久后渐隐（配合 CSS 0.45s opacity 过渡）
    var scroller = document.scrollingElement || document.documentElement;

    // 构建覆盖式滚动条（fixed 悬浮，不占布局、不挤压背景）
    var bar = document.createElement('div');
    bar.className = 'app-scrollbar';
    bar.setAttribute('aria-hidden', 'true');
    var thumb = document.createElement('div');
    thumb.className = 'app-scrollbar__thumb';
    bar.appendChild(thumb);
    document.body.appendChild(bar);

    var hideTimer = null;
    var raf = null;
    var dragging = false;
    var hovering = false;

    function refresh() {
      var ch = scroller.clientHeight;
      var sh = scroller.scrollHeight;
      if (sh <= ch + 1) { thumb.style.height = '0px'; return; }   // 内容不足一屏：不显示滑块
      var ratio = ch / sh;
      var th = Math.round(ch * ratio);
      th = Math.max(40, Math.min(th, Math.round(ch * 0.3)));      // 长度减短：最长不超过视口 30%
      var maxScroll = sh - ch;
      var maxTop = ch - th;
      var progress = maxScroll <= 0 ? 0 : Math.min(1, scroller.scrollTop / maxScroll);
      var top = Math.round(progress * maxTop);
      thumb.style.height = th + 'px';
      thumb.style.top = top + 'px';
    }

    function show() {
      bar.classList.add('app-scrollbar--visible');
      clearTimeout(hideTimer);
      if (!hovering && !dragging) hideTimer = setTimeout(hide, HIDE_DELAY);
    }
    function hide() {
      if (dragging || hovering) return;   // 拖拽中/悬停中不隐藏
      bar.classList.remove('app-scrollbar--visible');
    }

    // 拖动滑块：按抓取点偏移 1:1 跟随鼠标（跟手），并直接同步滑块位置
    var dragOffset = 0;
    function moveThumb(clientY) {
      var ch = scroller.clientHeight;
      var sh = scroller.scrollHeight;
      if (sh <= ch) return;
      var th = thumb.offsetHeight || 40;
      var maxTop = ch - th;
      var targetTop = clientY - dragOffset;
      var ratio = maxTop <= 0 ? 0 : Math.max(0, Math.min(1, targetTop / maxTop));
      // 拖拽时强制即时滚动：html 上的 scroll-behavior:smooth 会让赋值走平滑动画，导致页面不实时跟手
      var prev = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollTop = Math.round(ratio * (sh - ch));
      scroller.style.scrollBehavior = prev;
      thumb.style.top = Math.round(ratio * maxTop) + 'px';   // 直接同步，确保跟手不延迟
    }

    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        raf = null;
        refresh();
        show();
      });
    }

    // 拖拽逻辑（pointer 事件；移动/抬起挂在 window 上，避免指针离开识别区后丢事件）
    bar.addEventListener('pointerdown', function (e) {
      dragging = true;
      clearTimeout(hideTimer);
      show();
      dragOffset = e.clientY - thumb.getBoundingClientRect().top;   // 记住抓取点，滑块不跳、直接跟随
      moveThumb(e.clientY);
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      moveThumb(e.clientY);
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY);
    });

    // 鼠标靠近/悬停在识别区：自动显示；移开后再渐隐
    bar.addEventListener('mouseenter', function () {
      hovering = true;
      clearTimeout(hideTimer);
      show();
    });
    bar.addEventListener('mouseleave', function () {
      hovering = false;
      if (dragging) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY);
    });

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', refresh);

    // 内层滚动容器（课表/弹窗等）自动显隐：滚动时加 .scrolling（风格化缩略条淡入），静止后移除
    document.addEventListener('scroll', function (e) {
      var el = e.target;
      if (el === document || el === document.documentElement) return;   // 整页滚动交给上方覆盖条
      if (!el || !el.classList) return;
      el.classList.add('scrolling');
      clearTimeout(el._scrT);
      el._scrT = setTimeout(function () { el.classList.remove('scrolling'); }, 350);
    }, true);

    refresh();
    show();   // 首屏短暂显示一次，提示页面可滚动
  }

  /* ---------- 弹簧拖拽：整个导航胶囊可整体拖拽一小段距离，松手弹性归位 ---------- */
  function initSpringDrag() {
    var targets = document.querySelectorAll('.nav-capsule-left, .nav-capsule-right');
    var LONG_PRESS = 160;   // ms 长按阈值
    var MAX_DRAG = 52;      // 对数弹簧的参考值(px)：阻力从起步就有、越拖越大，且永不到硬墙
    var SPRING = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
    var cur = null;         // 当前拖拽中的胶囊 { el, sx, sy, active, dragging, timer }

    function finish() {
      if (!cur) return;
      var el = cur.el;
      clearTimeout(cur.timer);
      el.classList.remove('spring-drag');
      if (cur.dragging) {
        el.style.transition = SPRING;
        el.style.transform = '';
        el.addEventListener('transitionend', function h(ev) {
          if (ev.propertyName !== 'transform') return;
          el.style.transition = '';
          el.removeEventListener('transitionend', h);
        });
        el.__moved = true;                    // 供随后的 click 判断是否吞掉
        setTimeout(function () { if (el.__moved) el.__moved = false; }, 200);
      } else {
        el.style.transition = '';
        el.style.transform = '';
      }
      cur = null;
    }

    targets.forEach(function (el) {
      // 阻止浏览器原生"拖链接"手势（从品牌文字上拖会拖出链接幽灵），改由自定义拖拽接管
      el.addEventListener('dragstart', function (e) { e.preventDefault(); });
      el.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        finish();                              // 结束上一个
        el.__moved = false;
        cur = { el: el, sx: e.clientX, sy: e.clientY, active: false, dragging: false, timer: null };
        clearTimeout(cur.timer);
        cur.timer = setTimeout(function () {
          if (!cur || cur.el !== el) return;
          cur.active = true;
          el.classList.add('spring-drag');
          el.style.transition = 'transform 0s';   // 拖拽期间即时跟随
        }, LONG_PRESS);
      });

      // 拖拽过就吞掉随之而来的 click（避免误触发主题/菜单/导航）
      el.addEventListener('click', function (e) {
        if (el.__moved) { e.preventDefault(); e.stopPropagation(); el.__moved = false; }
      }, true);
    });

    // 拖拽全程（move/up/cancel）挂 window：光标移出胶囊也能跟随并归位
    window.addEventListener('pointermove', function (e) {
      if (!cur || !cur.active) return;   // 未到长按阈值：不响应（鼠标轻微抖动也不会误取消）
      cur.dragging = true;
      if (e.cancelable) e.preventDefault();
      var mx = e.clientX - cur.sx, my = e.clientY - cur.sy;
      var m = Math.hypot(mx, my);
      if (m > 0.5) {
        // 对数橡皮筋：d = MAX·ln(1 + m/MAX) —— 起步略低于 1:1、阻力从早就有，
        // 越拖越费劲且一直能拉（无硬墙），彻底避免"先跟手后撞墙"
        var d = MAX_DRAG * Math.log(1 + m / MAX_DRAG);
        var s = d / m;
        mx *= s; my *= s;
      }
      cur.el.style.transform = 'translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px)';
    });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectRefractionFilter();
    initTheme();
    initNavCapsules();
    initHeaderScroll();
    initScrollbarAutoHide();
    initCardGlow();
    initBurger();
    initActiveNav();
    initDemoToggles();
    initUserBackground();
    initSpringDrag();
  });
})();
