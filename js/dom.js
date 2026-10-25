// Tiny DOM helpers: morph() patches the live DOM to match new markup so re-rendering the whole
// screen keeps focus, scroll positions and running CSS animations; flip() animates keyed items
// to their new positions.

const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);

const same = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && keyOf(a) === keyOf(b);

function syncAttrs(from, to) {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  if (from.nodeName === 'INPUT' || from.nodeName === 'TEXTAREA' || from.nodeName === 'SELECT') {
    if (from !== document.activeElement && 'value' in to && to.getAttribute('value') !== null && from.value !== to.getAttribute('value')) {
      from.value = to.getAttribute('value');
    }
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
  }
}

function morphNode(from, to) {
  if (from.nodeType !== 1) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  // data-keep marks elements the app draws into itself (canvases): leave them untouched.
  if (from.hasAttribute('data-keep')) return;
  syncAttrs(from, to);
  morphChildren(from, to);
}

function morphChildren(from, to) {
  let f = from.firstChild;
  let t = to.firstChild;
  while (t) {
    const nextT = t.nextSibling;
    if (!f) {
      from.appendChild(t);
    } else if (same(f, t)) {
      morphNode(f, t);
      f = f.nextSibling;
    } else {
      const key = keyOf(t);
      let match = null;
      if (key) {
        for (let s = f.nextSibling; s; s = s.nextSibling) {
          if (keyOf(s) === key && s.nodeName === t.nodeName) {
            match = s;
            break;
          }
        }
      }
      if (match) {
        from.insertBefore(match, f);
        morphNode(match, t);
      } else {
        from.insertBefore(t, f);
      }
    }
    t = nextT;
  }
  while (f) {
    const next = f.nextSibling;
    from.removeChild(f);
    f = next;
  }
}

export function morph(root, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(root, tpl.content);
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Records keyed child positions, runs `change`, then slides children from old to new spots.
export function flip(container, change, duration = 260) {
  if (!container || reduced()) return change();
  const before = new Map();
  container.querySelectorAll('[data-key]').forEach((el) => before.set(el.dataset.key, el.getBoundingClientRect()));
  change();
  container.querySelectorAll('[data-key]').forEach((el) => {
    const old = before.get(el.dataset.key);
    if (!old) return;
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (!dx && !dy) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}
