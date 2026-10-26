/*
 * Line simulator: step through chunks one at a time. Shows the buffer,
 * the lines taken out, and a plain-language explanation of each step.
 * Optionally compares with the naive chunk.split('\n').
 *
 * Markup:
 *   <div class="widget line-sim" data-title="..." data-chunks='["hel","lo\n"]' data-naive></div>
 * data-chunks is JSON, so write \n and \r as JSON escapes.
 * Add data-naive to show the "wrong way" column.
 */
(function () {
  /** A string with \r and \n made visible. */
  function visible(text) {
    var frag = document.createDocumentFragment();
    text.split(/(\r|\n)/).forEach(function (p) {
      if (p === '') return;
      if (p === '\r' || p === '\n') {
        var s = document.createElement('span');
        s.className = 'ctl';
        s.textContent = p === '\r' ? '\\r' : '\\n';
        frag.appendChild(s);
      } else {
        frag.appendChild(document.createTextNode(p));
      }
    });
    return frag;
  }

  /** A quoted string as inline code, with \r and \n visible. */
  function q(text) {
    var c = document.createElement('code');
    c.appendChild(document.createTextNode('"'));
    c.appendChild(visible(text));
    c.appendChild(document.createTextNode('"'));
    return c;
  }

  /** Builds a sentence from strings (plain text) and {q: '...'} (quoted code). */
  function sentence(parts) {
    var li = document.createElement('li');
    parts.forEach(function (p) {
      li.appendChild(typeof p === 'string' ? document.createTextNode(p) : q(p.q));
    });
    return li;
  }

  /** The buffered splitter, same rules as the lesson. */
  function takeLines(buffer, final) {
    var lines = [];
    var start = 0;
    for (var i = 0; i < buffer.length; i++) {
      var ch = buffer[i];
      if (ch !== '\n' && ch !== '\r') continue;
      if (ch === '\r') {
        if (i === buffer.length - 1 && !final) break; // might be the first half of \r\n
        lines.push(buffer.slice(start, i));
        if (buffer[i + 1] === '\n') i++;
      } else {
        lines.push(buffer.slice(start, i));
      }
      start = i + 1;
    }
    return { lines: lines, buffer: buffer.slice(start) };
  }

  function lineList(lines) {
    var ol = document.createElement('ol');
    lines.forEach(function (l) {
      var li = document.createElement('li');
      if (l === '') {
        li.className = 'blank';
        li.textContent = '"" (blank line)';
      } else {
        li.appendChild(visible(l));
      }
      ol.appendChild(li);
    });
    if (!lines.length) {
      var li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'nothing yet';
      ol.appendChild(li);
    }
    return ol;
  }

  /** Plain-language explanation of what happened in the latest step. */
  function explain(step, chunks, before, result, ended) {
    var out = [];
    if (step === 0) {
      out.push(sentence(['Nothing has arrived yet. The buffer is empty.']));
      return out;
    }
    if (!ended) {
      var chunk = chunks[step - 1];
      out.push(sentence(['Chunk ' + step + ' arrives: ', { q: chunk }, '.']));
      out.push(sentence(['Add it to the end of the buffer. The buffer is now ', { q: before + chunk }, '.']));
    } else {
      out.push(sentence(['The stream ends. No more chunks will come.']));
    }
    var waitingOnCR = result.buffer[result.buffer.length - 1] === '\r';
    if (result.lines.length === 0 && !ended) {
      out.push(sentence([waitingOnCR ? 'Look for a line ending… there is a \\r at the very end, but we can\'t be sure yet. Take nothing out.' : 'Look for a line ending… none found, so no line is complete. Take nothing out.']));
    }
    result.lines.forEach(function (l) {
      out.push(sentence(l === '' ? ['Found a line ending with nothing before it → take out an empty line ', { q: '' }, ' (a blank line).'] : ['Found a line ending → take out the line ', { q: l }, '.']));
    });
    var left = result.buffer;
    if (ended) {
      if (left) out.push(sentence(['Left over: ', { q: left }, '. It never got a line ending, so it is not a complete line. Drop it.']));
      else out.push(sentence(['The buffer is empty. Everything was a complete line.']));
    } else if (left === '') {
      out.push(sentence(['The buffer is now empty. Wait for the next chunk.']));
    } else if (left[left.length - 1] === '\r') {
      out.push(sentence(['Keep ', { q: left }, ' in the buffer. It ends with ', { q: '\r' }, ', which might be the first half of ', { q: '\r\n' }, '. Wait for the next chunk to find out.']));
    } else {
      out.push(sentence(['Keep ', { q: left }, ' in the buffer. It has no line ending yet, so the rest of the line is still coming.']));
    }
    return out;
  }

  function setup(root) {
    var chunks = JSON.parse(root.dataset.chunks);
    var showNaive = root.hasAttribute('data-naive');
    root.innerHTML =
      '<h3>' + (root.dataset.title || 'Step through the chunks') + '</h3>' +
      '<div class="chunks"></div>' +
      '<div class="row"><button class="primary">Next chunk →</button><button>Start over</button><span class="step muted"></span></div>' +
      '<ol class="story" aria-live="polite"></ol>' +
      '<div class="sim-grid' + (showNaive ? '' : ' single') + '">' +
      (showNaive ? '<div><b>✗ Wrong way: chunk.split("\\n")</b><div class="naive"></div></div>' : '') +
      '<div><b>✓ With a buffer</b><div class="buf-label">buffer now: <code class="buf"></code></div><div class="buf-label">lines taken out so far:</div><div class="good"></div></div>' +
      '</div>';
    var chunkEls = [];
    var chunksBox = root.querySelector('.chunks');
    chunks.forEach(function (c, i) {
      var el = document.createElement('code');
      el.className = 'chunk c' + (i % 4);
      el.title = 'chunk ' + (i + 1);
      el.appendChild(visible(c));
      chunksBox.appendChild(el);
      chunkEls.push(el);
    });
    var next = root.querySelector('.row .primary');
    var reset = root.querySelector('.row button:not(.primary)');
    var step = 0;

    function render() {
      var naive = [];
      var buffer = '';
      var lines = [];
      var before = '';
      var last = { lines: [], buffer: '' };
      for (var i = 0; i < step && i < chunks.length; i++) {
        naive = naive.concat(chunks[i].split('\n'));
        before = buffer;
        last = takeLines(buffer + chunks[i], false);
        lines = lines.concat(last.lines);
        buffer = last.buffer;
      }
      var ended = step > chunks.length;
      if (ended) {
        before = buffer;
        last = takeLines(buffer, true);
        lines = lines.concat(last.lines);
        buffer = last.buffer;
      }
      chunkEls.forEach(function (el, i) {
        el.classList.toggle('done', i < step);
        el.classList.toggle('now', i === step - 1 && !ended);
      });
      root.querySelector('.story').replaceChildren.apply(root.querySelector('.story'), explain(step, chunks, before, last, ended));
      if (showNaive) root.querySelector('.naive').replaceChildren(lineList(naive));
      root.querySelector('.buf').replaceChildren(buffer ? visible(buffer) : document.createTextNode('"" (empty)'));
      root.querySelector('.good').replaceChildren(lineList(lines));
      root.querySelector('.step').textContent = step === 0 ? 'Not started' : ended ? 'Finished' : 'Step ' + step + ' of ' + (chunks.length + 1);
      next.textContent = step < chunks.length ? 'Next chunk →' : 'End the stream →';
      next.disabled = ended;
    }
    next.addEventListener('click', function () { step++; render(); });
    reset.addEventListener('click', function () { step = 0; render(); });
    render();
  }

  document.querySelectorAll('.line-sim').forEach(setup);
})();
