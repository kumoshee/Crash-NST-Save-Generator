'use strict';
const $ = id => document.getElementById(id), P = NSTProgress, UI = NSTGeneratorUI;
let language = document.documentElement.lang === 'ja' ? 'ja' : 'en';
const t = (key, values) => UI.text(language, key, values);
const displayName = name => UI.displayName(language, name);
const stageName = s => UI.stageName(typeof s === 'string' ? s : s.id, NST_LEVEL_NAMES);
let save, initialSave, initialValues, filename, changes = {}, selected = new Set(), focused;
let currentTab = 'basic', generated = false;
let calculationResult;
let akuFocused, indexedSave, fieldIndex, akuIndex;
let akuVisibleStages = [], akuStageRows = new Map();
let rowSelection = new NSTStageSelection.StageSelection();
const summaryNames = ['percent_complete', 'life_count', 'key_count', 'gem_count', 'platinum_count', 'gold_count', 'sapphire_count', 'crystal_count', 'story_completed'];
const message = (text, error = false) => { const node = $('message'); if (node) { node.textContent = text; node.classList.toggle('error', error); } };
function indexes() {
  if (indexedSave === save) return;
  indexedSave = save; fieldIndex = new Map(save.fields.map(f => [f.path, f])); akuIndex = undefined;
}
const value = path => { indexes(); return Object.hasOwn(changes, path) ? changes[path] : fieldIndex.get(path)?.value; };
function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
function option(v, label) { const node = el('option', label); node.value = v; return node; }
function identifyControl(control, key, label) {
  const id = `control-${encodeURIComponent(key)}`;
  control.setAttribute('id', id); control.setAttribute('name', key);
  if (label) label.setAttribute('for', id);
  return control;
}
function hiddenLabel(control, text) { const label = el('label', text, 'sr-only'); label.setAttribute('for', control.getAttribute('id')); return label; }
function prepareStaticControls() {
  const labelled = new Set(Array.from(document.querySelectorAll('label'), label => label.getAttribute('for')));
  for (const control of [...document.querySelectorAll('input'), ...document.querySelectorAll('select')]) {
    const id = control.getAttribute('id');
    if (!id) continue;
    control.setAttribute('name', id);
    if (!labelled.has(id)) {
      const label = hiddenLabel(control, control.getAttribute('aria-label') || id);
      if (control.dataset.i18nAria) label.dataset.i18n = control.dataset.i18nAria;
      document.body.append(label);
    }
  }
}
function stats() {
  const cards = ['percent_complete', 'life_count', 'gem_count', 'crystal_count'].map(name => { const box = el('div', undefined, 'metric'); box.append(el('strong', value(`summary.${name}`) + (name === 'percent_complete' ? '%' : '')), el('span', displayName(name))); return box; });
  const relics = el('div', undefined, 'metric'), details = el('div', undefined, 'metric-details');
  const tiers = ['platinum', 'gold', 'sapphire'];
  relics.append(el('strong', tiers.reduce((sum, tier) => sum + value(`summary.${tier}_count`), 0)), el('span', t('totalRelics')));
  for (const tier of tiers) details.append(el('span', `${displayName(tier)}: ${value(`summary.${tier}_count`)}`));
  relics.append(details); cards.push(relics); $('metrics').replaceChildren(...cards);
  const count = save.fields.filter(f => !initialValues.has(f.path) || !Object.is(value(f.path), initialValues.get(f.path))).length;
  $('changes-count').textContent = t('changes', { count });
}
function commit(next, rerender = false) {
  try {
    for (const path of ['summary.farthest_progression_index', 'summary.previous_level_progression_index']) {
      if (Object.hasOwn(next, path) && !P.isValidProgressionIndex(save, next[path], path)) throw new Error(t('progressionRange', P.progressionRange(save, path)));
    }
    indexes(); save.encode(next);
    for (const [path, v] of Object.entries(next)) {
      if (Object.is(v, fieldIndex.get(path).value)) delete changes[path]; else changes[path] = v;
    }
    stats(); if (rerender) render(); message(t('recorded')); return true;
  } catch (error) { message(error.message, true); return false; }
}
function field(path, parent, displayLabel) {
  const f = save.fields.find(f => f.path === path); if (!f) return;
  const labelText = displayLabel || displayName(f.label), row = el('div', undefined, 'field'), label = el('label', labelText), input = identifyControl(el('input'), path, label);
  input.dataset.field = path;
  input.setAttribute('aria-label', labelText); input.type = f.kind === 'bool' ? 'checkbox' : 'number';
  if (f.kind === 'bool') input.checked = value(path);
  else {
    input.value = value(path);
    const limits = { ...NSTSave.NUMERIC_LIMITS[f.kind], ...(f.kind === 'float' ? UI.FLOAT_INPUT_LIMITS : {}) };
    if (displayLabel === t('clearCount')) limits.min = 0;
    for (const [name, bound] of Object.entries(limits)) input.setAttribute(name, String(bound));
  }
  const update = () => {
    if (input.type === 'number' && input.value.trim() === '') return false;
    const next = input.type === 'checkbox' ? input.checked : Number(input.value);
    try {
      if (input.type === 'number' && (!Number.isFinite(next) || next < Number(input.getAttribute('min')) || next > Number(input.getAttribute('max')))) throw new Error(t('numberRange', { min: input.getAttribute('min'), max: input.getAttribute('max') }));
      if (displayLabel === t('clearCount')) return commit(P.stageChanges(P.stagesFor(save).find(s => P.zonePath(s, 3) === path), { count: next }, save, changes));
      return commit({ [path]: next });
    } catch (error) { message(error.message, true); return false; }
  };
  input.addEventListener('input', update); input.addEventListener('change', () => { if (!update() && input.type === 'number') input.value = value(path); }); row.append(label, input); parent.append(row);
}
function renderFilename() { $('filename').textContent = `${filename} / Crash ${save.game}${generated ? ' / ' + t('newLabel') : ''}`; }
function load(next, name, isNew = false) {
  save = initialSave = next; filename = name; generated = isNew; changes = {}; selected = new Set(); focused = P.stagesFor(save)[0]?.id; currentTab = 'basic';
  akuFocused = focused;
  rowSelection = new NSTStageSelection.StageSelection(P.stagesFor(save).map(s => s.id)); if (focused) rowSelection.choose(focused);
  $('bulk-flags').replaceChildren(); $('bulk-clear').value = $('bulk-relic').value = 'keep';
  initialValues = new Map(next.fields.map(f => [f.path, f.value]));
  $('bonus-gem').checked = !!value('tables.bool.LastGemRewarded'); $('workspace').classList.remove('hidden');
  renderFilename();
  $('reset').classList.toggle('hidden', generated); $('backup').classList.toggle('hidden', generated);
  $('game').value = save.game; $('stage-search').value = $('death-search').value = ''; clearCalculationNote();
  render(); message(t(isNew ? 'blankMessage' : 'readMessage'));
}
function renderBasic() {
  const ss = P.stagesFor(save), current = value('summary.previous_level_name'), currentStage = ss.find(s => s.zone === current || s.id === P.idOf(current));
  const farthestStages = P.farthestStagesFor(save), currentFarthest = farthestStages.find(s => s.index === value('summary.farthest_progression_index'));
  $('farthest').replaceChildren(...farthestStages.map(s => option(s.index, stageName(s))));
  if (!currentFarthest) {
    const placeholder = option('', t('previousNone')); placeholder.disabled = true; placeholder.hidden = true; $('farthest').prepend(placeholder);
  }
  $('farthest').value = currentFarthest ? String(currentFarthest.index) : '';
  $('previous').replaceChildren(...ss.map(s => option(s.zone, stageName(s))));
  if (!currentStage) {
    const placeholder = option('', t('previousNone')); placeholder.disabled = true; placeholder.hidden = true; $('previous').prepend(placeholder);
  }
  // Viewing a save with a hub or movie as its previous level does not rewrite it.
  $('previous').value = currentStage?.zone || '';
  $('summary-fields').replaceChildren(); summaryNames.forEach(name => field(`summary.${name}`, $('summary-fields')));
  for (const [id, names] of [['gem-fields', P.GEM_ORDER], ['secret-fields', P.SECRET_ORDER], ['upgrade-fields', P.UPGRADE_ORDER]]) { $(id).replaceChildren(); names.forEach(name => field(`variables.${name}`, $(id))); }
  $('bonus-wrap').classList.toggle('hidden', save.game !== 3); $('bonus-gem').checked = !!value('tables.bool.LastGemRewarded');
}
function recordField(field, parent, displayLabel = UI.eventName(field.label, language)) {
  const row = el('div', undefined, 'field'), label = el('label', displayLabel), input = identifyControl(el('input'), field.path, label);
  input.type = 'checkbox'; input.checked = value(field.path) ?? false; input.setAttribute('aria-label', displayLabel); input.dataset.record = field.label;
  input.addEventListener('change', () => { try { addRecords(); const actual = P.recordFields(save, NST_GAME_RECORDS[save.game].find(e => e.name.toLowerCase() === field.label.toLowerCase())?.category).find(f => f.label.toLowerCase() === field.label.toLowerCase()); commit(P.deathChanges(actual, input.checked)); } catch (error) { message(error.message, true); } });
  row.append(label, input); parent.append(row);
}
function renderGameVariables() {
  const target = $('game-variable-fields'); target.replaceChildren();
  for (const name of ['C1_StormyAscentRevealed', 'C2_BossCortexDefeated', 'CocoUnlockedC1', 'CocoUnlockedC2', 'CocoUnlockedC3']) field(`variables.${name}`, target, displayName(name));
}
function renderEvents() {
  for (const [id, category] of [['cutscenes', 'cutscene'], ['hint-fields', 'hint'], ['event-fields', 'event']]) {
    const target = $(id); target.replaceChildren(); const fields = P.recordFields(save, category).filter(f => f.label !== 'LastGemRewarded');
    if (category === 'event') fields.sort((a, b) => UI.eventOrder(save.game, a.label) - UI.eventOrder(save.game, b.label));
    if (!fields.length && category === 'cutscene') target.append(el('p', t('noCuts')));
    for (const f of fields) recordField(f, target, category === 'cutscene' ? UI.cutsceneName(f.label) : undefined);
  }
  const cuts = P.cutsceneFields(save); $('cuts-on').disabled = $('cuts-off').disabled = !cuts.length;
  const hints = P.recordFields(save, 'hint'); $('hints-on').disabled = $('hints-off').disabled = !hints.length;
}
function setRecordFlags(category, on) {
  try { addRecords(); if (commit(Object.assign({}, ...P.recordFields(save, category).map(f => P.deathChanges(f, on))))) renderEvents(); } catch (error) { message(error.message, true); }
}
function setLastGem(on) {
  try { addRecords(); if (!commit({ 'tables.bool.LastGemRewarded': on })) $('bonus-gem').checked = !!value('tables.bool.LastGemRewarded'); } catch (error) { $('bonus-gem').checked = !!value('tables.bool.LastGemRewarded'); message(error.message, true); }
}

