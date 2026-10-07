/* Stage capabilities and completion rules for Steam NST. */
(function(root, factory) {
  const commonJS = typeof module === 'object' && module.exports;
  const api = factory(commonJS ? require('./nst-save.js') : root.NSTSave, commonJS ? require('./game-records.js') : root.NST_GAME_RECORDS);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.NSTProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(NSTSave, records) {
  'use strict';
  const BITS = Object.fromEntries(NSTSave.ITEM_BITS.map(f => [f.name, f.bit]));
  const RELICS = BITS.sapphire | BITS.gold | BITS.platinum;
  const PROGRESS_EVENTS = {
    1:{OneZeroTwoRewarded:102,OneZeroFourRewarded:104},
    2:{OneZeroOneRewarded:101,OneZeroTwoRewarded:102},
    3:{OneHundredCortexBeat:100}
  };
  const NAME_PRIORITY = new Map(Object.values(records || {}).flat().map((e,i)=>[e.name,i]));
  function groupAliases(fields) {
    const groups = new Map();
    for(const f of fields){
      const key=f.label.toLowerCase(),old=groups.get(key);
      if(!old)groups.set(key,{...f,aliases:[f.path]});
      else if((NAME_PRIORITY.get(f.label)??Infinity)<(NAME_PRIORITY.get(old.label)??Infinity))groups.set(key,{...f,aliases:[...old.aliases,f.path]});
      else old.aliases.push(f.path);
    }
    return [...groups.values()];
  }
  const GEM_ORDER = ['Gem_Blue','Gem_Red','Gem_Green','Gem_Yellow','Gem_Purple','Gem_Orange'];
  const SECRET_ORDER = ['C2_SecretWarpRoom_Unlocked','C2_AirCrash_Secret_Unlocked','C2_SnowGo_Secret_Unlocked','C2_RoadToRuin_Secret_Unlocked','C2_TotallyBear_Secret_Unlocked','C2_TotallyFly_Secret_Unlocked'];
  const UPGRADE_ORDER = ['Upgrade_SpeedShoesCrash2','Upgrade_SuperChargedBodySlam','Upgrade_DoubleJump','Upgrade_DeathTornadoSpin','Upgrade_FruitBazooka','Upgrade_SpeedShoes'];
  const C1_ORDER = ['l101','l102','l103','l104','l105','b101','l106','l107','l108','l109','b102','l110','l111','l112','l113','l114','l115','b103','l116','l117','l118','l119','b104','l120','l121','l122','l123','l124','l125','b105','l126','l127','b106','l128'];
  const stages = [];
  const add = (game, id, allowed, extra = {}) => stages.push({ game, id, allowed, ...extra });
  for (let i = 101; i <= 128; i++) {
    const id = `l${i}`, color = {110:'green_gem',118:'orange_gem',119:'blue_gem',121:'red_gem',122:'purple_gem',126:'yellow_gem'}[i];
    add(1,id,i === 127 ? 0 : BITS[color || 'clear_gem'] | RELICS | ([115,124].includes(i) ? BITS.key : 0), { index:C1_ORDER.indexOf(id)+1, relic:i!==127, bonus:i===128 });
  }
  for (let i = 101; i <= 106; i++) add(1,`b${i}`,BITS.boss,{index:C1_ORDER.indexOf(`b${i}`)+1,boss:true});
  for (let game = 2; game <= 3; game++) {
    const start = game * 100;
    for (let n = 1; n <= 25; n++) {
      const colors = game === 2 ? {1:'blue_gem',2:'red_gem',10:'green_gem',11:'yellow_gem',20:'purple_gem'} : {7:'yellow_gem',12:'red_gem',13:'purple_gem',20:'blue_gem',23:'green_gem'};
      const doubles = game === 2 ? [3,7,12,14,17,18,19,21,23,25] : [4,9,11,16,19,21,25];
      add(game,`l${start+n}`, BITS.clear_gem | BITS.crystal | RELICS | (colors[n] ? BITS[colors[n]] : 0) | (doubles.includes(n) ? BITS.extra_gem : 0), {index:n+Math.floor((n-1)/5),relic:true});
    }
    for (let n = 1; n <= 5; n++) add(game,`b${start+n}`,BITS.boss,{index:n*6,boss:true});
  }
  add(2,'l226',BITS.clear_gem|RELICS,{index:31,relic:true,bonus:true});
  add(2,'l227',BITS.clear_gem|RELICS,{index:32,relic:true,bonus:true});
  for (const [n,index,two] of [[326,31,false],[328,32,true],[330,33,true],[331,34,false],[332,35,false],[333,36,true]])
    add(3,`l${n}`,BITS.clear_gem|RELICS|(two?BITS.extra_gem:0),{index,relic:true,bonus:true});
  function idOf(name) { return /(?:^|[/. (])([lb][123]\d{2})(?=[_/. ])/i.exec(name)?.[1].toLowerCase(); }
  function stagesFor(save) {
    const zones = [...new Set(save.fields.filter(f => f.category === 'zones' && f.zone.startsWith(`crash${save.game}/`)).map(f=>f.zone))];
    return stages.filter(s=>s.game===save.game).map(s=>({...s,zone:zones.find(z=>idOf(z)===s.id)})).filter(s=>s.zone).sort((a,b)=>a.index-b.index);
  }
  const zonePath = (s,slot) => `zones.${s.zone}.slot${slot}`;
  function value(save,changes,path) { return Object.hasOwn(changes,path) ? changes[path] : save.fields.find(f=>f.path===path)?.value; }
  function farthestStagesFor(save) {
    const ss=stagesFor(save),cortex=ss.find(s=>s.id===`b${save.game}0${save.game===1?6:5}`);
    return ss.filter(s=>s.index<=(cortex?.index||ss.at(-1)?.index||1));
  }
  function progressionRange(save,path) {
    const ss=path==='summary.farthest_progression_index'?farthestStagesFor(save):stagesFor(save);
    return {min:ss[0]?.index||1,max:ss.at(-1)?.index||1};
  }
  function isValidProgressionIndex(save,index,path) {
    const ss=path==='summary.farthest_progression_index'?farthestStagesFor(save):stagesFor(save);
    return Number.isInteger(index)&&ss.some(stage=>stage.index===index);
  }
  function farthestProgressionIndex(save,changes={}) {
    const lastCleared=farthestStagesFor(save).reduce((index,stage)=>value(save,changes,zonePath(stage,2))===1?Math.max(index,stage.index):index,0);
    const range=progressionRange(save,'summary.farthest_progression_index');
    return Math.min(range.max,Math.max(range.min,lastCleared+1));
  }
  function stageChanges(stage, edit, save, existing={}) {
    const out = {};
    if (Object.hasOwn(edit,'clear')) { out[zonePath(stage,2)] = edit.clear ? 1 : -1; out[zonePath(stage,3)] = edit.clear ? 1 : 0; }
    if (Object.hasOwn(edit,'count')) {
      if (!Number.isInteger(edit.count) || edit.count < 0 || edit.count > 2147483647) throw new Error('Invalid clear count');
      out[zonePath(stage,3)] = edit.count;
    }
    let mask = value(save,existing,zonePath(stage,13));
    if (edit.flags) for (const [name,on] of Object.entries(edit.flags)) {
      const bit = BITS[name];
      if (!bit || !(stage.allowed & bit)) { if (on) throw new Error(`${stage.id}: ${name} is unavailable`); continue; }
      if (bit & RELICS) throw new Error('Choose a relic tier');
      mask = on ? mask | bit : mask & ~bit;
    }
    if (Object.hasOwn(edit,'relic')) {
      if (!stage.relic && edit.relic) throw new Error(`${stage.id}: relic is unavailable`);
      if (![0,1,2,3].includes(edit.relic)) throw new Error('Invalid relic tier');
      const bit = [0,BITS.sapphire,BITS.gold,BITS.platinum][edit.relic];
      mask = (mask & ~RELICS) | bit; out[zonePath(stage,11)] = edit.relic;
    }
    if (edit.flags || Object.hasOwn(edit,'relic')) out[zonePath(stage,13)] = mask >>> 0;
    return out;
  }
  function calculate(save,changes={},bonusGem) {
    const lastGem=save.game===3 && (bonusGem===undefined?!!value(save,changes,'tables.bool.LastGemRewarded'):bonusGem);
    const ss = stagesFor(save), counts = {key_count:0,gem_count:0,sapphire_count:0,gold_count:0,platinum_count:0,crystal_count:0};
    let cleared = 0,bosses=0,relCount=0,goldCount=0;
    for (const s of ss) {
      const clear = value(save,changes,zonePath(s,2))===1;
      if (clear) { if(s.boss)bosses++;else cleared++; }
      const mask=value(save,changes,zonePath(s,13)) & s.allowed;
      for (const [name,bit] of Object.entries(BITS)) if (mask & bit) {
        if (bit<=256) counts.gem_count++;
        if (name==='key')counts.key_count++;
        if (name==='crystal')counts.crystal_count++;
      }
      // A stage holds one best relic. Highest tier wins if imported bits disagree.
      if (mask & RELICS) {
        relCount++;
        if (mask & BITS.platinum) {counts.platinum_count++;goldCount++;}
        else if(mask & BITS.gold){counts.gold_count++;goldCount++;}else counts.sapphire_count++;
      }
    }
    const secretCount = SECRET_ORDER.slice(1).filter(name=>value(save,changes,`variables.${name}`)).length;
    const finalBoss=ss.find(s=>s.id===`b${save.game}0${save.game===1?6:5}`);
    const finalDone=finalBoss && value(save,changes,zonePath(finalBoss,2))===1;
    if(lastGem) counts.gem_count++;
    const relicBonus = Number(relCount>=27)+Number(goldCount>=27);
    const percent = save.game===1 ? cleared*2+bosses*2+counts.gem_count+counts.key_count*4+relicBonus :
      save.game===2 ? counts.crystal_count*2+counts.gem_count+secretCount+(finalDone?3:0)+relicBonus :
      counts.crystal_count+counts.gem_count+relCount+bosses;
    const farthest=farthestProgressionIndex(save,changes);
    const result = Object.fromEntries(Object.entries({...counts,percent_complete:percent,farthest_progression_index:farthest,story_completed:finalDone?1:0}).map(([name,v])=>[`summary.${name}`,v]));
    const available=new Set(save.fields.map(f=>f.path));
    for(const [name,threshold] of Object.entries(PROGRESS_EVENTS[save.game]||{})) {
      const path=`tables.bool.${name}`;
      if(available.has(path))result[path]=percent>=threshold;
    }
    if(save.game===3 && available.has('tables.bool.LastGemRewarded'))result['tables.bool.LastGemRewarded']=lastGem;
    if(save.game===2 && available.has('variables.C2_BossCortexDefeated'))result['variables.C2_BossCortexDefeated']=!!finalDone && !!(value(save,changes,zonePath(finalBoss,13))&BITS.boss);
    for(const name of GEM_ORDER) {
      const path=`variables.${name}`,bit=BITS[`${name.slice(4).toLowerCase()}_gem`];
      if(save.fields.some(f=>f.path===path))result[path]=ss.some(s=>s.allowed&bit&&value(save,changes,zonePath(s,13))&bit);
    }
    return {changes:result,counts,percent,farthest,cleared,bosses,relicBonus,secretCount,relCount,goldCount,bonusEligible:save.game===3 && ss.filter(s=>s.relic && s.id!=='l333').every(s=>value(save,changes,zonePath(s,13)) & (BITS.gold|BITS.platinum))};
  }
  function previousChanges(save,zone) {
    if(!save.fields.some(f=>f.category==='zones'&&f.zone===zone&&zone.startsWith(`crash${save.game}/`)))throw new Error('Unknown previous level');
    const stage=stagesFor(save).find(s=>s.zone===zone);
    return {'summary.previous_level_name':zone,'summary.previous_level_progression_index':stage?.index || 0};
  }
  function recordFields(save,category) {
    const catalog=(records[save.game]||[]).filter(e=>e.category===category),actual=new Map(groupAliases(save.fields.filter(f=>f.category==='tables')).map(f=>[f.label.toLowerCase(),f]));
    const groups=new Map();
    for(const entry of catalog) {
      const key=entry.name.toLowerCase(),path=`tables.${entry.kind}.${entry.name}`;
      if(!groups.has(key))groups.set(key,actual.get(key)||{label:entry.name,path,kind:entry.kind,value:entry.value,aliases:[]});
      const field=groups.get(key);if(!field.aliases.includes(path))field.aliases.push(path);
    }
    const order=new Map(stagesFor(save).map(s=>[s.id,s.index])),source=new Map(catalog.map((e,i)=>[e.name.toLowerCase(),i]));
    return [...groups.values()].sort((a,b)=>category==='cutscene'?cutsceneOrder(a.label)-cutsceneOrder(b.label)||(source.get(a.label.toLowerCase())-source.get(b.label.toLowerCase())):
      category==='death'?(order.get(idOf(a.label))||999)-(order.get(idOf(b.label))||999)||(source.get(a.label.toLowerCase())-source.get(b.label.toLowerCase())):source.get(a.label.toLowerCase())-source.get(b.label.toLowerCase()));
  }
  function deathFields(save,type='all') {
    return recordFields(save,'death').filter(f=>type==='world'?/^the world entity \(/i.test(f.label):type==='checkpoint'?!/^the world entity \(/i.test(f.label):true);
  }
  function deathChanges(field,number) {return Object.fromEntries((field.aliases || [field.path]).map(path=>[path,number]));}
  function cutsceneFields(save) { return recordFields(save,'cutscene'); }
  function cutsceneOrder(name) {
    const n=name.split(' (archetype')[0];
    if(/Intro0?1|Intro0?2|Intro0?3|Dr_N_Brio_Intro|AkuAku_Warning/i.test(n)) return 0;
    const crystal=/Crystal_(\d+)/i.exec(n); if(crystal)return Number(crystal[1])*6/5;
    const hub=/Hub_?(\d)/i.exec(n); if(hub)return (Number(hub[1])-1)*6+(n.includes('Part_2')?3:1);
    const boss=/Post_Boss_(\d)/i.exec(n); if(boss)return Number(boss[1])*6+0.5;
    const order=['Tiny','Dingodile','NTropy','NGin','Cortex'];
    const i=order.findIndex(s=>n.includes(s));
    if(i>=0) return i*6+(/Post/i.test(n)?6.5:/Pre/i.test(n)?5.5:1);
    if(/Complete|Final|Cortex_Hub_5|outro/i.test(n))return 31;
    return 0.5;
  }
  return {BITS,RELICS,GEM_ORDER,SECRET_ORDER,UPGRADE_ORDER,stagesFor,farthestStagesFor,idOf,zonePath,value,progressionRange,isValidProgressionIndex,farthestProgressionIndex,stageChanges,calculate,previousChanges,deathFields,deathChanges,cutsceneFields,cutsceneOrder,recordFields};
});
