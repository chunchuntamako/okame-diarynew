import React, { useState, useEffect, useContext, createContext } from 'react';
import { Camera, Mic, Sparkles, Weight, ChevronLeft, PenLine, Check, Sun, BookOpen, Feather, Bird, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ---- Supabase接続 ---- */
const SUPABASE_URL = 'https://wqjzeewsitghgvfsxskv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AlGNwi1FHnqBWvKWAlqFqQ_t1cYVoiD';

async function supabaseSelect(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

const BirdContext = createContext(null);
function useBird() {
  return useContext(BirdContext);
}

function BirdProvider({ children }) {
  const [bird, setBird] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    supabaseSelect('bird', 'select=*&limit=1')
      .then((rows) => {
        if (cancelled) return;
        setBird(rows[0] || null);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  // Supabaseから取得できるまで／失敗時は、今まで通りの固定値でホームを表示できるようにフォールバックする
  const fallback = {
    name: 'ちゅんこ',
    baseline_weight: 90,
    danger_weight_high: 110,
    danger_weight_note: '記録を始める前、この体重の時に卵づまりで倒れたことがあります',
  };
  const value = { bird: bird || fallback, status };

  return <BirdContext.Provider value={value}>{children}</BirdContext.Provider>;
}

/* ---- モックデータ ---- */

const WEIGHT_DATA = [
  { d: '7/9', w: 91.6 }, { d: '7/10', w: 90.8 }, { d: '7/11', w: 89.9 },
  { d: '7/12', w: 89.1 }, { d: '7/13', w: 88.0 }, { d: '7/14', w: 86.5 }, { d: '7/15', w: 86.2 },
];
const TODAY_WEIGHT = WEIGHT_DATA[WEIGHT_DATA.length - 1].w;

// コールドスタート対策：種の平均ベースライン ⇄ 本人のベースライン を記録日数に応じてブレンドする
const SPECIES_BASELINE = 95; // オカメインコの一般的な適正体重（80〜110gの中央値）
const PERSONAL_BASELINE = 90; // この子のベスト体重（飼い主が判断した理想値。将来的にはプロフィール画面で自分で設定・編集できるようにする）
const BLEND_DAYS = 30; // この日数で完全に本人基準へ移行

// ベースラインからの変動率で判定（固定グラム数ではなく%にするのは、
// 個体差が大きい種（華奢75g〜がっしり120g）でも同じ基準で使えるようにするため）
const CAUTION_GRAMS = 3; // ベースライン±3gを超えたら注意

// AIコメント機能のON/OFFフラグ。ANTHROPIC_API_KEYの設定が済むまではfalseにしておく
// （trueに変えるだけで「教えてピポ鳥博士」機能が有効になる）
const AI_COMMENT_ENABLED = false;
const WARN_RATIO = 0.20; // ゲージ表示の両端（±20%）※表示用のスケールのみ、判定には使わない

// 歴代最高・最低・危険ラインは判定には使わず、参考情報として表示するだけ
const PERSONAL_MAX = 98.3; // 健康時の歴代最高（記録より）
const PERSONAL_MIN = 82.3; // 歴代最低（記録より）
const DANGER_HIGH = { weight: 110, label: '卵づまりで倒れた時の体重', note: '記録を始める前、この体重の時に卵づまりで倒れたことがあります' };

// 生態サイクル：種の一般論 ⇄ この子自身の検出パターン を記録年数に応じて移行する
const SPECIES_CYCLE = [
  { season: '春（3〜5月）', note: '発情期・換羽期になりやすい時期（一般論）' },
  { season: '秋（9〜11月）', note: '発情期・換羽期になりやすい時期（一般論）' },
];
const SPECIES_CYCLE_CAVEAT = '室内飼育は温度・日照が一定なため、季節に関係なく崩れやすいとされています';
const YEARS_RECORDED = 1.1; // 記録が始まってからの年数（2025-06-08〜）
const CYCLE_CONFIDENCE_YEARS = 2; // このくらいで「この子の傾向」の確度が上がる
const PERSONAL_CYCLE_DETECTED = { period: '6月下旬〜7月', pattern: '換羽（羽が抜ける）の記述が集中', cyclesObserved: 1 };

const PHOTO_TONES = [
  'linear-gradient(150deg,#F2C14E,#E2703A)',
  'linear-gradient(150deg,#9BB08C,#5F7A52)',
  'linear-gradient(150deg,#E8B4A0,#C97B5B)',
  'linear-gradient(150deg,#D9CBAE,#A79571)',
];

const PREVIOUS_ENTRY = { date: '7/14', text: '夜はまだ少し肌寒いかな。よく食べてよく寝てた' };
const ENERGY_CHIPS = ['元気いっぱい', 'いつも通り', '少し静か', '気になる'];
const APPETITE_CHIPS = ['よく食べた', '普通', '少なかった'];

const MEMORY_TIERS = [
  { id: 'week', label: '1週間前', days: 7, date: '7/8', note: 'おやつをよく欲しがる', photo: PHOTO_TONES[2] },
  { id: 'month', label: '1ヶ月前', days: 30, date: '6/15', note: 'ままちゃんがいなくて寂しそうだった', photo: PHOTO_TONES[1] },
  { id: 'quarter', label: '3ヶ月前', days: 90, date: '4/16', note: 'いつもと違う部屋にだいぶ慣れたよ', photo: PHOTO_TONES[3] },
  { id: 'half', label: '半年前', days: 180, date: '1/16', note: 'おひっこし直後、新しいおうちにドキドキ', photo: PHOTO_TONES[0] },
  { id: 'year', label: '1年前', days: 365, date: '2025/7/15', note: '暑い日、水浴びをよくした', photo: PHOTO_TONES[1] },
];
const DAYS_RECORDED = 210;

/* ---- 部品 ---- */

function PunchHoles() {
  return (
    <div className="punch">
      <span /><span /><span />
    </div>
  );
}

function KirieCockatiel() {
  return (
    <svg viewBox="0 0 140 110" className="kirie-svg">
      <line x1="14" y1="94" x2="126" y2="94" className="kirie-branch" />
      <path d="M46 92 C34 78 32 54 48 40 C56 32 74 30 86 38 C100 46 106 66 98 82 C92 92 78 96 62 95 C56 95 50 94 46 92 Z" className="kirie-body" />
      <path d="M96 78 C112 80 122 86 128 92 C116 92 104 90 94 86 Z" className="kirie-tail" />
      <path d="M50 52 C46 66 48 80 60 90 C56 76 56 62 62 50 Z" className="kirie-wing" />
      <path d="M60 40 C58 26 66 14 80 10 C74 20 74 28 78 36 C82 30 90 26 98 26 C90 34 86 40 86 46 C78 34 66 34 60 40 Z" className="kirie-crest" />
      <circle cx="80" cy="46" r="8" className="kirie-cheek" />
      <circle cx="82" cy="40" r="3" className="kirie-eye" />
      <path d="M96 42 L110 46 L96 50 Z" className="kirie-beak" />
      <line x1="58" y1="92" x2="58" y2="98" className="kirie-leg" />
      <line x1="70" y1="93" x2="70" y2="99" className="kirie-leg" />
    </svg>
  );
}

/* ---- 今日の記録（専用画面） ---- */

// 日替わりローテーション（ナビ設計）: 曜日ごとに聞くカテゴリと選択肢
const ROTATION_CHIPS = {
  'うんち': ['いつも通り', '少ない', '大きい', '色が違う'],
  '行動': ['いつも通り', '甘える', '静か', '落ち着かない'],
  '呼吸': ['普通', '気になる', '音がある'],
  '保温': ['快適そう', '膨らむ', '寒そう'],
  '発情': ['隙間探し', '巣探し', '吐き戻し', '甘え方変化'],
};
const ROTATION_SCHEDULE = {
  1: ['うんち'],       // 月
  2: ['行動'],         // 火
  3: ['呼吸'],         // 水
  4: ['うんち'],       // 木
  5: ['保温'],         // 金
  6: ['行動', '発情'], // 土
  0: [],               // 日（AI判断枠・ローテーションなし）
};

// ---- Safety Layer（安全装置）----
// AIより先に動く「最後の砦」。該当したらAIの判断を待たず、必ず受診を促す（ナビ設計）
const SAFETY_SIGNALS = [
  '出血している',
  'うんちが出ていない',
  '呼吸がおかしい（音・苦しそう）',
  'うずくまって動かない',
  '長時間ご飯を食べていない',
];

// ---- AIへ渡す傾向データ（細かい分岐はアプリ側で持たず、傾向だけ計算してAIに任せる）----
function computeWeightTrend(currentWeight, history) {
  if (!history || history.length === 0) return currentWeight ? `今日の体重: ${currentWeight}g（過去データなし）` : '体重データなし';
  const first = history[0].w;
  const last = history[history.length - 1].w;
  const diff = (last - first).toFixed(1);
  const days = history.length;
  const dir = diff > 0 ? '増加' : diff < 0 ? '減少' : '横ばい';
  const todayPart = currentWeight ? `、今日の入力値は${currentWeight}g` : '';
  return `直近${days}日間で${Math.abs(diff)}g${dir}（${history[0].d}: ${first}g → ${history[history.length - 1].d}: ${last}g）${todayPart}`;
}

// 注: このアーティファクトのプレビュー内では、Supabaseなど外部サービスへの直接fetchが
// サンドボックスの都合でブロックされる可能性がある。実際にデプロイした環境では動作する想定。
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/pipo-comment`;

// APIキーはEdge Function側（サーバー）にだけ置く。クライアントはbirdIdと今日の入力を渡すだけ
async function callPipoComment({ bird, weight, energy, appetite, rotationAnswers, ownerComment }) {
  let response;
  try {
    response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ birdId: bird.id, weight, energy, appetite, rotationAnswers, ownerComment }),
    });
  } catch (e) {
    throw new Error(`Edge Functionへの通信に失敗: ${e.message}`);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Edge Function応答エラー(${response.status}): ${data?.error || JSON.stringify(data)}`);
  }
  if (!data.comment) throw new Error(`応答は届いたが本文が空でした: ${JSON.stringify(data).slice(0, 200)}`);
  return data.comment;
}

function RecordScreen({ initial, onSave, onBack }) {
  const { bird } = useBird();
  const [photo, setPhoto] = useState(initial?.photo || null);
  const [weight, setWeight] = useState(initial?.weight || '');
  const [energy, setEnergy] = useState(initial?.energy || null);
  const [appetite, setAppetite] = useState(initial?.appetite || null);
  const [rotationAnswers, setRotationAnswers] = useState(initial?.rotationAnswers || {});
  const [ownerComment, setOwnerComment] = useState(initial?.text || '');
  const [aiComment, setAiComment] = useState(initial?.aiComment || '');
  const [aiCommentSource, setAiCommentSource] = useState(null); // 'cached' | 'generated'
  const [aiState, setAiState] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [showPrev, setShowPrev] = useState(false);
  const [voice, setVoice] = useState(false);

  const todayCategories = ROTATION_SCHEDULE[new Date().getDay()] || [];
  const setRotationAnswer = (cat, val) => setRotationAnswers((r) => ({ ...r, [cat]: val }));

  // Safety Layer: 命に関わるサインは、AIより先にここで機械的に判定する
  const [safetySignals, setSafetySignals] = useState(initial?.safetySignals || []);
  const toggleSafetySignal = (s) => setSafetySignals((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const hasSafetyAlert = safetySignals.length > 0;

  const weightTrend = computeWeightTrend(weight, WEIGHT_DATA);

  const [aiError, setAiError] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedLogId, setSavedLogId] = useState(null);

  const persistToSupabase = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const rotCat = Object.keys(rotationAnswers)[0] || null;
    const rows = await supabaseInsert('daily_logs', {
      bird_id: bird.id,
      log_date: today,
      owner_comment: ownerComment || null,
      ai_comment: aiComment || null,
      weight_g: weight === '' ? null : Number(weight),
      energy_level: energy,
      appetite: appetite,
      rotation_category: rotCat,
      rotation_answer: rotCat ? rotationAnswers[rotCat] : null,
      alert_signals: hasSafetyAlert ? safetySignals : null,
    });
    if (rows && rows[0]) setSavedLogId(rows[0].id);
  };

  const handleSaveClick = async () => {
    setSaveError('');
    try {
      await persistToSupabase();
      setHasSaved(true);
    } catch (e) {
      setSaveError(e.message || String(e));
    }
  };

  // 「1日1回生成・保存・再利用」方針: 今日すでにai_commentがあれば、それを読み込んで使い回す
  useEffect(() => {
    if (!bird?.id || !AI_COMMENT_ENABLED) return;
    const today = new Date().toISOString().slice(0, 10);
    supabaseSelect('daily_logs', `select=id,ai_comment&bird_id=eq.${bird.id}&log_date=eq.${today}&limit=1`)
      .then((rows) => {
        if (rows && rows[0]) {
          setSavedLogId(rows[0].id);
          if (rows[0].ai_comment) {
            setAiComment(rows[0].ai_comment);
            setAiCommentSource('cached');
            setAiState('done');
          }
        }
      })
      .catch(() => {}); // 取得できなければ通常通り新規生成に進む
  }, [bird?.id]);

  const handleGenerateComment = async () => {
    setAiState('loading');
    setAiError('');
    try {
      const result = await callPipoComment({ bird, weight, energy, appetite, rotationAnswers, ownerComment });
      setAiComment(result);
      setAiCommentSource('generated');
      setAiState('done');
      if (savedLogId) {
        supabaseUpdate('daily_logs', savedLogId, { ai_comment: result }).catch(() => {});
      }
    } catch (e) {
      setAiError(e.message || String(e));
      setAiState('error');
    }
  };

  return (
    <div className="screen">
      <div className="record-head">
        <button className="back-btn" onClick={onBack} aria-label="戻る"><ChevronLeft size={20} /></button>
        <div>
          <span className="eyebrow">7月15日（水）</span>
          <h1>今日を記録</h1>
        </div>
      </div>

      <div className="ruled-card today-card">
        <PunchHoles />
        <div className="ruled-card-body">
          <button className="photo-well photo-well-lg" onClick={() => setPhoto((p) => (p ? null : PHOTO_TONES[0]))}>
            {photo ? (
              <div className="photo-well-img" style={{ background: photo }}>
                <span className="photo-well-tag">今日撮った1枚</span>
              </div>
            ) : (
              <div className="photo-well-empty">
                <KirieCockatiel />
                <span><Camera size={13} strokeWidth={2.2} /> タップして今日の写真を追加</span>
              </div>
            )}
          </button>

          <div className="safety-block">
            <span className="field-label safety-label"><AlertTriangle size={12} strokeWidth={2.4} /> 気になるサインはありますか？（該当すれば選択）</span>
            <div className="chip-row">
              {SAFETY_SIGNALS.map((s) => (
                <button key={s} className={`mini-chip mini-chip-safety ${safetySignals.includes(s) ? 'is-active' : ''}`}
                  onClick={() => toggleSafetySignal(s)}>{s}</button>
              ))}
            </div>
            {hasSafetyAlert ? (
              <div className="safety-alert">
                <AlertTriangle size={14} strokeWidth={2.6} />
                <p>{safetySignals.join('・')}が見られます。念のため、早めに鳥を診られる病院へ相談してください。</p>
              </div>
            ) : null}
          </div>

          <div className="today-text-row">
            <input type="text" placeholder="飼い主メモ（空欄でもOK）" value={ownerComment} onChange={(e) => setOwnerComment(e.target.value)} />
            <button className={`icon-pill ${voice ? 'is-active' : ''}`} onClick={() => setVoice((v) => !v)} aria-label="音声で入力">
              <Mic size={15} strokeWidth={2.2} />
            </button>
          </div>

          <label className="weight-input-row">
            <span className="field-label"><Weight size={12} strokeWidth={2.4} /> 体重(g)</span>
            <input type="number" step="0.1" inputMode="decimal" placeholder="例）90.0"
              value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>

          <div className="chip-row">
            {ENERGY_CHIPS.map((c) => (
              <button key={c} className={`mini-chip ${energy === c ? 'is-active' : ''}`} onClick={() => setEnergy(c)}>{c}</button>
            ))}
            {APPETITE_CHIPS.map((c) => (
              <button key={c} className={`mini-chip mini-chip-alt ${appetite === c ? 'is-active' : ''}`} onClick={() => setAppetite(c)}>{c}</button>
            ))}
          </div>

          {todayCategories.map((cat) => (
            <div className="rotation-block" key={cat}>
              <span className="field-label">今日のプラス1問: {cat}</span>
              <div className="chip-row">
                {ROTATION_CHIPS[cat].map((c) => (
                  <button key={c} className={`mini-chip mini-chip-rotation ${rotationAnswers[cat] === c ? 'is-active' : ''}`}
                    onClick={() => setRotationAnswer(cat, c)}>{c}</button>
                ))}
              </div>
            </div>
          ))}

          {showPrev ? (
            <p className="prev-entry-hint">前回（{PREVIOUS_ENTRY.date}）: {PREVIOUS_ENTRY.text}</p>
          ) : (
            <button className="prev-entry-toggle" onClick={() => setShowPrev(true)}>前回の記録を見る</button>
          )}

          {!hasSaved ? (
            <>
              <button className="btn-primary btn-block" onClick={handleSaveClick}>
                <Check size={15} strokeWidth={2.6} /> 記録する
              </button>
              {saveError ? <span className="ai-error-note">保存できませんでした: {saveError}</span> : null}
            </>
          ) : (
            <>
              <div className="saved-confirm">
                <Check size={14} strokeWidth={2.8} /> 記録しました
              </div>

              {AI_COMMENT_ENABLED ? (
                <div className="ai-comment-section">
                  <button className="ai-generate-btn" onClick={handleGenerateComment} disabled={aiState === 'loading'}>
                    <Bird size={13} strokeWidth={2.4} />
                    {aiState === 'loading' ? 'ピポ鳥博士が考え中…' : aiComment ? 'もう一度教えてピポ鳥博士' : '教えてピポ鳥博士'}
                  </button>
                  {aiComment ? (
                    <div className="ai-comment-bubble ai-comment-ok">
                      <Bird size={13} strokeWidth={2.4} />
                      <p>{aiComment}</p>
                    </div>
                  ) : null}
                  {aiCommentSource === 'cached' ? <span className="ai-cached-note">※今日はもう聞いています（もう一度押すと聞き直せます）</span> : null}
                  {aiState === 'error' ? <span className="ai-error-note">うまく生成できませんでした: {aiError}</span> : null}
                </div>
              ) : null}

              <button className="btn-primary btn-block"
                onClick={() => onSave({ photo, weight, energy, appetite, rotationAnswers, text: ownerComment, aiComment, safetySignals })}>
                ホームに戻る
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- AIコメントカード（仮実装：体重・うんち・行動をまとめた「今日のひとこと」） ---- */
const AI_COMMENT_DEMO = {
  ok: {
    summary: [
      { label: '体重', value: '92g（安定）' },
      { label: 'うんち', value: 'いつもの状態' },
      { label: '行動', value: 'いつも通り' },
    ],
    comment: '特に大きな変化はありません。いつもの記録を続けていきましょう😊',
    tone: 'ok',
  },
  caution: {
    summary: [
      { label: '体重', value: '89g（やや減少）' },
      { label: 'うんち', value: '普段通り' },
      { label: '行動', value: '少し静か' },
    ],
    comment: '体重が少し減っていますね。換羽期にはよく見られる変化です。あと2〜3日一緒に様子を見ていきましょう。',
    tone: 'warn',
  },
  danger: {
    summary: [
      { label: '体重', value: '84g（急な減少）' },
      { label: 'うんち', value: '出ていない' },
      { label: '行動', value: 'うずくまっている' },
    ],
    comment: '気になる変化が重なっています。念のため早めに、鳥を診られる病院へ相談することをおすすめします。',
    tone: 'danger',
  },
};

function AIDailyComment() {
  const [demo, setDemo] = useState('ok');
  const d = AI_COMMENT_DEMO[demo];
  return (
    <div className="ai-comment-card">
      <div className="ai-comment-summary">
        {d.summary.map((s) => (
          <span key={s.label} className="ai-summary-chip"><strong>{s.label}</strong>{s.value}</span>
        ))}
      </div>
      <div className={`ai-comment-bubble ai-comment-${d.tone}`}>
        <Sparkles size={13} strokeWidth={2.4} />
        <p>{d.comment}</p>
      </div>
      <div className="mode-demo">
        <span className="mode-demo-label">▼ 確認用: パターンを見比べる（仮実装）</span>
        <div className="mode-demo-chips">
          <button className={demo === 'ok' ? 'is-active' : ''} onClick={() => setDemo('ok')}>通常</button>
          <button className={demo === 'caution' ? 'is-active' : ''} onClick={() => setDemo('caution')}>注意</button>
          <button className={demo === 'danger' ? 'is-active' : ''} onClick={() => setDemo('danger')}>危険</button>
        </div>
      </div>
    </div>
  );
}

/* ---- ホーム用: 今日の状態サマリー／誘導カード ---- */

function TodayStatusCard({ record, onOpenRecord }) {
  const { bird } = useBird();
  if (!record) {
    return (
      <button className="ruled-card today-prompt" onClick={onOpenRecord}>
        <PunchHoles />
        <div className="ruled-card-body today-prompt-body">
          <div className="photo-well-empty today-prompt-illust">
            <KirieCockatiel />
          </div>
          <div className="today-prompt-text">
            <span className="eyebrow">今日はまだ</span>
            <p className="lyt-locked-title">{bird.name}の今日を記録する</p>
            <span className="today-prompt-sub">写真・気分・ひとこと、どれか1つでOK</span>
          </div>
        </div>
      </button>
    );
  }

  const energyMeta = record.energy;
  const appetiteMeta = record.appetite;

  return (
    <div className="ruled-card today-done">
      <PunchHoles />
      <div className="ruled-card-body">
        <div className="today-done-row">
          {record.photo ? (
            <div className="polaroid polaroid-sm today-done-photo"><div className="polaroid-photo" style={{ background: record.photo }} /></div>
          ) : (
            <div className="today-done-noPhoto"><KirieCockatiel /></div>
          )}
          <div className="today-done-text">
            <span className="eyebrow">今日は記録済み</span>
            <div className="chip-row">
              {energyMeta ? <span className="mini-chip is-active">{energyMeta}</span> : null}
              {appetiteMeta ? <span className="mini-chip mini-chip-alt is-active">{appetiteMeta}</span> : null}
            </div>
            {record.text ? <p className="today-done-note">{record.text}</p> : null}
          </div>
        </div>
        <button className="prev-entry-toggle today-edit-btn" onClick={onOpenRecord}><PenLine size={11} strokeWidth={2.4} /> 編集する</button>
      </div>
    </div>
  );
}

/* ---- 体重（文脈を1つのブロックに統一） ---- */

function blendRange(recordedDays, personalBaseline) {
  const t = Math.min(1, recordedDays / BLEND_DAYS);
  const baseline = SPECIES_BASELINE + (personalBaseline - SPECIES_BASELINE) * t;
  return { baseline, t };
}

// 生態サイクルは画面には出さず、警告メッセージのトーン調整だけに裏側で使う（レイヤー2＝Knowledge Layer）
const CURRENT_MONTH = 7;
function seasonContext(direction) {
  // direction: 'down'（体重減少・換羽期と一致するか） / 'up'（体重増加・発情期と一致するか）
  if (direction === 'down') {
    // 本人検出パターン（6月下旬〜7月）を優先。確度が低いうちは種の一般論（春3-5・秋9-11）も見る
    const matchesPersonal = CURRENT_MONTH === 6 || CURRENT_MONTH === 7;
    const matchesSpecies = [3, 4, 5, 9, 10, 11].includes(CURRENT_MONTH);
    return { matches: matchesPersonal || matchesSpecies, label: '換羽期' };
  }
  const matchesSpecies = [3, 4, 5, 9, 10, 11].includes(CURRENT_MONTH);
  return { matches: matchesSpecies, label: '発情期' };
}

function WeightGauge() {
  const { bird, status: birdStatus } = useBird();
  const dangerWeight = Number(bird.danger_weight_high);
  const dangerNote = bird.danger_weight_note;
  const [demoDays, setDemoDays] = useState(210);
  const { baseline, t } = blendRange(demoDays, Number(bird.baseline_weight));

  const yesterday = WEIGHT_DATA[WEIGHT_DATA.length - 2].w;
  const devToday = TODAY_WEIGHT - baseline;
  const devYesterday = yesterday - baseline;
  const streakHigh = devToday >= CAUTION_GRAMS && devYesterday >= CAUTION_GRAMS;
  const streakLow = devToday <= -CAUTION_GRAMS && devYesterday <= -CAUTION_GRAMS;
  const rapidChange = Math.abs(TODAY_WEIGHT - yesterday) >= 5; // 2日で5g以上
  const dangerNear = TODAY_WEIGHT >= dangerWeight - 5;

  let status = { label: '通常の範囲', tone: 'ok' };
  if (dangerNear || rapidChange) {
    status = { label: '体重の変化が大きく出ています。念のため早めに鳥を診られる病院へ相談することをおすすめします。', tone: 'danger' };
  } else if (streakHigh) {
    const s = seasonContext('up');
    status = s.matches
      ? { label: `体重が少し増えていますね。${s.label}にはよくある変化です。おもちゃや布を隠す・日照時間を短くするなど、いつもの対策をしてみましょう。`, tone: 'warn-high' }
      : { label: '体重が少し増えていますね。もう少し様子を見ながら記録を続けましょう。', tone: 'warn-high' };
  } else if (streakLow) {
    const s = seasonContext('down');
    status = s.matches
      ? { label: `体重が少し減っていますね。${s.label}にはよく見られる変化です。あと2〜3日一緒に様子を見ていきましょう。`, tone: 'warn-low' }
      : { label: '体重が少し減っていますね。もう少し様子を見ながら記録を続けましょう。', tone: 'warn-low' };
  }

  // バーは最低〜危険ラインを表示範囲にする（判定には使わない、見た目のみ）
  const trackMin = PERSONAL_MIN;
  const trackMax = dangerWeight;
  const pct = (w) => Math.min(100, Math.max(0, ((w - trackMin) / (trackMax - trackMin)) * 100));

  return (
    <div className="gauge-block">
      <div className="gauge-source">
        {birdStatus === 'loading' ? (
          <span>ちゅんこのデータを読み込み中…</span>
        ) : t < 1 ? (
          <span>種の平均を参考にしています · あと{Math.max(0, BLEND_DAYS - demoDays)}日でこの子だけの基準に</span>
        ) : (
          <span className="gauge-source-done">この子だけの基準（実測平均）</span>
        )}
      </div>

      <div className="gauge-track gauge-track-zoned">
        <span className="gauge-num gauge-num-edge" style={{ left: `${pct(PERSONAL_MIN)}%` }}>{PERSONAL_MIN}</span>
        <span className="gauge-num gauge-num-base" style={{ left: `${pct(baseline)}%` }}>{baseline.toFixed(1)}</span>
        <span className="gauge-num gauge-num-edge" style={{ left: `${pct(PERSONAL_MAX)}%` }}>{PERSONAL_MAX}</span>
        <span className="gauge-num gauge-num-danger" style={{ left: `${pct(dangerWeight)}%` }}>{dangerWeight}</span>
        <span className="gauge-num gauge-num-today" style={{ left: `${pct(TODAY_WEIGHT)}%` }}>{TODAY_WEIGHT}</span>
        <span className="gauge-marker-dot" style={{ left: `${pct(TODAY_WEIGHT)}%` }} />
      </div>

      <span className={`gauge-status gauge-status-${status.tone}`}>{status.label}</span>

      <div className="mode-demo">
        <span className="mode-demo-label">▼ 確認用: 記録日数を変えてみる</span>
        <div className="mode-demo-chips">
          <button className={demoDays === 0 ? 'is-active' : ''} onClick={() => setDemoDays(0)}>0日目</button>
          <button className={demoDays === 15 ? 'is-active' : ''} onClick={() => setDemoDays(15)}>15日目</button>
          <button className={demoDays === 210 ? 'is-active' : ''} onClick={() => setDemoDays(210)}>210日目</button>
        </div>
      </div>
    </div>
  );
}

function WeightCard({ onSeeMore }) {
  return (
    <div className="ruled-card">
      <PunchHoles />
      <div className="ruled-card-body">
        <span className="field-label"><Weight size={12} strokeWidth={2.4} /> 体重</span>
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={WEIGHT_DATA} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8A8272' }} axisLine={false} tickLine={false} />
            <YAxis domain={[80, 'dataMax + 2']} tick={{ fontSize: 10, fill: '#8A8272' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}g`, '体重']} />
            <Line type="monotone" dataKey="w" stroke="#E2703A" strokeWidth={2.4} dot={{ r: 2.5, fill: '#E2703A' }} />
          </LineChart>
        </ResponsiveContainer>
        <WeightGauge />
        <button className="weight-more-link" onClick={onSeeMore}>もっと過去を見る（記録タブ）→</button>
      </div>
    </div>
  );
}

/* ---- 生態サイクル ---- */

function CyclePanel() {
  const { bird } = useBird();
  const t = Math.min(1, YEARS_RECORDED / CYCLE_CONFIDENCE_YEARS);
  const confidenceLabel = t < 0.6 ? 'まだ参考程度' : t < 1 ? '確度が上がってきています' : 'この子の傾向として信頼度高め';

  return (
    <div className="ruled-card">
      <PunchHoles />
      <div className="ruled-card-body">
        <span className="field-label"><Sparkles size={12} strokeWidth={2.4} /> 生態サイクル</span>

        <div className="cycle-species">
          <span className="cycle-species-title">種の一般論</span>
          {SPECIES_CYCLE.map((c) => (
            <div className="cycle-row" key={c.season}>
              <span className="cycle-season">{c.season}</span>
              <span className="cycle-note">{c.note}</span>
            </div>
          ))}
          <span className="cycle-caveat">※ {SPECIES_CYCLE_CAVEAT}</span>
        </div>

        <div className="cycle-personal">
          <span className="cycle-species-title">{bird.name}自身の検出パターン</span>
          <div className="cycle-row">
            <span className="cycle-season cycle-season-personal">{PERSONAL_CYCLE_DETECTED.period}</span>
            <span className="cycle-note">{PERSONAL_CYCLE_DETECTED.pattern}</span>
          </div>
          <span className="cycle-confidence">
            {confidenceLabel} · 観測{PERSONAL_CYCLE_DETECTED.cyclesObserved}周期分（あと{Math.max(0, CYCLE_CONFIDENCE_YEARS - YEARS_RECORDED).toFixed(1)}年で確度アップ）
          </span>
        </div>
      </div>
    </div>
  );
}

function MemoryStaircase() {
  const [demoIndex, setDemoIndex] = useState(2);
  const unlockedTiers = MEMORY_TIERS.filter((t) => t.days <= DAYS_RECORDED);
  const currentTier = unlockedTiers[demoIndex] || unlockedTiers[unlockedTiers.length - 1] || null;
  const nextTier = MEMORY_TIERS[MEMORY_TIERS.findIndex((t) => t.id === currentTier?.id) + 1];

  return (
    <div className="lyt-block">
      {currentTier ? (
        <div className="washi-card">
          <span className="washi-tape" />
          <div className="washi-card-row">
            <div className="polaroid polaroid-md">
              <div className="polaroid-photo" style={{ background: currentTier.photo }} />
            </div>
            <div className="washi-card-text">
              <span className="eyebrow">{currentTier.label}の記憶 · {currentTier.date}</span>
              <p>{currentTier.note}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="washi-card washi-card-locked">
          <span className="washi-tape washi-tape-locked" />
          <div className="lyt-locked-row">
            <div className="lyt-seal"><Sparkles size={20} strokeWidth={2} /></div>
            <div className="washi-card-text">
              <span className="eyebrow">最初の記憶までもうすぐ</span>
              <p className="lyt-locked-title">あと{MEMORY_TIERS[0].days - DAYS_RECORDED}日で「1週間前」が解放</p>
            </div>
          </div>
        </div>
      )}

      <div className="staircase">
        {MEMORY_TIERS.map((t) => {
          const unlocked = t.days <= DAYS_RECORDED;
          const isCurrent = currentTier?.id === t.id;
          return (
            <div key={t.id} className={`staircase-step ${unlocked ? 'is-unlocked' : ''} ${isCurrent ? 'is-current' : ''}`}>
              <span className="staircase-dot" />
              <span className="staircase-label">{t.label}</span>
            </div>
          );
        })}
      </div>
      {nextTier ? (
        <span className="lyt-progress-label">次は「{nextTier.label}」· あと{nextTier.days - DAYS_RECORDED}日</span>
      ) : currentTier ? (
        <span className="lyt-progress-label">すべての記憶を解放済み</span>
      ) : null}

      <button className="lyt-demo-toggle" onClick={() => setDemoIndex((i) => (i + 1) % Math.max(1, unlockedTiers.length))}>
        ▼ 確認用: 別の段階を見る
      </button>
    </div>
  );
}

/* ---- Supabase 書き込みヘルパー ---- */
async function supabaseInsert(table, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${res.status}`);
  return res.json();
}

async function supabaseUpdate(table, id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status}`);
  return res.json();
}

/* ---- タブバー ---- */
function TabBar({ tab, setTab, onOpenRecord }) {
  const leftTabs = [
    { id: 'home', label: 'ホーム', icon: Sun },
    { id: 'album', label: 'アルバム', icon: BookOpen },
  ];
  const rightTabs = [
    { id: 'log', label: '記録', icon: Feather },
    { id: 'profile', label: 'プロフィール', icon: Bird },
  ];
  const [sheetOpen, setSheetOpen] = useState(false);

  const quickActions = [
    { label: '写真', icon: Camera },
    { label: '音声', icon: Mic },
    { label: '体重', icon: Weight },
    { label: 'メモ', icon: PenLine },
  ];

  const openRecord = () => { setSheetOpen(false); onOpenRecord(); };

  return (
    <>
      {sheetOpen ? (
        <div className="quick-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="quick-sheet" onClick={(e) => e.stopPropagation()}>
            <span className="quick-sheet-title">何を記録する？</span>
            <div className="quick-sheet-grid">
              {quickActions.map((a) => (
                <button key={a.label} className="quick-sheet-item" onClick={openRecord}>
                  <a.icon size={20} strokeWidth={2} />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="tabbar tabbar-with-fab">
        {leftTabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={19} strokeWidth={tab === t.id ? 2.5 : 1.8} />
            <span>{t.label}</span>
          </button>
        ))}
        <button className="tab-fab" onClick={() => setSheetOpen(true)} aria-label="記録する">
          <span>＋</span>
        </button>
        {rightTabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={19} strokeWidth={tab === t.id ? 2.5 : 1.8} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

/* ---- アルバムタブ ---- */
const ALBUM_DEMO_PHOTOS = [
  { id: 'd1', photo_date: '2026-07-15', caption: '今日から夜タオルケットをかけて寝る', tone: PHOTO_TONES[0], is_milestone: false },
  { id: 'd2', photo_date: '2026-07-12', caption: 'おでかけ。暑くて新しい車でちょっと疲れる', tone: PHOTO_TONES[2], is_milestone: false },
  { id: 'd3', photo_date: '2026-07-06', caption: '中くらいの羽が1本抜けた', tone: PHOTO_TONES[0], is_milestone: false },
  { id: 'd4', photo_date: '2026-06-08', caption: 'お迎え1周年！', tone: PHOTO_TONES[1], is_milestone: true },
  { id: 'd5', photo_date: '2026-06-02', caption: 'いつもと違う部屋にだいぶ慣れたよ', tone: PHOTO_TONES[3], is_milestone: false },
  { id: 'd6', photo_date: '2026-05-20', caption: '初めておもちゃで遊んだ日', tone: PHOTO_TONES[2], is_milestone: true },
];

function groupPhotosByMonth(photos) {
  const groups = {};
  photos.forEach((p) => {
    const key = p.photo_date.slice(0, 7); // YYYY-MM
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function AlbumThrowback({ photos }) {
  const [pick, setPick] = useState(null);

  useEffect(() => {
    if (photos && photos.length > 0) {
      setPick(photos[Math.floor(Math.random() * photos.length)]);
    } else {
      setPick(null);
    }
  }, [photos]);

  if (!pick) return null;

  return (
    <div className="washi-card throwback-card">
      <span className="washi-tape" />
      <div className="washi-card-row">
        <div className="polaroid polaroid-md tilt-l">
          <div className="polaroid-photo" style={{ background: pick.tone || PHOTO_TONES[0] }} />
        </div>
        <div className="washi-card-text">
          <span className="eyebrow">今日のちゅんこ · {pick.photo_date.slice(5).replace('-', '/')}</span>
          <p>{pick.caption || 'この頃はこんな様子でした'}</p>
        </div>
      </div>
      <button className="lyt-demo-toggle throwback-shuffle" onClick={() => setPick(photos[Math.floor(Math.random() * photos.length)])}>
        🔀 別の1枚を見る
      </button>
    </div>
  );
}

function AlbumTab() {
  const { bird } = useBird();
  const [photos, setPhotos] = useState(null); // null=読込中
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (!bird?.id) return;
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; setPhotos([]); } }, 6000);
    supabaseSelect('photos', `select=*&bird_id=eq.${bird.id}&order=photo_date.desc`)
      .then((rows) => { if (!done) { done = true; clearTimeout(timeout); setPhotos(rows); } })
      .catch(() => { if (!done) { done = true; clearTimeout(timeout); setPhotos([]); } });
  }, [bird?.id]);

  const displayPhotos = showDemo ? ALBUM_DEMO_PHOTOS : photos;
  const isEmpty = displayPhotos && displayPhotos.length === 0;
  const grouped = displayPhotos && displayPhotos.length > 0 ? groupPhotosByMonth(displayPhotos) : [];

  return (
    <div className="screen">
      <header className="page-head">
        <span className="eyebrow">Album</span>
        <h1>{bird.name}の記録帳</h1>
      </header>

      {displayPhotos && displayPhotos.length > 0 ? <AlbumThrowback photos={displayPhotos} /> : null}

      {displayPhotos === null ? (
        <p className="muted">読み込み中…</p>
      ) : isEmpty ? (
        <div className="ruled-card">
          <PunchHoles />
          <div className="ruled-card-body album-empty">
            <KirieCockatiel />
            <p className="lyt-locked-title">まだ写真がありません</p>
            <span className="today-prompt-sub">ホームの「今日の1枚」から記録を始めると、少しずつここに貯まっていきます</span>
          </div>
        </div>
      ) : (
        <div className="album-months">
          {grouped.map(([month, items]) => (
            <div className="album-month-group" key={month}>
              <span className="album-month-label">{month.replace('-', '年')}月</span>
              <div className="album-grid">
                {items.map((p, i) => (
                  <div className={`polaroid polaroid-grid ${i % 2 === 0 ? 'tilt-l' : 'tilt-r'} ${p.is_milestone ? 'is-milestone' : ''}`} key={p.id}>
                    {p.is_milestone ? <span className="washi-tape album-tape" /> : null}
                    <div className="polaroid-photo" style={{ background: p.tone || PHOTO_TONES[0] }} />
                    <span className="polaroid-cap">{p.photo_date.slice(5).replace('-', '/')}</span>
                    {p.caption ? <p className="album-caption">{p.caption}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="lyt-demo-toggle album-demo-toggle" onClick={() => setShowDemo((v) => !v)}>
        ▼ 確認用: {showDemo ? '実データ表示に戻す' : '写真が貯まった見た目を確認'}
      </button>

      <MemoryStaircase />
    </div>
  );
}

/* ---- 記録タブ（過去の履歴） ---- */
function LogTab() {
  const { bird } = useBird();
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    if (!bird?.id) return;
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; setLogs([]); } }, 6000); // 6秒で応答なければ諦めて空表示に
    supabaseSelect('daily_logs', `select=*&bird_id=eq.${bird.id}&order=log_date.desc&limit=60`)
      .then((rows) => { if (!done) { done = true; clearTimeout(timeout); setLogs(rows); } })
      .catch(() => { if (!done) { done = true; clearTimeout(timeout); setLogs([]); } });
  }, [bird?.id]);

  const realWeights = logs ? logs.filter((l) => l.weight_g != null).map((l) => Number(l.weight_g)) : [];
  const hasRealWeights = realWeights.length > 0;
  const chartData = hasRealWeights
    ? [...logs].filter((l) => l.weight_g != null).reverse().map((l) => ({ d: l.log_date.slice(5).replace('-', '/'), w: Number(l.weight_g) }))
    : WEIGHT_DATA;
  const statMax = hasRealWeights ? Math.max(...realWeights) : null;
  const statMin = hasRealWeights ? Math.min(...realWeights) : null;
  const statAvg = hasRealWeights ? (realWeights.reduce((a, b) => a + b, 0) / realWeights.length).toFixed(1) : null;

  const monthGroups = logs && logs.length > 0
    ? Object.entries(
        logs.reduce((acc, l) => {
          const key = l.log_date.slice(0, 7);
          (acc[key] = acc[key] || []).push(l);
          return acc;
        }, {})
      ).sort((a, b) => (a[0] < b[0] ? 1 : -1))
    : [];

  return (
    <div className="screen">
      <header className="page-head">
        <span className="eyebrow">Log</span>
        <h1>記録の履歴</h1>
      </header>

      <div className="ruled-card">
        <PunchHoles />
        <div className="ruled-card-body">
          <span className="field-label"><Weight size={12} strokeWidth={2.4} /> 体重{hasRealWeights ? '（全期間）' : '（見本）'}</span>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#8A8272' }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 'dataMax + 2']} tick={{ fontSize: 10, fill: '#8A8272' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}g`, '体重']} />
              <Line type="monotone" dataKey="w" stroke="#E2703A" strokeWidth={2.4} dot={{ r: 2.5, fill: '#E2703A' }} />
            </LineChart>
          </ResponsiveContainer>
          {hasRealWeights ? (
            <div className="log-stat-row">
              <span className="log-stat">最高 <strong>{statMax}g</strong></span>
              <span className="log-stat">最低 <strong>{statMin}g</strong></span>
              <span className="log-stat">平均 <strong>{statAvg}g</strong></span>
            </div>
          ) : (
            <span className="muted">実際のデータが貯まると、ここが全期間のグラフ＋統計に切り替わります</span>
          )}
        </div>
      </div>

      {logs === null ? (
        <p className="muted">読み込み中…</p>
      ) : logs.length === 0 ? (
        <div className="ruled-card">
          <PunchHoles />
          <div className="ruled-card-body album-empty">
            <KirieCockatiel />
            <p className="lyt-locked-title">まだ記録がありません</p>
            <span className="today-prompt-sub">ホームから記録すると、ここに日々の履歴が並びます</span>
          </div>
        </div>
      ) : (
        <div className="log-months">
          {monthGroups.map(([month, items]) => (
            <div className="album-month-group" key={month}>
              <span className="album-month-label">{month.replace('-', '年')}月</span>
              <div className="binder-spine">
                {items.map((l) => (
                  <div className="binder-entry" key={l.id}>
                    <PunchHoles vertical />
                    <div className="binder-entry-body">
                      <div className="binder-entry-head">
                        <span className="binder-date">{l.log_date.slice(5).replace('-', '/')}</span>
                        {l.weight_g != null ? <span className="binder-weight"><Weight size={12} strokeWidth={2.4} />{l.weight_g}g</span> : null}
                      </div>
                      {(l.energy_level || l.appetite) ? (
                        <div className="chip-row log-chip-row">
                          {l.energy_level ? <span className="mini-chip is-active">{l.energy_level}</span> : null}
                          {l.appetite ? <span className="mini-chip mini-chip-alt is-active">{l.appetite}</span> : null}
                        </div>
                      ) : null}
                      {l.rotation_category ? (
                        <span className="log-rotation-tag">{l.rotation_category}: {l.rotation_answer}</span>
                      ) : null}
                      {l.owner_comment ? <p className="binder-note">{l.owner_comment}</p> : null}
                      {l.ai_comment ? (
                        <div className="ai-comment-bubble ai-comment-ok log-ai-bubble">
                          <Bird size={12} strokeWidth={2.4} />
                          <p>{l.ai_comment}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- プロフィールタブ ---- */
function ProfileTab() {
  const { bird } = useBird();
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [quirkInput, setQuirkInput] = useState('');

  useEffect(() => {
    if (bird) {
      setForm({
        name: bird.name || '',
        birthday: bird.birthday || '',
        adopted_date: bird.adopted_date || '',
        gender: bird.gender || '',
        personality: bird.personality || '',
        favorite_things: bird.favorite_things || '',
        quirks: bird.quirks || [],
        feeding_method: bird.feeding_style?.method || '',
        can_confirm_eating: bird.feeding_style?.can_confirm_eating ?? true,
        baseline_weight: bird.baseline_weight ?? '',
        danger_weight_high: bird.danger_weight_high ?? '',
        danger_weight_note: bird.danger_weight_note || '',
      });
    }
  }, [bird]);

  if (!form) return <div className="screen"><p className="muted">読み込み中…</p></div>;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addQuirk = () => {
    const v = quirkInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, quirks: [...f.quirks, v] }));
    setQuirkInput('');
  };
  const removeQuirk = (i) => setForm((f) => ({ ...f, quirks: f.quirks.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await supabaseUpdate('bird', bird.id, {
        name: form.name,
        birthday: form.birthday || null,
        adopted_date: form.adopted_date || null,
        gender: form.gender || null,
        personality: form.personality || null,
        favorite_things: form.favorite_things || null,
        quirks: form.quirks,
        feeding_style: { method: form.feeding_method || null, can_confirm_eating: form.can_confirm_eating },
        baseline_weight: form.baseline_weight === '' ? null : Number(form.baseline_weight),
        danger_weight_high: form.danger_weight_high === '' ? null : Number(form.danger_weight_high),
        danger_weight_note: form.danger_weight_note || null,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="screen">
      <header className="page-head">
        <span className="eyebrow">Profile</span>
        <h1>{form.name || 'この子'}のプロフィール</h1>
      </header>

      <div className="ruled-card">
        <PunchHoles />
        <div className="ruled-card-body profile-form">
          <label className="profile-field">
            <span className="field-label">名前</span>
            <input type="text" value={form.name} onChange={set('name')} />
          </label>
          <div className="profile-row">
            <label className="profile-field">
              <span className="field-label">誕生日</span>
              <input type="date" value={form.birthday} onChange={set('birthday')} />
            </label>
            <label className="profile-field">
              <span className="field-label">お迎え日</span>
              <input type="date" value={form.adopted_date} onChange={set('adopted_date')} />
            </label>
          </div>
          <label className="profile-field">
            <span className="field-label">性別</span>
            <input type="text" value={form.gender} onChange={set('gender')} placeholder="オス・メス・不明 など" />
          </label>
          <label className="profile-field">
            <span className="field-label">性格</span>
            <textarea rows={2} value={form.personality} onChange={set('personality')} placeholder="例: 人懐っこい、初対面には慎重" />
          </label>
          <label className="profile-field">
            <span className="field-label">好きなもの</span>
            <textarea rows={2} value={form.favorite_things} onChange={set('favorite_things')} placeholder="例: 栗、おもちゃの鈴、水浴び" />
          </label>
        </div>
      </div>

      <div className="ruled-card">
        <PunchHoles />
        <div className="ruled-card-body profile-form">
          <span className="field-label">この子だけの癖（個体DB）</span>
          <div className="quirk-tags">
            {form.quirks.map((q, i) => (
              <span className="quirk-tag" key={i}>{q}<button onClick={() => removeQuirk(i)} aria-label="削除">×</button></span>
            ))}
          </div>
          <div className="quirk-add-row">
            <input type="text" value={quirkInput} onChange={(e) => setQuirkInput(e.target.value)}
              placeholder="例: ツンデレ、朝は機嫌が悪い" onKeyDown={(e) => e.key === 'Enter' && addQuirk()} />
            <button className="quirk-add-btn" onClick={addQuirk}>追加</button>
          </div>
          <span className="today-prompt-sub">Case014のような「性格か異常か」の判断にNaviが使います</span>
        </div>
      </div>

      <div className="ruled-card">
        <PunchHoles />
        <div className="ruled-card-body profile-form">
          <span className="field-label">給餌スタイル</span>
          <label className="profile-field">
            <span className="field-label">給餌方法</span>
            <input type="text" value={form.feeding_method} onChange={set('feeding_method')} placeholder="例: ご飯をあげてからケージに入れる" />
          </label>
          <div className="chip-row">
            <button className={`mini-chip ${form.can_confirm_eating ? 'is-active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, can_confirm_eating: true }))}>その場で食べたか確認できる</button>
            <button className={`mini-chip mini-chip-alt ${!form.can_confirm_eating ? 'is-active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, can_confirm_eating: false }))}>後で皿を見るだけ</button>
          </div>
          <span className="today-prompt-sub">Case027の「実際に食べたか目視できるか」の判断に使います</span>
        </div>
      </div>

      <div className="ruled-card">
        <PunchHoles />
        <div className="ruled-card-body profile-form">
          <span className="field-label"><Weight size={12} strokeWidth={2.4} /> 体重の基準（体重ゲージに反映）</span>
          <div className="profile-row">
            <label className="profile-field">
              <span className="field-label">ベスト体重(g)</span>
              <input type="number" step="0.1" value={form.baseline_weight} onChange={set('baseline_weight')} />
            </label>
            <label className="profile-field">
              <span className="field-label">危険ライン(g)</span>
              <input type="number" step="0.1" value={form.danger_weight_high} onChange={set('danger_weight_high')} />
            </label>
          </div>
          <label className="profile-field">
            <span className="field-label">危険ラインの理由</span>
            <textarea rows={2} value={form.danger_weight_note} onChange={set('danger_weight_note')} />
          </label>
        </div>
      </div>

      <button className="btn-primary btn-block" onClick={handleSave} disabled={saveState === 'saving'}>
        {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '保存しました✓' : saveState === 'error' ? 'エラー・もう一度' : '保存する'}
      </button>
    </div>
  );
}

/* ---- 新ホーム: 写真ヒーロー＋ピポ博士の一言＋シンプル体重＋記録ボタン ---- */
function HomeHero({ record, onOpenRecord, onSeeWeight }) {
  const { bird } = useBird();
  const [memoryPhotos, setMemoryPhotos] = useState(null);
  const [demo, setDemo] = useState('ok');

  useEffect(() => {
    if (!bird?.id || record?.photo) return;
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; setMemoryPhotos([]); } }, 6000);
    supabaseSelect('photos', `select=*&bird_id=eq.${bird.id}&order=photo_date.desc&limit=20`)
      .then((rows) => { if (!done) { done = true; clearTimeout(timeout); setMemoryPhotos(rows); } })
      .catch(() => { if (!done) { done = true; clearTimeout(timeout); setMemoryPhotos([]); } });
    return () => { done = true; clearTimeout(timeout); };
  }, [bird?.id, record?.photo]);

  const memoryPick = memoryPhotos && memoryPhotos.length > 0
    ? memoryPhotos[Math.floor(Math.random() * memoryPhotos.length)]
    : null;
  const heroTone = record?.photo || memoryPick?.tone || null;
  const isMemory = !record?.photo && memoryPick;

  const d = AI_COMMENT_DEMO[demo];
  const greeting = record
    ? d.comment
    : `おかえり、ピポだよ。今日の${bird.name}はどんな様子だったピポ？`;

  const yesterday = WEIGHT_DATA[WEIGHT_DATA.length - 2].w;
  const todayW = TODAY_WEIGHT;
  const diff = (todayW - yesterday).toFixed(1);
  const diffLabel = diff > 0 ? `昨日より+${diff}g` : diff < 0 ? `昨日より${diff}g` : '昨日と変わらず';

  return (
    <div className="screen home-hero-screen">
      <header className="page-head">
        <span className="eyebrow">7月15日（水）</span>
        <h1>今日の{bird.name}</h1>
      </header>

      <button className="hero-photo" onClick={onOpenRecord}>
        {heroTone ? (
          <div className="hero-photo-img" style={{ background: heroTone }}>
            {isMemory ? <span className="hero-photo-tag">思い出の1枚</span> : <span className="hero-photo-tag">今日撮った1枚</span>}
          </div>
        ) : (
          <div className="hero-photo-empty">
            <KirieCockatiel />
            <span><Camera size={13} strokeWidth={2.2} /> タップして今日の写真を追加</span>
          </div>
        )}
      </button>

      <div className={`pipo-bubble pipo-bubble-${d.tone}`}>
        <Bird size={15} strokeWidth={2.4} />
        <p>{greeting}</p>
      </div>

      <button className="home-weight-line" onClick={onSeeWeight}>
        <Weight size={13} strokeWidth={2.4} />
        <span className="home-weight-num">{todayW}g</span>
        <span className="home-weight-diff">{diffLabel}</span>
        <span className="home-weight-more">グラフを見る →</span>
      </button>

      <button className="btn-primary btn-block home-record-btn" onClick={onOpenRecord}>
        <PenLine size={15} strokeWidth={2.6} /> ＋ 記録する
      </button>

      <div className="mode-demo home-demo-toggle">
        <span className="mode-demo-label">▼ 確認用: ピポ博士のトーンを見比べる</span>
        <div className="mode-demo-chips">
          <button className={demo === 'ok' ? 'is-active' : ''} onClick={() => setDemo('ok')}>通常</button>
          <button className={demo === 'caution' ? 'is-active' : ''} onClick={() => setDemo('caution')}>注意</button>
          <button className={demo === 'danger' ? 'is-active' : ''} onClick={() => setDemo('danger')}>危険</button>
        </div>
      </div>
    </div>
  );
}

/* ---- ルート ---- */

function AppInner() {
  const { bird } = useBird();
  const [tab, setTab] = useState('home'); // 'home' | 'album' | 'log' | 'profile'
  const [view, setView] = useState('home'); // ホームタブ内: 'home' | 'record'
  const [record, setRecord] = useState(null); // 今日の記録（未記録ならnull）

  if (tab === 'home' && view === 'record') {
    return (
      <div className="app-wrap">
        <style>{CSS}</style>
        <div className="phone">
          <div className="content">
            <RecordScreen
              initial={record}
              onBack={() => setView('home')}
              onSave={(r) => { setRecord(r); setView('home'); }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrap">
      <style>{CSS}</style>
      <div className="phone">
        <div className="content">
          {tab === 'home' ? (
            <HomeHero record={record} onOpenRecord={() => setView('record')} onSeeWeight={() => setTab('log')} />
          ) : null}
          {tab === 'album' ? <AlbumTab /> : null}
          {tab === 'log' ? <LogTab /> : null}
          {tab === 'profile' ? <ProfileTab /> : null}
        </div>
        <TabBar tab={tab} setTab={setTab} onOpenRecord={() => { setTab('home'); setView('record'); }} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BirdProvider>
      <AppInner />
    </BirdProvider>
  );
}

/* ---- スタイル ---- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Klee+One:wght@400;600&display=swap');

:root {
  --bg: #DDD6C8;
  --surface: #FBF8F2;
  --surface-alt: #F1EADB;
  --ink: #2C2620;
  --ink-soft: #8A8272;
  --cheek: #E2703A;
  --cheek-deep: #B85423;
  --crest: #EFC24C;
  --sage: #7C8A6E;
  --line: #C9C0AC;
  --danger: #B4432F;
}

* { box-sizing: border-box; }
.app-wrap {
  font-family: 'Zen Kaku Gothic New', sans-serif;
  color: var(--ink);
  display: flex;
  justify-content: center;
  padding: 0;
  background: radial-gradient(circle at 50% 0%, #E8E1D2 0%, #D2C9B7 100%);
  min-height: 100vh;
}
.phone {
  width: 100%;
  max-width: 420px;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.content { flex: 1; overflow-y: auto; }
.screen { padding: 22px 14px 24px; }

.eyebrow { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cheek-deep); font-weight: 700; }
.page-head { margin-bottom: 16px; display: flex; flex-direction: column; gap: 3px; }
.page-head h1 { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 900; font-size: 22px; margin: 0; }

.punch { display: flex; flex-direction: column; gap: 14px; justify-content: center; align-items: center; width: 24px; background: var(--surface-alt); border-right: 1px dashed var(--line); flex-shrink: 0; }
.punch span { width: 7px; height: 7px; border-radius: 50%; background: var(--bg); box-shadow: inset 0 1px 2px rgba(0,0,0,0.18); }

.ruled-card {
  display: flex;
  background: repeating-linear-gradient(var(--surface) 0px, var(--surface) 27px, var(--line) 28px);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 14px;
}
.ruled-card-body { padding: 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.field-label { font-size: 11px; font-weight: 700; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; }

/* --- 記録専用画面のヘッダー --- */
.record-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.back-btn {
  width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--surface);
  color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
}
.record-head h1 { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 900; font-size: 20px; margin: 2px 0 0; }

/* --- ホーム: 未記録の誘導カード --- */
.today-prompt { border: none; padding: 0; text-align: left; width: 100%; cursor: pointer; font-family: inherit; }
.today-prompt-body { flex-direction: row !important; align-items: center; gap: 14px; }
.today-prompt-illust { width: 84px; height: 84px; flex-shrink: 0; }
.today-prompt-illust .kirie-svg { width: 74px; height: 60px; }
.today-prompt-text { display: flex; flex-direction: column; gap: 3px; }
.today-prompt-text .lyt-locked-title { margin: 0; font-size: 15px; }
.today-prompt-sub { font-size: 11px; color: var(--ink-soft); font-family: 'Klee One', cursive; }

/* --- ホーム: 記録済みサマリー --- */
.today-done-row { display: flex; gap: 12px; align-items: flex-start; }
.today-done-photo { transform: rotate(-2deg); }
.today-done-noPhoto { width: 62px; height: 74px; border-radius: 6px; background: var(--surface-alt); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.today-done-noPhoto .kirie-svg { width: 48px; height: 40px; }
.today-done-text { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.today-done-note { margin: 0; font-size: 12.5px; line-height: 1.6; font-family: 'Klee One', cursive; color: var(--ink); }
.today-edit-btn { display: flex; align-items: center; gap: 4px; margin-top: 2px; }

/* --- 今日の記録カード --- */
.photo-well { border: none; padding: 0; background: none; cursor: pointer; display: block; width: 100%; }
.photo-well-img { position: relative; height: 140px; border-radius: 10px; overflow: hidden; }
.photo-well-tag {
  position: absolute; bottom: 8px; left: 8px; background: rgba(44,38,32,0.55); color: #fff;
  font-size: 10.5px; font-family: 'Klee One', cursive; padding: 3px 9px; border-radius: 999px;
}
.photo-well-empty {
  height: 140px; border-radius: 10px; border: 1.5px dashed var(--line); background: var(--surface-alt);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
}
.photo-well-empty .kirie-svg { width: 78px; height: 62px; }
.photo-well-empty span { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-soft); font-family: 'Klee One', cursive; }
.photo-well-lg .photo-well-img,
.photo-well-lg .photo-well-empty { height: 220px; }
.photo-well-lg .kirie-svg { width: 60px; height: 48px; }

.ai-comment-section { display: flex; flex-direction: column; gap: 8px; }
.ai-generate-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px; align-self: flex-start;
  border: 1.5px dashed var(--crest); background: #FBF6E4; color: var(--cheek-deep); border-radius: 999px;
  padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Zen Kaku Gothic New', sans-serif;
}
.ai-generate-btn:disabled { opacity: 0.6; }
.ai-error-note { font-size: 11px; color: var(--danger); }
.ai-cached-note { font-size: 10.5px; color: var(--ink-soft); }
.saved-confirm {
  display: flex; align-items: center; gap: 6px; justify-content: center; align-self: stretch;
  background: #E9EDE4; color: #556347; font-weight: 700; font-size: 12.5px; border-radius: 10px; padding: 8px;
}

.chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
.weight-input-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; background: var(--surface-alt); }
.weight-input-row input {
  width: 90px; text-align: right; border: none; background: transparent; font-size: 16px; font-weight: 700;
  color: var(--cheek-deep); font-family: 'Zen Kaku Gothic New', sans-serif; outline: none;
}
.rotation-block { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; border-top: 1px dashed var(--line); }
.mini-chip-rotation { border-style: dashed; }
.mini-chip-rotation.is-active { border-style: solid; }
.safety-block { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px dashed var(--line); border-radius: 10px; }
.safety-label { color: var(--danger) !important; }
.mini-chip-safety { border-color: var(--danger); color: var(--danger); }
.mini-chip-safety.is-active { background: var(--danger); border-color: var(--danger); color: #fff; }
.safety-alert { display: flex; gap: 8px; align-items: flex-start; background: var(--danger); color: #fff; border-radius: 10px; padding: 10px 12px; }
.safety-alert p { margin: 0; font-size: 12.5px; line-height: 1.6; font-weight: 700; }
.safety-alert svg { flex-shrink: 0; margin-top: 2px; }
.mini-chip {
  border: 1.5px solid var(--line); background: var(--surface-alt); color: var(--ink-soft);
  border-radius: 999px; padding: 5px 11px; font-size: 11px; cursor: pointer; font-family: 'Zen Kaku Gothic New', sans-serif;
}
.mini-chip-alt { border-style: dashed; }
.mini-chip.is-active { background: var(--cheek); border-color: var(--cheek); color: #fff; font-weight: 700; }

.today-text-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.today-text-row input {
  flex: 1; min-width: 0; border: none; border-bottom: 1.5px solid var(--line); background: transparent;
  font-family: 'Zen Kaku Gothic New', sans-serif; font-size: 13.5px; color: var(--ink); padding: 6px 2px; outline: none;
}
.today-text-row input:focus { border-color: var(--cheek); }
.icon-pill {
  display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--line); background: var(--surface-alt);
  color: var(--ink-soft); border-radius: 50%; width: 30px; height: 30px; cursor: pointer; flex-shrink: 0;
}
.icon-pill.is-active { border-color: var(--cheek); color: var(--cheek-deep); background: #FBEADF; }

.prev-entry-toggle {
  align-self: flex-start; border: none; background: none; color: var(--ink-soft); font-size: 10.5px;
  text-decoration: underline; cursor: pointer; padding: 0; font-family: 'Zen Kaku Gothic New', sans-serif;
}
.prev-entry-hint { margin: 0; font-size: 11px; color: var(--ink-soft); font-family: 'Klee One', cursive; line-height: 1.5; }

.btn-primary {
  border: none; background: var(--cheek); color: #fff; border-radius: 999px;
  padding: 10px 18px; font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 13.5px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-block { width: 100%; margin-top: 2px; }

/* --- 体重カード --- */
.gauge-block { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
.gauge-source { font-size: 10px; color: var(--ink-soft); font-family: 'Klee One', cursive; }
.gauge-source-done { color: #556347; font-weight: 700; font-family: 'Zen Kaku Gothic New', sans-serif; }

.gauge-track-zoned {
  position: relative; height: 10px; border-radius: 999px; margin: 24px 4px 22px;
  background: linear-gradient(90deg, #E3C6BC 0%, #E3C6BC 25%, #E9EDE4 25%, #E9EDE4 75%, #F0D2A8 75%, #F0D2A8 100%);
}
.gauge-num { position: absolute; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.gauge-num-edge { top: -20px; }
.gauge-num-danger { top: -20px; color: var(--danger); }
.gauge-num-base { top: -20px; color: var(--sage); }
.gauge-num-today { bottom: -20px; color: var(--cheek-deep); }
.gauge-marker-dot {
  position: absolute; top: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 50%;
  background: var(--cheek); border: 3px solid var(--surface); box-shadow: 0 1px 5px rgba(0,0,0,0.35); z-index: 2;
}

.gauge-status { align-self: stretch; font-size: 12px; line-height: 1.6; font-weight: 600; border-radius: 12px; padding: 8px 12px; margin-top: 2px; }
.gauge-status-ok { background: #E9EDE4; color: #556347; }
.gauge-status-warn-high { background: #FBEADF; color: var(--cheek-deep); }
.gauge-status-warn-low { background: #F5DCD6; color: var(--danger); }
.gauge-status-danger { background: var(--danger); color: #fff; }

/* --- 生態サイクル --- */
.cycle-species { padding-bottom: 10px; border-bottom: 1px dashed var(--line); display: flex; flex-direction: column; gap: 5px; }
.cycle-species-title { font-size: 10.5px; font-weight: 700; color: var(--ink-soft); }
.cycle-row { display: flex; align-items: baseline; gap: 8px; }
.cycle-season { font-size: 12px; font-weight: 700; color: var(--ink); flex-shrink: 0; white-space: nowrap; }
.cycle-season-personal { color: var(--cheek-deep); }
.cycle-note { font-size: 11.5px; color: var(--ink-soft); font-family: 'Klee One', cursive; }
.cycle-caveat { font-size: 10px; color: var(--ink-soft); font-family: 'Klee One', cursive; }
.cycle-personal { padding-top: 2px; display: flex; flex-direction: column; gap: 5px; }
.cycle-confidence { font-size: 10.5px; color: var(--sage); font-weight: 700; }
.weight-more-link {
  align-self: flex-start; border: none; background: none; color: var(--cheek-deep);
  font-size: 11px; font-weight: 700; text-decoration: underline; cursor: pointer; padding: 0;
  font-family: 'Zen Kaku Gothic New', sans-serif;
}

.mode-demo { margin-top: 4px; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 10px; background: rgba(255,255,255,0.4); }
.mode-demo-label { font-size: 10px; color: var(--ink-soft); display: block; margin-bottom: 6px; }
.mode-demo-chips { display: flex; gap: 6px; }
.mode-demo-chips button {
  flex: 1; border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft);
  border-radius: 999px; padding: 6px 4px; font-size: 10.5px; cursor: pointer; font-family: 'Zen Kaku Gothic New', sans-serif;
}
.mode-demo-chips button.is-active { background: var(--cheek); border-color: var(--cheek); color: #fff; font-weight: 700; }

/* --- 切り絵イラスト --- */
.kirie-branch { stroke: #A79571; stroke-width: 3; stroke-linecap: round; }
.kirie-body { fill: #D7CDB6; stroke: #B9AC8A; stroke-width: 1.5; }
.kirie-tail { fill: #C7BB9F; stroke: #B9AC8A; stroke-width: 1.2; }
.kirie-wing { fill: #C2B79C; stroke: #AFA184; stroke-width: 1.2; }
.kirie-crest { fill: var(--crest); stroke: #D9A431; stroke-width: 1; }
.kirie-cheek { fill: var(--cheek); }
.kirie-beak { fill: #8A8272; }
.kirie-eye { fill: var(--ink); }
.kirie-leg { stroke: #8A8272; stroke-width: 2.2; stroke-linecap: round; }

/* --- 記憶の階段（唯一の和紙・ポラロイド表現） --- */
.lyt-block { margin-bottom: 4px; }
.washi-card { position: relative; background: var(--surface); border-radius: 14px; padding: 20px 16px 16px; border: 1px solid var(--line); }
.washi-tape {
  position: absolute; top: -10px; left: 20px; width: 64px; height: 22px;
  background: repeating-linear-gradient(45deg, var(--crest), var(--crest) 4px, #F5D477 4px, #F5D477 8px);
  opacity: 0.85; transform: rotate(-3deg); border-radius: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.12);
}
.washi-card-row { display: flex; gap: 12px; align-items: flex-start; }
.washi-card-text { flex: 1; }
.washi-card-text p { margin: 6px 0 0; font-size: 13px; line-height: 1.7; font-family: 'Klee One', cursive; }
.polaroid {
  background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 5px 5px 8px;
  box-shadow: 0 4px 8px -4px rgba(44,38,32,0.3); flex-shrink: 0;
}
.polaroid-photo { width: 100%; height: 100%; border-radius: 2px; }
.polaroid-md { width: 76px; height: 92px; }

.washi-card-locked { background: var(--surface-alt); border-style: dashed; }

/* --- アルバム: 月別ポラロイドグリッド --- */
.album-months { display: flex; flex-direction: column; gap: 20px; }
.album-month-group { display: flex; flex-direction: column; gap: 10px; }
.album-month-label { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 13px; color: var(--cheek-deep); }
.album-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 10px; padding: 4px 2px 10px; }
.polaroid-grid { width: 100%; padding-bottom: 10px; }
.polaroid-grid .polaroid-photo { height: 90px; }
.polaroid-cap { display: block; font-size: 9.5px; color: var(--ink-soft); text-align: center; margin-top: 4px; font-family: 'Klee One', cursive; }
.album-caption { font-size: 10.5px; color: var(--ink); margin: 3px 2px 0; line-height: 1.4; font-family: 'Klee One', cursive; }
.tilt-l { transform: rotate(-3deg); }
.tilt-r { transform: rotate(2.5deg); }
.polaroid.is-milestone { box-shadow: 0 0 0 2px var(--crest); }
.album-tape {
  position: absolute; top: -8px; left: 50%; transform: translateX(-50%) rotate(-4deg); width: 46px; height: 16px;
}
.polaroid-grid { position: relative; }
.album-demo-toggle { margin-top: 16px; }
.throwback-card { margin-bottom: 18px; }
.throwback-shuffle { margin-top: 10px; }
.throwback-card .polaroid-md { width: 108px; height: 132px; }
.washi-tape-locked { background: repeating-linear-gradient(45deg, var(--sage), var(--sage) 4px, #97A587 4px, #97A587 8px); }
.lyt-locked-row { display: flex; gap: 12px; align-items: flex-start; }
.lyt-seal {
  width: 40px; height: 40px; border-radius: 50%; background: var(--surface); border: 1.5px dashed var(--line);
  display: flex; align-items: center; justify-content: center; color: var(--ink-soft); flex-shrink: 0; margin-top: 2px;
}
.lyt-locked-title { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: var(--ink); font-family: 'Zen Kaku Gothic New', sans-serif !important; }

.staircase { display: flex; justify-content: space-between; margin: 12px 2px 4px; position: relative; }
.staircase::before { content: ''; position: absolute; top: 5px; left: 4%; right: 4%; height: 2px; background: var(--line); z-index: 0; }
.staircase-step { display: flex; flex-direction: column; align-items: center; gap: 5px; position: relative; z-index: 1; flex: 1; }
.staircase-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--surface); border: 2px solid var(--line); }
.staircase-step.is-unlocked .staircase-dot { background: var(--sage); border-color: var(--sage); }
.staircase-step.is-current .staircase-dot { background: var(--cheek); border-color: var(--cheek); width: 13px; height: 13px; }
.staircase-label { font-size: 9px; color: var(--ink-soft); text-align: center; }
.staircase-step.is-current .staircase-label { color: var(--cheek-deep); font-weight: 700; }
.lyt-progress-label { display: block; margin-top: 6px; font-size: 10.5px; color: var(--ink-soft); font-family: 'Klee One', cursive; }
.lyt-demo-toggle {
  display: block; margin: 8px auto 0; border: 1px dashed var(--line); background: none; color: var(--ink-soft);
  font-size: 10px; padding: 5px 10px; border-radius: 999px; cursor: pointer; font-family: 'Zen Kaku Gothic New', sans-serif;
}

.muted { color: var(--ink-soft); font-size: 13px; }

/* --- 新ホーム: 写真ヒーロー --- */
.home-hero-screen { gap: 14px; display: flex; flex-direction: column; }
.hero-photo { border: none; padding: 0; background: none; cursor: pointer; border-radius: 16px; overflow: hidden; display: block; width: 100%; }
.hero-photo-img { position: relative; height: 260px; border-radius: 16px; }
.hero-photo-tag {
  position: absolute; left: 12px; bottom: 12px; background: rgba(44,38,32,0.55); color: #fff;
  font-size: 11px; padding: 4px 10px; border-radius: 999px; font-family: 'Klee One', cursive;
}
.hero-photo-empty {
  height: 260px; border-radius: 16px; background: var(--surface-alt); border: 1.5px dashed var(--line);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.hero-photo-empty .kirie-svg { width: 100px; height: 82px; }
.hero-photo-empty span { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ink-soft); font-family: 'Klee One', cursive; }

.pipo-bubble {
  display: flex; gap: 8px; align-items: flex-start; border-radius: 12px; padding: 12px 14px;
}
.pipo-bubble p { margin: 0; font-size: 13.5px; line-height: 1.7; font-family: 'Klee One', cursive; }
.pipo-bubble svg { flex-shrink: 0; margin-top: 2px; }
.pipo-bubble-ok { background: #E9EDE4; color: #556347; }
.pipo-bubble-warn { background: #FBEADF; color: var(--cheek-deep); }
.pipo-bubble-danger { background: var(--danger); color: #fff; }

.home-weight-line {
  display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 10px;
  padding: 10px 14px; background: var(--surface); cursor: pointer; font-family: 'Zen Kaku Gothic New', sans-serif;
}
.home-weight-num { font-weight: 700; font-size: 15px; color: var(--ink); }
.home-weight-diff { font-size: 12px; color: var(--ink-soft); }
.home-weight-more { margin-left: auto; font-size: 11px; color: var(--cheek-deep); font-weight: 700; }

.home-record-btn { margin-top: 2px; }
.home-demo-toggle { margin-top: 4px; }

/* --- AIコメントカード（仮実装） --- */
.ai-comment-card { background: var(--surface); border: 1.5px solid var(--crest); border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; }
.ai-comment-summary { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.ai-summary-chip { font-size: 11px; color: var(--ink-soft); background: var(--surface-alt); border-radius: 999px; padding: 4px 10px; }
.ai-summary-chip strong { color: var(--ink); margin-right: 4px; }
.ai-comment-bubble { display: flex; gap: 8px; align-items: flex-start; border-radius: 10px; padding: 10px 12px; }
.ai-comment-bubble p { margin: 0; font-size: 13px; line-height: 1.7; font-family: 'Klee One', cursive; }
.ai-comment-ok { background: #E9EDE4; color: #556347; }
.ai-comment-warn { background: #FBEADF; color: var(--cheek-deep); }
.ai-comment-danger { background: var(--danger); color: #fff; }
.ai-comment-bubble svg { flex-shrink: 0; margin-top: 2px; }

/* --- タブバー --- */
.content { flex: 1; overflow-y: auto; }
.tabbar { display: flex; border-top: 1px solid var(--line); background: var(--surface); }
.tab {
  flex: 1; border: none; background: none; padding: 10px 0 13px; display: flex; flex-direction: column;
  align-items: center; gap: 3px; color: var(--ink-soft); font-size: 10.5px; font-family: 'Zen Kaku Gothic New', sans-serif; cursor: pointer;
}
.tab.is-active { color: var(--cheek-deep); font-weight: 700; }

.tabbar-with-fab { position: relative; align-items: center; }
.tab-fab {
  width: 50px; height: 50px; border-radius: 50%; background: var(--cheek); border: 4px solid var(--surface);
  color: #fff; font-size: 24px; display: flex; align-items: center; justify-content: center;
  margin-top: -26px; box-shadow: 0 4px 10px rgba(226,112,58,0.4); cursor: pointer; flex-shrink: 0;
}
.quick-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(44,38,32,0.4); z-index: 50;
  display: flex; align-items: flex-end; justify-content: center;
}
.quick-sheet {
  width: 100%; max-width: 420px; background: var(--surface); border-radius: 20px 20px 0 0;
  padding: 18px 20px 28px; display: flex; flex-direction: column; gap: 14px;
}
.quick-sheet-title { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 14px; text-align: center; }
.quick-sheet-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.quick-sheet-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px; border: 1px solid var(--line);
  background: var(--surface-alt); border-radius: 12px; padding: 14px 4px; color: var(--cheek-deep); cursor: pointer;
}
.quick-sheet-item span { font-size: 11px; color: var(--ink); font-family: 'Zen Kaku Gothic New', sans-serif; }

/* --- アルバム・記録の空状態 --- */
.album-empty { align-items: center; text-align: center; gap: 8px; padding: 20px 10px; }
.album-empty .kirie-svg { width: 90px; height: 74px; }

/* --- バインダー風タイムライン（アルバム・記録共通） --- */
.binder-spine { display: flex; flex-direction: column; gap: 14px; }
.binder-entry { display: flex; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 0; }
.binder-entry-body { padding: 12px 14px; flex: 1; }
.binder-entry-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.binder-date { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 13px; color: var(--cheek-deep); }
.binder-weight { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--ink-soft); background: var(--surface-alt); border-radius: 999px; padding: 3px 8px; }
.binder-note { font-size: 13px; line-height: 1.6; margin: 0; color: var(--ink); font-family: 'Klee One', cursive; }
.log-chip-row { margin-bottom: 4px; }
.log-rotation-tag { display: inline-block; font-size: 10.5px; color: var(--ink-soft); background: var(--surface-alt); border-radius: 999px; padding: 3px 9px; margin-bottom: 4px; align-self: flex-start; }
.log-ai-bubble { margin-top: 4px; padding: 8px 10px; }
.log-stat-row { display: flex; gap: 10px; flex-wrap: wrap; }
.log-stat { font-size: 11.5px; color: var(--ink-soft); background: var(--surface-alt); border-radius: 999px; padding: 4px 10px; }
.log-stat strong { color: var(--cheek-deep); margin-left: 3px; }
.log-months { display: flex; flex-direction: column; gap: 20px; }

/* --- プロフィールフォーム --- */
.profile-form { gap: 12px; }
.profile-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
.profile-field input, .profile-field textarea {
  border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 13px;
  font-family: 'Zen Kaku Gothic New', sans-serif; background: var(--surface); color: var(--ink); outline: none;
}
.profile-field input:focus, .profile-field textarea:focus { border-color: var(--cheek); }
.profile-row { display: flex; gap: 10px; flex-wrap: wrap; }

.quirk-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.quirk-tag {
  display: flex; align-items: center; gap: 5px; background: var(--surface-alt); border: 1px solid var(--line);
  border-radius: 999px; padding: 4px 6px 4px 12px; font-size: 12px; color: var(--ink);
}
.quirk-tag button { border: none; background: none; color: var(--ink-soft); cursor: pointer; font-size: 13px; line-height: 1; padding: 2px; }
.quirk-add-row { display: flex; gap: 8px; }
.quirk-add-row input {
  flex: 1; min-width: 0; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 13px;
  font-family: 'Zen Kaku Gothic New', sans-serif; background: var(--surface); color: var(--ink); outline: none;
}
.quirk-add-btn {
  border: 1.5px solid var(--cheek); background: var(--surface); color: var(--cheek-deep); border-radius: 8px;
  padding: 0 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Zen Kaku Gothic New', sans-serif;
}

@media (min-width: 480px) {
  .phone { border-radius: 30px; box-shadow: 0 30px 60px -20px rgba(44, 38, 32, 0.35), 0 0 0 9px #2B2820; min-height: 780px; }
  .app-wrap { padding: 24px 12px; }
}
`;