function renderList(restoreFocus = false) {
  const query = $('stage-search').value.toLowerCase(), ss = P.stagesFor(save).filter(s => (stageName(s) + ' ' + s.zone).toLowerCase().includes(query));
  rowSelection.setItems(ss.map(s => s.id)); $('stage-list').replaceChildren();
  for (const s of ss) {
    const row = el('div', undefined, 'stage-choice' + (rowSelection.selected.has(s.id) ? ' highlighted' : '') + (s.id === focused ? ' focused' : '')), box = el('input'), name = el('button', undefined, 'stage-name');
    row.dataset.stage = s.id; box.type = 'checkbox'; box.checked = selected.has(s.id); box.setAttribute('aria-label', t('selectStage', { id: s.id.toUpperCase() }));
    identifyControl(box, `stage-selection.${s.id}`);
    box.addEventListener('change', () => {
      const targets = rowSelection.targets(s.id); if (targets.length === 1) rowSelection.choose(s.id);
      for (const id of targets) if (box.checked) selected.add(id); else selected.delete(id);
      focused = rowSelection.focused = s.id; renderList(true); renderDetail();
    });
    name.type = 'button'; name.setAttribute('aria-label', stageName(s)); name.setAttribute('aria-current', s.id === focused ? 'true' : 'false');
    name.setAttribute('aria-pressed', String(rowSelection.selected.has(s.id))); name.tabIndex = s.id === rowSelection.focused ? 0 : -1;
    name.append(el('span', stageName(s), 'stage-title'), el('span', t(value(P.zonePath(s, 2)) === 1 ? 'clear' : 'uncleared'), 'stage-status'), el('span', UI.itemStatus(value(P.zonePath(s, 13)) & s.allowed, P.BITS, value(P.zonePath(s, 11))), 'stage-items'));
    row.addEventListener('click', event => {
      if (event.target === box) return;
      rowSelection.choose(s.id, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey });
      focused = s.id; renderList(true); renderDetail();
    });
    row.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); rowSelection.focused = s.id; rowSelection.move(event.key === 'ArrowUp' ? -1 : 1, event.shiftKey);
      focused = rowSelection.focused; renderList(true); renderDetail();
    });
    row.append(hiddenLabel(box, t('selectStage', { id: s.id.toUpperCase() })), box, name); $('stage-list').append(row);
  }
  renderBulk();
  if (restoreFocus) { const name = $('stage-list').querySelector(`[data-stage="${rowSelection.focused}"] .stage-name`); name?.focus({ preventScroll: true }); name?.scrollIntoView({ block: 'nearest' }); }
}
function renderBulk() {
  const ss = P.stagesFor(save).filter(s => selected.has(s.id)); $('selected-count').textContent = t('selectedCount', { count: ss.length });
  $('apply-bulk').disabled = $('all-items').disabled = !ss.length;
  const previous = new Map([...$('bulk-flags').querySelectorAll('select')].map(n => [n.dataset.flag, n.value]));
  const allowed = ss.length ? ss.reduce((mask, s) => mask & s.allowed, 0xffffffff) : 0; $('bulk-flags').replaceChildren();
  for (const [name, bit] of UI.itemEntries(P.BITS)) if (!(bit & P.RELICS) && allowed & bit) {
    const row = el('div', undefined, 'field'), label = el('label', displayName(name)), select = identifyControl(el('select'), `bulk.flags.${name}`, label); select.dataset.flag = name; select.setAttribute('aria-label', t('batchFlag', { name: displayName(name) }));
    select.append(option('keep', t('keep')), option('yes', t('collected')), option('no', t('uncollected'))); row.append(label, select); $('bulk-flags').append(row);
    select.value = previous.get(name) || 'keep';
  }
  if (!allowed && ss.length) $('bulk-flags').append(el('p', t('noShared')));
}
function applyBulk(allItems = false) {
  try {
    const edit = {}, flags = {}; if ($('bulk-clear').value !== 'keep') edit.clear = $('bulk-clear').value === 'yes';
    if ($('bulk-relic').value !== 'keep') edit.relic = Number($('bulk-relic').value);
    for (const input of $('bulk-flags').querySelectorAll('select')) if (input.value !== 'keep') flags[input.dataset.flag] = input.value === 'yes';
    const result = {};
    for (const s of P.stagesFor(save).filter(s => selected.has(s.id))) {
      const own = { ...edit, flags: allItems ? Object.fromEntries(Object.entries(P.BITS).filter(([, bit]) => !(bit & P.RELICS) && (s.allowed & bit)).map(([name]) => [name, true])) : flags };
      if (!s.relic) delete own.relic; Object.assign(result, P.stageChanges(s, own, save, { ...changes, ...result }));
    }
    commit(result, true);
  } catch (error) { message(error.message, true); }
}
function switchControl(on, aria, action) {
  const button = el('button', undefined, 'toggle-switch'); button.type = 'button'; button.setAttribute('role', 'switch'); button.setAttribute('aria-checked', String(on)); button.setAttribute('aria-label', aria); button.addEventListener('click', action); return button;
}
function controlRow(label, control) {
  const row = el('div', undefined, 'field'); row.append(el('span', label), control); return row;
}
function renderDetail() {
  const target = $('stage-detail'); target.replaceChildren(); const s = P.stagesFor(save).find(s => s.id === focused); if (!s) return;
  target.append(el('h3', stageName(s))); const controls = el('div', undefined, 'stage-settings'), isClear = value(P.zonePath(s, 2)) === 1;
  controls.append(controlRow(t('clear'), switchControl(isClear, t('stageClear', { id: s.id.toUpperCase() }), () => commit(P.stageChanges(s, { clear: !isClear }, save, changes), true))));
  field(P.zonePath(s, 3), controls, t('clearCount'));
  for (const [name, bit] of UI.itemEntries(P.BITS)) if (!(bit & P.RELICS) && (s.allowed & bit)) {
    const on = !!(value(P.zonePath(s, 13)) & bit), label = displayName(name);
    controls.append(controlRow(label, switchControl(on, `${s.id.toUpperCase()} ${label}`, () => commit(P.stageChanges(s, { flags: { [name]: !on } }, save, changes), true))));
  }
  if (!s.allowed) controls.append(el('p', t('noItems'))); target.append(controls);
  if (s.relic) {
    const row = el('div', undefined, 'field'), label = el('label', t('relic')), select = identifyControl(el('select'), P.zonePath(s, 11), label); select.setAttribute('aria-label', `${s.id.toUpperCase()} ${t('relic')}`);
    select.append(option('0', t('none')), ...[['platinum', 3], ['gold', 2], ['sapphire', 1]].map(([name, tier]) => option(String(tier), displayName(name)))); select.value = value(P.zonePath(s, 11));
    select.addEventListener('change', () => commit(P.stageChanges(s, { relic: Number(select.value) }, save, changes), true)); row.append(label, select); controls.append(row); target.append(el('h3', t('trials')));
    for (let i = 0; i < 3; i++) {
      const row = el('div', undefined, 'trial'), time = el('input'), name = el('input'); time.type = name.type = 'text'; time.value = NSTSave.formatTime(value(P.zonePath(s, 5 + i))); time.placeholder = 'm:ss:cc'; time.setAttribute('aria-label', t('trialTime', { id: s.id.toUpperCase(), count: i + 1 }));
      identifyControl(time, P.zonePath(s, 5 + i)); identifyControl(name, P.zonePath(s, 8 + i));
      time.setAttribute('minlength', '7'); time.setAttribute('maxlength', '12'); time.setAttribute('pattern', '[0-9]{1,6}:[0-5][0-9]:[0-9]{2}');
      name.value = value(P.zonePath(s, 8 + i)); name.maxLength = 3; name.placeholder = 'ABC'; name.spellcheck = false; name.setAttribute('aria-label', t('trialName', { id: s.id.toUpperCase(), count: i + 1 }));
      name.setAttribute('minlength', '3'); name.setAttribute('maxlength', '3'); name.setAttribute('pattern', '[A-Za-z]{3}|---');
      time.addEventListener('input', () => { try { commit({ [P.zonePath(s, 5 + i)]: NSTSave.parseTime(time.value) }); } catch { } });
      time.addEventListener('change', () => { try { if (!commit({ [P.zonePath(s, 5 + i)]: NSTSave.parseTime(time.value) })) time.value = NSTSave.formatTime(value(P.zonePath(s, 5 + i))); } catch (error) { time.value = NSTSave.formatTime(value(P.zonePath(s, 5 + i))); message(error.message, true); } });
      name.addEventListener('input', () => { if (/^[A-Za-z]{3}$|^---$/.test(name.value)) commit({ [P.zonePath(s, 8 + i)]: name.value }); });
      name.addEventListener('change', () => { if (!commit({ [P.zonePath(s, 8 + i)]: name.value })) name.value = value(P.zonePath(s, 8 + i)); }); row.append(el('span', String(i + 1)), hiddenLabel(time, time.getAttribute('aria-label')), time, hiddenLabel(name, name.getAttribute('aria-label')), name); target.append(row);
    }
  }
  if (value(P.zonePath(s, 13)) & ~s.allowed) target.append(el('p', t('importedFlags')));
}
function allDeathFields() { return P.deathFields(save); }
function addRecords() {
  const paths = new Set(save.fields.map(f => f.path));
  if (NST_GAME_RECORDS[save.game].every(e => paths.has(`tables.${e.kind}.${e.name}`))) return;
  const current = new NSTSave.Save(save.encode(changes)), values = new Map([...P.deathFields(current), ...P.cutsceneFields(current)].map(f => [f.label.toLowerCase(), f.value]));
  const entries = NST_GAME_RECORDS[save.game].map(e => ({ ...e, value: values.get(e.name.toLowerCase()) ?? e.value }));
  save = current.withTableEntries(entries); changes = {};
}
function akuRecords() {
  indexes(); if (akuIndex) return akuIndex;
  const stages = P.stagesFor(save), byStage = new Map(stages.map(s => [s.id, { world: undefined, checkpoints: [], search: stageName(s) + ' ' + s.zone }]));
  const fields = allDeathFields(), byLabel = new Map();
  for (const f of fields) {
    byLabel.set(f.label.toLowerCase(), f);
    const group = byStage.get(P.idOf(f.label)); if (!group) continue;
    if (/^the world entity \(/i.test(f.label)) group.world = f; else group.checkpoints.push(f);
    group.search += ' ' + f.label;
  }
  for (const group of byStage.values()) {
    group.search = group.search.toLowerCase();
    const names = new Map(); for (const f of group.checkpoints) { const name = UI.checkpointName(f.label); names.set(name, (names.get(name) || 0) + 1); }
    group.labels = new Map(group.checkpoints.map(f => [f.label, UI.checkpointName(f.label, names.get(UI.checkpointName(f.label)) > 1)]));
  }
  akuIndex = { stages, byStage, byLabel }; return akuIndex;
}
function setAku(field, tier, options) {
  try {
    addRecords(); const actual = akuRecords().byLabel.get(field.label.toLowerCase());
    if (!actual) throw new Error(t('missingRecord'));
    if (commit(P.deathChanges(actual, UI.akuValue(tier)))) updateAkuOptions(options, actual);
  } catch (error) { message(error.message, true); }
}
function updateAkuOptions(options, field) {
  const chosen = UI.akuTier(value(field.path) ?? 0);
  for (const button of options.children) button.setAttribute('aria-pressed', String(Number(button.dataset.tier) === chosen));
}
function akuOptions(field, label, stage) {
  const options = el('div', undefined, 'aku-options'), id = stage.id.toUpperCase();
  options.setAttribute('role', 'group'); options.setAttribute('aria-label', `${id} ${label}`);
  for (let tier = 0; tier <= 2; tier++) {
    const button = el('button', UI.masks(language, tier)); button.type = 'button'; button.dataset.tier = String(tier);
    button.setAttribute('aria-label', t('akuChoice', { name: `${id} ${label}`, masks: UI.masks(language, tier) }));
    button.addEventListener('click', () => setAku(field, tier, options)); options.append(button);
  }
  updateAkuOptions(options, field); return options;
}
function selectAkuStage(id, restoreFocus = false) {
  if (akuFocused !== id || !$('death-fields').firstChild) { akuFocused = id; renderAkuDetail(); }
  for (const [stageId, row] of akuStageRows) {
    const chosen = stageId === id; row.classList.toggle('focused', chosen);
    const button = row.querySelector('.aku-stage-name'); button.setAttribute('aria-current', String(chosen)); button.tabIndex = chosen ? 0 : -1;
  }
  if (restoreFocus) { const button = akuStageRows.get(id)?.querySelector('.aku-stage-name'); button?.focus({ preventScroll: true }); button?.scrollIntoView({ block: 'nearest' }); }
}
function renderAkuDetail() {
  const target = $('death-fields'); target.replaceChildren(); const records = akuRecords(), s = records.stages.find(stage => stage.id === akuFocused);
  if (!s) return;
  const group = records.byStage.get(s.id), article = el('article', undefined, 'aku-stage'); article.dataset.stage = s.id;
  article.append(el('h3', stageName(s)), el('p', t('checkpoints', { count: group.checkpoints.length }), 'aku-checkpoint-heading'));
  if (!group.checkpoints.length) article.append(el('p', t('noCheckpoints')));
  for (const f of group.checkpoints) {
    const row = el('div', undefined, 'death-row'); row.dataset.kind = 'checkpoint'; row.dataset.record = f.label; row.title = f.label;
    const label = group.labels.get(f.label); row.append(el('span', label), akuOptions(f, label, s)); article.append(row);
  }
  target.append(article);
}
function renderDeaths() {
  $('aku-stage-list').replaceChildren(); akuStageRows = new Map();
  const query = $('death-search').value.toLowerCase(), records = akuRecords();
  akuVisibleStages = records.stages.filter(s => records.byStage.get(s.id).search.includes(query));
  if (!akuVisibleStages.some(s => s.id === akuFocused)) akuFocused = akuVisibleStages[0]?.id;
  for (const s of akuVisibleStages) {
    const row = el('div', undefined, 'aku-stage-choice'), button = el('button', stageName(s), 'aku-stage-name'), world = records.byStage.get(s.id).world;
    row.dataset.stage = s.id; button.type = 'button'; button.setAttribute('aria-label', stageName(s));
    row.addEventListener('click', event => {
      if (event.target.closest('.aku-options button')) return;
      selectAkuStage(s.id, true);
    });
    button.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const index = akuVisibleStages.findIndex(stage => stage.id === s.id), delta = event.key === 'ArrowUp' ? -1 : 1;
      selectAkuStage(akuVisibleStages[Math.max(0, Math.min(akuVisibleStages.length - 1, index + delta))].id, true);
    });
    row.append(button); if (world) row.append(akuOptions(world, t('spawn'), s));
    akuStageRows.set(s.id, row); $('aku-stage-list').append(row);
  }
  if (!akuVisibleStages.length) $('aku-stage-list').append(el('p', t('noAkuMatches')));
  renderAkuDetail(); selectAkuStage(akuFocused);
}
function render() { renderBasic(); renderList(); renderDetail(); renderDeaths(); renderGameVariables(); renderEvents(); stats(); showTab(currentTab); }
function showTab(name) { currentTab = name; for (const id of ['basic', 'stages', 'aku', 'events']) $(id).classList.toggle('hidden', id !== name); document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name))); }
function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes])), a = el('a');
  a.href = url; a.download = name; document.body.append(a);
  try { a.click(); }
  finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
}
function clearCalculationNote() { calculationResult = undefined; $('calculation-note').textContent = ''; $('calculation-note').classList.add('hidden'); }
function renderCalculationNote() {
  if (!calculationResult) return;
  $('calculation-note').textContent = t('calculation', calculationResult) + (save.game === 2 ? t('secretResult', calculationResult) : '') + (save.game !== 3 ? t('relicResult', calculationResult) : '') + t('calculationDone');
  $('calculation-note').classList.remove('hidden');
}
function changeLanguage(next) {
  if (!['en', 'ja'].includes(next)) { $('language').value = language; return; }
  const scrollPositions = new Map(['stage-list', 'aku-stage-list'].map(id => [id, $(id).scrollTop || 0]));
  language = next; document.documentElement.setAttribute('lang', language); $('language').value = language;
  UI.applyTranslations(document, language);
  if (save) {
    renderFilename(); render(); renderCalculationNote();
    for (const [id, top] of scrollPositions) $(id).scrollTop = top;
  }
}
UI.applyTranslations(document, language);
prepareStaticControls();
$('language').value = language;
$('language').addEventListener('change', () => changeLanguage($('language').value));
function confirmAction(id, answer) {
  return new Promise(resolve => {
    const dialog = $(id); dialog.returnValue = 'cancel';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === answer), { once: true });
    dialog.showModal();
  });
}
$('generate').addEventListener('click', async () => { try { if (generated && save && save.fields.some(f => !initialValues.has(f.path) || !Object.is(value(f.path), initialValues.get(f.path))) && !await confirmAction('discard-dialog', 'generate')) return; const game = Number($('game').value); load(NSTSaveFactory.create(game), `SAVE_${(game - 1) * 4}.sav`, true); } catch (error) { message(error.message, true); } });
$('file').addEventListener('change', async e => { try { if (!e.target.files[0]) return; const file = e.target.files[0], next = new NSTSave.Save(new Uint8Array(await file.arrayBuffer())); if (!next.game) throw new Error(t('unknownGame')); load(next, file.name); } catch (error) { message(error.message, true); } finally { e.target.value = ''; } });
$('save').addEventListener('click', () => {
  if ($('save').disabled) return;
  $('save').disabled = true;
  try {
    download(save.encode(changes), filename.replace(/\.sav$/i, '') + (generated ? '_generated.sav' : '_edited.sav'));
    message(t('downloadMessage'));
  } catch (error) {
    message(error.message, true); if (!$('message') && typeof globalThis.alert === 'function') globalThis.alert(error.message);
  }
  finally { $('save').disabled = false; }
});
$('backup').addEventListener('click', () => download(initialSave.bytes, filename.replace(/\.sav$/i, '') + '_original.sav'));
$('reset').addEventListener('click', () => { save = initialSave; changes = {}; $('bonus-gem').checked = !!value('tables.bool.LastGemRewarded'); clearCalculationNote(); render(); message(t('resetMessage')); });
$('calculate').addEventListener('click', () => { try { addRecords(); const result = P.calculate(save, changes); if (commit(result.changes, true)) { calculationResult = result; renderCalculationNote(); } } catch (error) { message(error.message, true); } });
$('previous').addEventListener('change', () => commit(P.previousChanges(save, $('previous').value), true));
$('farthest').addEventListener('change', () => { if (!commit({ 'summary.farthest_progression_index': Number($('farthest').value) }, true)) renderBasic(); });
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('stage-search').addEventListener('input', () => renderList()); $('death-search').addEventListener('input', () => renderDeaths());
$('select-all').addEventListener('click', () => { selected = new Set(P.stagesFor(save).map(s => s.id)); rowSelection.selected = new Set(rowSelection.items); renderList(); }); $('select-none').addEventListener('click', () => { selected.clear(); rowSelection.selected.clear(); renderList(); });
$('apply-bulk').addEventListener('click', () => applyBulk()); $('all-items').addEventListener('click', () => applyBulk(true));
$('aku-reset').addEventListener('click', async () => { try { if (!await confirmAction('aku-reset-dialog', 'reset')) return; addRecords(); if (commit(Object.assign({}, ...P.deathFields(save).map(f => P.deathChanges(f, 0))))) { renderDeaths(); message(t('akuResetMessage')); } } catch (error) { message(error.message, true); } });


$('bonus-gem').addEventListener('change', () => setLastGem($('bonus-gem').checked));
$('cuts-on').addEventListener('click', () => setRecordFlags('cutscene', true));
$('cuts-off').addEventListener('click', () => setRecordFlags('cutscene', false));
$('hints-on').addEventListener('click', () => setRecordFlags('hint', true));
$('hints-off').addEventListener('click', () => setRecordFlags('hint', false));
