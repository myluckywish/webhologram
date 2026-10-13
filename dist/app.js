(() => {
  const STORAGE_KEY = 'lics-trove-canvas-v1';
  const LEGACY_STORAGE_KEY = 'node-weave-canvas-v1';
  const colors = {
    gold: { bg: '#6c5039', ink: '#f0c997', dot: '#d1a36b', label: 'IDEA', symbol: '✳' },
    blue: { bg: '#605849', ink: '#dfd0af', dot: '#bba984', label: 'CONCEPT', symbol: '◇' },
    purple: { bg: '#6a4d46', ink: '#e9b8a8', dot: '#cb9180', label: 'NOTE', symbol: '▤' },
    green: { bg: '#485b49', ink: '#c5d9b9', dot: '#9eb796', label: 'TASK', symbol: '✓' },
    coral: { bg: '#704c42', ink: '#efbca9', dot: '#d6957e', label: 'POINT', symbol: '◆' }
  };
  const seed = {
    nodes: [
      { id: 'n1', x: 180, y: 245, title: 'Start with an idea', description: 'Every great project begins with a spark.', color: 'gold' },
      { id: 'n2', x: 510, y: 130, title: 'Explore possibilities', description: 'Let your thinking branch out.', color: 'blue' },
      { id: 'n3', x: 510, y: 375, title: 'Make connections', description: 'See how ideas work together.', color: 'purple' },
      { id: 'n4', x: 835, y: 255, title: 'Bring it to life', description: 'Turn your map into momentum.', color: 'green' }
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2' }, { id: 'e2', from: 'n1', to: 'n3' }, { id: 'e3', from: 'n2', to: 'n4' }, { id: 'e4', from: 'n3', to: 'n4' }]
  };
  const $ = id => document.getElementById(id);
  const shell = $('canvas-shell'), world = $('world'), nodesEl = $('nodes'), edgesEl = $('edges');
  let data;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    data = validData(stored) ? stored : structuredClone(seed);
    if (validData(stored) && !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
  catch { data = structuredClone(seed); }
  let selection = null, pending = null, pointer = null, transform = { x: 0, y: 0, scale: 1 }, toastTimer;

  function validData(value) { return value && Array.isArray(value.nodes) && Array.isArray(value.edges) && value.nodes.every(n => typeof n.id === 'string' && Number.isFinite(n.x) && Number.isFinite(n.y) && typeof n.title === 'string'); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 10); }
  function notify(message) { const el = $('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2500); }
  function node(id) { return data.nodes.find(n => n.id === id); }
  function screenToWorld(clientX, clientY) { const r = shell.getBoundingClientRect(); return { x: (clientX - r.left - transform.x) / transform.scale, y: (clientY - r.top - transform.y) / transform.scale }; }
  function setTransform() { world.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`; $('zoom-label').textContent = Math.round(transform.scale * 100) + '%'; }
  function centerWorld() { const r = shell.getBoundingClientRect(); return { x: (r.width / 2 - transform.x) / transform.scale, y: (r.height / 2 - transform.y) / transform.scale }; }
  function addNode(point) {
    const p = point || centerWorld();
    const n = { id: uid('n'), x: Math.max(0, p.x - 109), y: Math.max(0, p.y - 55), title: 'New idea', description: 'Add a description...', color: 'gold' };
    data.nodes.push(n); save(); render(); select('node', n.id); notify('Node added');
    const input = $('node-title-input'); if (input) { input.focus(); input.select(); }
  }
  function connect(from, to) {
    if (from === to) { notify('Choose a different node'); return; }
    if (data.edges.some(e => (e.from === from && e.to === to) || (e.from === to && e.to === from))) { notify('These nodes are already connected'); return; }
    data.edges.push({ id: uid('e'), from, to }); pending = null; save(); render(); notify('Connection created');
  }
  function select(type, id) { selection = id ? { type, id } : null; renderSelection(); renderInspector(); }
  function renderSelection() {
    document.querySelectorAll('.node').forEach(el => el.classList.toggle('selected', selection?.type === 'node' && selection.id === el.dataset.id));
    document.querySelectorAll('.edge').forEach(el => el.classList.toggle('selected', selection?.type === 'edge' && selection.id === el.dataset.id));
    document.querySelectorAll('.node-list button').forEach(el => el.classList.toggle('selected', selection?.type === 'node' && selection.id === el.dataset.id));
    document.querySelectorAll('.port').forEach(el => el.classList.toggle('active', pending === el.dataset.id));
    $('inspector').classList.toggle('open', !!selection);
  }
  function renderNodes() {
    nodesEl.replaceChildren();
    for (const n of data.nodes) {
      const c = colors[n.color] || colors.gold;
      const el = document.createElement('div'); el.className = 'node'; el.dataset.id = n.id; el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      const head = document.createElement('div'); head.className = 'node-head';
      const icon = document.createElement('div'); icon.className = 'node-icon'; icon.style.background = c.bg; icon.style.color = c.ink; icon.textContent = c.symbol;
      const category = document.createElement('div'); category.className = 'node-category'; category.style.color = c.ink; category.textContent = c.label;
      const menu = document.createElement('div'); menu.className = 'node-menu'; menu.textContent = '···';
      head.append(icon, category, menu);
      const body = document.createElement('div'); body.className = 'node-body';
      const title = document.createElement('div'); title.className = 'node-title'; title.textContent = n.title;
      const desc = document.createElement('div'); desc.className = 'node-description'; desc.textContent = n.description || 'No description';
      body.append(title, desc);
      for (const side of ['input', 'output']) { const port = document.createElement('div'); port.className = 'port ' + side; port.dataset.id = n.id; port.setAttribute('aria-label', 'Connect ' + n.title); port.title = 'Click to connect'; port.addEventListener('pointerdown', portDown); el.append(port); }
      el.append(head, body); el.addEventListener('pointerdown', nodeDown); nodesEl.append(el);
    }
  }
  function edgePath(a, b) {
    const ax = a.x + 218, ay = a.y + 56, bx = b.x, by = b.y + 56;
    const bend = Math.max(70, Math.abs(bx - ax) * .47);
    return `M ${ax} ${ay} C ${ax + bend} ${ay}, ${bx - bend} ${by}, ${bx} ${by}`;
  }
  function makeSvg(tag, attrs) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; }
  function renderEdges() {
    edgesEl.replaceChildren();
    for (const e of data.edges) {
      const a = node(e.from), b = node(e.to); if (!a || !b) continue;
      const d = edgePath(a, b);
      const hit = makeSvg('path', { d, class: 'edge-hit' }); hit.addEventListener('pointerdown', ev => { ev.stopPropagation(); select('edge', e.id); });
      const line = makeSvg('path', { d, class: 'edge' }); line.dataset.id = e.id;
      edgesEl.append(hit, line);
    }
    if (pending && pointer?.kind === 'connect') {
      const a = node(pending); if (a) {
        const p = screenToWorld(pointer.clientX, pointer.clientY);
        const d = `M ${a.x + 218} ${a.y + 56} C ${a.x + 288} ${a.y + 56}, ${p.x - 70} ${p.y}, ${p.x} ${p.y}`;
        edgesEl.append(makeSvg('path', { d, class: 'edge-preview' }));
      }
    }
  }
  function renderList() {
    $('node-count').textContent = `${data.nodes.length} node${data.nodes.length === 1 ? '' : 's'}`;
    $('edge-count').textContent = `${data.edges.length} connection${data.edges.length === 1 ? '' : 's'}`;
    $('empty-hint').hidden = data.nodes.length !== 0;
    const list = $('node-list'); list.replaceChildren();
    for (const n of data.nodes) {
      const btn = document.createElement('button'); btn.dataset.id = n.id;
      const dot = document.createElement('span'); dot.className = 'list-dot'; dot.style.background = (colors[n.color] || colors.gold).dot;
      const label = document.createElement('span'); label.textContent = n.title;
      btn.append(dot, label); btn.addEventListener('click', () => { select('node', n.id); const r = shell.getBoundingClientRect(); transform.x = r.width / 2 - (n.x + 109) * transform.scale; transform.y = r.height / 2 - (n.y + 56) * transform.scale; setTransform(); }); list.append(btn);
    }
  }
  function renderInspector() {
    const root = $('inspector-content'); root.replaceChildren();
    if (!selection) { root.innerHTML = '<div class="inspector-placeholder"><div class="illustration">⌗</div><h3>Nothing selected</h3><p>Choose a node or connection to see its details here.</p></div>'; return; }
    if (selection.type === 'edge') {
      const e = data.edges.find(x => x.id === selection.id); if (!e) { select(null); return; }
      root.innerHTML = '<div class="inspector-content"><div class="inspector-kicker">CONNECTION</div><h2 class="inspector-title">Linked ideas</h2><div class="details-row"><span>From</span><strong id="edge-from"></strong></div><div class="details-row"><span>To</span><strong id="edge-to"></strong></div><div class="inspector-line"></div><p class="connection-help">Connections show how one thought leads to another.</p><button class="danger-button" id="delete-selected">Delete connection</button></div>';
      $('edge-from').textContent = node(e.from)?.title || 'Unknown'; $('edge-to').textContent = node(e.to)?.title || 'Unknown'; $('delete-selected').onclick = deleteSelected; return;
    }
    const n = node(selection.id); if (!n) { select(null); return; }
    root.innerHTML = '<div class="inspector-content"><div class="inspector-kicker">NODE DETAILS</div><h2 class="inspector-title">Shape this idea</h2><div class="field"><label for="node-title-input">TITLE</label><input id="node-title-input" maxlength="80"></div><div class="field"><label for="node-description-input">DESCRIPTION</label><textarea id="node-description-input" maxlength="240"></textarea></div><div class="field"><label>COLOR</label><div class="swatches" id="swatches"></div></div><div class="inspector-line"></div><div class="details-row"><span>Connections</span><strong id="connections-count"></strong></div><div class="details-row"><span>Position</span><strong id="node-position"></strong></div><div class="inspector-line"></div><button class="danger-button" id="delete-selected">Delete node</button></div>';
    const title = $('node-title-input'), desc = $('node-description-input'); title.value = n.title; desc.value = n.description || '';
    title.addEventListener('input', () => { n.title = title.value; save(); updateNodeText(n); renderList(); renderSelection(); });
    desc.addEventListener('input', () => { n.description = desc.value; save(); updateNodeText(n); });
    for (const [key, c] of Object.entries(colors)) { const b = document.createElement('button'); b.className = 'swatch' + (n.color === key ? ' selected' : ''); b.style.background = c.dot; b.title = key; b.setAttribute('aria-label', key + ' color'); b.onclick = () => { n.color = key; save(); renderNodes(); renderList(); renderInspector(); renderSelection(); }; $('swatches').append(b); }
    $('connections-count').textContent = data.edges.filter(e => e.from === n.id || e.to === n.id).length;
    $('node-position').textContent = `${Math.round(n.x)}, ${Math.round(n.y)}`;
    $('delete-selected').onclick = deleteSelected;
  }
  function updateNodeText(n) { const el = [...nodesEl.children].find(x => x.dataset.id === n.id); if (el) { el.querySelector('.node-title').textContent = n.title || 'Untitled'; el.querySelector('.node-description').textContent = n.description || 'No description'; } }
  function render() { renderNodes(); renderEdges(); renderList(); renderSelection(); renderInspector(); }
  function deleteSelected() {
    if (!selection) return;
    if (selection.type === 'node') { data.nodes = data.nodes.filter(n => n.id !== selection.id); data.edges = data.edges.filter(e => e.from !== selection.id && e.to !== selection.id); }
    else data.edges = data.edges.filter(e => e.id !== selection.id);
    selection = null; pending = null; save(); render(); notify('Deleted');
  }
  function portDown(ev) {
    ev.stopPropagation(); ev.preventDefault();
    const id = ev.currentTarget.dataset.id;
    if (pending && pending !== id) { connect(pending, id); return; }
    pending = pending === id ? null : id;
    if (pending) { pointer = { kind: 'connect', clientX: ev.clientX, clientY: ev.clientY }; notify('Click a dot on another node'); }
    else pointer = null;
    renderSelection(); renderEdges();
  }
  function nodeDown(ev) {
    if (ev.button !== 0 || ev.target.classList.contains('port')) return;
    ev.stopPropagation();
    const id = ev.currentTarget.dataset.id, n = node(id); if (!n) return;
    select('node', id);
    pointer = { kind: 'node', id, startX: ev.clientX, startY: ev.clientY, x: n.x, y: n.y, moved: false };
    ev.currentTarget.setPointerCapture(ev.pointerId); ev.currentTarget.classList.add('dragging');
  }
  shell.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 && ev.button !== 1) return;
    if (ev.target.closest('.node') || ev.target.closest('.zoom-controls')) return;
    if (pending) { pending = null; pointer = null; renderSelection(); renderEdges(); }
    else select(null);
    pointer = { kind: 'pan', startX: ev.clientX, startY: ev.clientY, x: transform.x, y: transform.y };
    shell.setPointerCapture(ev.pointerId); shell.classList.add('panning');
  });
  window.addEventListener('pointermove', ev => {
    if (!pointer) return;
    if (pointer.kind === 'node') {
      const n = node(pointer.id); if (!n) return;
      const dx = (ev.clientX - pointer.startX) / transform.scale, dy = (ev.clientY - pointer.startY) / transform.scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) pointer.moved = true;
      n.x = Math.max(0, pointer.x + dx); n.y = Math.max(0, pointer.y + dy);
      const el = [...nodesEl.children].find(x => x.dataset.id === n.id); if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
      renderEdges(); if ($('node-position')) $('node-position').textContent = `${Math.round(n.x)}, ${Math.round(n.y)}`;
    } else if (pointer.kind === 'pan') { transform.x = pointer.x + ev.clientX - pointer.startX; transform.y = pointer.y + ev.clientY - pointer.startY; setTransform(); }
    else if (pointer.kind === 'connect') { pointer.clientX = ev.clientX; pointer.clientY = ev.clientY; renderEdges(); }
  });
  window.addEventListener('pointerup', ev => {
    if (!pointer) return;
    if (pointer.kind === 'node' && pointer.moved) save();
    if (pointer.kind === 'connect') { const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.port'); if (target && target.dataset.id !== pending) connect(pending, target.dataset.id); }
    document.querySelectorAll('.node.dragging').forEach(el => el.classList.remove('dragging'));
    shell.classList.remove('panning');
    if (pointer.kind !== 'connect') pointer = null;
    else { pointer = null; renderEdges(); }
  });
  shell.addEventListener('dblclick', ev => { if (ev.target.closest('.node') || ev.target.closest('.zoom-controls')) return; addNode(screenToWorld(ev.clientX, ev.clientY)); });
  shell.addEventListener('wheel', ev => {
    ev.preventDefault(); const r = shell.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const next = Math.min(2, Math.max(.4, transform.scale * (ev.deltaY < 0 ? 1.1 : .9)));
    transform.x = mx - (mx - transform.x) * next / transform.scale;
    transform.y = my - (my - transform.y) * next / transform.scale;
    transform.scale = next; setTransform();
  }, { passive: false });
  function zoom(factor) { const r = shell.getBoundingClientRect(), mx = r.width / 2, my = r.height / 2; const next = Math.min(2, Math.max(.4, transform.scale * factor)); transform.x = mx - (mx - transform.x) * next / transform.scale; transform.y = my - (my - transform.y) * next / transform.scale; transform.scale = next; setTransform(); }
  function fitView() {
    if (!data.nodes.length) { transform = { x: 0, y: 0, scale: 1 }; setTransform(); return; }
    const r = shell.getBoundingClientRect(), minX = Math.min(...data.nodes.map(n => n.x)), minY = Math.min(...data.nodes.map(n => n.y)), maxX = Math.max(...data.nodes.map(n => n.x + 218)), maxY = Math.max(...data.nodes.map(n => n.y + 113));
    const s = Math.min(1.2, Math.max(.4, Math.min((r.width - 110) / (maxX - minX), (r.height - 140) / (maxY - minY))));
    transform = { scale: s, x: (r.width - (maxX + minX) * s) / 2, y: (r.height - (maxY + minY) * s) / 2 }; setTransform();
  }
  $('add-node-side').onclick = () => addNode(); $('add-node-main').onclick = () => addNode(); $('empty-add').onclick = () => addNode();
  $('connect-side').onclick = () => { if (selection?.type === 'node') { pending = selection.id; renderSelection(); notify('Click a dot on another node'); } else notify('Select a node, then click its dot'); };
  $('fit-btn').onclick = fitView; $('zoom-in').onclick = () => zoom(1.2); $('zoom-out').onclick = () => zoom(1 / 1.2); $('zoom-reset').onclick = () => { transform.scale = 1; fitView(); };
  $('close-inspector').onclick = () => select(null);
  $('export-btn').onclick = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lics-trove-canvas.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); notify('Canvas exported'); };
  $('import-btn').onclick = () => $('import-file').click();
  $('import-file').onchange = async ev => { const file = ev.target.files[0]; if (!file) return; try { const incoming = JSON.parse(await file.text()); if (!validData(incoming)) throw Error(); const ids = new Set(incoming.nodes.map(n => n.id)); incoming.edges = incoming.edges.filter(e => ids.has(e.from) && ids.has(e.to)); data = incoming; selection = null; pending = null; save(); render(); fitView(); notify('Canvas imported'); } catch { notify('Could not import this canvas'); } ev.target.value = ''; };
  document.addEventListener('keydown', ev => { if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return; if (ev.key.toLowerCase() === 'n') { ev.preventDefault(); addNode(); } if (ev.key.toLowerCase() === 'c') { ev.preventDefault(); $('connect-side').click(); } if (ev.key === 'Escape') { pending = null; select(null); renderEdges(); } if (ev.key === 'Delete' || ev.key === 'Backspace') { if (selection) { ev.preventDefault(); deleteSelected(); } } });
  render(); requestAnimationFrame(fitView);
})();
