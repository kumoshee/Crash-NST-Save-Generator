/* Lossless reader, editor and blank-save factory for the supplied Steam NST IGB v12 saves. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NSTSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const ITEM_BITS = [
    { bit: 2, name: 'clear_gem', label: '白ダイヤ' }, { bit: 4, name: 'blue_gem', label: '青ダイヤ' },
    { bit: 8, name: 'green_gem', label: '緑ダイヤ' }, { bit: 16, name: 'purple_gem', label: '紫ダイヤ' },
    { bit: 32, name: 'red_gem', label: '赤ダイヤ' }, { bit: 64, name: 'yellow_gem', label: '黄色ダイヤ' },
    { bit: 128, name: 'orange_gem', label: 'オレンジダイヤ' }, { bit: 256, name: 'extra_gem', label: '追加白ダイヤ' },
    { bit: 512, name: 'crystal', label: 'パワーストーン' }, { bit: 1024, name: 'key', label: 'カギ' }, { bit: 2048, name: 'boss', label: 'ボス' },
    { bit: 4096, name: 'platinum', label: 'プラチナレリック' }, { bit: 8192, name: 'sapphire', label: 'サファイアレリック' },
    { bit: 16384, name: 'gold', label: 'ゴールドレリック' }
  ];
  const encoder = new TextEncoder();
  const NUMERIC_LIMITS = {
    int: { min: -2147483648, max: 2147483647, step: '1' },
    uint: { min: 0, max: 4294967295, step: '1' },
    float: { min: -3.4028234663852886e38, max: 3.4028234663852886e38, step: 'any' }
  };
  const concat = parts => {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  };
  function uint32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); return bytes; }
  function formatTime(value) {
    if (!Number.isInteger(value) || value < 0) return String(value);
    return `${Math.floor(value / 6000)}:${String(Math.floor(value / 100) % 60).padStart(2, '0')}:${String(value % 100).padStart(2, '0')}`;
  }
  function parseTime(text) {
    const match = /^(\d+):([0-5]\d):(\d{2})$/.exec(text);
    if (!match) throw new Error('Expected m:ss:cc');
    const value = Number(match[1]) * 6000 + Number(match[2]) * 100 + Number(match[3]);
    if (!Number.isSafeInteger(value) || value > 2147483647) throw new Error('Time is outside int32 range');
    return value;
  }
  class FormatError extends Error {}
  class Save {
    constructor(input) {
      this.bytes = new Uint8Array(input).slice();
      this.view = new DataView(this.bytes.buffer);
      this.fields = [];
      this.sections = [];
      this.objects = new Map();
      this.memory = new Map();
      this.parse();
    }
    check(offset, size) {
      if (!Number.isInteger(offset) || !Number.isInteger(size) || offset < 0 || size < 0 || offset + size > this.bytes.length)
        throw new FormatError(`Out of bounds at 0x${offset.toString(16)} (${size} bytes)`);
    }
    u32(offset) { this.check(offset, 4); return this.view.getUint32(offset, true); }
    i32(offset) { this.check(offset, 4); return this.view.getInt32(offset, true); }
    u16(offset) { this.check(offset, 2); return this.view.getUint16(offset, true); }
    str(offset, size) {
      this.check(offset, size);
      const part = this.bytes.subarray(offset, offset + size);
      const end = part.indexOf(0);
      if (end < 0 && size) throw new FormatError(`Unterminated string at 0x${offset.toString(16)}`);
      return decoder.decode(part.subarray(0, end < 0 ? size : end));
    }
    section(name, start, size) {
      this.check(start, size);
      this.sections.push({ name, offset: start, size });
      return start + size;
    }
    addField(path, kind, offset, extra = {}) {
      const size = kind === 'bool' ? 1 : kind === 'string' ? extra.size : 4;
      this.check(offset, size);
      const field = { path, kind, offset, size, ...extra };
      field.value = this.read(field);
      this.fields.push(field);
      return field;
    }
    read(f) {
      if (f.kind === 'float') return this.view.getFloat32(f.offset, true);
      if (f.kind === 'bool') return this.bytes[f.offset] !== 0;
      if (f.kind === 'string') return this.str(f.offset, f.size);
      if (f.kind === 'string-index') return this.strings[this.u32(f.offset)];
      return f.kind === 'int' ? this.i32(f.offset) : this.u32(f.offset);
    }
    parse() {
      this.check(0, 0x38);
      this.header = Array.from({ length: 12 }, (_, i) => this.u32(i * 4));
      if (this.header[10] !== 0xfada || this.header[11] !== 0xb400000c)
        throw new FormatError('Supported format: little-endian NST IGB v12, flags 0xb400000c');
      if (this.u32(0x30) !== 3) throw new FormatError('Unsupported save metadata version');
      const recordSize = this.u32(0x34);
      if (recordSize % 12) throw new FormatError('Invalid metadata table size');
      const records = 0x38, names = records + recordSize + 4;
      this.check(records, recordSize);
      const nameSize = this.u32(names - 4), values = names + nameSize + 4;
      this.check(names, nameSize);
      const valueSize = this.u32(values - 4);
      this.check(values, valueSize);
      const metadata = [];
      for (let p = records; p < records + recordSize; p += 12) {
        const type = this.u32(p), no = this.u32(p + 4), vo = this.u32(p + 8);
        if (no >= nameSize || vo >= valueSize || type > 2) throw new FormatError('Invalid metadata record');
        metadata.push({ type, name: this.str(names + no, nameSize - no), offset: vo, nameOffset: names + no, recordOffset: p });
      }
      for (const m of metadata) {
        const next = Math.min(valueSize, ...metadata.filter(x => x.offset > m.offset).map(x => x.offset));
        if (m.type !== 2 && next - m.offset !== 4) throw new FormatError('Invalid scalar metadata width');
        this.addField(`summary.${m.name}`, ['uint', 'float', 'string'][m.type], values + m.offset,
          { size: next - m.offset, category: 'summary', label: m.name, nameOffset: m.nameOffset, recordOffset: m.recordOffset, readOnly: m.name === 'save_version' });
      }
      this.metadataValueOffset = values;
      let p = this.section('metadata', 0x30, values + valueSize - 0x30);
      const stringStart = p, stringSize = this.u32(p), stringCount = this.u32(p + 4);
      const stringEnd = this.section('strings', p, stringSize);
      p += 8;
      this.strings = [];
      this.stringOffsets = [];
      for (let i = 0; i < stringCount; i++) {
        if (p + 4 > stringEnd) throw new FormatError('Invalid string count');
        const size = this.u32(p); p += 4;
        if (p + size > stringEnd) throw new FormatError('String exceeds table');
        this.stringOffsets.push(p); this.strings.push(this.str(p, size)); p += size;
      }
      if (p !== stringEnd || stringStart === p) throw new FormatError('Invalid string table length');
      const mf = p, mfSize = this.header[8], mfCount = this.header[9];
      const mfEnd = this.section('field-types', p, mfSize);
      p += mfCount * 12;
      if (p > mfEnd) throw new FormatError('Invalid field-type count');
      this.types = [];
      for (let i = 0; i < mfCount; i++) {
        const size = this.u32(mf + i * 12);
        if (p + size > mfEnd) throw new FormatError('Field-type name exceeds table');
        this.types.push(this.str(p, size)); p += size;
      }
      if (p !== mfEnd) throw new FormatError('Field-type table length mismatch');
      const meta = p, metaSize = this.header[2], metaCount = this.header[3];
      const metaEnd = this.section('object-types', p, metaSize);
      p += metaCount * 24;
      if (p > metaEnd) throw new FormatError('Invalid object-type count');
      this.classes = [];
      for (let i = 0; i < metaCount; i++) {
        const r = meta + i * 24, size = this.u32(r), count = this.u32(r + 12);
        if (p + size + count * 6 > metaEnd) throw new FormatError('Invalid class descriptor');
        const name = this.str(p, size); p += size;
        const fields = [];
        for (let j = 0; j < count; j++, p += 6) {
          const type = this.u16(p), slot = this.u16(p + 2), runtimeSize = this.u16(p + 4);
          if (type >= this.types.length) throw new FormatError('Invalid field-type index');
          fields.push({ type: this.types[type], slot, runtimeSize });
        }
        this.classes.push({ name, fields });
      }
      if (p !== metaEnd) throw new FormatError('Object-type table length mismatch');
      const hashStart = p, hashSize = this.u32(p), hashCount = this.u32(p + 8);
      const hashEnd = this.section('handle-names', p, hashSize);
      this.handleNames = new Map();
      this.handleNameOffsets = new Map();
      p += 12 + hashCount * 4;
      if (p > hashEnd) throw new FormatError('Invalid handle-name count');
      for (let i = 0; i < hashCount; i++) {
        const name = this.str(p, hashEnd - p);
        this.handleNames.set(this.u32(hashStart + 12 + i * 4), name);
        this.handleNameOffsets.set(this.u32(hashStart + 12 + i * 4), p);
        p += new TextEncoder().encode(name).length + 1;
      }
      if (p !== hashEnd) throw new FormatError('Handle-name table length mismatch');
      for (const name of ['memory-pools', 'pool-assignments']) p = this.section(name, p, this.u32(p));
      const entriesEnd = this.section('directory', p, this.header[0]);
      this.entries = [];
      while (p < entriesEnd) {
        const type = this.u32(p), size = this.u32(p + 4);
        if (!this.classes[type] || size < 8 || p + size > entriesEnd) throw new FormatError('Invalid directory record');
        this.entries.push({ type: this.classes[type].name, data: p + 8, size }); p += size;
      }
      if (this.entries.length !== this.header[1]) throw new FormatError('Directory count mismatch');
      const indexSize = this.u32(p), indexCount = this.u32(p + 4);
      if (indexSize !== 8 + indexCount * 2) throw new FormatError('Invalid reference-index size');
      const indexEnd = this.section('reference-index', p, indexSize);
      this.refs = Array.from({ length: indexCount }, (_, i) => this.u16(p + 8 + i * 2));
      p = indexEnd;
      this.infoRef = this.u32(p); p = this.section('info-reference', p, 4);
      const objectEnd = this.section('objects', p, this.header[4]);
      for (let ref = 0; ref < this.refs.length; ref++) {
        const e = this.entries[this.refs[ref]];
        if (!e) throw new FormatError('Invalid directory reference');
        if (e.type !== 'igObjectDirEntry') continue;
        const type = this.u32(p), size = this.u32(p + 4), cls = this.classes[type];
        if (!cls || size < 8 || p + size > objectEnd || type !== this.u32(e.data + 4))
          throw new FormatError('Invalid object record');
        const obj = { ref, type: cls.name, offset: p, size, fields: [] };
        let fpos = p + 8;
        for (const spec of cls.fields) {
          const wireSize = this.wireSize(spec);
          if (fpos + wireSize > p + size) throw new FormatError(`Field exceeds ${cls.name}`);
          obj.fields.push({ ...spec, offset: fpos, wireSize });
          fpos += wireSize;
        }
        if (fpos !== p + size) throw new FormatError(`Unparsed bytes in ${cls.name}`);
        this.objects.set(ref, obj); p += size;
      }
      if (p !== objectEnd || this.objects.size !== this.header[5]) throw new FormatError('Object count/size mismatch');
      const memoryEnd = this.section('memory', p, this.header[6]);
      for (let ref = 0; ref < this.refs.length; ref++) {
        const e = this.entries[this.refs[ref]];
        if (e.type !== 'igMemoryDirEntry') continue;
        const count = this.u32(e.data + 4), type = this.types[this.u32(e.data + 8)];
        const elementSize = { igObjectRefMetaField: 4, igBoolMetaField: 1, igIntMetaField: 4,
          igStringMetaField: 4, igNameMetaField: 8 }[type];
        if (!elementSize) throw new FormatError(`Unsupported memory element: ${type}`);
        const size = count * elementSize;
        if (p + size > memoryEnd) throw new FormatError('Memory reference exceeds section');
        this.memory.set(ref, { offset: p, size, count, type }); p += Math.ceil(size / 4) * 4;
      }
      if (p !== memoryEnd || p !== this.bytes.length || this.memory.size !== this.header[7])
        throw new FormatError(`Memory count/size or file length mismatch: end ${p}/${memoryEnd}, count ${this.memory.size}/${this.header[7]}`);
      this.mapEditableFields();
    }
    wireSize(f) {
      const four = ['igStringMetaField', 'igObjectRefMetaField', 'igMemoryRefMetaField',
        'igIntMetaField', 'igUnsignedIntMetaField', 'igEnumMetaField', 'igFloatMetaField', 'igBoolMetaField'];
      if (four.includes(f.type)) return 4;
      if (f.type === 'igHandleMetaField' || f.type === 'igNameMetaField' || f.type === 'igVectorMetaField') return 8;
      throw new FormatError(`Unsupported serialized field: ${f.type}`);
    }
    slot(obj, slot) {
      const field = obj.fields.find(f => f.slot === slot);
      if (!field) throw new FormatError(`Missing slot ${slot} in ${obj.type}`);
      return field.offset;
    }
    list(ref) {
      const obj = this.objects.get(ref);
      if (!obj) throw new FormatError(`Missing list reference ${ref}`);
      const count = this.u32(this.slot(obj, 0));
      const memoryRef = this.i32(this.slot(obj, 2));
      if (count === 0) return [];
      const memory = this.memory.get(memoryRef);
      if (!memory || count * 4 > memory.size) throw new FormatError('Invalid list memory');
      return Array.from({ length: count }, (_, i) => ({ offset: memory.offset + i * 4, value: this.i32(memory.offset + i * 4) }));
    }
    mapEditableFields() {
      for (const obj of this.objects.values()) {
        if (['igStringBoolHashTable', 'igStringIntHashTable'].includes(obj.type)) {
          const kind = obj.type === 'igStringBoolHashTable' ? 'bool' : 'int';
          const values = this.memory.get(this.i32(this.slot(obj, 0))), keys = this.memory.get(this.i32(this.slot(obj, 1)));
          const count = this.u32(this.slot(obj, 2));
          if (!values || !keys || values.count !== keys.count || keys.type !== 'igStringMetaField' ||
              values.type !== (kind === 'bool' ? 'igBoolMetaField' : 'igIntMetaField')) throw new FormatError('Invalid hash-table memory');
          let found = 0;
          for (let i = 0; i < keys.count; i++) {
            const index = this.u32(keys.offset + i * 4);
            if (index === 0 || index === 0xffffffff) continue;
            const name = this.strings[index];
            if (name === undefined) throw new FormatError('Invalid hash-table string index');
            this.addField(`tables.${kind}.${name}`, kind, values.offset + i * (kind === 'bool' ? 1 : 4),
              { category: 'tables', label: name, nameOffset: this.stringOffsets[index], ref: obj.ref, meaning: 'name available; in-game effect unconfirmed' });
            found++;
          }
          if (found !== count) throw new FormatError('Hash-table entry count mismatch');
        }
        const kinds = { CGameVariableValueSavedBool: 'bool', CGameVariableValueSavedInt: 'int', CGameVariableValueSavedFloat: 'float' };
        if (kinds[obj.type]) {
          const hash = this.u32(this.slot(obj, 1));
          const name = this.handleNames.get(hash) || `hash_${hash.toString(16)}`;
          this.addField(`variables.${name}`, kinds[obj.type], this.slot(obj, 0), { category: 'variables', label: name, nameOffset: this.handleNameOffsets.get(hash), ref: obj.ref });
        }
        if (obj.type === 'CZoneInfoSave') {
          const nameIndex = this.u32(this.slot(obj, 0)), sessionRef = this.i32(this.slot(obj, 1));
          const name = this.strings[nameIndex], session = this.objects.get(sessionRef);
          if (name === undefined || !session || session.type !== 'CZoneInfoUserSession') throw new FormatError('Invalid zone session');
          for (const f of session.fields) {
            const kind = { igUnsignedIntMetaField: 'uint', igIntMetaField: 'int', igEnumMetaField: 'int', igBoolMetaField: 'bool', igStringMetaField: 'string-index' }[f.type];
            if (!kind) throw new FormatError(`Unsupported session field ${f.type}`);
            if (kind === 'string-index' && this.strings[this.u32(f.offset)] === undefined) throw new FormatError('Invalid string reference');
            this.addField(`zones.${name}.slot${f.slot}`, kind, f.offset,
              { category: 'zones', label: `slot${f.slot}`, zone: name, nameOffset: this.stringOffsets[nameIndex], slot: f.slot, ref: sessionRef,
                meaning: f.slot === 2 ? 'stage cleared: -1=no, 1=yes' : f.slot === 3 ? 'stage clear count' : f.slot === 13 ? 'item bits (confirmed by user)' : f.slot === 11 ? 'relic tier: 0=none, 1=sapphire, 2=gold, 3=platinum' :
                  f.slot >= 5 && f.slot <= 7 ? 'time trial result (centisecond conversion assumed)' : f.slot >= 8 && f.slot <= 10 ? 'time trial initials (3 English letters)' : 'unconfirmed' });
          }
        }
        if (['CGameVariableValueSavedIntList', 'CGameVariableValueSavedFloatList', 'CGameVariableValueSavedBoolList'].includes(obj.type)) {
          const entries = this.list(obj.ref);
          entries.forEach((item, i) => {
            if (!this.objects.has(item.value)) throw new FormatError('Invalid variable-list object reference');
          });
        }
      }
      const names = new Set();
      for (const f of this.fields) {
        if (names.has(f.path)) throw new FormatError(`Duplicate editable field: ${f.path}`);
        names.add(f.path);
      }
      const previous = this.fields.find(f => f.path === 'summary.previous_level_name');
      const match = previous && /^crash([123])\//.exec(previous.value);
      this.game = match ? Number(match[1]) : null;
    }
    patch(changes) {
      const output = this.bytes.slice(), view = new DataView(output.buffer), fields = new Map(this.fields.map(f => [f.path, f]));
      for (const [path, value] of Object.entries(changes)) {
        const f = fields.get(path);
        if (!f) throw new Error(`Unknown field: ${path}`);
        if (f.readOnly) throw new Error(`Read-only field: ${path}`);
        if (Object.is(value, f.value)) continue;
        if (f.kind === 'bool') {
          if (typeof value !== 'boolean') throw new Error(`${path}: expected true or false`);
          output[f.offset] = value ? 1 : 0;
        } else if (f.kind === 'string') {
          if (typeof value !== 'string' || value.includes('\0')) throw new Error(`${path}: invalid string`);
          const encoded = new TextEncoder().encode(value);
          if (encoded.length >= f.size) throw new Error(`${path}: at most ${f.size - 1} UTF-8 bytes`);
          output.fill(0, f.offset, f.offset + f.size); output.set(encoded, f.offset);
        } else if (f.kind === 'string-index') {
          const index = typeof value === 'number' ? value : this.strings.indexOf(value);
          if (!Number.isInteger(index) || index < 0 || index >= this.strings.length) throw new Error(`${path}: select an existing string`);
          view.setUint32(f.offset, index, true);
        } else if (f.kind === 'float') {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < NUMERIC_LIMITS.float.min || value > NUMERIC_LIMITS.float.max) throw new Error(`${path}: expected a finite float32`);
          view.setFloat32(f.offset, value, true);
        } else {
          const min = f.kind === 'int' ? -2147483648 : 0, max = f.kind === 'int' ? 2147483647 : 4294967295;
          if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${path}: integer range ${min}..${max}`);
          if (f.kind === 'int') view.setInt32(f.offset, value, true); else view.setUint32(f.offset, value, true);
        }
      }
      new Save(output);
      return output;
    }
    encode(changes = {}) {
      // Preserve the existing binary exactly unless a string needs a larger/new entry.
      const fields = new Map(this.fields.map(f => [f.path, f])), fixed = {}, variable = [];
      for (const [path, value] of Object.entries(changes)) {
        const f = fields.get(path);
        if (!f || f.readOnly) throw new Error(`Unknown or read-only field: ${path}`);
        if (f.kind === 'string' || (f.kind === 'string-index' && typeof value === 'string')) {
          if (typeof value !== 'string' || value.includes('\0')) throw new Error(`${path}: invalid string`);
          if (f.category === 'zones' && f.slot >= 8 && f.slot <= 10 && value !== '---' && !/^[A-Za-z]{3}$/.test(value))
            throw new Error(`${path}: expected 3 English letters or ---`);
          if (f.kind === 'string' && encoder.encode(value).length < f.size) fixed[path] = value;
          else if (f.kind === 'string-index' && this.strings.includes(value)) fixed[path] = value;
          else variable.push({ f, value });
        } else fixed[path] = value;
      }
      const patched = this.patch(fixed);
      if (!variable.length) return patched;
      const view = new DataView(patched.buffer), strings = this.strings.slice();
      const summaryChanges = new Map();
      for (const { f, value } of variable) {
        if (f.kind === 'string') summaryChanges.set(f.path, value);
        else {
          let index = strings.indexOf(value);
          if (index < 0) { index = strings.length; strings.push(value); }
          view.setUint32(f.offset, index, true);
        }
      }
      const metadata = this.sections.find(s => s.name === 'metadata'), stringSection = this.sections.find(s => s.name === 'strings');
      let metadataBytes = patched.slice(metadata.offset, metadata.offset + metadata.size);
      if (summaryChanges.size) {
        const prefix = patched.slice(metadata.offset, this.metadataValueOffset - 4), prefixView = new DataView(prefix.buffer);
        const values = []; let valueOffset = 0;
        for (const f of this.fields.filter(f => f.category === 'summary').sort((a, b) => a.offset - b.offset)) {
          prefixView.setUint32(f.recordOffset + 8 - metadata.offset, valueOffset, true);
          const bytes = summaryChanges.has(f.path) ? concat([encoder.encode(summaryChanges.get(f.path)), new Uint8Array(1)]) : patched.slice(f.offset, f.offset + f.size);
          values.push(bytes); valueOffset += bytes.length;
        }
        metadataBytes = concat([prefix, uint32(valueOffset), ...values]);
      }
      let stringBytes = patched.slice(stringSection.offset, stringSection.offset + stringSection.size);
      if (strings.length !== this.strings.length) {
        const additions = strings.slice(this.strings.length).map(text => {
          const bytes = concat([encoder.encode(text), new Uint8Array(1)]);
          return concat([uint32(bytes.length), bytes]);
        });
        stringBytes = concat([stringBytes, ...additions]);
        const stringView = new DataView(stringBytes.buffer);
        stringView.setUint32(0, stringBytes.length, true); stringView.setUint32(4, strings.length, true);
      }
      const output = concat([patched.slice(0, 0x30), metadataBytes, stringBytes, patched.slice(stringSection.offset + stringSection.size)]);
      new Save(output);
      return output;
    }
    withTableEntries(entries, { replace = false } = {}) {
      // FNV-1a with linear probing matches every occupied bucket in all 10 samples.
      const patched = this.bytes.slice(), view = new DataView(patched.buffer), strings = this.strings.slice(), replacements = new Map(), capacities = new Map();
      const fnv = name => { let h = 2166136261; for (const byte of encoder.encode(name)) h = Math.imul(h ^ byte, 16777619) >>> 0; return h; };
      for (const kind of ['bool', 'int']) {
        const incoming = entries.filter(e => e.kind === kind);
        if (!incoming.length && !replace) continue;
        const obj = [...this.objects.values()].find(o => o.type === (kind === 'bool' ? 'igStringBoolHashTable' : 'igStringIntHashTable'));
        if (!obj) throw new Error(`Missing ${kind} table`);
        const valueRef = this.i32(this.slot(obj, 0)), keyRef = this.i32(this.slot(obj, 1));
        const oldKeys = this.memory.get(keyRef), items = new Map(replace ? [] : this.fields.filter(f => f.category === 'tables' && f.kind === kind).map(f => [f.label, f.value]));
        for (const { name, value } of incoming) {
          if (typeof name !== 'string' || !name || name.includes('\0')) throw new Error('Invalid table name');
          if (kind === 'bool' ? typeof value !== 'boolean' : !Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw new Error('Invalid table value');
          if (!items.has(name)) items.set(name, value);
        }
        let capacity = oldKeys.count;
        while (items.size > capacity * 0.5) capacity *= 2;
        const keys = new Uint8Array(capacity * 4), values = new Uint8Array(capacity * (kind === 'bool' ? 1 : 4));
        const keyView = new DataView(keys.buffer), valueView = new DataView(values.buffer);
        for (const [name, value] of items) {
          let index = strings.indexOf(name);
          if (index < 0) { index = strings.length; strings.push(name); }
          let bucket = fnv(name) % capacity;
          while (keyView.getUint32(bucket * 4, true)) bucket = (bucket + 1) % capacity;
          keyView.setUint32(bucket * 4, index, true);
          if (kind === 'bool') values[bucket] = value ? 1 : 0; else valueView.setInt32(bucket * 4, value, true);
        }
        replacements.set(valueRef, values); replacements.set(keyRef, keys);
        view.setUint32(this.slot(obj, 2), items.size, true);
        for (const ref of [valueRef, keyRef]) capacities.set(ref,capacity);
      }
      if (entries.some(e => !['bool', 'int'].includes(e.kind))) throw new Error('Invalid table kind');
      if (!replacements.size) return new Save(this.bytes);
      const memorySection = this.sections.find(s => s.name === 'memory'), stringSection = this.sections.find(s => s.name === 'strings');
      const memoryBytes = concat([...this.memory].map(([ref, m]) => {
        const replacement = replacements.get(ref);
        return replacement ? concat([replacement, new Uint8Array((4 - replacement.length % 4) % 4)]) : patched.slice(m.offset, m.offset + Math.ceil(m.size / 4) * 4);
      }));
      view.setUint32(0x18, memoryBytes.length, true);
      const additions = strings.slice(this.strings.length).map(name => { const bytes = concat([encoder.encode(name), new Uint8Array(1)]); return concat([uint32(bytes.length), bytes]); });
      const stringBytes = concat([patched.slice(stringSection.offset, stringSection.offset + stringSection.size), ...additions]);
      const stringView = new DataView(stringBytes.buffer); stringView.setUint32(0, stringBytes.length, true); stringView.setUint32(4, strings.length, true);
      const directory=this.sections.find(s=>s.name==='directory'), reference=this.sections.find(s=>s.name==='reference-index');
      const refBytes=patched.slice(reference.offset,reference.offset+reference.size),refView=new DataView(refBytes.buffer),newEntries=[];
      // Directory descriptors can be shared by several memory references. Clone, do not mutate them.
      for(const [ref,count]of capacities)if(count!==this.memory.get(ref).count) {
        const entry=this.entries[this.refs[ref]],bytes=patched.slice(entry.data-8,entry.data-8+entry.size);
        new DataView(bytes.buffer).setUint32(12,count,true);
        const index=this.entries.length+newEntries.length;if(index>65535)throw new Error('Too many directory entries');
        refView.setUint16(8+ref*2,index,true);newEntries.push(bytes);
      }
      const directoryBytes=concat([patched.slice(directory.offset,directory.offset+directory.size),...newEntries]);
      view.setUint32(0,directoryBytes.length,true);view.setUint32(4,this.entries.length+newEntries.length,true);
      const sections={strings:stringBytes,directory:directoryBytes,'reference-index':refBytes,memory:memoryBytes};
      return new Save(concat([patched.slice(0,0x30),...this.sections.map(s=>sections[s.name]||patched.slice(s.offset,s.offset+s.size))]));
    }
    sortedFields(order = 'source') {
      if (!['source', 'name'].includes(order)) throw new Error('Unknown field order');
      return this.fields.slice().sort((a, b) => {
        if (order === 'name') {
          const name = (a.zone || a.label).localeCompare(b.zone || b.label, 'en');
          if (name) return name;
        } else {
          const offset = (a.nameOffset ?? Infinity) - (b.nameOffset ?? Infinity);
          if (offset) return offset;
        }
        return (a.slot ?? 0) - (b.slot ?? 0) || a.path.localeCompare(b.path, 'en');
      });
    }
    static create(game, template) {
      if (![1, 2, 3].includes(game)) throw new Error('Choose Crash 1, 2 or 3');
      const seed = new Save(template), changes = {};
      for (const f of seed.fields) {
        if (f.readOnly) continue;
        changes[f.path] = f.kind === 'bool' ? false : f.kind === 'string-index' ? '---' : f.kind === 'string' ? `crash${game}/l${game}00_hub/l${game}00_hub` :
          f.category === 'zones' && f.slot === 2 ? -1 : 0;
      }
      changes['summary.life_count'] = 4;
      changes['summary.farthest_progression_index'] = 1;
      if (seed.fields.some(f => f.path === 'variables.KeyTotal')) changes['variables.KeyTotal'] = 2;
      const first = seed.fields.find(f => f.category === 'zones' && new RegExp(`^crash${game}/l${game}01_`).test(f.zone));
      if (first) { changes['summary.previous_level_name'] = first.zone; changes['summary.previous_level_progression_index'] = 1; }
      if (seed.fields.some(f => f.path === 'variables.C1_StormyAscentRevealed')) changes['variables.C1_StormyAscentRevealed'] = true;
      return new Save(seed.encode(changes));
    }
    itemCounts(changes = {}) {
      if (!this.game) throw new Error('Cannot identify the current game');
      const result = { gem_count: 0, crystal_count: 0, sapphire_count: 0, gold_count: 0, platinum_count: 0 };
      for (const f of this.fields.filter(f => f.category === 'zones' && f.label === 'slot13' && f.zone.startsWith(`crash${this.game}/`))) {
        const mask = Object.hasOwn(changes, f.path) ? changes[f.path] : f.value;
        if (!Number.isInteger(mask) || mask < 0 || mask > 4294967295) throw new Error('Invalid item mask');
        for (const flag of ITEM_BITS) {
          if (!(mask & flag.bit)) continue;
          if (flag.bit <= 256) result.gem_count++;
          if (flag.name === 'crystal') result.crystal_count++;
          if (['sapphire', 'gold', 'platinum'].includes(flag.name)) result[flag.name + '_count']++;
        }
      }
      return result;
    }
    inspect() {
      return { game: this.game, format: 'IGB v12 (little endian)', bytes: this.bytes.length,
        summary: Object.fromEntries(this.fields.filter(f => f.category === 'summary').map(f => [f.label, f.value])),
        sections: this.sections, fields: this.fields,
        objects: [...this.objects.values()], memory: [...this.memory].map(([ref, data]) => ({ ref, ...data })) };
    }
  }
  return { Save, FormatError, ITEM_BITS, NUMERIC_LIMITS, formatTime, parseTime };
});
