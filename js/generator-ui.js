/* Display helpers. Binary identifiers remain unchanged. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NSTGeneratorUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const en = {
    language:'Language',
    newOpen:'Generate / open a save', newGame:'Game for the new save', generate:'Generate a blank save', open:'Open an existing .sav',
    save:'Save .sav', calculate:'Calculate progress and totals', reset:'Revert changes', backup:'Save original .sav',
    navLabel:'Save settings', basic:'Basic settings', stages:'Stage settings', aku:'Aku Aku settings',
    previous:'Previous Level', farthest:'Farthest Progression Level',
    numberRange:'Enter a number between {min} and {max}.', totalRelics:'Total Relics',
    progressionRange:'Enter a whole stage index from {min} to {max}.',
    bonus:'Last Gem',
    gameVariables:'Game variables', events:'Event data', eventFlags:'Event flags', allOn:'Turn all on', allOff:'Turn all off',
    discardConfirm:'Discard the save you are generating and generate a new blank save?',
    cancel:'Cancel', discardGenerate:'Discard and generate',
    colorGems:'Colored gems', secretWarpRoom:'Secret Warp Room', upgrades:'Upgrades',
    cutscenes:'Cutscene flags / progression order',
    stagesTitle:'Stage settings', hintDisplay:'Hint Display',
    previousNone:'Choose a stage', stageList:'Stage list',
    selectAll:'Select all stages', selectNone:'Clear selection', searchStages:'Search stages', searchStagesPlaceholder:'Search by stage name or ID',
    stageColumn:'Stage', statusColumn:'Status', itemsColumn:'Items',
    bulkTitle:'Edit selected stages', bulkClear:'Batch completion', bulkClearKeep:'Keep completion status', clear:'Clear', uncleared:'Uncleared',
    bulkRelic:'Batch relic', bulkRelicKeep:'Keep relic', none:'None', relic:'Relic',
    applyBulk:'Apply to selected stages', allItems:'Collect all available items in each stage',
    akuStageList:'Aku Aku stage list', noAkuMatches:'No matching stages.',
    akuReset:'Reset all Aku Aku settings', akuResetConfirm:'Reset all Aku Aku settings. Are you sure?',
    searchAku:'Search Aku Aku settings', searchAkuPlaceholder:'Search by stage or checkpoint name',
    spawn:'Initial Aku Aku', checkpoints:'Checkpoints ({count})', masks:'{count} masks', noCheckpoints:'There are no checkpoint records for this stage.',
    changes:'{count} changes', newLabel:'new', blankMessage:'Generated a blank save with 4 lives. You can edit Life_Count and the other settings.',
    readMessage:'Loaded the save.', recorded:'Changes recorded. Use “Save .sav” to export.',
    resetMessage:'Reverted changes.',
    downloadMessage:'Downloaded the save. Use the original filename when loading it in the game.',
    akuResetMessage:'Reset all stage and checkpoint Aku Aku settings to zero.', selectedCount:'{count} stages',
    noCuts:'This save has no named cutscene flags.', noShared:'The selected stages have no shared collectibles. You can still collect all available items in each stage.',
    noItems:'This stage has no collectibles.', clearCount:'Clear count', trials:'Time trial / m:ss:cc · 3 English letters',
    importedFlags:'The original save contains flags unavailable in this stage. Their original values are preserved.',
    selectStage:'Select {id} for batch editing', batchFlag:'Batch {name}', openStage:'View {name}',
    stageClear:'{id} completion', trialTime:'{id} time {count}', trialName:'{id} initials {count}',
    akuChoice:'{name}: {masks}', unknownGame:'Could not identify the game.',
    calculation:'{percent}% / Progression index {farthest} / Stages {cleared} / Bosses {bosses} / Relics {relCount}',
    secretResult:' / Secret entrances {secretCount}', relicResult:' / Relic bonus {relicBonus}%', calculationDone:'. Updated totals and progression.',
    missingRecord:'No record was found for this setting.', keep:'Keep', collected:'Collected', uncollected:'Uncollected'
  };
  const ja = {
    language:'言語',
    newOpen:'新しく作る / セーブを開く', newGame:'新しいセーブのゲーム', generate:'空のセーブを作る', open:'既存の .sav を開く',
    save:'.sav を保存', calculate:'ステージから進行・個数を計算', reset:'変更をもどす', backup:'元の .sav を保存',
    navLabel:'設定するデータ', basic:'基本設定', stages:'ステージ設定', aku:'アクアク設定',
    previous:'直前に入ったステージ', farthest:'最高到達地点',
    numberRange:'数値は{min}〜{max}の範囲で入力してください。', totalRelics:'レリックの合計数',
    progressionRange:'ステージ番号は{min}〜{max}の整数で入力してください。',
    bonus:'最後のダイヤ',
    colorGems:'カラーダイヤ', secretWarpRoom:'隠しワープルーム', upgrades:'追加アクション',
    gameVariables:'ゲーム変数', events:'イベントデータ', eventFlags:'イベントの保存フラグ', allOn:'全てオンにする', allOff:'全てオフにする',
    discardConfirm:'作成中のセーブデータは消えてしまいますが、よろしいですか？',
    cancel:'キャンセル', discardGenerate:'消して新しく作る',
    cutscenes:'カットシーンの保存フラグ / 攻略順',
    stagesTitle:'ステージ設定', hintDisplay:'ヒント表示',
    previousNone:'ステージを選んでください', stageList:'ステージリスト',
    selectAll:'全ステージを選ぶ', selectNone:'選択を解除', searchStages:'ステージを検索', searchStagesPlaceholder:'ステージ名・IDで検索',
    stageColumn:'ステージ', statusColumn:'クリア', itemsColumn:'取得アイテム',
    bulkTitle:'選んだステージをまとめて変更', bulkClear:'まとめてクリア判定', bulkClearKeep:'クリア判定を変えない', clear:'クリア', uncleared:'未クリア',
    bulkRelic:'まとめてレリック', bulkRelicKeep:'レリックを変えない', none:'なし', relic:'レリック',
    applyBulk:'選択したステージに適用', allItems:'それぞれで取れる収集物を全部入手',
    akuStageList:'アクアクのステージリスト', noAkuMatches:'一致するステージがありません。',
    akuReset:'アクアク設定を全て初期化', akuResetConfirm:'アクアク設定を全て初期化します。よろしいですか？',
    searchAku:'アクアク設定を検索', searchAkuPlaceholder:'ステージ名・チェックポイント名で検索',
    spawn:'初期アクアク', checkpoints:'チェックポイント（{count}）', masks:'{count}枚', noCheckpoints:'このステージにはチェックポイントの記録がありません。',
    changes:'変更 {count} 件', newLabel:'新規', blankMessage:'ライフ4で空の進行状態を作りました。Life_Countなどは自由に変更できます。',
    readMessage:'セーブを読み取りました。', recorded:'変更を記録しました。「.sav を保存」で書き出せます。',
    resetMessage:'変更をもどしました。',
    downloadMessage:'セーブをダウンロードしました。ゲームで使うときは元のファイル名にしてください。',
    akuResetMessage:'全ステージ・全チェックポイントのアクアク設定を0枚にしました。', selectedCount:'{count} ステージ',
    noCuts:'このセーブには名前つきのカットシーンフラグがありません。', noShared:'共通して取れる収集物はありません。各ステージの「全部入手」は使えます。',
    noItems:'このステージには収集物がありません。', clearCount:'クリア回数', trials:'タイムトライアル / m:ss:cc・英字3文字',
    importedFlags:'元のデータに、このステージで取れないフラグがあります。元の値は保持しています。',
    selectStage:'{id} を一括変更に選択', batchFlag:'まとめて {name}', openStage:'{name} を表示',
    stageClear:'{id} クリア判定', trialTime:'{id} タイム{count}', trialName:'{id} 名前{count}',
    akuChoice:'{name}：{masks}', unknownGame:'ゲームの種類を判別できません。',
    calculation:'{percent}% / 進行先の番号 {farthest} / ステージ {cleared} / ボス {bosses} / レリック {relCount}',
    secretResult:' / 隠しワープルーム {secretCount}', relicResult:' / レリックの追加 {relicBonus}%', calculationDone:'。合計と進行番号を更新しました。',
    missingRecord:'この設定の記録が見つかりません。', keep:'変更しない', collected:'入手', uncollected:'未入手'
  };
  const dictionaries = {ja,en};
  const FLOAT_INPUT_LIMITS = {min:-9999999,max:9999999,step:'1'};
  const DISPLAY_NAMES = {
    Percent_Complete:['Progress','進行度'], Life_Count:['Live','ライフの数'], Key_Count:['Keys','鍵の数'],
    Gem_Count:['Gems','ダイヤの数'], Sapphire_Count:['Sapphire Relics','サファイアレリックの数'],
    Gold_Count:['Gold Relics','ゴールドレリックの数'], Platinum_Count:['Platinum Relics','プラチナレリックの数'],
    Crystal_Count:['Crystals','パワーストーンの数'], Story_Completed:['Story Completed','ストーリーをクリアしたか'],
    Gem_Blue:['Blue Gem','青ダイヤ'], Gem_Red:['Red Gem','赤ダイヤ'], Gem_Green:['Green Gem','緑ダイヤ'],
    Gem_Yellow:['Yellow Gem','黄色ダイヤ'], Gem_Purple:['Purple Gem','紫ダイヤ'], Gem_Orange:['Orange Gem','オレンジダイヤ'],
    C2_SecretWarpRoom_Unlocked:['Secret Warp Room Unlocked','隠しワープルーム解放'],
    C2_AirCrash_Secret_Unlocked:['Secret Air Crash Unlocked','Air Crashの隠し入口解放'],
    C2_SnowGo_Secret_Unlocked:['Secret Snow Go Unlocked','Snow Goの隠し入口解放'],
    C2_RoadToRuin_Secret_Unlocked:['Secret Road to Ruin Unlocked','Road to Ruinの隠し入口解放'],
    C2_TotallyBear_Secret_Unlocked:['Secret Totally Bear Unlocked','Totally Bearの隠し入口解放'],
    C2_TotallyFly_Secret_Unlocked:['Secret Totally Fly Unlocked','Totally Flyの隠し入口解放'],
    Upgrade_SpeedShoesCrash2:['Speed Shoes (Crash 2)','スピードシューズ (クラッシュ2)'],
    Upgrade_SuperChargedBodySlam:['Super Charged Body Slam','スーパーボディプレス'],
    Upgrade_DoubleJump:['Double Jump','ダブルジャンプ'], Upgrade_DeathTornadoSpin:['Death Tornado Spin','竜巻スピンアタック'],
    Upgrade_FruitBazooka:['Fruit Bazooka','リンゴバズーカ'], Upgrade_SpeedShoes:['Speed Shoes','スピードシューズ'],
    KeyTotal:['Total Keys','鍵の合計数'], C1_StormyAscentRevealed:['C1 Stormy Ascent Revealed','C1 Stormy Ascentを明らかにする'],
    C2_BossCortexDefeated:['C2 Boss Cortex Defeated','C2 コルテックスを倒した'],
    CocoUnlockedC1:['C1 Coco Unlocked','C1 ココに変更可能'], CocoUnlockedC2:['C2 Coco Unlocked','C2 ココに変更可能'],
    CocoUnlockedC3:['C3 Coco Unlocked','C3 ココに変更可能'],
    Key:['Key','鍵'], Boss:['Boss','ボス'],
    Crystal:['Crystal','パワーストーン'], Clear_Gem:['Clear Gem','クリアダイヤ'], Extra_Gem:['Extra Gem','エクストラダイヤ'],
    Blue_Gem:['Blue Gem','青ダイヤ'], Red_Gem:['Red Gem','赤ダイヤ'], Green_Gem:['Green Gem','緑ダイヤ'],
    Yellow_Gem:['Yellow Gem','黄色ダイヤ'], Purple_Gem:['Purple Gem','紫ダイヤ'], Orange_Gem:['Orange Gem','オレンジダイヤ'],
    Sapphire:['Sapphire','サファイア'], Gold:['Gold','ゴールド'], Platinum:['Platinum','プラチナ'],
    BaseFireworksRewarded:['Base Fireworks Rewarded','完全クリア達成時の花火']
  };
  function text(lang,key,values={}) {
    const template = dictionaries[lang]?.[key];
    if(template===undefined)throw new Error(`Unknown display string: ${lang}.${key}`);
    return template.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??`{${name}}`));
  }
  function itemName(name) {return name.split('_').map(s=>s[0].toUpperCase()+s.slice(1)).join('_');}
  function displayName(lang,name) {const labels=DISPLAY_NAMES[name]||DISPLAY_NAMES[itemName(name)];return labels?labels[lang==='ja'?1:0]:itemName(name);}
  function eventName(name,lang='en') {
    const percent={OneZeroOneRewarded:101,OneZeroTwoRewarded:102,OneZeroFourRewarded:104}[name];
    if(percent)return `${percent}% ${lang==='ja'?'達成':'Rewarded'}`;
    if(name==='OneHundredCortexBeat')return '100%CortexBeat';
    return DISPLAY_NAMES[name]?displayName(lang,name):name;
  }
  function eventOrder(game,name) {
    const order={1:['OneZeroTwoRewarded','OneZeroFourRewarded'],2:['OneZeroOneRewarded','OneZeroTwoRewarded','BaseFireworksRewarded'],3:['OneHundredCortexBeat','BaseFireworksRewarded']}[game]||[];
    const index=order.indexOf(name);return index<0?order.length:index;
  }
  function itemEntries(bits) {return Object.entries(bits).sort(([a],[b])=>a==='crystal'?-1:b==='crystal'?1:0);}
  function itemStatus(mask,bits,relic=0) {
    const codes=[['crystal','C'],['clear_gem','G'],['extra_gem','G2'],['blue_gem','BG'],['red_gem','RG'],['green_gem','GG'],['yellow_gem','YG'],['purple_gem','PG'],['orange_gem','OG'],['key','K']];
    const items=codes.filter(([name])=>mask&bits[name]).map(([,code])=>code);
    if(mask&(bits.sapphire|bits.gold|bits.platinum)||[1,2,3].includes(relic))items.push('R');
    return items.join(' · ')||'-';
  }
  function stageName(id,names) {const key=id.toLowerCase();return `${key.toUpperCase()} - ${names[key] || id}`;}
  function cutsceneName(name) {return name.replace(/\s+\([^)]*\)\s*$/,'');}
  function checkpointName(label,withSource=false) {
    const raw=label.split(' (archetype')[0],dot=raw.indexOf('.'),name=dot<0?raw:raw.slice(dot+1);
    if(!withSource||dot<0)return name;
    const namespace=raw.slice(0,dot),source=namespace.split('_').slice(2).join('_')||namespace;
    return `${name} · ${source}`;
  }
  function masks(lang,count) {const label=text(lang,'masks',{count});return lang==='en'&&count===1?label.replace('masks','mask'):label;}
  function akuTier(value) {return value>=12?2:value>=6?1:0;}
  function akuValue(tier) {if(![0,1,2].includes(tier))throw new Error('Invalid Aku Aku tier');return [0,6,12][tier];}
  function applyTranslations(document,lang) {
    for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=text(lang,node.dataset.i18n);
    for(const node of document.querySelectorAll('[data-i18n-aria]'))node.setAttribute('aria-label',text(lang,node.dataset.i18nAria));
    for(const node of document.querySelectorAll('[data-i18n-placeholder]'))node.setAttribute('placeholder',text(lang,node.dataset.i18nPlaceholder));
    for(const node of document.querySelectorAll('[data-item-name]'))node.textContent=displayName(lang,node.dataset.itemName);
  }
  return {dictionaries,FLOAT_INPUT_LIMITS,text,itemName,displayName,eventName,eventOrder,itemEntries,itemStatus,stageName,cutsceneName,checkpointName,masks,akuTier,akuValue,applyTranslations};
});
