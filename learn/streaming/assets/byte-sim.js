/*
 * Byte simulator: shows a string as UTF-8 bytes, cut into network chunks,
 * and compares two ways of decoding them.
 * Markup: <div class="widget byte-sim" data-text="سلام 👋" data-size="3"></div>
 */
(function () {
  var encoder = new TextEncoder();

  function chunk(bytes, size) {
    var out = [];
    for (var i = 0; i < bytes.length; i += size) out.push(bytes.slice(i, i + size));
    return out;
  }

  function setup(root) {
    root.innerHTML =
      '<h3>Try it: bytes on the wire</h3>' +
      '<label>Text <input type="text"></label>' +
      '<label>Chunk size <input type="range" min="1" max="8"> <span class="mono"></span></label>' +
      '<div class="bytes" aria-label="Bytes, coloured by chunk"></div>' +
      '<div class="sim-out">' +
      '<div><b>new TextDecoder().decode(chunk) per chunk</b><output class="naive"></output></div>' +
      '<div><b>one decoder, { stream: true }</b><output class="stream"></output></div>' +
      '</div>';
    var text = root.querySelector('input[type=text]');
    var size = root.querySelector('input[type=range]');
    var sizeLabel = root.querySelector('label span');
    var bytesEl = root.querySelector('.bytes');
    text.value = root.dataset.text || 'Hi سلام 👋';
    size.value = root.dataset.size || '3';

    function render() {
      var n = Number(size.value);
      sizeLabel.textContent = n + (n === 1 ? ' byte' : ' bytes');
      var chunks = chunk(encoder.encode(text.value), n);
      bytesEl.innerHTML = '';
      chunks.forEach(function (c, ci) {
        Array.prototype.forEach.call(c, function (b, bi) {
          var s = document.createElement('span');
          s.className = 'byte c' + (ci % 4) + (bi === 0 && ci > 0 ? ' split' : '');
          s.textContent = b.toString(16).padStart(2, '0');
          s.title = 'chunk ' + (ci + 1);
          bytesEl.appendChild(s);
        });
      });
      root.querySelector('.naive').textContent = chunks.map(function (c) { return new TextDecoder().decode(c); }).join('');
      var d = new TextDecoder();
      root.querySelector('.stream').textContent =
        chunks.map(function (c) { return d.decode(c, { stream: true }); }).join('') + d.decode();
    }
    text.addEventListener('input', render);
    size.addEventListener('input', render);
    render();
  }
  document.querySelectorAll('.byte-sim').forEach(setup);
})();
