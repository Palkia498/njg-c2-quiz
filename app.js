/* 新日本语教程 初级2 · 刷题 PWA
 * 全部逻辑本地运行：题目来自 data/bank.json，进度存在 localStorage。
 */
(function () {
  'use strict';

  var KEY = 'njg.c2.state.v1';
  var LETTER = ['A', 'B', 'C', 'D'];
  var bank = null;
  var state = null;
  var answeredThis = false;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 工具 ---------------- */
  function show(id) {
    ['screen-setup', 'screen-quiz', 'screen-done'].forEach(function (s) {
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
    var ids = [];
    lessons.forEach(function (n) {
      var pool = bank.questions.filter(function (q) { return q.lesson === n; })
                               .map(function (q) { return q.id; });
      ids = ids.concat(shuffle(pool));
    });
    state = {
      v: 1,
      version: bank.version,
      sel: lessons,
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

    answeredThis = false;
    var n = state.order.length;
    $('q-counter').textContent = (state.idx + 1) + ' / ' + n;
    $('q-lesson').textContent = '第' + q.lesson + '課 · ' + bank.grammar[q.gid].pattern;
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
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    fetch('./data/bank.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        bank = data;
        $('bank-sub').textContent = '选择题库范围 · 共 ' + bank.questions.length +
          ' 题 / ' + Object.keys(bank.grammar).length + ' 个语法点';
        bind();
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
