/*
 * In-browser coding task with instant, automatic tests.
 *
 * Markup:
 *   <div class="widget code-task" data-task="myTask" data-fn="functionName">
 *     <h3>Practice</h3>
 *     <textarea>starter code</textarea>
 *     <details><summary>Hint</summary>...</details>
 *   </div>
 *
 * Tests are registered in any script (read when Run is clicked):
 *   window.CODE_TASKS = { myTask: [{ name, run: async (fn) => ({ pass, detail }) }] }
 *
 * Helpers for stream exercises are on window.StreamKit.
 */
(function () {
  var encoder = new TextEncoder();
  var lastInput = ''; // shown in failure details so you can see what went in

  /** A ReadableStream that delivers `text` as UTF-8 bytes, `size` bytes per chunk. */
  function streamOf(text, size) {
    var bytes = text instanceof Uint8Array ? text : encoder.encode(text);
    lastInput = typeof text === 'string' ? JSON.stringify(text) + ', ' + size + ' byte(s) per chunk' : 'raw bytes [' + Array.from(bytes).join(', ') + '], ' + size + ' per chunk';
    var i = 0;
    var stats = { reads: 0, cancelled: false };
    var stream = new ReadableStream({
      pull: function (controller) {
        if (i >= bytes.length) return controller.close();
        stats.reads++;
        controller.enqueue(bytes.slice(i, i + size));
        i += size;
      },
      cancel: function () {
        stats.cancelled = true;
      },
    });
    stream.stats = stats;
    return stream;
  }

  function show(value) {
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
  }

  /** A ReadableStream that delivers each string in `parts` as its own chunk (exact split points). */
  function streamOfChunks(parts) {
    lastInput = parts.map(function (p) { return JSON.stringify(p); }).join('  then  ');
    var all = parts.map(function (p) { return encoder.encode(p); });
    var i = 0;
    var stats = { reads: 0, cancelled: false };
    var stream = new ReadableStream({
      pull: function (controller) {
        if (i >= all.length) return controller.close();
        stats.reads++;
        controller.enqueue(all[i++]);
      },
      cancel: function () {
        stats.cancelled = true;
      },
    });
    stream.stats = stats;
    return stream;
  }

  /** Collects everything an async iterable yields into an array. */
  async function collect(iterable) {
    var out = [];
    for await (var x of iterable) {
      out.push(x);
      // An endless yield loop never lets timers run, so the page would freeze. Stop it here.
      if (out.length > 1000) {
        throw new Error('Yielded more than 1000 values. Probably an endless loop: does every loop have a way to stop?');
      }
    }
    return out;
  }

  /** Test result for "got deep-equals want" (JSON comparison). */
  function same(got, want, note) {
    var g = JSON.stringify(got);
    var w = JSON.stringify(want);
    return {
      pass: g === w,
      detail: (lastInput ? 'input chunks: ' + lastInput + '\n' : '') + 'expected:     ' + w + '\nyour code:    ' + g + (note ? '\n' + note : ''),
    };
  }

  window.StreamKit = { streamOf: streamOf, streamOfChunks: streamOfChunks, collect: collect, same: same, show: show, encoder: encoder };

  function setup(root) {
    var area = root.querySelector('textarea');
    var key = 'code-task:' + location.pathname + ':' + root.dataset.task;
    var starter = area.value;
    try {
      var saved = localStorage.getItem(key);
      if (saved) area.value = saved;
    } catch (e) {}

    var row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<button class="primary">Run tests</button><button>Reset code</button>';
    area.after(row);
    var list = document.createElement('ul');
    var summary = document.createElement('div');
    summary.className = 'summary';
    summary.setAttribute('role', 'status');
    row.after(list, summary);

    area.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = area.selectionStart;
        area.setRangeText('  ', s, area.selectionEnd, 'end');
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run();
    });
    area.addEventListener('input', function () {
      try { localStorage.setItem(key, area.value); } catch (e) {}
    });
    row.children[1].addEventListener('click', function () {
      area.value = starter;
      try { localStorage.removeItem(key); } catch (e) {}
      list.innerHTML = '';
      summary.textContent = '';
    });
    row.children[0].addEventListener('click', run);

    async function run() {
      var tests = (window.CODE_TASKS || {})[root.dataset.task] || [];
      list.innerHTML = '';
      summary.className = 'summary';
      var fn;
      try {
        fn = new Function(area.value + '\n;return ' + root.dataset.fn + ';')();
        if (typeof fn !== 'function') throw new Error(root.dataset.fn + ' is not a function');
      } catch (err) {
        summary.textContent = 'Your code did not load: ' + err.message;
        return;
      }
      var passed = 0;
      for (var t of tests) {
        lastInput = '';
        var li = document.createElement('li');
        li.textContent = t.name;
        var result;
        try {
          result = await Promise.race([
            t.run(fn),
            new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Timed out after 2s (infinite loop or never-settling promise?)')); }, 2000); }),
          ]);
        } catch (err) {
          result = { pass: false, detail: 'Threw: ' + (err && err.message) };
        }
        li.className = result.pass ? 'pass' : 'fail';
        if (!result.pass && result.detail) {
          var d = document.createElement('span');
          d.className = 'detail';
          d.textContent = result.detail;
          li.appendChild(d);
        }
        if (result.pass) passed++;
        list.appendChild(li);
      }
      summary.textContent = passed + ' / ' + tests.length + ' passing' + (passed === tests.length ? ' — nice work.' : '');
      if (passed === tests.length) summary.classList.add('done');
    }
  }
  document.querySelectorAll('.code-task').forEach(setup);
})();
