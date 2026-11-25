/* 新日本语教程 初级2 · 刷题 PWA
 * 全部逻辑本地运行：题目来自 data/bank.json，进度存在 localStorage。
 */
(function () {
  'use strict';

  var KEY = 'njg.c2.state.v1';
  var WKEY = 'njg.c2.wrong.v1';
  var LETTER = ['A', 'B', 'C', 'D'];
  var bank = null;
  var state = null;
  var answeredThis = false;
  var curQ = null;
  /* 错题本：wrong.q[题号] / wrong.g[语法点号]，值=记入时间；wSel 是本次勾选的键（'q:xxx' / 'g:xxx'） */
  var wrong = { q: {}, g: {} };
  var wSel = {};
  var wTab = 'q';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 工具 ---------------- */
  function show(id) {
    ['screen-setup', 'screen-quiz', 'screen-done', 'screen-wrong'].forEach(function (s) {
      $(s).classList.toggle('hidden', s !== id);
    });
    window.scrollTo(0, 0);
  }
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, ms || 1800);
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveState() {
    if (!state) return;
    state.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function clearState() {
    state = null;
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function qById(id) {
    for (var i = 0; i < bank.questions.length; i++) {
      if (bank.questions[i].id === id) return bank.questions[i];
    }
    return null;
  }

  /* ---------------- 错题本数据 ---------------- */
  function loadWrong() {
    try {
      var o = JSON.parse(localStorage.getItem(WKEY) || 'null');
      wrong = { q: (o && o.q) || {}, g: (o && o.g) || {} };
    } catch (e) { wrong = { q: {}, g: {} }; }
  }
  function saveWrong() {
    try {
      localStorage.setItem(WKEY, JSON.stringify({ v: 1, q: wrong.q, g: wrong.g }));
    } catch (e) {}
  }
  function gidLesson() {
    if (gidLesson._m) return gidLesson._m;
    var m = {};
    bank.units.forEach(function (u) {
      u.lessons.forEach(function (l) {
        (l.points || []).forEach(function (g) { m[g] = l.lesson; });
      });
    });
    gidLesson._m = m;
    return m;
  }
  function lessonTitle(n) {
    for (var i = 0; i < bank.units.length; i++) {
      var ls = bank.units[i].lessons;
      for (var j = 0; j < ls.length; j++) if (ls[j].lesson === n) return ls[j].title;
    }
    return '';
  }
  function questionsOfGid(gid) {
    return bank.questions.filter(function (q) { return q.gid === gid; });
  }
  function wrongTotals() {
    return { q: Object.keys(wrong.q).length, g: Object.keys(wrong.g).length };
  }
  function updateWrongBadge() {
    var t = wrongTotals();
    var el = $('wrong-count');
    if (el) el.textContent = t.q + ' 题 / ' + t.g + ' 点';
  }
  function renderMarks() {
    if (!curQ) return;
    var qOn = !!wrong.q[curQ.id], gOn = !!wrong.g[curQ.gid];
    var bq = $('btn-mark-q'), bg = $('btn-mark-g');
    bq.textContent = qOn ? '✓ 已记入错题本' : '＋ 记入错题本';
    bq.classList.toggle('on', qOn);
    bg.textContent = gOn ? '✓ 已记入语法点' : '＋ 记入语法点';
    bg.classList.toggle('on', gOn);
  }
  function toggleMark(kind) {
    if (!curQ) return;
    if (kind === 'q') {
      if (wrong.q[curQ.id]) { delete wrong.q[curQ.id]; toast('已从错题本移除'); }
      else { wrong.q[curQ.id] = Date.now(); toast('已记入错题本'); }
    } else {
      if (wrong.g[curQ.gid]) { delete wrong.g[curQ.gid]; toast('已从语法点本移除'); }
      else { wrong.g[curQ.gid] = Date.now(); toast('已记入语法点本'); }
    }
    saveWrong();
    renderMarks();
    updateWrongBadge();
  }

  /* ---------------- 错题本界面 ---------------- */
  function openWrongBook() {
    wSel = {};
    wTab = 'q';
    renderWrongScreen();
    show('screen-wrong');
  }
  function wrongSelIds() {
    var ids = [], gids = [];
    Object.keys(wSel).forEach(function (k) {
      if (!wSel[k]) return;
      if (k.indexOf('q:') === 0) ids.push(k.slice(2));
      else gids.push(k.slice(2));
    });
    gids.forEach(function (g) {
      questionsOfGid(g).forEach(function (q) {
        if (ids.indexOf(q.id) < 0) ids.push(q.id);
      });
    });
    return ids;
  }
  function renderWrongScreen() {
    var t = wrongTotals();
    $('tab-q').textContent = '错题 ' + t.q;
    $('tab-g').textContent = '语法点 ' + t.g;
    $('tab-q').classList.toggle('on', wTab === 'q');
    $('tab-g').classList.toggle('on', wTab === 'g');
    $('w-title').textContent = '错题本';
    $('w-sub').textContent = t.q + ' 道错题 · ' + t.g + ' 个语法点';

    // 按课分组
    var groups = {};
    if (wTab === 'q') {
      Object.keys(wrong.q).forEach(function (id) {
        var q = qById(id);
        if (!q) return;
        (groups[q.lesson] = groups[q.lesson] || []).push({ key: 'q:' + id, q: q });
      });
    } else {
      var m = gidLesson();
      Object.keys(wrong.g).forEach(function (gid) {
        var les = m[gid];
        (groups[les] = groups[les] || []).push({ key: 'g:' + gid, gid: gid });
      });
    }

    var list = $('wrong-list');
    list.innerHTML = '';
    var lesKeys = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    if (!lesKeys.length) {
      list.innerHTML = '<div class="empty">' +
        (wTab === 'q'
          ? '还没有错题。<br>答题后点「＋ 记入错题本」，这里就会出现。'
          : '还没有记过语法点。<br>答题后点「＋ 记入语法点」，这里就会出现。') +
        '</div>';
    }

    lesKeys.forEach(function (les) {
      var items = groups[les], keys = items.map(function (x) { return x.key; });
      var wrap = document.createElement('div');
      wrap.className = 'unit';
      var head = document.createElement('div');
      head.className = 'unit-head';
      head.innerHTML = '<span class="unit-name">第' + les + '課　' +
        escapeHtml(lessonTitle(les)) + '</span>';
      var allBtn = document.createElement('button');
      allBtn.className = 'unit-all';
      allBtn.textContent = '本课全选';
      allBtn.addEventListener('click', function () {
        var allOn = keys.every(function (k) { return wSel[k]; });
        keys.forEach(function (k) { if (allOn) delete wSel[k]; else wSel[k] = 1; });
        renderWrongScreen();
      });
      head.appendChild(allBtn);
      wrap.appendChild(head);

      items.forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'item' + (wSel[it.key] ? ' checked' : '');
        var main = '';
        if (it.q) {
          main = '<div class="item-t">' + escapeHtml(it.q.stem) + '</div>' +
                 '<div class="item-s">' + escapeHtml(bank.grammar[it.q.gid].pattern) +
                 '　·　答：' + escapeHtml(it.q.options[it.q.answer]) + '</div>';
        } else {
          var g = bank.grammar[it.gid];
          main = '<div class="item-t">' + escapeHtml(g.pattern) + '</div>' +
                 '<div class="item-s">' + escapeHtml(g.cn) + '　·　' +
                 questionsOfGid(it.gid).length + ' 题</div>';
        }
        row.innerHTML = '<div class="box">' + (wSel[it.key] ? '✓' : '') + '</div>' +
          '<div class="item-main">' + main + '</div>' +
          '<button class="item-x" aria-label="移除">✕</button>';
        row.addEventListener('click', function () {
          if (wSel[it.key]) delete wSel[it.key]; else wSel[it.key] = 1;
          renderWrongScreen();
        });
        row.querySelector('.item-x').addEventListener('click', function (e) {
          e.stopPropagation();
          if (it.q) delete wrong.q[it.q.id]; else delete wrong.g[it.gid];
          delete wSel[it.key];
          saveWrong();
          renderWrongScreen();
          updateWrongBadge();
          toast('已移除');
        });
        wrap.appendChild(row);
      });
      list.appendChild(wrap);
    });

    var ids = wrongSelIds();
    var nq = 0, ng = 0;
    Object.keys(wSel).forEach(function (k) {
      if (!wSel[k]) return;
      if (k.indexOf('q:') === 0) nq++; else ng++;
    });
    var parts = [];
    if (nq) parts.push(nq + ' 道错题');
    if (ng) parts.push(ng + ' 个语法点');
    $('w-sel').textContent = ids.length
      ? '已选 ' + parts.join(' + ') + ' · 共 ' + ids.length + ' 题'
      : '已选 0 项 · 0 题';
    $('btn-wstart').disabled = ids.length === 0;
    $('btn-wstart').textContent = ids.length ? '开始练习（' + ids.length + ' 题）' : '开始练习';
  }

  /* ---------------- 选题范围 ---------------- */
  function renderSetup() {
    var list = $('lesson-list');
    list.innerHTML = '';
    var selSet = {};
    (state && state.sel ? state.sel : []).forEach(function (n) { selSet[n] = true; });

    bank.units.forEach(function (u, ui) {
      var wrap = document.createElement('div');
      wrap.className = 'unit';
      var head = document.createElement('div');
      head.className = 'unit-head';
      head.innerHTML = '<span class="unit-name">' + escapeHtml(bank.unit_names[ui]) + '</span>';
      var allBtn = document.createElement('button');
      allBtn.className = 'unit-all';
      allBtn.textContent = '整单元全选';
      allBtn.addEventListener('click', function () {
        var allOn = u.lessons.every(function (l) { return selSet[l.lesson]; });
        u.lessons.forEach(function (l) {
          if (allOn) delete selSet[l.lesson]; else selSet[l.lesson] = true;
        });
        applySel(selSet);
      });
      head.appendChild(allBtn);
      wrap.appendChild(head);

      u.lessons.forEach(function (l) {
        var row = document.createElement('div');
        row.className = 'lesson' + (selSet[l.lesson] ? ' checked' : '');
        row.dataset.lesson = l.lesson;
        row.innerHTML =
          '<div class="box">' + (selSet[l.lesson] ? '✓' : '') + '</div>' +
          '<div class="lesson-main">' +
            '<div class="lesson-title">第' + l.lesson + '課　' + escapeHtml(l.title) + '</div>' +
            '<div class="lesson-meta">' + l.points.length + ' 个语法点 · ' + l.count + ' 题</div>' +
          '</div>';
        row.addEventListener('click', function () {
          if (selSet[l.lesson]) delete selSet[l.lesson]; else selSet[l.lesson] = l.lesson;
          applySel(selSet);
        });
        wrap.appendChild(row);
      });
      list.appendChild(wrap);
    });
    applySel(selSet);
  }

  function applySel(selSet) {
    var lessons = Object.keys(selSet).map(Number).sort(function (a, b) { return a - b; });
    // 同步勾选样式（不整页重绘，保留滚动位置）
    var rows = document.querySelectorAll('.lesson');
    for (var i = 0; i < rows.length; i++) {
      var n = Number(rows[i].dataset.lesson);
      var on = !!selSet[n];
      rows[i].classList.toggle('checked', on);
      rows[i].querySelector('.box').textContent = on ? '✓' : '';
    }
    var total = lessons.reduce(function (s, n) { return s + countOf(n); }, 0);
    $('sel-info').textContent = '已选 ' + lessons.length + ' 课 · ' + total + ' 题';
    $('btn-start').disabled = total === 0;
    $('btn-start').textContent = lessons.length ? '开始练习（' + total + ' 题）' : '开始练习';
    $('btn-start').onclick = function () {
      if (!total) return;
      startRound(lessons);
    };
    renderResumeBanner();
  }

  function countOf(lesson) {
    for (var i = 0; i < bank.units.length; i++) {
      var ls = bank.units[i].lessons;
      for (var j = 0; j < ls.length; j++) if (ls[j].lesson === lesson) return ls[j].count;
    }
    return 0;
  }

  function renderResumeBanner() {
    var b = $('resume-banner');
    if (state && state.order && state.order.length &&
        state.idx < state.order.length && state.version === bank.version) {
      var done = Object.keys(state.answers || {}).length;
      $('resume-detail').textContent =
        '已答 ' + done + ' / ' + state.order.length + ' 题，第 ' + (state.idx + 1) + ' 题等你';
      b.classList.remove('hidden');
    } else {
      b.classList.add('hidden');
    }
  }

  /* ---------------- 开始 / 继续 ---------------- */
  function startRound(lessons) {
    /* 所选范围内全部题目混洗成一条顺序，不再按课分组 */
    var ids = bank.questions.filter(function (q) {
      return lessons.indexOf(q.lesson) >= 0;
    }).map(function (q) { return q.id; });
    beginRound(ids, lessons);
  }

  function beginRound(ids, sel) {
    ids = shuffle(ids);
    state = {
      v: 1,
      version: bank.version,
      sel: sel || [],
      order: ids,
      idx: 0,
      answers: {},
      startedAt: Date.now(),
      updatedAt: Date.now()
    };
    saveState();
    renderQuestion();
    show('screen-quiz');
  }

  function resumeRound() {
    renderQuestion();
    show('screen-quiz');
  }

  function startWrongOnly() {
    if (!state || !state.answers) return;
    var wrong = state.order.filter(function (id) {
      var q = qById(id);
      return q && state.answers[id] !== undefined && state.answers[id] !== q.answer;
    });
    if (!wrong.length) { toast('没有错题，太厉害了'); return; }
    var sel = (state.sel || []).slice();
    state = {
      v: 1, version: bank.version, sel: sel,
      order: shuffle(wrong.slice()), idx: 0, answers: {},
      startedAt: Date.now(), updatedAt: Date.now()
    };
    saveState();
    renderQuestion();
    show('screen-quiz');
  }

  /* ---------------- 答题 ---------------- */
  function renderQuestion() {
    if (!state || !state.order.length) { show('screen-setup'); return; }
    if (state.idx >= state.order.length) { showDone(); return; }

    var q = qById(state.order[state.idx]);
    if (!q) { state.idx++; saveState(); renderQuestion(); return; }
    curQ = q;

    answeredThis = false;
    var n = state.order.length;
    $('q-counter').textContent = (state.idx + 1) + ' / ' + n;
    $('q-lesson').textContent = '第' + q.lesson + '課';
    $('progress-fill').style.width = (state.idx / n * 100) + '%';

    $('q-stem').innerHTML = escapeHtml(q.stem).split('（　　）').join('<span class="blank">　　</span>');

    var box = $('q-options');
    box.innerHTML = '';
    q.options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.className = 'opt';
      btn.innerHTML = '<span class="lt">' + LETTER[i] + '</span><span>' + escapeHtml(opt) + '</span>';
      btn.addEventListener('click', function () { answer(i, q); });
      box.appendChild(btn);
    });

    $('q-feedback').classList.add('hidden');
    $('btn-next').textContent = (state.idx === n - 1) ? '看成绩' : '下一题';
  }

  function answer(pick, q) {
    if (answeredThis) return;
    answeredThis = true;
    state.answers[q.id] = pick;
    saveState();

    var ok = pick === q.answer;
    var btns = $('q-options').querySelectorAll('.opt');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      if (i === q.answer) btns[i].classList.add('correct');
      else if (i === pick) btns[i].classList.add('wrong');
      else btns[i].classList.add('dim');
    }

    var v = $('fb-verdict');
    v.className = 'verdict ' + (ok ? 'ok' : 'ng');
    v.textContent = ok
      ? '✓ 答对了　' + LETTER[q.answer] + '. ' + q.options[q.answer]
      : '✗ 答错了　正确答案 ' + LETTER[q.answer] + '. ' + q.options[q.answer] +
        '　（你选 ' + LETTER[pick] + '. ' + q.options[pick] + '）';

    var g = bank.grammar[q.gid];
    $('gp-pattern').textContent = g.pattern;
    $('gp-meta').textContent = '第' + q.lesson + '課 · ' + q.gid;
    var book = $('gp-book');
    if (g.cn_book && g.cn_book.text) {
      book.className = 'gp-book';
      book.innerHTML = escapeHtml(g.cn_book.text) +
        '<span class="pg">—— 教材 p.' + g.cn_book.page + ' 原文</span>';
    } else {
      book.className = 'gp-book missing';
      book.textContent = '（这个语法点的教材中文讲解还没录入）';
    }
    $('gp-brief').textContent = g.cn;
    $('q-src').textContent = '例句出处：' + (q.source === 'tb' ? '教材' : '同步辅导') +
      ' p.' + q.page + '　·　句子为书中原文，未改写';

    $('q-feedback').classList.remove('hidden');
    renderMarks();
    $('q-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function next() {
    if (!answeredThis) {
      // 允许跳过（不计入对错，稍后仍会再出现？这里选择：直接跳过不记录）
      state.idx++;
      saveState();
      renderQuestion();
      return;
    }
    state.idx++;
    saveState();
    renderQuestion();
  }

  /* ---------------- 完成 ---------------- */
  function showDone() {
    var total = state.order.length;
    var right = 0, wrongs = [];
    state.order.forEach(function (id) {
      var q = qById(id);
      if (!q) return;
      var pick = state.answers[id];
      if (pick === q.answer) right++;
      else if (pick !== undefined) wrongs.push(q);
    });
    var answered = Object.keys(state.answers).length;
    $('done-rate').textContent = (answered ? Math.round(right / total * 100) : 0) + '%';
    $('done-nums').textContent = '共 ' + total + ' 题 · 答对 ' + right +
      ' · 答错 ' + (answered - right) + (answered < total ? ' · 未答 ' + (total - answered) : '');

    var box = $('wrong-box');
    box.innerHTML = '';
    if (!wrongs.length) {
      box.innerHTML = '<div class="wrow"><div class="wq">全对，没有错题 🎉</div></div>';
    } else {
      wrongs.forEach(function (q) {
        var d = document.createElement('div');
        d.className = 'wrow';
        d.innerHTML = '<div class="wq">' + escapeHtml(q.stem) + '</div>' +
          '<div class="wa">正确：' + escapeHtml(q.options[q.answer]) +
          '　·　' + escapeHtml(bank.grammar[q.gid].pattern) + '</div>';
        box.appendChild(d);
      });
    }
    $('btn-again-wrong').classList.toggle('hidden', !wrongs.length);
    $('progress-fill').style.width = '100%';
    show('screen-done');
  }

  /* ---------------- 导出 ---------------- */
  function exportState() {
    var data = JSON.stringify(state || {}, null, 1);
    try {
      var blob = new Blob([data], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'njg-c2-progress.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('已导出 progress.json');
    } catch (e) {
      toast('导出失败，已复制到剪贴板');
      if (navigator.clipboard) navigator.clipboard.writeText(data);
    }
  }

  /* ---------------- 绑定 ---------------- */
  function bind() {
    $('btn-resume').addEventListener('click', resumeRound);
    $('btn-discard').addEventListener('click', function () {
      clearState();
      renderSetup();
      toast('已放弃上次进度');
    });
    $('btn-quit').addEventListener('click', function () {
      saveState();
      show('screen-setup');
      renderSetup();
      toast('进度已保存');
    });
    $('btn-skip').addEventListener('click', next);
    $('btn-next').addEventListener('click', next);
    $('btn-again-wrong').addEventListener('click', startWrongOnly);
    $('btn-newround').addEventListener('click', function () {
      clearState();
      show('screen-setup');
      renderSetup();
    });
    $('btn-export').addEventListener('click', exportState);

    /* 错题本 */
    $('btn-wrongbook').addEventListener('click', openWrongBook);
    $('btn-wback').addEventListener('click', function () {
      show('screen-setup');
      renderSetup();
      updateWrongBadge();
    });
    $('tab-q').addEventListener('click', function () { wTab = 'q'; renderWrongScreen(); });
    $('tab-g').addEventListener('click', function () { wTab = 'g'; renderWrongScreen(); });
    $('btn-wstart').addEventListener('click', function () {
      var ids = wrongSelIds();
      if (!ids.length) return;
      beginRound(ids, state && state.sel ? state.sel.slice() : []);
    });
    $('btn-mark-q').addEventListener('click', function () { toggleMark('q'); });
    $('btn-mark-g').addEventListener('click', function () { toggleMark('g'); });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    fetch('./data/bank.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        bank = data;
        loadWrong();
        $('bank-sub').textContent = '选择题库范围 · 共 ' + bank.questions.length +
          ' 题 / ' + Object.keys(bank.grammar).length + ' 个语法点';
        bind();
        updateWrongBadge();
        var saved = loadState();
        if (saved && saved.version === bank.version && saved.order && saved.order.length) {
          state = saved;
          if (state.idx < state.order.length) { resumeRound(); return; }
          if (state.idx >= state.order.length && Object.keys(state.answers || {}).length) {
            showDone(); return;
          }
        }
        if (saved && saved.version !== bank.version) { clearState(); }
        show('screen-setup');
        renderSetup();
      })
      .catch(function (e) {
        $('bank-sub').textContent = '题库加载失败：' + e.message + '（首次使用请联网打开一次）';
      });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
  boot();
})();
