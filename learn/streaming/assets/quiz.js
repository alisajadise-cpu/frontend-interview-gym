/*
 * Quiz component. Markup:
 *   <div class="quiz-q" data-correct="1" data-explain="Why the right answer is right.">
 *     <p>Question?</p>
 *     <div class="choices"><button>A</button><button>B</button>...</div>
 *   </div>
 * Choices are shuffled on load so position gives no clue.
 */
(function () {
  function setup(q) {
    var box = q.querySelector('.choices');
    var buttons = Array.prototype.slice.call(box.querySelectorAll('button'));
    var correct = buttons[Number(q.dataset.correct)];
    // Shuffle so the answer position is random each visit.
    for (var i = buttons.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      box.appendChild(buttons[j]);
      buttons.splice(j, 1);
    }
    var feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.setAttribute('role', 'status');
    q.appendChild(feedback);

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      box.querySelectorAll('button').forEach(function (x) { x.classList.remove('right', 'wrong'); });
      if (b === correct) {
        b.classList.add('right');
        feedback.className = 'feedback right';
        feedback.textContent = 'Correct. ' + (q.dataset.explain || '');
      } else {
        b.classList.add('wrong');
        feedback.className = 'feedback wrong';
        feedback.textContent = 'Not quite. Think again, then try another answer.';
      }
    });
  }
  document.querySelectorAll('.quiz-q').forEach(setup);
})();
