/*
 * Event simulator: step through SSE lines one at a time. Shows the parser's
 * three variables (data buffer, event type, last id), the events sent so far,
 * and a plain-language explanation of each step.
 *
 * Markup: <div class="widget event-sim" data-title="..." data-lines='["data: hi", ""]'></div>
 * data-lines is a JSON array of lines (already split, no line endings).
 */
(function () {
  function code(text) {
    var c = document.createElement('code');
    c.textContent = JSON.stringify(text);
    return c;
  }

  function sentence(parts) {
    var li = document.createElement('li');
    parts.forEach(function (p) {
      li.appendChild(typeof p === 'string' ? document.createTextNode(p) : code(p.q));
    });
    return li;
  }

  /** Runs the parser over `lines`, returning the final state and a story for the last line. */
  function run(lines) {
    var s = { data: '', type: '', id: '', events: [], story: [] };
    lines.forEach(function (line) {
      var story = [sentence(['Line: ', { q: line }])];
      if (line === '') {
        if (s.data === '') {
          story.push(sentence(['Empty line → end of an event. But the data buffer is empty, so there is nothing to send.']));
        } else {
          var ev = { event: s.type || 'message', data: s.data.slice(0, -1), id: s.id };
          s.events.push(ev);
          story.push(sentence(['Empty line → the event is finished. Send it:']));
          story.push(sentence(['event = ', { q: ev.event }, s.type ? '' : ' (no type was set, so "message")', ', data = ', { q: ev.data }, ' (the last \\n removed), id = ', { q: ev.id }]));
        }
        story.push(sentence(['Reset the data buffer and the event type to "". The last id stays.']));
        s.data = '';
        s.type = '';
      } else if (line[0] === ':') {
        story.push(sentence(['Starts with ":" → a comment (servers send these to keep the connection alive). Ignore it.']));
      } else {
        var colon = line.indexOf(':');
        var field = colon === -1 ? line : line.slice(0, colon);
        var value = colon === -1 ? '' : line.slice(colon + 1);
        var hadSpace = value[0] === ' ';
        if (hadSpace) value = value.slice(1);
        if (colon === -1) {
          story.push(sentence(['No ":" in the line → the whole line is the field name ', { q: field }, ', and the value is ', { q: '' }, '.']));
        } else {
          story.push(sentence(['Split at the first ":" → field ', { q: field }, ', value ', { q: value }, hadSpace ? ' (one space after ":" removed).' : '.']));
        }
        if (field === 'data') {
          s.data += value + '\n';
          story.push(sentence(['Field is data → add the value and a \\n to the data buffer. Data buffer is now ', { q: s.data }, '.']));
        } else if (field === 'event') {
          s.type = value;
          story.push(sentence(['Field is event → set the event type to ', { q: value }, '.']));
        } else if (field === 'id') {
          s.id = value;
          story.push(sentence(['Field is id → set the last id to ', { q: value }, '. It stays for later events until the server changes it.']));
        } else {
          story.push(sentence(['Field ', { q: field }, ' is not data, event or id → ignore it.']));
        }
      }
      s.story = story;
    });
    return s;
  }

  function setup(root) {
    var lines = JSON.parse(root.dataset.lines);
    root.innerHTML =
      '<h3>' + (root.dataset.title || 'Step through the lines') + '</h3>' +
      '<ol class="ev-lines"></ol>' +
      '<div class="row"><button class="primary">Next line →</button><button>Start over</button><span class="step muted"></span></div>' +
      '<ol class="story" aria-live="polite"></ol>' +
      '<div class="sim-grid">' +
      '<div><b>Parser state</b><table class="ev-state"><tr><td>data buffer</td><td><code class="st-data"></code></td></tr><tr><td>event type</td><td><code class="st-type"></code></td></tr><tr><td>last id</td><td><code class="st-id"></code></td></tr></table></div>' +
      '<div><b>Events sent</b><ol class="ev-out"></ol></div>' +
      '</div>';
    var list = root.querySelector('.ev-lines');
    var items = lines.map(function (l) {
      var li = document.createElement('li');
      li.appendChild(code(l));
      if (l === '') li.appendChild(document.createTextNode('  ← empty line'));
      list.appendChild(li);
      return li;
    });
    var next = root.querySelector('.row .primary');
    var reset = root.querySelector('.row button:not(.primary)');
    var step = 0;

    function render() {
      var s = run(lines.slice(0, step));
      items.forEach(function (li, i) {
        li.classList.toggle('done', i < step);
        li.classList.toggle('now', i === step - 1);
      });
      var story = root.querySelector('.story');
      story.replaceChildren.apply(story, step === 0 ? [sentence(['Nothing read yet. All three variables start as "".'])] : s.story);
      root.querySelector('.st-data').textContent = JSON.stringify(s.data);
      root.querySelector('.st-type').textContent = JSON.stringify(s.type);
      root.querySelector('.st-id').textContent = JSON.stringify(s.id);
      var out = root.querySelector('.ev-out');
      out.replaceChildren();
      s.events.forEach(function (e) {
        var li = document.createElement('li');
        li.appendChild(code(e));
        out.appendChild(li);
      });
      if (!s.events.length) {
        var none = document.createElement('li');
        none.className = 'none';
        none.textContent = 'none yet';
        out.appendChild(none);
      }
      var finished = step >= lines.length;
      root.querySelector('.step').textContent = step === 0 ? 'Not started' : 'Line ' + step + ' of ' + lines.length;
      next.disabled = finished;
      if (finished && step > 0 && s.data !== '') {
        story.appendChild(sentence(['The stream ends here, but the last event never got its empty line. It is not sent.']));
      }
    }
    next.addEventListener('click', function () { step++; render(); });
    reset.addEventListener('click', function () { step = 0; render(); });
    render();
  }

  document.querySelectorAll('.event-sim').forEach(setup);
})();
