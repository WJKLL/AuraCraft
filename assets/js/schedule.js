/* ==========================================================================
   课程表（周日历）——数据仅存本地浏览器 localStorage，不上传服务器
   - 首页 mini 视图：index.html 的 hero-glass 内
   - 完整可编辑课程表：schedule.html
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'ceshi-schedule';
  var DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var COLORS = ['#0080FF', '#8B00FF', '#FF1493', '#20B2AA', '#FF8A00', '#00A86B', '#5A6BFF'];

  var editingId = null;
  var colorSel = 'auto';   // 卡片颜色选择：'auto' 或具体色值

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaults() {
    return {
      meta: { grade: '大三', term: 1, week: 5 },
      courses: [
        { id: uid(), name: '高等数学', day: 1, start: 1, len: 2, room: '教3-101', teacher: '张老师', weeks: 'all' },
        { id: uid(), name: '大学英语', day: 2, start: 3, len: 2, room: '教2-204', teacher: '李老师', weeks: 'odd' },
        { id: uid(), name: '数据结构', day: 3, start: 1, len: 2, room: '实验楼B-302', teacher: '王老师', weeks: 'all' },
        { id: uid(), name: '体育', day: 4, start: 5, len: 2, room: '操场', teacher: '', weeks: 'even' },
        { id: uid(), name: '毛概', day: 5, start: 1, len: 2, room: '教1-401', teacher: '赵老师', weeks: 'all' }
      ]
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.meta && Array.isArray(d.courses)) return d;
      }
    } catch (e) {}
    var d = defaults();
    save(d);
    return d;
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  function metaLabel(m) {
    m = m || {};
    return (m.grade || '') + ' · 第' + (m.term || 1) + '学期 · 第' + (m.week || 1) + '周';
  }

  function sortCourses(list) {
    return list.slice().sort(function (a, b) {
      return (a.day - b.day) || (a.start - b.start);
    });
  }

  function colorFor(c) {
    var h = 0;
    for (var i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  /* ---------- 单双周辅助 ---------- */
  function weeksShort(w) {
    if (w === 'odd') return '单';
    if (w === 'even') return '双';
    if (typeof w === 'string' && /^\d+\s*-\s*\d+$/.test(w)) {
      var p = w.split('-');
      var a = parseInt(p[0], 10), b = parseInt(p[1], 10);
      return (a === b) ? String(a) : (a + '-' + b);
    }
    return '';
  }
  // 该课程在第 weekNo 周是否上课（all=每周都上；"a-b"=第 a~b 周上课）
  function inWeek(w, weekNo) {
    if (w === 'odd') return (weekNo % 2 === 1);
    if (w === 'even') return (weekNo % 2 === 0);
    if (typeof w === 'string' && /^\d+\s*-\s*\d+$/.test(w)) {
      var p = w.split('-');
      var a = parseInt(p[0], 10), b = parseInt(p[1], 10);
      return weekNo >= a && weekNo <= b;
    }
    return true;
  }

  /* ---------- 首页 mini 视图（周日历纵向列表） ---------- */
  function scrollMiniToToday(list) {
    if (!list) return;
    var today = new Date().getDay();   // 0=周日 1=周一 … 6=周六
    var todayNum = (today === 0) ? 7 : today;
    var el = list.querySelector('.sched-mini-day[data-day="' + todayNum + '"]');
    if (!el) return;
    // 用可视区坐标计算相对偏移（不受移动端 offsetParent 差异影响，桌面/移动一致生效）
    var offset = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop - 4;
    list.scrollTop = Math.max(0, offset);
  }

  function renderMini() {
    var badge = document.getElementById('sched-badge');
    var list = document.getElementById('sched-mini-list');
    var data = load();
    if (badge) badge.textContent = metaLabel(data.meta);
    if (!list) return;

    list.innerHTML = '';
    var weekNo = Number(data.meta.week) || 1;
    // 按当前周次奇偶过滤单双周课程
    var courses = sortCourses(data.courses).filter(function (c) {
      return inWeek(c.weeks, weekNo);
    });

    if (!courses.length) {
      var empty = document.createElement('p');
      empty.className = 'sched-empty';
      empty.textContent = '暂无课程，点「展开全部」去添加';
      list.appendChild(empty);
      return;
    }

    var curDay = -1, dayWrap = null;
    courses.forEach(function (c) {
      if (c.day !== curDay) {
        curDay = c.day;
        dayWrap = document.createElement('div');
        dayWrap.className = 'sched-mini-day';
        dayWrap.setAttribute('data-day', c.day);
        var dh = document.createElement('div');
        dh.className = 'sched-mini-dayname';
        dh.textContent = DAYS[c.day - 1] || ('周' + c.day);
        dayWrap.appendChild(dh);
        list.appendChild(dayWrap);
      }
      var row = document.createElement('div');
      row.setAttribute('data-glow', '');   // 让补扫的光效逻辑识别并注入跟随光斑
      row.className = 'sched-mini-row';

      var t = document.createElement('span');
      t.className = 'sched-mini-time';
      t.textContent = c.start + '-' + (c.start + c.len - 1);

      var n = document.createElement('span');
      n.className = 'sched-mini-name';
      n.textContent = c.name;

      row.appendChild(t);
      row.appendChild(n);
      var ws = weeksShort(c.weeks);
      if (ws) {
        var wt = document.createElement('span');
        wt.className = 'sched-mini-weeks w-' + (c.weeks === 'odd' ? 'odd' : 'even');
        wt.textContent = ws;
        row.appendChild(wt);
      }
      if (c.room) {
        var r = document.createElement('span');
        r.className = 'sched-mini-room';
        r.textContent = '@' + c.room;
        row.appendChild(r);
      }
      dayWrap.appendChild(row);
    });

    // 自动滚动到"今天"的当天课程到顶部
    scrollMiniToToday(list);
  }

  /* ---------- 完整课程表 ---------- */
  function renderFull() {
    var grid = document.getElementById('sched-grid');
    if (!grid) return;
    var data = load();

    var gEl = document.getElementById('meta-grade');
    var tEl = document.getElementById('meta-term');
    var wEl = document.getElementById('meta-week');
    if (gEl) gEl.value = data.meta.grade || '';
    if (tEl) tEl.value = data.meta.term || 1;
    if (wEl) wEl.value = data.meta.week || 1;

    renderGrid(grid, data);
  }

  function renderGrid(grid, data) {
    grid.innerHTML = '';

    // 所有格子都用显式行列定位，避免自动放置被课程块挤乱导致错位
    var corner = document.createElement('div');
    corner.className = 'sched-corner';
    corner.textContent = '节次';
    corner.style.gridRow = '1';
    corner.style.gridColumn = '1';
    grid.appendChild(corner);
    for (var d = 1; d <= 7; d++) {
      var h = document.createElement('div');
      h.className = 'sched-day';
      h.textContent = DAYS[d - 1];
      h.style.gridRow = '1';
      h.style.gridColumn = (d + 1) + ' / ' + (d + 2);
      grid.appendChild(h);
    }

    for (var p = 1; p <= 16; p++) {
      var lab = document.createElement('div');
      lab.className = 'sched-period';
      lab.textContent = '第' + p + '节';
      lab.style.gridRow = (p + 1) + ' / ' + (p + 2);
      lab.style.gridColumn = '1';
      grid.appendChild(lab);
      for (var dd = 1; dd <= 7; dd++) {
        (function (day, period) {
          var cell = document.createElement('div');
          cell.className = 'sched-cell';
          cell.style.gridRow = (period + 1) + ' / ' + (period + 2);
          cell.style.gridColumn = (day + 1) + ' / ' + (day + 2);
          cell.addEventListener('click', function () { openEditor(null, day, period); });
          grid.appendChild(cell);
        })(dd, p);
      }
    }

    data.courses.forEach(function (c) {
      var b = document.createElement('div');
      b.className = 'sched-course';
      b.style.gridColumn = (c.day + 1) + ' / ' + (c.day + 2);
      b.style.gridRow = (c.start + 1) + ' / ' + (c.start + c.len + 1);
      b.style.background = c.color || colorFor(c);

      var n = document.createElement('div');
      n.className = 'sched-course-name';
      n.textContent = c.name;
      var r = document.createElement('div');
      r.className = 'sched-course-room';
      r.textContent = c.room || '';
      b.appendChild(n);
      b.appendChild(r);
      var ws = weeksShort(c.weeks);
      if (ws) {
        var wb = document.createElement('span');
        wb.className = 'sched-course-weeks w-' + (c.weeks === 'odd' ? 'odd' : 'even');
        wb.textContent = ws;
        b.appendChild(wb);
      }
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openEditor(c.id, c.day, c.start);
      });
      grid.appendChild(b);
    });
  }

  function refresh() {
    var grid = document.getElementById('sched-grid');
    if (grid) renderGrid(grid, load());
    renderMini();
  }

  /* ---------- 添加/编辑弹层 ---------- */
  function openEditor(id, day, period) {
    var data = load();
    editingId = id || null;
    var c = null;
    if (id) {
      for (var i = 0; i < data.courses.length; i++) {
        if (data.courses[i].id === id) { c = data.courses[i]; break; }
      }
    }
    var f = modalFields();
    f.name.value = c ? c.name : '';
    f.day.value = c ? c.day : day;
    f.start.value = c ? c.start : period;
    f.len.value = c ? c.len : 2;
    f.weeks.value = c ? (c.weeks || 'all') : 'all';
    f.room.value = c ? (c.room || '') : '';
    f.teacher.value = c ? (c.teacher || '') : '';
    setActiveColor((c && c.color) ? c.color : 'auto');

    var title = document.getElementById('sched-modal-title');
    if (title) title.textContent = c ? '编辑课程' : '添加课程';
    var del = document.getElementById('f-delete');
    if (del) del.style.display = c ? '' : 'none';
    var modal = document.getElementById('sched-modal');
    if (modal) modal.hidden = false;
  }

  function closeEditor() {
    editingId = null;
    var modal = document.getElementById('sched-modal');
    if (modal) modal.hidden = true;
  }

  function modalFields() {
    return {
      name: document.getElementById('f-name'),
      day: document.getElementById('f-day'),
      start: document.getElementById('f-start'),
      len: document.getElementById('f-len'),
      weeks: document.getElementById('f-weeks'),
      room: document.getElementById('f-room'),
      teacher: document.getElementById('f-teacher')
    };
  }

  /* ---------- 卡片颜色选择 ---------- */
  function bindColorPicker() {
    var row = document.getElementById('f-colors');
    if (!row) return;
    row.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.sched-color') : null;
      if (!b) return;
      setActiveColor(b.getAttribute('data-color'));
    });
  }
  function setActiveColor(sel) {
    colorSel = sel || 'auto';
    var btns = document.querySelectorAll('.sched-color');
    for (var i = 0; i < btns.length; i++) {
      var v = btns[i].getAttribute('data-color') || 'auto';
      btns[i].classList.toggle('is-active', v === colorSel);
    }
  }

  function bindModal() {
    var saveBtn = document.getElementById('f-save');
    var delBtn = document.getElementById('f-delete');
    var cancelBtn = document.getElementById('f-cancel');
    var modal = document.getElementById('sched-modal');

    if (saveBtn) saveBtn.addEventListener('click', function () {
      var f = modalFields();
      var name = (f.name.value || '').trim();
      if (!name) { alert('请填写课程名'); return; }
      var data = load();
      var rec = {
        id: editingId || uid(),
        name: name,
        day: Number(f.day.value) || 1,
        start: Number(f.start.value) || 1,
        len: Number(f.len.value) || 2,
        weeks: f.weeks.value || 'all',
        room: (f.room.value || '').trim(),
        teacher: (f.teacher.value || '').trim(),
        color: colorSel && colorSel !== 'auto' ? colorSel : ''
      };
      if (editingId) {
        for (var i = 0; i < data.courses.length; i++) {
          if (data.courses[i].id === editingId) { data.courses[i] = rec; break; }
        }
      } else {
        data.courses.push(rec);
      }
      save(data);
      closeEditor();
      refresh();
    });

    if (delBtn) delBtn.addEventListener('click', function () {
      if (!editingId) return;
      var data = load();
      data.courses = data.courses.filter(function (x) { return x.id !== editingId; });
      save(data);
      closeEditor();
      refresh();
    });

    if (cancelBtn) cancelBtn.addEventListener('click', closeEditor);
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target === modal) closeEditor();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeEditor();
    });
  }

  function bindMeta() {
    var btn = document.getElementById('meta-save');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var data = load();
      var g = document.getElementById('meta-grade');
      var t = document.getElementById('meta-term');
      var w = document.getElementById('meta-week');
      if (g) data.meta.grade = (g.value || '').trim() || data.meta.grade;
      if (t) data.meta.term = Number(t.value) || 1;
      if (w) data.meta.week = Number(w.value) || 1;
      save(data);
      refresh();
    });
  }

  /* ---------- 从 Excel 导入课程 ---------- */
  function bindImport() {
    var btn = document.getElementById('excel-import');
    var input = document.getElementById('excel-file');
    if (!btn || !input) return;
    btn.addEventListener('click', function () {
      input.value = '';
      input.click();
    });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      if (!/\.(xlsx?|xlsm?)$/i.test(f.name)) { alert('请选择 .xls 或 .xlsx 文件'); return; }
      handleExcelFile(f);
    });
  }

  function handleExcelFile(file) {
    if (typeof XLSX === 'undefined') { alert('Excel 解析库未加载，请检查网络后刷新重试'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!rows || !rows.length) { alert('文件为空'); return; }
        applyImport(parseRows(rows));
      } catch (err) {
        alert('解析失败：' + (err && err.message ? err.message : err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 宽松匹配表头列：include 命中且不含 exclude 关键词；已占用列不再复用
  function parseRows(rows) {
    var hIdx = findHeaderRow(rows);
    if (hIdx < 0) return { courses: [], skipped: 0 };
    if (hIdx > 0) rows = rows.slice(hIdx);
    var headers = (rows[0] || []).map(function (h) { return String(h == null ? '' : h); });
    // 网格课表格式（节次 + 星期一~星期日）：走网格解析
    if (isGridHeaders(headers)) return parseGrid(rows);
    var used = {};
    function col(include, exclude) {
      for (var i = 0; i < headers.length; i++) {
        if (used[i]) continue;
        var h = headers[i].toLowerCase();
        var hit = false;
        for (var a = 0; a < include.length; a++) { if (h.indexOf(include[a]) !== -1) { hit = true; break; } }
        if (!hit) continue;
        var bad = false;
        for (var b = 0; b < exclude.length; b++) { if (h.indexOf(exclude[b]) !== -1) { bad = true; break; } }
        if (bad) continue;
        used[i] = true;
        return i;
      }
      return -1;
    }
    var cols = {
      name: col(['课程', '名称', 'name', 'subject'], ['教师', '老师', 'teacher', '星期']),
      day: col(['星期', '周几', 'weekday', 'day'], ['周次']),
      start: col(['开始节', '节次', 'start', 'begin', 'period'], ['节数', '时长']),
      len: col(['节数', '时长', '长度', 'len', 'length', 'duration'], []),
      weeks: col(['周次', '单双周', 'weeks'], ['星期']),
      room: col(['地点', '教室', '位置', 'room', 'place'], []),
      teacher: col(['教师', '老师', 'teacher'], [])
    };

    var courses = [];
    var skipped = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r] || [];
      function cell(i) { return i >= 0 && i < row.length ? String(row[i] == null ? '' : row[i]).trim() : ''; }
      var name = cell(cols.name);
      if (!name) { skipped++; continue; }
      courses.push({
        id: uid(),
        name: name,
        day: parseDay(cell(cols.day)),
        start: clampInt(cell(cols.start), 1, 12, 1),
        len: clampInt(cell(cols.len), 1, 4, 1),
        weeks: parseWeeks(cell(cols.weeks)),
        room: cell(cols.room),
        teacher: cell(cols.teacher)
      });
    }
    return { courses: courses, skipped: skipped };
  }

  /* ----- 网格课表格式解析（节次 + 星期一~星期日；每格可含多门 ★ 分隔课程） ----- */
  function hasHeaderKeyword(headers, keywords) {
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] == null ? '' : headers[i]).toLowerCase();
      for (var k = 0; k < keywords.length; k++) { if (h.indexOf(keywords[k]) !== -1) return i; }
    }
    return -1;
  }
  // 跳过顶部标题行，找到真正的表头行（网格：节次+星期~日；列格式：课程名+星期）
  function findHeaderRow(rows) {
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || [];
      var headers = row.map(function (h) { return String(h == null ? '' : h); });
      if (isGridHeaders(headers)) return i;
      if (hasHeaderKeyword(headers, ['课程', '名称', 'subject']) >= 0 &&
          hasHeaderKeyword(headers, ['星期', '周几', 'weekday', 'day']) >= 0) return i;
    }
    return -1;
  }
  function isGridHeaders(headers) {
    if (!headers || headers.length < 2) return false;
    var h0 = String(headers[0] || '').toLowerCase();
    if (h0.indexOf('节') === -1) return false;
    var found = 0;
    for (var i = 1; i < headers.length; i++) { if (dayFromHeader(headers[i])) found++; }
    return found >= 5;
  }
  function dayFromHeader(h) {
    h = String(h == null ? '' : h).trim();
    if (h.indexOf('星期') !== -1 || h.indexOf('周') !== -1) {
      var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
      for (var k in map) { if (h.indexOf(k) !== -1) return map[k]; }
    }
    var n = parseInt(h, 10);
    if (n >= 1 && n <= 7) return n;
    return 0;
  }
  function parseGrid(rows) {
    var headers = (rows[0] || []).map(function (h) { return String(h == null ? '' : h); });
    var dayCols = [];
    for (var i = 1; i < headers.length; i++) {
      var day = dayFromHeader(headers[i]);
      if (day) dayCols.push({ col: i, day: day });
    }
    var courses = [];
    var skipped = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var rowPeriod = parsePeriodRange(String(row[0] == null ? '' : row[0]));
      for (var d = 0; d < dayCols.length; d++) {
        var dc = dayCols[d];
        var cellText = String(row[dc.col] == null ? '' : row[dc.col]);
        if (!cellText.trim()) continue;
        var lines = cellText.split(/\r?\n/);
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          if (!line.trim()) continue;
          var c = parseGridCourse(line, dc.day, rowPeriod);
          if (!c) { skipped++; continue; }
          courses.push(c);
        }
      }
    }
    return { courses: courses, skipped: skipped };
  }
  function parseGridCourse(line, day, rowPeriod) {
    var parts = line.split('★');
    var name = (parts[0] || '').trim();
    if (!name) return null;
    var course = {
      id: uid(),
      name: name,
      day: day,
      start: rowPeriod ? rowPeriod.start : 1,
      len: rowPeriod ? rowPeriod.len : 1,
      weeks: 'all',
      room: '',
      teacher: ''
    };
    // 找第一个含 "(" 的段，作为「周次(节次)」信息，如 1-16(03,04节) 或 (01,02节)
    var block = null;
    for (var i = 1; i < parts.length; i++) {
      if (parts[i].indexOf('(') !== -1) { block = parts[i]; break; }
    }
    var tail = [];
    for (var j = 1; j < parts.length; j++) {
      if (parts[j] === block) continue;
      tail.push((parts[j] || '').trim());
    }
    if (block) {
      var per = parsePeriods(block);
      if (per) { course.start = per.start; course.len = per.len; }
      course.weeks = parseWeekRange(block) || 'all';
    }
    course.room = tail[0] || '';
    course.teacher = tail[1] || '';
    return course;
  }
  function parsePeriodRange(label) {
    var rng = /(\d+)\s*[-–—~]\s*(\d+)/.exec(String(label || ''));
    if (rng) {
      var a = parseInt(rng[1], 10), b = parseInt(rng[2], 10);
      return { start: a, len: Math.max(1, b - a + 1) };
    }
    var n = parseInt(String(label || ''), 10);
    if (!isNaN(n)) return { start: n, len: 1 };
    return null;
  }
  function parsePeriods(block) {
    var m = /\(([\d、，,]+)\s*节?\)/.exec(String(block || ''));
    if (!m) return null;
    var nums = m[1].split(/[、，,]/).filter(function (x) { return x !== ''; }).map(function (x) { return parseInt(x, 10); });
    if (!nums.length) return null;
    nums.sort(function (a, b) { return a - b; });
    return { start: nums[0], len: nums.length };
  }
  function parseWeekRange(block) {
    var before = String(block || '').split('(')[0].trim();
    if (!before) return 'all';
    var m = /^(\d+)\s*[-–—~]\s*(\d+)$/.exec(before);
    if (m) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      return (a <= 1) ? 'all' : (a + '-' + b);
    }
    var n = parseInt(before, 10);
    if (!isNaN(n)) return (n <= 1) ? 'all' : (n + '-' + n);
    return 'all';
  }

  function parseDay(v) {
    v = String(v == null ? '' : v);
    var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7, '末': 6 };
    for (var k in map) { if (v.indexOf(k) !== -1) return map[k]; }
    return clampInt(v, 1, 7, 1);
  }

  function parseWeeks(v) {
    v = String(v == null ? '' : v).toLowerCase();
    if (v.indexOf('单') !== -1 || v.indexOf('odd') !== -1) return 'odd';
    if (v.indexOf('双') !== -1 || v.indexOf('even') !== -1) return 'even';
    return 'all';
  }

  function clampInt(v, min, max, dflt) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return dflt;
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
  }

  function applyImport(result) {
    if (!result.courses.length) {
      alert('没有可导入的课程。请确认表头包含：课程名/星期/开始节次/节数/周次/地点/教师。');
      return;
    }
    var data = load();
    var replace = false;
    if (data.courses.length) {
      replace = confirm('检测到已有 ' + data.courses.length + ' 门课程。\n\n确定 = 清空现有课程后导入\n取消 = 追加到现有课程');
    }
    if (replace) data.courses = [];
    data.courses = data.courses.concat(result.courses);
    save(data);
    refresh();
    var msg = '成功导入 ' + result.courses.length + ' 门课程';
    if (result.skipped) msg += '，跳过 ' + result.skipped + ' 行（课程名为空）';
    alert(msg);
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderMini();
    if (document.getElementById('sched-grid')) {
      renderFull();
      bindMeta();
      bindModal();
      bindColorPicker();
      bindImport();
    }
  });
})();
