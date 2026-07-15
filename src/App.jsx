import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sun, CloudSun, Sparkles, AlertCircle, Camera, BookOpen, Bird,
  ChevronLeft, ChevronRight, X, Check, Feather, Egg, Weight,
  PenLine, CalendarHeart, Loader2, Plus, CalendarPlus, Utensils
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

/* ---------------------------------------------------------
   定数・データ定義
--------------------------------------------------------- */

const PROFILE_KEY = 'okame-profile-v1';
const RECORDS_KEY = 'okame-records-v1';

const ENERGY_OPTIONS = [
  { id: 'genki', label: '元気いっぱい', icon: Sparkles },
  { id: 'itsumo', label: 'いつも通り', icon: Sun },
  { id: 'shizuka', label: '少し静か', icon: CloudSun },
  { id: 'henka', label: '気になる変化あり', icon: AlertCircle },
];

const APPETITE_OPTIONS = [
  { id: 'yoku', label: 'よく食べた' },
  { id: 'futsuu', label: '普通' },
  { id: 'sukunai', label: '少なかった' },
];

const BEHAVIOR_OPTIONS = [
  { id: 'asonda', label: 'よく遊んだ' },
  { id: 'amaeta', label: '甘えてきた' },
  { id: 'naita', label: 'よく鳴いた' },
  { id: 'atarashii', label: '新しいことをした' },
  { id: 'neta', label: 'よく寝た' },
];

const GENDER_OPTIONS = [
  { id: 'male', label: 'オス' },
  { id: 'female', label: 'メス' },
  { id: 'unknown', label: '不明' },
];

/* ---------------------------------------------------------
   日付ユーティリティ
--------------------------------------------------------- */

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateJP(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const week = ['日', '月', '火', '水', '木', '金', '土'];
  const wd = new Date(y, m - 1, d).getDay();
  return `${y}年${m}月${d}日（${week[wd]}）`;
}

function formatShortDate(key) {
  if (!key) return '';
  const [, m, d] = key.split('-').map(Number);
  return `${m}/${d}`;
}

function daysBetween(fromKey, toKey = todayKey()) {
  if (!fromKey) return null;
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
}

function addDays(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function recentUnrecordedDates(existingDates, count = 14) {
  const set = new Set(existingDates);
  const out = [];
  let cursor = addDays(todayKey(), -1); // 昨日から遡る
  while (out.length < count && daysBetween(cursor) < 120) {
    if (!set.has(cursor)) out.push(cursor);
    cursor = addDays(cursor, -1);
  }
  return out;
}

/* --- 一括インポート用パーサー ---
   1行 = 1日分。 "日付 | 元気度 | 食欲 | 行動(カンマ区切り) | 体重 | コメント"
   ラベル(元気いっぱい 等)・id(genki 等)のどちらでも認識する。
   "#" で始まる行や空行は無視する。 */

function findOption(list, raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  return list.find((o) => o.id === v || o.label === v) || null;
}

function toNumOrNull(raw) {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v || isNaN(Number(v))) return null;
  return Number(v);
}

function parseBulkText(text) {
  const lines = (text || '').split('\n');
  const records = [];
  const errors = [];
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 1 || !parts[0]) {
      errors.push({ line: idx + 1, message: '日付がありません' });
      return;
    }
    const [
      dateRaw,
      energyRaw = '',
      appetiteRaw = '',
      behaviorsRaw = '',
      wMorningRaw = '',
      wNoonRaw = '',
      wEveningRaw = '',
      fBeforeMRaw = '',
      fAfterMRaw = '',
      fBeforeNRaw = '',
      fAfterNRaw = '',
      fBeforeERaw = '',
      fAfterERaw = '',
      supplementRaw = '',
      concernRaw = '',
      ...rest
    ] = parts;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      errors.push({ line: idx + 1, message: `日付の形式が正しくありません: "${dateRaw}"（例: 2026-06-01）` });
      return;
    }
    const energyTrim = energyRaw.trim();
    const appetiteTrim = appetiteRaw.trim();
    const energyOpt = energyTrim && energyTrim !== '-' ? findOption(ENERGY_OPTIONS, energyTrim) : null;
    const appetiteOpt = appetiteTrim && appetiteTrim !== '-' ? findOption(APPETITE_OPTIONS, appetiteTrim) : null;
    if (energyTrim && energyTrim !== '-' && !energyOpt) {
      errors.push({ line: idx + 1, message: `元気度が認識できません: "${energyRaw}"` });
      return;
    }
    if (appetiteTrim && appetiteTrim !== '-' && !appetiteOpt) {
      errors.push({ line: idx + 1, message: `食欲が認識できません: "${appetiteRaw}"` });
      return;
    }
    const behaviors = behaviorsRaw
      .split(',')
      .map((b) => findOption(BEHAVIOR_OPTIONS, b))
      .filter(Boolean)
      .map((o) => o.id);

    const weightMorning = toNumOrNull(wMorningRaw);
    const weightNoon = toNumOrNull(wNoonRaw);
    const weightEvening = toNumOrNull(wEveningRaw);
    const provided = [weightMorning, weightNoon, weightEvening].filter((v) => v != null);
    const comment = rest.join('|').trim();

    records.push({
      date: dateRaw,
      energy: energyOpt ? energyOpt.id : null,
      appetite: appetiteOpt ? appetiteOpt.id : null,
      behaviors,
      weightMorning,
      weightNoon,
      weightEvening,
      weight: provided.length ? Math.round((provided.reduce((a, b) => a + b, 0) / provided.length) * 10) / 10 : null,
      foodBeforeMorning: toNumOrNull(fBeforeMRaw),
      foodAfterMorning: toNumOrNull(fAfterMRaw),
      foodBeforeNoon: toNumOrNull(fBeforeNRaw),
      foodAfterNoon: toNumOrNull(fAfterNRaw),
      foodBeforeEvening: toNumOrNull(fBeforeERaw),
      foodAfterEvening: toNumOrNull(fAfterERaw),
      supplement: supplementRaw.trim(),
      concern: concernRaw.trim(),
      comment,
      photoUrl: null,
      updatedAt: Date.now(),
    });
  });
  return { records, errors };
}

function ageText(birthKey) {
  if (!birthKey) return null;
  const days = daysBetween(birthKey);
  if (days === null || days < 0) return null;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}歳${months}ヶ月`;
  if (months > 0) return `${months}ヶ月`;
  return `${days}日`;
}

/* ---------------------------------------------------------
   小さな汎用パーツ
--------------------------------------------------------- */

function Chip({ active, onClick, children, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className={`oc-chip ${active ? 'is-active' : ''}`}>
      {Icon ? <Icon size={16} strokeWidth={2.2} /> : null}
      <span>{children}</span>
    </button>
  );
}

function SectionLabel({ eyebrow, title }) {
  return (
    <div className="oc-section-label">
      {eyebrow ? <span className="oc-eyebrow">{eyebrow}</span> : null}
      <h3>{title}</h3>
    </div>
  );
}

function foodEatenOf(record, slot) {
  const before = record[`foodBefore${slot}`];
  const after = record[`foodAfter${slot}`];
  return before != null && after != null ? Math.round((before - after) * 10) / 10 : null;
}

function WeightFoodBadges({ record }) {
  const hasWeights = record.weightMorning != null || record.weightNoon != null || record.weightEvening != null;
  const slots = [
    ['Morning', '朝'],
    ['Noon', '昼'],
    ['Evening', '晩'],
  ];
  const hasFood = slots.some(([slot]) => record[`foodBefore${slot}`] != null || record[`foodAfter${slot}`] != null);
  if (!hasWeights && !hasFood && !record.concern && !record.supplement) return null;
  return (
    <>
      {hasWeights ? (
        <div className="oc-summary-row">
          {record.weightMorning != null ? <span className="oc-badge oc-badge-soft">朝 {record.weightMorning}g</span> : null}
          {record.weightNoon != null ? <span className="oc-badge oc-badge-soft">昼 {record.weightNoon}g</span> : null}
          {record.weightEvening != null ? <span className="oc-badge oc-badge-soft">晩 {record.weightEvening}g</span> : null}
        </div>
      ) : null}
      {hasFood
        ? slots.map(([slot, label]) => {
            const before = record[`foodBefore${slot}`];
            const after = record[`foodAfter${slot}`];
            const eaten = foodEatenOf(record, slot);
            if (before == null && after == null) return null;
            return (
              <div className="oc-summary-row" key={slot}>
                <span className="oc-badge-label">{label}ご飯</span>
                {before != null ? <span className="oc-badge oc-badge-soft">前{before}g</span> : null}
                {after != null ? <span className="oc-badge oc-badge-soft">後{after}g</span> : null}
                {eaten != null ? <span className="oc-badge">約{eaten}g</span> : null}
              </div>
            );
          })
        : null}
      {record.supplement ? <p className="oc-comment oc-supplement">💊 {record.supplement}</p> : null}
      {record.concern ? <p className="oc-comment oc-concern">⚠ {record.concern}</p> : null}
    </>
  );
}

/* ---------------------------------------------------------
   オンボーディング（プロフィール登録）
--------------------------------------------------------- */

function Onboarding({ onComplete }) {
  const [form, setForm] = useState({
    name: '',
    birthday: '',
    adoptedDate: '',
    gender: 'unknown',
    photoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('名前を入力してください');
      return;
    }
    setSaving(true);
    setError('');
    onComplete({ ...form, name: form.name.trim() });
  };

  return (
    <div className="oc-screen oc-onboarding">
      <div className="oc-onboard-hero">
        <div className="oc-onboard-bird">
          <Bird size={40} strokeWidth={1.6} />
        </div>
        <h1>その子の一生を、<br />ここから残そう</h1>
        <p>まずはあなたのオカメインコのことを教えてください</p>
      </div>

      <form className="oc-form" onSubmit={handleSubmit}>
        <label className="oc-field">
          <span>名前 <em>*必須</em></span>
          <input
            type="text"
            value={form.name}
            placeholder="例）ぴい"
            onChange={(e) => update('name', e.target.value)}
          />
        </label>

        <div className="oc-field-row">
          <label className="oc-field">
            <span>誕生日</span>
            <input type="date" value={form.birthday} onChange={(e) => update('birthday', e.target.value)} />
          </label>
          <label className="oc-field">
            <span>お迎え日</span>
            <input type="date" value={form.adoptedDate} onChange={(e) => update('adoptedDate', e.target.value)} />
          </label>
        </div>

        <div className="oc-field">
          <span>性別</span>
          <div className="oc-chip-row">
            {GENDER_OPTIONS.map((g) => (
              <Chip key={g.id} active={form.gender === g.id} onClick={() => update('gender', g.id)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        <label className="oc-field">
          <span>写真URL（任意）</span>
          <input
            type="url"
            value={form.photoUrl}
            placeholder="Googleフォトなどの共有リンク"
            onChange={(e) => update('photoUrl', e.target.value)}
          />
          <small>写真はこのアプリには保存されません。お手持ちのアルバムのリンクを貼ってね</small>
        </label>

        {error ? <p className="oc-error">{error}</p> : null}

        <button type="submit" className="oc-button oc-button-primary" disabled={saving}>
          {saving ? <Loader2 size={18} className="oc-spin" /> : <Feather size={18} />}
          この子の記録をはじめる
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------
   今日の記録フォーム
--------------------------------------------------------- */

function RecordForm({ date: fixedDate, dateEditable, seriesMode, existingDates, initial, onSave, onCancel, onFinish }) {
  const [date, setDate] = useState(fixedDate || initial?.date || '');
  const [energy, setEnergy] = useState(initial?.energy || '');
  const [appetite, setAppetite] = useState(initial?.appetite || '');
  const [behaviors, setBehaviors] = useState(initial?.behaviors || []);
  const [comment, setComment] = useState(initial?.comment || '');
  const [weightMorning, setWeightMorning] = useState(initial?.weightMorning != null ? String(initial.weightMorning) : '');
  const [weightNoon, setWeightNoon] = useState(initial?.weightNoon != null ? String(initial.weightNoon) : '');
  const [weightEvening, setWeightEvening] = useState(initial?.weightEvening != null ? String(initial.weightEvening) : '');
  const initFood = (key) => (initial && initial[key] != null ? String(initial[key]) : '');
  const [food, setFood] = useState({
    foodBeforeMorning: initFood('foodBeforeMorning'),
    foodAfterMorning: initFood('foodAfterMorning'),
    foodBeforeNoon: initFood('foodBeforeNoon'),
    foodAfterNoon: initFood('foodAfterNoon'),
    foodBeforeEvening: initFood('foodBeforeEvening'),
    foodAfterEvening: initFood('foodAfterEvening'),
  });
  const setFoodField = (key) => (e) => setFood((prev) => ({ ...prev, [key]: e.target.value }));
  const [supplement, setSupplement] = useState(initial?.supplement || '');
  const [concern, setConcern] = useState(initial?.concern || '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [lastSaved, setLastSaved] = useState('');
  const [knownDates, setKnownDates] = useState(existingDates || []);

  const quickDates = useMemo(
    () => (seriesMode ? recentUnrecordedDates(knownDates, 10) : []),
    [seriesMode, knownDates]
  );

  const foodEaten = (before, after) =>
    food[before].trim() && food[after].trim() && !isNaN(Number(food[before])) && !isNaN(Number(food[after]))
      ? Math.round((Number(food[before]) - Number(food[after])) * 10) / 10
      : null;

  const toggleBehavior = (id) => {
    setBehaviors((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const resetFields = () => {
    setEnergy('');
    setAppetite('');
    setBehaviors([]);
    setComment('');
    setWeightMorning('');
    setWeightNoon('');
    setWeightEvening('');
    setFood({
      foodBeforeMorning: '',
      foodAfterMorning: '',
      foodBeforeNoon: '',
      foodAfterNoon: '',
      foodBeforeEvening: '',
      foodAfterEvening: '',
    });
    setSupplement('');
    setConcern('');
    setPhotoUrl('');
  };

  const willOverwrite = dateEditable && date && knownDates.includes(date) && date !== initial?.date;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateEditable && !date) {
      setError('日付を選んでください');
      return;
    }
    if (dateEditable && date > todayKey()) {
      setError('未来の日付は選べません');
      return;
    }
    if (!energy || !appetite) {
      setError('元気度と食欲は選んでください');
      return;
    }
    setSaving(true);
    setError('');
    const wMorning = weightMorning.trim() ? Number(weightMorning) : null;
    const wNoon = weightNoon.trim() ? Number(weightNoon) : null;
    const wEvening = weightEvening.trim() ? Number(weightEvening) : null;
    const provided = [wMorning, wNoon, wEvening].filter((v) => v != null);
    const toNumOrNull = (v) => (v.trim() ? Number(v) : null);
    const record = {
      date: dateEditable ? date : fixedDate,
      energy,
      appetite,
      behaviors,
      comment: comment.trim(),
      weightMorning: wMorning,
      weightNoon: wNoon,
      weightEvening: wEvening,
      weight: provided.length ? Math.round((provided.reduce((a, b) => a + b, 0) / provided.length) * 10) / 10 : null,
      foodBeforeMorning: toNumOrNull(food.foodBeforeMorning),
      foodAfterMorning: toNumOrNull(food.foodAfterMorning),
      foodBeforeNoon: toNumOrNull(food.foodBeforeNoon),
      foodAfterNoon: toNumOrNull(food.foodAfterNoon),
      foodBeforeEvening: toNumOrNull(food.foodBeforeEvening),
      foodAfterEvening: toNumOrNull(food.foodAfterEvening),
      supplement: supplement.trim(),
      concern: concern.trim(),
      photoUrl: photoUrl.trim() || null,
      updatedAt: Date.now(),
    };
    try {
      await onSave(record);
      if (seriesMode) {
        setKnownDates((prev) => (prev.includes(record.date) ? prev : [...prev, record.date]));
        setSavedCount((n) => n + 1);
        setLastSaved(record.date);
        resetFields();
        setDate((d) => addDays(d, -1));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="oc-form" onSubmit={handleSubmit}>
      {seriesMode ? (
        <div className="oc-series-bar">
          <span>{savedCount > 0 ? `${savedCount}件 記録しました` : '古い日から順に、続けて記録できます'}</span>
          {onFinish ? (
            <button type="button" className="oc-series-done" onClick={onFinish}>
              完了する
            </button>
          ) : null}
        </div>
      ) : null}

      {dateEditable ? (
        <label className="oc-field">
          <span>日付</span>
          <div className="oc-date-row">
            <button type="button" className="oc-date-step" onClick={() => setDate((d) => addDays(d || todayKey(), -1))} aria-label="前の日">
              <ChevronLeft size={16} />
            </button>
            <input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
            <button
              type="button"
              className="oc-date-step"
              onClick={() => setDate((d) => (d && d < todayKey() ? addDays(d, 1) : d))}
              aria-label="次の日"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {willOverwrite ? <small className="oc-warn">この日はすでに記録があります。保存すると上書きされます</small> : null}
        </label>
      ) : null}

      {seriesMode && quickDates.length > 0 ? (
        <div className="oc-field">
          <span>まだ記録のない日</span>
          <div className="oc-chip-row oc-chip-wrap">
            {quickDates.map((d) => (
              <Chip key={d} active={date === d} onClick={() => setDate(d)}>
                {formatShortDate(d)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {lastSaved ? <p className="oc-series-toast">{formatDateJP(lastSaved)}を保存しました。続けてどうぞ</p> : null}

      <SectionLabel eyebrow="Q1" title="元気度は？" />
      <div className="oc-grid-2">
        {ENERGY_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.id}
            className={`oc-option-card ${energy === opt.id ? 'is-active' : ''}`}
            onClick={() => setEnergy(opt.id)}
          >
            <opt.icon size={20} strokeWidth={2} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      <SectionLabel eyebrow="Q2" title="食欲は？" />
      <div className="oc-chip-row">
        {APPETITE_OPTIONS.map((opt) => (
          <Chip key={opt.id} active={appetite === opt.id} onClick={() => setAppetite(opt.id)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      <SectionLabel eyebrow="Q3" title="行動（いくつでも）" />
      <div className="oc-chip-row oc-chip-wrap">
        {BEHAVIOR_OPTIONS.map((opt) => (
          <Chip key={opt.id} active={behaviors.includes(opt.id)} onClick={() => toggleBehavior(opt.id)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      <SectionLabel eyebrow="Q4" title="体重（任意・朝昼晩）" />
      <div className="oc-triple-input">
        <label className="oc-field">
          <span>朝</span>
          <div className="oc-weight-input">
            <Weight size={14} strokeWidth={2} />
            <input type="number" inputMode="decimal" step="0.1" placeholder="g" value={weightMorning} onChange={(e) => setWeightMorning(e.target.value)} />
          </div>
        </label>
        <label className="oc-field">
          <span>昼</span>
          <div className="oc-weight-input">
            <Weight size={14} strokeWidth={2} />
            <input type="number" inputMode="decimal" step="0.1" placeholder="g" value={weightNoon} onChange={(e) => setWeightNoon(e.target.value)} />
          </div>
        </label>
        <label className="oc-field">
          <span>晩</span>
          <div className="oc-weight-input">
            <Weight size={14} strokeWidth={2} />
            <input type="number" inputMode="decimal" step="0.1" placeholder="g" value={weightEvening} onChange={(e) => setWeightEvening(e.target.value)} />
          </div>
        </label>
      </div>

      <SectionLabel eyebrow="Q5" title="ご飯の量（任意・お皿ごと・朝昼晩）" />
      {[
        ['Morning', '朝'],
        ['Noon', '昼'],
        ['Evening', '晩'],
      ].map(([slot, label]) => {
        const beforeKey = `foodBefore${slot}`;
        const afterKey = `foodAfter${slot}`;
        const eaten = foodEaten(beforeKey, afterKey);
        return (
          <div className="oc-food-slot" key={slot}>
            <span className="oc-food-slot-label">{label}</span>
            <div className="oc-field-row oc-food-slot-inputs">
              <label className="oc-field">
                <span>あげる前</span>
                <div className="oc-weight-input">
                  <Utensils size={14} strokeWidth={2} />
                  <input type="number" inputMode="decimal" step="0.1" placeholder="g" value={food[beforeKey]} onChange={setFoodField(beforeKey)} />
                </div>
              </label>
              <label className="oc-field">
                <span>食べた後</span>
                <div className="oc-weight-input">
                  <Utensils size={14} strokeWidth={2} />
                  <input type="number" inputMode="decimal" step="0.1" placeholder="g" value={food[afterKey]} onChange={setFoodField(afterKey)} />
                </div>
              </label>
            </div>
            {eaten != null ? <small className="oc-food-eaten">食べた量: 約{eaten}g</small> : null}
          </div>
        );
      })}

      <SectionLabel eyebrow="Q6" title="投薬・おやつなど（任意）" />
      <label className="oc-field">
        <textarea rows={2} placeholder="ネクトン、おやつ 栗、など" value={supplement} onChange={(e) => setSupplement(e.target.value)} />
      </label>

      <SectionLabel eyebrow="Q7" title="気になること（任意）" />
      <label className="oc-field">
        <textarea rows={2} placeholder="羽が抜けた、少し痩せた気がする…など" value={concern} onChange={(e) => setConcern(e.target.value)} />
      </label>

      <SectionLabel eyebrow="Q8" title="写真URL（任意）" />
      <label className="oc-field">
        <div className="oc-weight-input">
          <Camera size={16} strokeWidth={2} />
          <input
            type="url"
            placeholder="Googleフォトなどの共有リンク"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
        </div>
      </label>

      <SectionLabel eyebrow="Q9" title="ひとこと" />
      <label className="oc-field">
        <textarea
          rows={4}
          placeholder="どんな一日でしたか？"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      {error ? <p className="oc-error">{error}</p> : null}

      <div className="oc-form-actions">
        {onCancel ? (
          <button type="button" className="oc-button oc-button-ghost" onClick={onCancel}>
            {seriesMode && savedCount > 0 ? '閉じる' : 'キャンセル'}
          </button>
        ) : null}
        <button type="submit" className="oc-button oc-button-primary" disabled={saving}>
          {saving ? <Loader2 size={18} className="oc-spin" /> : <Check size={18} />}
          記録する
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------
   今日タブ
--------------------------------------------------------- */

function TodayTab({ profile, records, onSaveRecord }) {
  const existing = records.find((r) => r.date === todayKey());
  const [editing, setEditing] = useState(false);

  const energyMeta = existing ? ENERGY_OPTIONS.find((o) => o.id === existing.energy) : null;
  const appetiteMeta = existing ? APPETITE_OPTIONS.find((o) => o.id === existing.appetite) : null;

  if (existing && !editing) {
    return (
      <div className="oc-screen">
        <div className="oc-today-header">
          <span className="oc-eyebrow">{formatDateJP(existing.date)}</span>
          <h2>今日はもう記録済みです</h2>
        </div>

        <div className="oc-card oc-summary-card">
          {existing.photoUrl ? (
            <a className="oc-photo-link" href={existing.photoUrl} target="_blank" rel="noreferrer">
              <Camera size={16} /> 今日の写真を見る
            </a>
          ) : null}
          <div className="oc-summary-row">
            {energyMeta ? (
              <span className="oc-badge">
                <energyMeta.icon size={14} /> {energyMeta.label}
              </span>
            ) : null}
            {appetiteMeta ? <span className="oc-badge">{appetiteMeta.label}</span> : null}
            {existing.weight != null ? <span className="oc-badge">{existing.weight}g 平均</span> : null}
          </div>
          <WeightFoodBadges record={existing} />
          {existing.behaviors?.length ? (
            <div className="oc-summary-row">
              {existing.behaviors.map((b) => {
                const meta = BEHAVIOR_OPTIONS.find((o) => o.id === b);
                return (
                  <span key={b} className="oc-badge oc-badge-soft">
                    {meta ? meta.label : b}
                  </span>
                );
              })}
            </div>
          ) : null}
          {existing.comment ? <p className="oc-comment">{existing.comment}</p> : null}
          <button className="oc-button oc-button-ghost oc-button-sm" onClick={() => setEditing(true)}>
            <PenLine size={14} /> 編集する
          </button>
        </div>

        <p className="oc-hint">
          <Feather size={13} /> {profile.name}ちゃんの記録が、また1日ぶん増えました
        </p>
      </div>
    );
  }

  return (
    <div className="oc-screen">
      <div className="oc-today-header">
        <span className="oc-eyebrow">{formatDateJP(todayKey())}</span>
        <h2>今日はどうでしたか？</h2>
      </div>
      <RecordForm
        date={todayKey()}
        dateEditable={false}
        initial={existing}
        onCancel={existing ? () => setEditing(false) : null}
        onSave={async (record) => {
          await onSaveRecord(record);
          setEditing(false);
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------
   アルバム（羽根のタイムライン）タブ
--------------------------------------------------------- */

function RecordDetail({ record, onClose, onEdit }) {
  const energyMeta = ENERGY_OPTIONS.find((o) => o.id === record.energy);
  const appetiteMeta = APPETITE_OPTIONS.find((o) => o.id === record.appetite);
  return (
    <div className="oc-modal-backdrop" onClick={onClose}>
      <div className="oc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="oc-modal-close" onClick={onClose} aria-label="閉じる">
          <X size={18} />
        </button>
        <span className="oc-eyebrow">{formatDateJP(record.date)}</span>
        {record.photoUrl ? (
          <a className="oc-photo-link" href={record.photoUrl} target="_blank" rel="noreferrer">
            <Camera size={16} /> 写真を見る
          </a>
        ) : null}
        <div className="oc-summary-row">
          {energyMeta ? (
            <span className="oc-badge">
              <energyMeta.icon size={14} /> {energyMeta.label}
            </span>
          ) : null}
          {appetiteMeta ? <span className="oc-badge">{appetiteMeta.label}</span> : null}
          {record.weight != null ? <span className="oc-badge">{record.weight}g 平均</span> : null}
        </div>
        <WeightFoodBadges record={record} />
        {record.behaviors?.length ? (
          <div className="oc-summary-row">
            {record.behaviors.map((b) => {
              const meta = BEHAVIOR_OPTIONS.find((o) => o.id === b);
              return (
                <span key={b} className="oc-badge oc-badge-soft">
                  {meta ? meta.label : b}
                </span>
              );
            })}
          </div>
        ) : null}
        {record.comment ? <p className="oc-comment">{record.comment}</p> : <p className="oc-comment oc-comment-empty">この日はひとことの記録はありません</p>}
        <button className="oc-button oc-button-ghost oc-button-sm" onClick={onEdit}>
          <PenLine size={14} /> この日の記録を編集
        </button>
      </div>
    </div>
  );
}

function AlbumTab({ profile, records, onSaveRecord }) {
  const [selected, setSelected] = useState(null);
  const [addingPast, setAddingPast] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [windowEnd, setWindowEnd] = useState(todayKey());
  const touchStartX = useRef(null);
  const sorted = useMemo(() => [...records].sort((a, b) => (a.date < b.date ? 1 : -1)), [records]);
  const existingDates = useMemo(() => records.map((r) => r.date), [records]);

  const allWeighed = useMemo(
    () => [...records].filter((r) => r.weight != null).sort((a, b) => (a.date > b.date ? 1 : -1)),
    [records]
  );

  const windowStart = useMemo(() => addDays(windowEnd, -29), [windowEnd]);
  const chartData = useMemo(
    () =>
      allWeighed
        .filter((r) => r.date >= windowStart && r.date <= windowEnd)
        .map((r) => ({ date: formatShortDate(r.date), weight: r.weight })),
    [allWeighed, windowStart, windowEnd]
  );
  const isNewestWindow = windowEnd >= todayKey();
  const oldestDataDate = allWeighed[0]?.date;
  const isOldestWindow = oldestDataDate ? windowStart <= oldestDataDate : true;

  const goPrevWindow = () => setWindowEnd((d) => addDays(d, -30));
  const goNextWindow = () => setWindowEnd((d) => (addDays(d, 30) > todayKey() ? todayKey() : addDays(d, 30)));

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && !isNewestWindow) goNextWindow();
      if (dx > 0 && !isOldestWindow) goPrevWindow();
    }
    touchStartX.current = null;
  };

  if (addingPast) {
    return (
      <div className="oc-screen">
        <div className="oc-today-header">
          <span className="oc-eyebrow">Album</span>
          <h2>過去の記録を追加</h2>
        </div>
        <RecordForm
          dateEditable
          seriesMode
          existingDates={existingDates}
          onCancel={() => setAddingPast(false)}
          onFinish={() => setAddingPast(false)}
          onSave={onSaveRecord}
        />
      </div>
    );
  }

  if (editingRecord) {
    return (
      <div className="oc-screen">
        <div className="oc-today-header">
          <span className="oc-eyebrow">{formatDateJP(editingRecord.date)}</span>
          <h2>記録を編集</h2>
        </div>
        <RecordForm
          date={editingRecord.date}
          dateEditable={false}
          initial={editingRecord}
          onCancel={() => setEditingRecord(null)}
          onSave={async (record) => {
            await onSaveRecord(record);
            setEditingRecord(null);
          }}
        />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="oc-screen">
        <div className="oc-empty-state">
          <Feather size={32} strokeWidth={1.4} />
          <h2>まだ羽根が1枚もありません</h2>
          <p>「今日」タブで記録すると、ここに{profile.name}ちゃんの物語が積み重なっていきます</p>
        </div>
        <button className="oc-button oc-button-ghost" onClick={() => setAddingPast(true)}>
          <CalendarPlus size={16} /> 過去の記録を追加する
        </button>
      </div>
    );
  }

  return (
    <div className="oc-screen">
      <div className="oc-today-header oc-today-header-row">
        <div>
          <span className="oc-eyebrow">Album</span>
          <h2>{profile.name}ちゃんのアルバム</h2>
        </div>
        <button className="oc-icon-button" onClick={() => setAddingPast(true)} aria-label="過去の記録を追加">
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </div>

      <div className="oc-card oc-chart-card" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="oc-chart-nav">
          <button
            type="button"
            className="oc-date-step"
            onClick={goPrevWindow}
            disabled={isOldestWindow}
            aria-label="前の30日"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="oc-chart-nav-label">
            <span className="oc-eyebrow">体重の変化</span>
            <span className="oc-chart-range">
              {formatShortDate(windowStart)} 〜 {formatShortDate(windowEnd)}
            </span>
          </div>
          <button
            type="button"
            className="oc-date-step"
            onClick={goNextWindow}
            disabled={isNewestWindow}
            aria-label="次の30日"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#DED7C6" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8A8272' }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 'dataMax + 3']} tick={{ fontSize: 11, fill: '#8A8272' }} axisLine={false} tickLine={false} width={34} unit="g" />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #DED7C6', fontSize: 12 }}
                formatter={(v) => [`${v}g`, '体重']}
              />
              <Line type="monotone" dataKey="weight" stroke="#DD7A34" strokeWidth={2.5} dot={{ r: 3, fill: '#DD7A34' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="oc-chart-empty">この期間は体重の記録がありません</p>
        )}
      </div>


      <div className="oc-feather-timeline">
        <div className="oc-feather-shaft" />
        {sorted.map((r, i) => {
          const energyMeta = ENERGY_OPTIONS.find((o) => o.id === r.energy);
          const side = i % 2 === 0 ? 'right' : 'left';
          return (
            <button key={r.date} className={`oc-barb-row oc-barb-${side}`} onClick={() => setSelected(r)}>
              <span className="oc-barb-dot" />
              <span className="oc-barb-line" />
              <span className="oc-barb-card">
                <span className="oc-barb-date">{formatShortDate(r.date)}</span>
                {energyMeta ? <energyMeta.icon size={15} strokeWidth={2.2} className="oc-barb-icon" /> : null}
                {r.weight != null ? <span className="oc-barb-weight">{r.weight}g</span> : null}
                <span className="oc-barb-comment">
                  {r.comment ? r.comment : '（ひとことなし）'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditingRecord(selected);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------
   一括インポート
--------------------------------------------------------- */

const IMPORT_TEMPLATE = `# 1行 = 1日分。以下の順番で「｜」区切りで入力してください
# 日付｜元気度｜食欲｜行動｜体重(朝)｜体重(昼)｜体重(晩)｜ご飯前(朝)｜ご飯後(朝)｜ご飯前(昼)｜ご飯後(昼)｜ご飯前(晩)｜ご飯後(晩)｜投薬・おやつ｜気になること｜ひとこと
# 元気度・食欲が分からない日は "-" か空欄でOK（体重・ご飯の記録だけでも読み込めます）
# 元気度: 元気いっぱい / いつも通り / 少し静か / 気になる変化あり
# 食欲: よく食べた / 普通 / 少なかった
# 行動: よく遊んだ・甘えてきた・よく鳴いた・新しいことをした・よく寝た（複数はカンマ区切り）
2026-07-05 | - | - |  | 91.1 |  |  | 50.4 |  | 50.3 |  | 50.3 |  | ネクトン、おでかけ | 中くらいの羽が1本抜けた |
2026-07-09 | 元気いっぱい | よく食べた | よく遊んだ | 91.6 | 93.0 | 93.2 | 50.6 |  | 50.2 |  | 50.5 |  | おやつ 栗 | | 元気で食欲もあり`;

// ノートの写真から読み取った過去分。まだ記録が無い日付だけ、初回起動時に自動で追加する。
const SEED_TEXT = `2026-05-17 | - | - |  | 91.3 |  | 91.3 |  |  |  |  |  |  |  | 車でも吐かない、いい子にしている |
2026-05-18 | - | - |  | 90.6 | 91.3 | 92.3 |  |  |  |  |  |  | ペレット1/3、シード2/3 | 体重に注意。1日1回発情してる |
2026-05-19 | - | - |  | 91.2 | 92.5 | 93.1 |  |  |  |  |  |  |  | 体重が増えすぎるので病院のダイエットごはん+ネクトンに変更 |
2026-05-20 | - | - |  | 92.9 | 93.4 | 93.2 |  |  |  |  |  |  |  | おやつを食べなかったのに体重が急増 |
2026-05-21 | - | - |  | 92.2 | 92.7 | 93.7 |  |  |  |  |  |  |  | 時々発情する |
2026-05-22 | - | - |  | 92.4 | 93.1 | 94.2 |  |  |  |  |  |  |  | 体重がどんどん増える |
2026-05-23 | - | - |  | 92.4 | 93.6 |  |  |  |  |  |  |  |  | ご飯の量が少ないのが気になるのでシードとペレット半々にしてみるが、体重が増えるのでなるべくペレット(砕いたもの)をあげる方針に |
2026-05-24 | - | - |  | 93.8 |  |  |  |  |  |  |  |  | シード2/3、ペレット1/3 |  |
2026-05-25 | - | - |  | 93.2 | 94.2 | 94.7 |  |  |  |  |  |  |  | 50gあげると太る?少し少なめにあげてみる(49.5〜49.7) |
2026-05-26 | - | - |  | 93.6 |  |  |  |  |  |  |  |  |  |  |
2026-05-27 | - | - |  | 94.0 | 95.8 | 95.4 |  |  |  |  |  |  |  | 病院で検査。薬は今日で終わり。そのう検査がんばった |
2026-05-28 | - | - |  | 94.4 | 95.9 | 95.9 |  |  |  |  |  |  |  |  |
2026-05-29 | - | - |  | 95.6 | 95.4 | 96.9 |  |  |  |  |  |  |  | 激太り。50gあげると体重が増える?少し減らしてみる |
2026-05-30 | - | - |  | 95.7 | 95.9 | 95.7 |  |  |  |  |  |  |  | 体重増えすぎ。おやつがまん |
2026-05-31 | - | - |  | 94.1 |  |  |  |  |  |  |  |  |  |  |
2026-06-01 | - | - |  | 95.6 |  | 96.8 |  |  |  |  |  |  |  |  |
2026-06-02 | - | - |  | 95.8 |  |  |  |  |  |  |  |  |  |  |
2026-06-03 | - | - |  | 96.1 |  |  |  |  |  |  |  |  |  | お昼シードにネクトン。ペレットはいったんやめる |
2026-06-04 | - | - |  | 95.6 | 97.0 | 98.3 |  |  |  |  |  |  |  |  |
2026-06-05 | - | - |  |  |  | 97.6 |  |  |  |  |  |  |  | 0.5gあげてゲージに入れる |
2026-06-06 | - | - |  | 96.5 |  |  |  |  |  |  |  |  |  |  |
2026-06-07 | - | - |  | 95.8 |  |  |  |  |  |  |  |  |  |  |
2026-06-08 | - | - |  | 97.0 |  |  |  |  |  |  |  |  |  |  |
2026-06-09 | - | - |  | 97.0 | 97.8 | 98.1 | 49.7 | 48.1 |  |  |  |  | おやつ 栗玉ひとつ |  |
2026-06-10 | - | - |  | 97.3 |  |  |  |  |  |  |  |  | おやつ 栗玉ひとつ |  |
2026-06-11 | - | - |  | 96.2 |  |  |  |  |  |  |  |  |  | 少しおるすばん。朝の体重、少し落ち着く |
2026-06-12 | - | - |  | 96.6 |  |  |  |  |  |  |  |  |  |  |
2026-06-13 | - | - |  | 97.0 |  |  |  |  |  |  |  |  |  | おでかけ |
2026-06-14 | - | - |  | 95.9 |  |  |  |  |  |  |  |  |  |  |
2026-06-15 | - | - |  | 96.0 |  |  |  |  |  |  |  |  |  | ままちゃんがいなくてどんどん痩せていく。寂しいと痩せる |
2026-06-16 | - | - |  | 95.9 |  |  |  |  |  |  |  |  |  |  |
2026-06-17 | - | - |  | 95.2 |  |  |  |  |  |  |  |  |  |  |
2026-06-18 | - | - |  | 95.1 |  |  |  |  |  |  |  |  |  |  |
2026-06-19 | - | - |  | 95.1 |  |  |  |  |  |  |  |  | ネクトン | 羽が抜ける(尾羽・中くらいの羽)。もふもふした腿。測り忘れ、ペレット測らせてくれない |
2026-06-20 | - | - |  | 95.0 |  |  |  |  |  |  |  |  |  |  |
2026-06-21 | - | - |  | 94.2 |  |  |  |  |  |  |  |  | ペレット | 今日は羽抜けない |
2026-06-22 | - | - |  | 94.0 |  |  |  |  |  |  |  |  | ペレット | 食事の時間になってもあまり欲しがらない。30分くらい遅れて食べる。食欲◎ |
2026-06-23 | - | - |  | 94.6 |  |  |  |  |  |  |  |  | ペレット |  |
2026-06-24 | - | - |  | 94.3 |  |  |  |  |  |  |  |  | ペレット | おとなしい、いい子 |
2026-06-25 | - | - |  | 94.4 |  |  |  |  |  |  |  |  | ペレット | おびかけ鳥 |
2026-06-26 | - | - |  | 93.6 |  |  |  |  |  |  |  |  |  |  |
2026-06-27 | - | - |  | 93.9 |  |  |  |  |  |  |  |  |  | やせた⚠️尾羽抜ける |
2026-06-28 | - | - |  | 92.4 |  |  |  |  |  |  |  |  |  |  |
2026-06-29 | - | - |  | 92.0 |  | 93.6 |  |  |  |  |  |  |  | ちょんまげ抜ける。少し発情ぎみ |
2026-06-30 | - | - |  | 92.2 |  | 93.4 |  |  |  |  |  |  | ペレット |  |
2026-07-01 | - | - |  | 91.8 | 92.4 | 92.5 |  |  |  |  |  |  | ペレット |  |
2026-07-02 | - | - |  | 91.9 | 93.2 | 93.3 |  |  |  |  |  |  | ペレット | 今日から夜タオルケットをかけて寝る |
2026-07-03 | - | - |  | 92.2 | 92.8 | 92.7 |  |  |  |  |  |  | ペレット |  |
2026-07-04 | - | - |  | 91.8 |  |  |  |  |  |  |  |  |  | おでかけ。暑くて新しい車でちょっと疲れる |
2026-07-05 | - | - |  | 91.1 |  |  | 50.4 |  | 50.3 |  | 50.3 |  | ネクトン、おでかけ | きのう疲れたのと、中くらいの羽1本抜けて尾羽が1本減った |
2026-07-06 | - | - |  | 91.3 |  | 92.4 | 50.3 | 48.1 | 50.3 | 48.0 | 50.4 |  | ペレット |  |
2026-07-07 | - | - |  | 90.6 | 92.0 | 92.8 | 50.2 |  | 50.6 | 48.6 | 50.4 |  | ネクトン | 中くらいの羽抜ける／ちょんまげや小さな尾羽もたくさん抜ける |
2026-07-08 | - | - |  | 91.4 |  | 92.7 | 51.0 |  | 50.5 |  | 50.6 |  | ネクトン、おやつ フォンオパティ、朝昼ネクトン | 小さめの尾羽?抜ける | ご飯多め、ネクトンふる
2026-07-09 | 元気いっぱい | よく食べた |  | 91.6 | 93.0 | 93.2 | 50.6 |  | 50.2 |  | 50.5 |  | ペレット、おやつ 栗 | | 元気で食欲もあり
2026-07-10 | - | - |  | 92.7 | 93.0 | 93.8 | 50.4 |  | 50.4 |  | 50.3 |  | ペレット |  |
2026-07-11 | - | - |  | 93.0 | 93.7 | 94.1 | 50.0 |  | 50.0 |  | 50.1 |  |  |  |
2025-06-08 | - | - |  |  |  |  |  |  |  |  |  |  |  | 卵を取る。発情ぎみ |
2025-06-09 | - | - |  |  |  |  |  |  |  |  |  |  |  | 夕方突然元気消失、りっか動物病院を受診。触診では卵詰まりなしとのこと。帰宅後ご飯を食べて回復 |
2025-06-10 | - | - |  |  |  |  |  |  |  |  |  |  |  | また夕方元気消失、りっか動物病院を再診。エコーで柔らかい卵がありカルシウム注射。帰宅後も元気なし、ご飯も食べず。21時頃活動的になり栗玉と水を飲む。何度もふんばるがうんちが出ず苦しそう。22時にようやくうんち(溜まっていて大きい)。AM4時に枕元で大きいうんち。夜間心配で眠れず |
2025-06-11 | - | - |  | 105 |  |  |  |  |  |  |  |  | 抗菌剤・カルシウム・発情抑制剤を毎食0.2mlずつ開始(藤井先生) | 藤井先生受診、1日様子見に。18:30殻の薄い卵を1個目産卵(バラバラの殻)。無事産んで一安心。その後、硬い殻の卵と差し替えると抱卵開始、元気な様子 |
2025-06-12 | - | - |  |  |  |  |  |  |  |  |  |  | 抗菌剤・カルシウム・発情抑制剤 継続 | 朝いつも通りご飯・薬。水浴びなど元気そう。保温をやめてゲージ位置を変更したが1回発情したため元の位置に戻す。16時藤井先生再診、ご飯の量の管理と薬の継続を指示 |
2025-06-13 | - | - |  | 101 |  | 98 | 1 |  |  |  | 1 |  | 抗菌剤等 0.2ml×3 | 外にいる時間長め、数回発情 |
2025-06-14 | - | - |  | 96 | 96 | 96 | 1.5 |  | 1.5 |  | 1 |  | 抗菌剤等 0.2ml×3 | 正常な卵を2個目産卵。落ち着いている |
2025-06-15 | - | - |  | 96.5 | 97.5 | 97 | 1.5 |  | 1.5 |  | 1.5 |  |  |  |
2025-06-16 | - | - |  | 95.9 | 96 | 97.9 | 1 |  | 1.9 |  | 1.2 |  |  |  |
2025-06-17 | - | - |  | 97.8 | 97.3 |  | 0.7 |  | 1.2 |  |  |  |  |  |
2025-06-18 | - | - |  | 96.8 |  |  | 1 |  |  |  |  |  |  | 卵を3個目産卵(正常)。いつも通りの様子、元気 |
2025-06-19 | - | - |  | 91.4 | 90.6 | 90 | 0.7 |  | 1 |  | 1.1 |  |  | 藤井先生受診、新しい薬をもらう |
2025-06-20 | - | - |  | 89.2 | 89.5 | 89 | 0.9 |  | 0.9 |  | 0.9 |  |  |  |
2025-06-21 | - | - |  | 88.1 |  |  | 1.3 |  |  |  |  |  |  | 記録忘れ(昼・夕) |
2025-06-22 | - | - |  | 88.6 | 88.5 | 88.1 | 1 |  | 1 |  | 0.4 |  |  |  |
2025-06-23 | - | - |  |  | 87.6 | 87.8 |  |  | 1 |  | 1.4 |  |  | 記録忘れ(朝) |
2025-06-24 | - | - |  |  |  |  |  |  |  |  |  |  |  | みんなでいぶの家に行く。リラックスしてご飯もよく食べる(その間は卵を取り、帰宅後戻す) |
2025-06-25 | - | - |  | 88.2 | 87.9 | 87.4 |  |  |  |  |  |  |  |  |
2025-06-26 | - | - |  | 86.9 | 87.8 | 87.1 | 1.2 |  | 1.8 |  |  |  |  |  |
2025-06-27 | - | - |  | 86.9 | 88.3 | 87.8 | 1.4 |  | 1.8 |  |  |  |  |  |
2025-06-28 | - | - |  | 87.5 | 88.4 | 87.3 | 1.4 |  |  |  | 2 |  |  | 夕方以降にご飯をあげる時は夕ご飯を半分ずつに分けてあげる |
2025-06-29 | - | - |  | 87.2 | 88.8 | 88.4 | 1.5 |  |  |  | 2 |  |  |  |
2025-06-30 | - | - |  | 88.5 |  |  | 1 |  |  |  |  |  |  | 記録忘れ(昼・夕) |
2025-07-01 | - | - |  | 88.4 | 88.9 |  | 1.5 |  | 1.8 |  |  |  | ネクトンは朝だけに変更。藤井先生から薬をもらう(抗菌剤はなし、発情抑える薬とカルシウムは半分量) |  |
2025-07-02 | - | - |  | 89.6 | 89.5 | 89.5 | 1.4 |  | 1.4 |  | 1.1 |  |  | この頃から薬を上手に飲めるようになる。ご飯を食べる量も増える |
2025-07-03 | - | - |  | 89.3 | 89.2 | 89.5 | 1.8 |  | 2.6 |  |  |  |  |  |
2025-07-04 | - | - |  | 88.5 | 89.8 | 89.7 | 1.7 |  | 1.1 |  | 2 |  |  |  |
2025-07-05 | - | - |  | 88.4 |  |  | 1.4 |  |  |  |  |  |  | 記録忘れ(昼・夕) |
2025-07-06 | - | - |  | 88.8 | 90.3 | 91.0 | 1.6 |  | 1.6 |  | 1.6 |  | 投薬0.2ml×3 |  |
2025-07-07 | - | - |  | 89.2 | 89.5 | 90.3 | 1.6 |  | 1.6 |  | 1.6 |  |  |  |
2025-07-08 | - | - |  | 89.0 | 90.1 | 90.8 | 1.8 |  | 1.9 |  | 1.5 |  |  |  |
2025-07-09 | - | - |  | 90.1 | 90.0 | 90.7 | 1.8 |  | 1.8 |  | 1.1 |  |  | 卵を取る。発情3回くらい。卵は戻さず、夜は下で寝る |
2025-07-10 | - | - |  | 89.8 | 91.0 | 91.4 | 1.0 |  | 1.7 |  |  |  | 投薬量を1日1mlに増量 | 上で寝るようにする |
2025-07-11 | - | - |  | 89.6 | 91.3 | 92.1 | 1.9 |  | 1.2 |  | 1.7 |  |  |  |
2025-07-12 | - | - |  | 89.8 | 91.5 | 92.5 |  |  | 1.2 |  | 1.6 |  |  | 発情止まる。羽が抜け始める(換羽期) |
2025-07-13 | - | - |  | 90.7 | 92.5 | 93.4 | 2.0 |  | 2.1 |  | 1.8 |  |  | おやつ いりこ |
2025-07-14 | - | - |  | 91.5 | 93.4 | 93.2 | 2.2 |  | 1.6 |  | 1.8 |  |  | おやつ |
2025-07-15 | - | - |  | 91.5 | 91.8 | 92.1 | 2.3 |  | 1.3 |  | 1.6 |  | 薬を1日0.6mlに減量、朝と夕にネクトン | |
2025-07-16 | - | - |  | 90.7 | 91.8 | 91.8 | 2.0 |  | 1.6 |  | 1.7 |  | ネクトンは1日2回 |  |
2025-07-17 | - | - |  | 90.7 |  | 93.2 | 1.8 |  |  |  | 1.7 |  |  | お出かけ。1日何度もうとうとする |
2025-07-18 | - | - |  | 91.5 | 92.0 |  | 1.7 |  | 1.7 |  |  |  |  |  |
2025-07-19 | - | - |  | 92.3 | 93.4 | 93.4 | 1.6 |  | 1.4 |  |  |  |  | 少しバナナ・レタスを食べる |
2025-07-20 | - | - |  | 92.6 |  |  |  |  |  |  |  |  |  | 山口までおでかけ。おやつをいろいろたくさん食べる。お昼はお留守番、ご飯あまり食べない |
2025-07-21 | - | - |  | 90.1 |  |  | 1.2 |  |  |  |  |  |  | お留守番。ご飯あまり食べない |
2025-07-22 | - | - |  | 88.9 | 90.1 | 90.5 | 1.6 |  |  |  | 1.6 |  |  | 夕方から元気になる。食欲も↑。頬がちくちく(換羽) |
2025-07-23 | - | - |  | 89.0 | 89.8 |  | 1.6 |  | 2.0 |  |  |  | 投薬0.1mlに減量 | おやつ バナナ・フォニオパティ・いりこ少し・レタス |
2025-07-24 | - | - |  | 88.4 | 89.4 |  | 1.6 |  | 1.3 |  | 1.7 |  |  | おやつ かぼちゃ・レタス |
2025-07-25 | - | - |  | 88.6 | 90.2 | 89.9 | 1.7 |  | 1.3 |  | 2.1 |  |  | レタスたくさん食べる |
2025-07-26 | - | - |  |  |  | 90.5 |  |  |  |  |  |  | 薬を1日0.3mlに減らしてみる | あわ玉2個。夕方まではうとうと、夕方以降は元気に |
2025-07-27 | - | - |  | 88.2 | 89.6 | 91.6 | 1.1 |  |  |  | 1.8 |  |  |  |
2025-07-28 | - | - |  | 89.9 | 91.2 |  | 1.7 |  | 1.5 |  |  |  |  |  |
2025-07-29 | - | - |  | 91.0 | 89.9 |  | 1.2 |  | 1.7 |  |  |  |  | 羽がだいぶ生えてきた |
2025-07-30 | - | - |  | 89.0 | 89.0 |  | 1.4 |  | 1.5 |  |  |  |  |  |
2025-07-31 | - | - |  | 88.2 | 89.2 |  | 1.3 |  | 1.6 |  |  |  | 薬をさらに減量(朝0.1・昼0.1) |  |
2025-08-01 | - | - |  | 88.3 | 90.4 |  | 2.0 |  | 2.1 |  |  |  |  | いぶが来てずっとくっついている。ちゃんと認識してる |
2025-08-02 | - | - |  | 88.8 | 89.5 |  | 1.6 |  | 1.7 |  |  |  |  | レタス。ネクトンは1日2回。ずっと甘えんぼ |
2025-08-03 | - | - |  | 88.3 |  | 91.5 | 1.3 |  | 2.2 |  | 1.7 |  |  | おやつ コーン |
2025-08-04 | - | - |  | 90.1 | 90.3 |  |  |  | 1.8 |  | 1.2 |  |  |  |
2025-08-05 | - | - |  | 89.4 |  |  |  |  |  |  | 1.8 |  |  | コーン2粒 |
2025-08-06 | - | - |  | 90.5 | 90.4 |  | 1.8 |  | 2.0 |  | 1.2 |  |  | コーン2つ、いりこ・竹炭少し |
2025-08-07 | - | - |  |  | 87.0 |  | 0.8 |  | 2.5 |  | 2.6 |  |  |  |
2025-08-08 | - | - |  | 90.8 |  |  | 1.8 |  |  |  |  |  |  | お留守番 |
2025-08-09 | - | - |  | 90.0 | 91.4 |  | 1.3 |  | 1.7 |  | 2.5 |  | 薬を1日1回0.1mlに減量。ネクトンは朝昼 | 藤井先生に薬のことを相談。換羽でしんどそうでもカルシウムの他にビタミン剤なども含まれているので続けても大丈夫とのこと |
2025-08-10 | - | - |  | 90.4 |  |  |  |  |  |  |  |  | 薬は朝0.1mlのみ。今週で終了予定 | お留守番 |
2025-08-11 | - | - |  |  | 90.2 |  |  |  |  |  |  |  |  | バナナ少し |
2025-08-12 | - | - |  | 89.3 |  |  |  |  |  |  |  |  |  | 竹炭とパリパリのおやつ |
2025-08-13 | - | - |  |  |  |  |  |  |  |  |  |  | 薬をやめる |  おでかけ。いっぱいご飯とおやつ食べる |
2025-08-14 | - | - |  |  |  | 89.6 |  |  |  |  |  |  |  |  |
2025-08-15 | - | - |  | 88.0 |  |  |  |  |  |  |  |  |  |  |
2025-08-16 | - | - |  | 87.8 |  |  |  |  |  |  |  |  | ネクトン朝昼半分ずつ | 順調に薬を減らせているので中止して様子を見てよいとのこと(病院) |
2025-08-17 | - | - |  | 87.4 |  |  |  |  |  |  |  |  | ネクトンは朝1回だけにする |  |
2025-08-18 | - | - |  | 84.5 |  |  |  |  |  |  |  |  |  | 前日のお留守番が寂しかったのかお昼はべったりくっついている |
2025-08-19 | - | - |  | 85.2 |  |  |  |  |  |  |  |  |  | ご飯を探し回ってすこし部屋をうろうろする |
2025-08-20 | - | - |  |  | 87.0 |  |  |  |  |  |  |  |  | フォニオパティ少し。毛並みがよくなる、つやつや |
2025-08-21 | - | - |  | 85.9 |  |  |  |  |  |  |  |  |  |  |
2025-08-22 | - | - |  | 86.8 |  |  |  |  |  |  |  |  |  | 毛並みつやつやかわいい |
2025-08-23 | - | - |  | 86.5 |  |  |  |  |  |  |  |  |  | おでかけ |
2025-08-24 | - | - |  | 87.2 |  |  |  |  |  |  |  |  |  | あわ玉1個 |
2025-08-25 | - | - |  | 87.1 |  |  |  |  |  |  |  |  |  | 2回発情する。フォニオパティ少し |
2025-08-26 | - | - |  | 87.0 |  | 88.0 |  |  |  |  |  |  |  |  |
2025-08-27 | - | - |  | 86.5 |  |  |  |  |  |  |  |  |  | その後発情なし |
2025-08-28 | - | - |  |  | 87.5 |  |  |  |  |  |  |  |  |  |
2025-08-29 | - | - |  | 87.7 |  |  |  |  |  |  |  |  |  |  |
2025-08-31 | - | - |  | 87.5 |  |  |  |  |  |  |  |  |  |  |
2025-09-01 | - | - |  | 88.0 |  |  |  |  |  |  |  |  |  |  |
2025-09-02 | - | - |  | 88.0 |  |  |  |  |  |  |  |  | ネクトンをまぜる | 食欲アップ |
2025-09-03 | - | - |  | 88.3 |  |  |  |  |  |  |  |  | 竹炭・いりこ少し | ペレットもよく食べる。食欲がいい |
2025-09-04 | - | - |  | 88.5 |  |  |  |  |  |  |  |  |  |  |
2025-09-05 | - | - |  | 88.2 |  |  |  |  |  |  |  |  |  |  |
2025-09-06 | - | - |  | 88.0 |  |  |  |  |  |  |  |  |  | つめ切り、途中で切る |
2025-09-07 | - | - |  | 87.7 |  |  |  |  |  |  |  |  |  | 以前の体重に比べると痩せているが90g位になると時々発情してしまう。残りのつめ切りもする |
2025-09-08 | - | - |  |  |  |  |  |  |  |  |  |  |  | 早く寝かせる |
2025-09-09 | - | - |  | 89.0 |  |  |  |  |  |  |  |  |  |  |
2025-09-10 | - | - |  | 88.9 |  |  |  |  |  |  |  |  |  | 2回発情する |
2025-09-11 | - | - |  | 88.9 |  |  |  |  |  |  |  |  |  |  |
2025-09-12 | - | - |  | 89.1 |  |  |  |  |  |  |  |  |  |  |
2025-09-13 | - | - |  | 89.6 |  |  |  |  |  |  |  |  |  |  |
2025-09-14 | - | - |  | 89.2 |  |  |  |  |  |  |  |  |  |  |
2025-09-15 | - | - |  | 89.5 |  |  |  |  |  |  |  |  |  | おでかけ |
2025-09-16 | - | - |  | 89.4 |  |  |  |  |  |  |  |  |  |  |
2025-09-17 | - | - |  | 89.8 | 90.5 | 91.3 |  |  |  |  |  |  |  |  |
2025-09-18 | - | - |  | 90.5 | 90.1 | 92.4 |  |  |  |  |  |  | 体重が増加傾向、注意 |
2025-09-19 | - | - |  | 90.1 |  |  |  |  |  |  |  |  |  | キャンプへおでかけ |
2025-09-20 | - | - |  | 90.2 | 90.2 | 91.2 |  |  |  |  |  |  |  | 発情なし、いい |
2025-09-21 | - | - |  | 90.0 | 91.3 |  |  |  |  |  |  |  |  | 時々発情しかけて心配 |
2025-09-22 | - | - |  | 90.9 | 91.8 |  |  |  |  |  |  |  |  |  |
2025-09-23 | - | - |  | 91.7 |  |  |  |  |  |  |  |  |  | おでかけ |
2025-09-24 | - | - |  | 91.7 |  |  |  |  |  |  |  |  |  | おでかけ |
2025-09-25 | - | - |  | 90.3 |  | 90.7 |  |  |  |  |  |  |  |  |
2025-09-26 | - | - |  | 89.5 |  |  |  |  |  |  |  |  |  |  |
2025-09-27 | - | - |  |  | 90.3 | 90.3 |  |  |  |  |  |  |  |  |
2025-09-28 | - | - |  | 89.5 | 90.4 |  |  |  |  |  |  |  |  |  |
2025-09-29 | - | - |  | 90.1 | 90.8 |  |  |  |  |  |  |  |  |  |
2025-09-30 | - | - |  | 90.0 | 91.8 | 92.3 |  |  |  |  |  |  |  |  |
2025-10-01 | - | - |  | 90.9 | 91.4 | 92.0 |  |  |  |  |  |  |  | 種のことで気になる記載あり(判読困難) |
2025-10-02 | - | - |  |  |  | 92.7 |  |  |  |  |  |  |  |  |
2025-10-03 | - | - |  | 91.5 | 91.4 | 92.6 |  |  |  |  |  |  |  | おやつ3つ |
2025-10-04 | - | - |  | 91.0 | 92.2 | 92.6 |  |  |  |  |  |  |  |  |
2025-10-05 | - | - |  | 91.2 |  | 93.0 |  |  |  |  |  |  |  | おでかけ。いっぱい食べてほしい |
2025-10-06 | - | - |  | 92.0 | 94.2 | 92.1 |  |  |  |  |  |  | 食べすぎ注意!! |  |
2025-10-07 | - | - |  | 93.0 |  |  |  |  |  |  |  |  |  |  |
2025-10-08 | - | - |  | 92.1 | 93.7 |  |  |  |  |  |  |  |  |  |
2025-10-09 | - | - |  | 93.8 | 93.5 | 93.9 |  |  |  |  |  |  |  | ご飯はいつも通りなのに体重が増える |
2025-10-10 | - | - |  | 92.8 | 94.3 | 94.9 |  |  |  |  |  |  |  | 体重増加が止まらない |
2025-10-11 | - | - |  | 93.2 | 94.3 | 95.3 |  |  |  |  |  |  |  | ご飯はいつもの量、体重増加続く |
2025-10-12 | - | - |  | 93.5 |  | 95.8 |  |  |  |  |  |  |  |  |
2025-10-13 | - | - |  | 94.8 | 95.8 | 96.0 |  |  |  |  |  |  |  | 6時になると寝はじめ、そのままゲージへ |
2025-10-14 | - | - |  | 94.5 | 95.0 | 95.8 |  |  |  |  |  |  |  |  |
2025-10-15 | - | - |  | 94.5 | 95.4 | 96.5 |  |  |  |  |  |  |  |  |
2025-10-16 | - | - |  | 95.1 |  | 96.0 |  |  |  |  |  |  |  | おでかけ |
2025-10-17 | - | - |  | 94.9 | 96.4 | 97.9 |  |  |  |  |  |  |  | 体重増加とまらない |
2025-10-18 | - | - |  |  | 96.7 | 97.7 |  |  |  |  |  |  |  |  |
2025-10-19 | - | - |  | 95.8 |  |  |  |  |  |  |  |  |  |  |
2025-10-20 | - | - |  | 96.5 |  |  |  |  |  |  |  |  |  |  |
2025-10-21 | - | - |  | 95.7 |  |  |  |  |  |  |  |  |  |  |
2025-10-22 | - | - |  | 96.5 |  |  |  |  |  |  |  |  |  |  |
2025-10-23 | - | - |  | 96.8 |  |  |  |  |  |  |  |  |  |  |
2025-10-24 | - | - |  | 96.0 |  |  |  |  |  |  |  |  |  |  |
2025-10-25 | - | - |  | 95.9 |  |  |  |  |  |  |  |  |  |  |
2025-10-26 | - | - |  | 95.5 |  |  |  |  |  |  |  |  |  |  |
2025-10-27 | - | - |  | 95.9 |  |  |  |  |  |  |  |  |  |  |
2025-10-28 | - | - |  |  |  |  |  |  |  |  |  |  |  | 花村家でお留守番。ゲージから出てつかまえられず、疲れなかった |
2025-10-29 | - | - |  | 94.2 |  |  |  |  |  |  |  |  |  |  |
2025-10-30 | - | - |  | 94.1 |  |  |  |  |  |  |  |  |  |  |
2025-10-31 | - | - |  | 94.0 |  |  |  |  |  |  |  |  |  |  |
2025-11-02 | - | - |  | 92.6 |  |  |  |  |  |  |  |  |  |  |
2025-11-03 | - | - |  | 92.9 |  |  |  |  |  |  |  |  |  | 車中泊。おびえている |
2025-11-04 | - | - |  |  |  |  |  |  |  |  |  |  |  | 激やせ |
2025-11-05 | - | - |  | 90.3 |  | 91.7 |  |  |  |  |  |  |  |  |
2025-11-06 | - | - |  | 91.2 |  | 91.7 |  |  |  |  |  |  |  | うれしそうな様子 |
2025-11-07 | - | - |  | 89.9 | 90.7 | 91.5 |  |  |  |  |  |  |  | おやつ あわ玉2個、さくさく少し |
2025-11-08 | - | - |  |  |  |  |  |  |  |  |  |  |  | おでかけ |
2025-11-09 | - | - |  | 91.2 |  | 92.3 |  |  |  |  |  |  |  |  |
2025-11-10 | - | - |  | 91.4 |  |  |  |  |  |  |  |  |  |  |
2025-11-11 | - | - |  | 90.9 | 92.0 | 92.3 |  |  |  |  |  |  |  |  |
2025-11-12 | - | - |  | 91.1 |  | 92.0 |  |  |  |  |  |  |  |  |
2025-11-13 | - | - |  | 89.9 | 91.0 | 91.8 |  |  |  |  |  |  |  | 健康診断に行く、良好 |
2025-11-14 | - | - |  | 89.0 | 90.9 | 90.2 |  |  |  |  |  |  |  | ともちゃんとおでかけ |
2025-11-15 | - | - |  | 89.1 | 90.4 | 91.4 |  |  |  |  |  |  |  |  |
2025-11-16 | - | - |  | 90.0 | 91.2 | 91.7 |  |  |  |  |  |  |  | ともちゃんとおでかけ |
2025-11-17 | - | - |  | 90.0 | 91.6 | 92.0 |  |  |  |  |  |  |  |  |
2025-11-18 | - | - |  | 90.3 |  | 91.8 |  |  |  |  |  |  |  |  |
2025-11-19 | - | - |  | 89.8 | 90.9 | 92.2 |  |  |  |  |  |  |  |  |
2025-11-20 | - | - |  | 89.9 | 91.7 | 92.8 |  |  |  |  |  |  |  |  |
2025-11-21 | - | - |  | 90.5 | 92.5 | 92.8 |  |  |  |  |  |  |  |  |
2025-11-22 | - | - |  | 90.5 | 91.6 | 92.2 |  |  |  |  |  |  |  |  |
2025-11-23 | - | - |  | 90.3 | 91.0 |  |  |  |  |  |  |  |  |  |
2025-11-24 | - | - |  | 90.6 |  |  |  |  |  |  |  |  |  |  |
2025-11-25 | - | - |  | 90.4 | 90.8 |  |  |  |  |  |  |  |  |  |
2025-11-26 | - | - |  | 90.9 | 91.5 |  |  |  |  |  |  |  |  |  |
2025-11-27 | - | - |  | 90.6 |  |  |  |  |  |  |  |  |  | 車で移動。おりこうさんにしていた |
2025-11-28 | - | - |  | 89.5 | 90.6 |  |  |  |  |  |  |  |  |  |
2025-11-29 | - | - |  |  |  |  |  |  |  |  |  |  |  | 体重測定できず |
2025-11-30 | - | - |  | 90.6 |  |  |  |  |  |  |  |  |  |  |
2025-12-01 | - | - |  | 91.6 |  | 92.4 |  |  |  |  |  |  |  |  |
2025-12-02 | - | - |  | 91.3 | 92.8 |  |  |  |  |  |  |  |  |  |
2025-12-03 | - | - |  | 91.1 |  |  |  |  |  |  |  |  |  | おでかけ |
2025-12-04 | - | - |  | 90.7 | 91.3 | 92.7 |  |  |  |  |  |  |  |  |
2025-12-05 | - | - |  | 91.3 | 92.5 | 93.8 |  |  |  |  |  |  |  | 体重増加に注意 |
2025-12-06 | - | - |  |  | 94.0 | 94.7 |  |  |  |  |  |  |  | 体重増加が続く |
2025-12-07 | - | - |  | 91.2 | 92.6 | 93.0 |  |  |  |  |  |  |  |  |
2025-12-08 | - | - |  | 92.6 | 93.9 | 94.5 |  |  |  |  |  |  |  |  |
2025-12-09 | - | - |  | 92.6 | 93.8 | 95.5 |  |  |  |  |  |  |  |  |
2025-12-10 | - | - |  | 93.1 | 94.1 | 94.7 |  |  |  |  |  |  |  |  |
2025-12-11 | - | - |  |  | 94.7 | 95.0 |  |  |  |  |  |  |  |  |
2025-12-13 | - | - |  | 93.9 | 94.6 | 95.9 |  |  |  |  |  |  |  | 体重増加 |
2025-12-14 | - | - |  | 93.8 | 95.8 | 96.5 |  |  |  |  |  |  |  |  |
2025-12-15 | - | - |  | 94.8 |  |  |  |  |  |  |  |  |  |  |
2025-12-16 | - | - |  | 94.1 | 94.7 |  |  |  |  |  |  |  |  |  |
2025-12-17 | - | - |  | 94.0 | 95.7 |  |  |  |  |  |  |  |  | ごはん減らし作戦を開始 |
2025-12-18 | - | - |  | 94.1 | 94.8 |  |  |  |  |  |  |  |  |  |
2025-12-19 | - | - |  | 94.3 | 94.0 | 97.8 |  |  |  |  |  |  |  |  |
2025-12-20 | - | - |  | 93.3 | 93.1 | 97.3 |  |  |  |  |  |  |  | ごはん減らし作戦継続 |
2025-12-21 | - | - |  | 92.1 |  |  |  |  |  |  |  |  |  | ごはん減らし作戦成功 |
2025-12-22 | - | - |  | 91.2 | 91.3 | 92.0 |  |  |  |  |  |  |  |  |
2025-12-23 | - | - |  | 91.3 | 91.5 | 93.1 |  |  |  |  |  |  |  |  |
2025-12-24 | - | - |  | 91.9 | 92.4 | 92.8 |  |  |  |  |  |  |  |  |
2025-12-25 | - | - |  | 90.9 | 91.5 | 92.3 |  |  |  |  |  |  |  |  |
2025-12-26 | - | - |  | 90.3 | 91.7 |  |  |  |  |  |  |  |  |  |
2025-12-27 | - | - |  | 89.3 | 90.7 | 91.2 |  |  |  |  |  |  |  |  |
2025-12-29 | - | - |  | 89.8 |  |  |  |  |  |  |  |  |  |  |
2025-12-30 | - | - |  | 90.1 |  |  |  |  |  |  |  |  |  |  |
2025-12-31 | - | - |  | 89.4 |  |  |  |  |  |  |  |  |  |  |
2026-01-01 | - | - |  | 89.5 |  |  |  |  |  |  |  |  |  |  |
2026-01-02 | - | - |  | 89.5 | 89.4 | 92.1 |  |  |  |  |  |  |  | 移動(車で3か所) |
2026-01-03 | - | - |  | 89.0 | 88.4 |  |  |  |  |  |  |  |  | とてもおりこうさん |
2026-01-04 | - | - |  | 88.3 |  |  |  |  |  |  |  |  |  |  |
2026-01-05 | - | - |  | 88.3 |  | 88.3 |  |  |  |  |  |  |  |  |
2026-01-06 | - | - |  | 88.1 |  |  |  |  |  |  |  |  |  | おでかけ。おりこうさん |
2026-01-07 | - | - |  | 86.8 | 88.0 | 88.0 |  |  |  |  |  |  |  | 体重が少し下がる |
2026-01-08 | - | - |  | 87.3 |  | 86.9 |  |  |  |  |  |  |  |  |
2026-01-09 | - | - |  | 86.6 | 86.1 | 87.3 |  |  |  |  |  |  |  |  |
2026-01-10 | - | - |  | 86.0 |  | 85.9 |  |  |  |  |  |  |  |  |
2026-01-11 | - | - |  | 85.3 |  |  |  |  |  |  |  |  |  |  |
2026-01-12 | - | - |  |  |  | 86.2 |  |  |  |  |  |  |  |  |
2026-01-13 | - | - |  | 85.3 | 84.6 |  |  |  |  |  |  |  |  | おひっこし |
2026-01-14 | - | - |  |  |  | 85.8 |  |  |  |  |  |  |  | おひっこし |
2026-01-15 | - | - |  | 84.6 |  | 86.1 |  |  |  |  |  |  |  | おひっこし |
2026-01-16 | - | - |  | 84.2 |  | 85.2 |  |  |  |  |  |  |  |  |
2026-01-17 | - | - |  | 83.8 | 84.1 |  |  |  |  |  |  |  |  |  |
2026-01-18 | - | - |  | 84.0 |  | 84.4 |  |  |  |  |  |  |  | お留守番ばかり…ごめんね |
2026-01-19 | - | - |  | 84.5 |  | 85.2 |  |  |  |  |  |  |  |  |
2026-01-20 | - | - |  | 83.3 |  | 85.8 |  |  |  |  |  |  |  | 新しいおうちに慣れてきたよ |
2026-01-21 | - | - |  | 84.0 | 85.6 |  |  |  |  |  |  |  |  |  |
2026-01-22 | - | - |  | 84.0 | 85.1 |  |  |  |  |  |  |  |  |  |
2026-01-23 | - | - |  | 83.9 | 85.6 | 85.7 |  |  |  |  |  |  |  |  |
2026-01-25 | - | - |  | 84.5 |  | 85.2 |  |  |  |  |  |  |  |  |
2026-01-26 | - | - |  | 85.0 | 85.9 | 85.8 |  |  |  |  |  |  |  |  |
2026-01-27 | - | - |  | 85.2 | 85.3 | 86.4 |  |  |  |  |  |  |  |  |
2026-01-28 | - | - |  | 85.6 | 86.9 | 86.8 |  |  |  |  |  |  |  | 体重増加 |
2026-01-29 | - | - |  | 85.2 | 85.2 | 86.2 |  |  |  |  |  |  |  | 甘えんぼ |
2026-01-30 | - | - |  | 85.6 | 86.4 | 87.4 |  |  |  |  |  |  |  |  |
2026-01-31 | - | - |  | 85.5 | 87.4 |  |  |  |  |  |  |  |  |  |
2026-02-01 | - | - |  | 85.7 |  | 88.4 |  |  |  |  |  |  |  | おでかけ |
2026-02-02 | - | - |  | 85.6 |  | 87.4 |  |  |  |  |  |  |  |  |
2026-02-03 | - | - |  | 85.4 | 86.7 | 87.6 |  |  |  |  |  |  |  | 夜中地震で眠れず。ちっちゃい羽がぱらぱら抜ける |
2026-02-04 | - | - |  | 85.5 | 86.7 | 87.2 |  |  |  |  |  |  |  |  |
2026-02-05 | - | - |  | 86.6 | 87.8 |  |  |  |  |  |  |  |  | お留守番、少し多め |
2026-02-06 | - | - |  | 87.5 |  | 87.7 |  |  |  |  |  |  |  |  |
2026-02-07 | - | - |  | 86.6 | 89.1 | 90.1 |  |  |  |  |  |  |  | 体重増えすぎ |
2026-02-08 | - | - |  | 87.4 |  | 50.3 |  |  |  |  |  |  |  |  |
2026-02-09 | - | - |  | 88.1 |  | 90.0 |  |  |  |  |  |  | ネクトン少し入れる | 毎食入れると食欲増えすぎるので注意 |
2026-02-10 | - | - |  | 88.5 | 88.3 | 89.8 |  |  |  |  |  |  |  |  |
2026-02-11 | - | - |  | 87.8 | 88.8 | 89.7 |  |  |  |  |  |  |  |  |
2026-02-12 | - | - |  | 88.1 | 89.5 | 90.2 |  |  |  |  |  |  |  |  |
2026-02-13 | - | - |  | 88.4 | 89.2 | 89.2 |  |  |  |  |  |  |  |  |
2026-02-14 | - | - |  | 88.0 | 90.3 |  |  |  |  |  |  |  |  | つめ切りがんばったよ |
2026-02-15 | - | - |  |  | 91.7 | 92.1 |  |  |  |  |  |  |  | 抜け毛が減る |
2026-02-16 | - | - |  | 90.6 | 91.1 | 91.9 |  |  |  |  |  |  |  |  |
2026-02-17 | - | - |  | 90.2 | 91.2 | 91.8 |  |  |  |  |  |  |  | 日中ずっとうとうと。でもご飯の時間にはぴったり気付いて食欲あり |
2026-02-18 | - | - |  | 90.5 | 91.6 | 92.5 |  |  |  |  |  |  |  |  |
2026-02-19 | - | - |  | 90.2 | 91.6 | 92.1 |  |  |  |  |  |  |  |  |
2026-02-20 | - | - |  | 90.3 | 91.8 |  |  |  |  |  |  |  |  |  |
2026-02-21 | - | - |  | 90.3 | 91.9 | 93.1 |  |  |  |  |  |  |  |  |
2026-02-22 | - | - |  | 90.8 |  |  |  |  |  |  |  |  |  | 家の駐車場に着くとのびをしてちゃんとわかってる様子。おりこうさん |
2026-02-23 | - | - |  | 90.4 | 92.1 | 92.6 |  |  |  |  |  |  |  |  |
2026-02-24 | - | - |  | 90.5 | 92.1 | 91.9 |  |  |  |  |  |  |  |  |
2026-02-25 | - | - |  | 90.5 | 90.3 |  |  |  |  |  |  |  |  |  |
2026-02-26 | - | - |  | 90.8 | 91.9 | 92.8 |  |  |  |  |  |  |  | 抜ける羽がまた増えたので夕方1回ネクトンを入れる |
2026-02-27 | - | - |  | 91.3 | 92.1 |  |  |  |  |  |  |  |  |  |
2026-02-28 | - | - |  | 91.5 | 92.2 | 93.3 |  |  |  |  |  |  |  | 昼間ずっとうとうと。食欲は良い |
2026-03-01 | - | - |  | 90.7 | 93.3 |  |  |  |  |  |  |  |  | 体重いっきに↑。キッチンでお昼もうとうと |
2026-03-02 | - | - |  | 91.1 | 92.3 | 93.0 |  |  |  |  |  |  |  | 羽ぱらぱら |
2026-03-03 | - | - |  | 91.6 |  | 92.1 |  |  |  |  |  |  |  | 夜寒いかな?時々明け方や夜中にエアコンを入れる。朝起きた時は元気 |
2026-03-04 | - | - |  | 90.6 | 91.1 | 91.9 |  |  |  |  |  |  |  | 尾羽もぱらぱら。1日1食ネクトンを入れる |
2026-03-05 | - | - |  | 90.4 | 91.2 | 91.9 |  |  |  |  |  |  | フォニオパティ |  |
2026-03-06 | - | - |  | 90.6 | 91.4 | 92.5 |  |  |  |  |  |  |  | pm6:00に寝て、体重のリズムが安定 |
2026-03-07 | - | - |  | 90.3 | 92.0 | 92.4 |  |  |  |  |  |  |  |  |
2026-03-08 | - | - |  | 90.3 |  | 92.0 |  |  |  |  |  |  |  | おでかけ。顔の毛が新しく生えてきてつんつん |
2026-03-09 | - | - |  | 90.4 | 92.2 | 91.9 |  |  |  |  |  |  |  | 夕方6時に寝て7時ごろ起きる。体重のリズムが整う |
2026-03-10 | - | - |  | 90.4 | 91.0 | 92.3 |  |  |  |  |  |  |  | 小さい羽が抜ける |
2026-03-11 | - | - |  | 90.2 | 90.7 | 91.4 |  |  |  |  |  |  |  | 体重安定。食欲あり |
2026-03-12 | - | - |  | 89.2 | 90.2 | 90.8 |  |  |  |  |  |  |  | 3時になるとおやつちょうだいって言うよ |
2026-03-13 | - | - |  | 89.5 | 90.2 | 90.2 |  |  |  |  |  |  |  | ガス屋さんが来たけどいい子にしてたよ |
2026-03-14 | - | - |  | 87.5 |  | 90.2 |  |  |  |  |  |  |  | 最近3時ごろになるとおやつをちょうだいとせがむ。体重は元に戻った |
2026-03-15 | - | - |  | 86.9 | 88.8 | 89.7 |  |  |  |  |  |  |  | ごはん少し増量 |
2026-03-16 | - | - |  | 87.7 | 88.7 | 89.2 |  |  |  |  |  |  |  | マンションの工事が始まる。大きい音がするとびっくりしてくっついてくる |
2026-03-17 | - | - |  | 87.3 | 89.2 | 89.2 |  |  |  |  |  |  |  |  |
2026-03-18 | - | - |  | 87.3 | 88.9 | 89.5 |  |  |  |  |  |  |  |  |
2026-03-19 | - | - |  | 87.3 | 87.0 | 86.0 |  |  |  |  |  |  |  | 尾羽抜ける |
2026-03-20 | - | - |  | 84.4 | 85.4 |  |  |  |  |  |  |  |  | 体重がすごく減る |
2026-03-21 | - | - |  | 84.2 | 86.0 |  |  |  |  |  |  |  |  | おとまり |
2026-03-22 | - | - |  |  |  |  |  |  |  |  |  |  |  | おとまり |
2026-03-23 | - | - |  | 82.3 | 84.3 | 85.3 |  |  |  |  |  |  | ネクトン毎食、おやつもしっかり | 家の工事の音や旅先で落ち着かずストレス多め。昼間離れない。レタスをよく食べる |
2026-03-24 | - | - |  | 83.5 | 84.8 | 86.4 |  |  |  |  |  |  |  |  |
2026-03-25 | - | - |  | 83.6 | 84.0 | 85.0 |  |  |  |  |  |  | 毎食ネクトン | 工事が静かだから落ち着いてる。食欲良い。ご飯しっかりあげる |
2026-03-26 | - | - |  | 83.8 | 85.2 | 85.8 |  |  |  |  |  |  |  | 羽が抜けなくなる。換羽期終わり? |
2026-03-27 | - | - |  | 84.4 | 85.5 | 86.8 |  |  |  |  |  |  |  |  |
2026-03-28 | - | - |  | 83.8 | 85.5 | 86.7 |  |  |  |  |  |  |  | 尾羽抜ける |
2026-03-29 | - | - |  | 84.3 | 85.5 | 86.2 |  |  |  |  |  |  |  | 小さい羽がぱらぱら抜ける |
2026-03-30 | - | - |  | 85.0 | 85.5 | 86.4 |  |  |  |  |  |  |  |  |
2026-03-31 | - | - |  | 84.6 | 86.1 | 86.8 |  |  |  |  |  |  | ネクトン1回 | おやつもしっかり |
2026-04-01 | - | - |  | 85.1 | 85.7 | 87.2 |  |  |  |  |  |  |  | 夜はまだヒーターをつける。横にくっついて寝る |
2026-04-02 | - | - |  | 85.8 |  | 87.5 |  |  |  |  |  |  |  | 工事の人を見てちょっと怖がってる。でもいい子 |
2026-04-03 | - | - |  | 85.8 | 86.7 | 88.4 |  |  |  |  |  |  |  | まだまだ夜は寒かった、ヒーター必要。減っていた体重が戻った |
2026-04-04 | - | - |  | 86.3 |  |  |  |  |  |  |  |  |  | おでかけ |
2026-04-05 | - | - |  | 85.5 | 88.9 | 90.1 |  |  |  |  |  |  |  | 体重が増えた。90をキープしたいけどできるかな |
2026-04-06 | - | - |  | 87.6 | 88.3 | 89.1 |  |  |  |  |  |  |  | 食欲良い |
2026-04-07 | - | - |  | 87.5 | 89.2 | 90.8 |  |  |  |  |  |  |  | 食欲旺盛なのでご飯あげすぎ注意 |
2026-04-08 | - | - |  | 87.8 | 89.2 | 90.0 |  |  |  |  |  |  |  | 新しいゲージでご飯食べれたよ |
2026-04-09 | - | - |  | 88.1 | 88.9 | 89.7 |  |  |  |  |  |  |  |  |
2026-04-10 | - | - |  | 88.3 | 90.2 | 90.2 |  |  |  |  |  |  |  | いつも甘えん坊でおりこうさん、かわいい |
2026-04-11 | - | - |  | 88.6 |  | 90.3 |  |  |  |  |  |  |  |  |
2026-04-12 | - | - |  | 88.5 |  | 89.9 |  |  |  |  |  |  |  | いつもと違う部屋でねんね… |
2026-04-13 | - | - |  | 88.2 | 90.4 |  |  |  |  |  |  |  |  |  |
2026-04-14 | - | - |  | 88.5 | 90.4 | 90.8 |  |  |  |  |  |  |  | 食欲アップ、注意 |
2026-04-15 | - | - |  | 89.0 |  | 91.0 |  |  |  |  |  |  |  | 体重アップ、注意 |
2026-04-16 | - | - |  | 89.5 | 89.8 | 90.9 |  |  |  |  |  |  |  | いつもと違う部屋にだいぶ慣れたよ |
2026-04-17 | - | - |  | 90.2 | 91.2 | 91.5 |  |  |  |  |  |  |  | 体重増。ご飯の量を控えめに |
2026-04-18 | - | - |  | 90.1 |  |  |  |  |  |  |  |  | お留守番 |
2026-04-19 | - | - |  | 90.2 | 91.1 | 92.1 |  |  |  |  |  |  |  | 体重増えた…注意 |
2026-04-20 | - | - |  | 90.2 | 91.4 | 92.7 |  |  |  |  |  |  |  | ごはんを少し減らす |
2026-04-21 | - | - |  | 90.1 | 89.1 | 90.1 |  |  |  |  |  |  | お薬 | 朝5:30起きて吐く。その後ご飯を食べてもまた2〜3度吐く。病院でそのうが悪いか、地震か工事のストレスかもとお薬をもらって帰る |
2026-04-22 | - | - |  | 88.0 | 89.2 | 90.1 |  |  |  |  |  |  |  | 大声で鳴く。元気すぎるのでネクトンはなし。少し吐く?食欲はある |
2026-04-23 | - | - |  | 88.4 | 89.8 | 89.1 |  |  |  |  |  |  | 栗玉、フォニオパティ | 土屋動物病院でメガバクテリアと判明。おやつをほしがる、頭をなでさせてくれた |
2026-04-24 | - | - |  | 85.9 |  | 87.3 |  |  |  |  |  |  | むき栗、フォニオパティ、パウダー | 帰宅してすぐご飯を食べるもののまた吐く。吐き気は止まる。やわらかめのうんち(濃い緑色、白と2色) |
2026-04-25 | - | - |  | 85.9 | 88.8 | 90.1 |  |  |  |  |  |  | 病院ごはん、パウダー | 調子よし。水浴びする。お薬を上手に飲む |
2026-04-26 | - | - |  | 86.5 | 88.7 | 89.3 |  |  |  |  |  |  | 病院ごはん、カルシウム | よく食べる。お腹が空いた様子で追加のごはん |
2026-04-27 | - | - |  | 87.2 | 89.6 | 89.9 |  |  |  |  |  |  | 病院ごはん、すりえ、カルシウム、海と山の実り | ペレットは食べない |
2026-04-28 | - | - |  | 87.7 | 88.1 | 89.6 |  |  |  |  |  |  | 海と山の実り、卵のからカルシウム、ネクトン少し、ペレット3粒 | 顔つきがだいぶ元気そう。久しぶりにペレットを食べる |
2026-04-29 | - | - |  | 87.5 |  | 89.1 |  |  |  |  |  |  |  | いつもの時間にご飯をほしがるように。体重計にもちゃんと乗ってくれる。久しぶりにお出かけ |
2026-04-30 | - | - |  | 88.3 | 89.1 | 89.9 |  |  |  |  |  |  |  | いつものご飯の時間に欲しがって、ちゃんと体重計にも乗ってくれる |
2026-05-01 | - | - |  | 87.9 | 89.1 | 89.6 |  |  |  |  |  |  |  | うんちの大きさだいぶいつも通り。おやつに栗玉1個 |
2026-05-02 | - | - |  | 87.9 |  |  |  |  |  |  |  |  |  | 変わりなし |
2026-05-03 | - | - |  |  |  |  |  |  |  |  |  |  | 同じ薬の新しいもの、消化器管の調子を良くする薬 | 新車で出かけていた途中、車内で吐く。病院を受診。水は飲むもののご飯は食べず寝る |
2026-05-04 | - | - |  | 86.5 |  |  |  |  |  |  |  |  | 病院のごはん多め、むき栗、ネクトン | 朝ゲージを見たらおしっこはしてる様子、うんちはすごく少ない。あまりいいうんちが出ない |
2026-05-05 | - | - |  |  |  |  |  |  |  |  |  |  | 病院のごはん、小松菜、ネクトン、卵のからカルシウム | いいうんちが出る。吐き気もなし。元気によく鳴く、呼び鳴きもする |
2026-05-06 | - | - |  |  |  |  |  |  |  |  |  |  |  | 起きてすぐ元気。12時と13時に吐くがその後落ち着く。15時にフォニオパティを食べて吐き気が止まり、以降異常なし |
2026-05-07 | - | - |  |  |  |  |  |  |  |  |  |  |  | 少しお留守番できた。吐き気はなし |
2026-05-08 | - | - |  |  |  |  |  |  |  |  |  |  |  | 普段どおりにご飯の量を増やす。よく食べる、元気そう。体内時計ぴったり |
2026-05-09 | - | - |  | 87.3 |  |  |  |  |  |  |  |  |  | 朝8:45に2回吐くがその後落ち着く。フォニオパティで吐き気止まり完食。帰る途中の車で1回吐くが、家に戻ると活動的で嬉しそう |
2026-05-10 | - | - |  | 87.4 | 88.4 | 88.0 |  |  |  |  |  |  | 薬を1種類(黄色)にしてみる | むき栗は食べないがふつうのご飯はよく食べて元気。いいうんち、未消化なし |
2026-05-11 | - | - |  | 87.6 | 88.6 | 89.2 |  |  |  |  |  |  |  | 朝元気に起きて飛ぶ。むき栗食べない。ふつうのご飯よく食べて元気 |
2026-05-12 | - | - |  | 89.1 | 89.0 | 89.7 |  |  |  |  |  |  |  | ごはんも元気によく食べる。1回発情する |
2026-05-13 | - | - |  | 88.8 | 89.6 | 89.9 |  |  |  |  |  |  |  | 元気に飛び回る。食欲もいい。衣替えの間、おりこうさん |
2026-05-14 | - | - |  | 90.3 | 90.2 | 91.1 |  |  |  |  |  |  |  | おやつに栗玉1つ |
2026-05-15 | - | - |  | 90.2 | 90.8 | 91.5 |  |  |  |  |  |  | フォニオパティ少し | かわいいけどご飯あげすぎ注意 |
2026-05-16 | - | - |  | 90.7 | 90.9 |  |  |  |  |  |  | ネクトン少しだけ | いつもより多めにペレットを砕いてごはんに混ぜる。食べ残しなし。車で吐かなかった |`;
const SEED_RECORDS = parseBulkText(SEED_TEXT).records;

function BulkImport({ existingDates, onImport, onClose }) {
  const [text, setText] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(null);

  const { records, errors } = useMemo(() => parseBulkText(text), [text]);
  const overwriteCount = useMemo(
    () => records.filter((r) => existingDates.includes(r.date)).length,
    [records, existingDates]
  );

  const handleImport = async () => {
    if (records.length === 0) return;
    setImporting(true);
    try {
      await onImport(records);
      setDone(records.length);
    } finally {
      setImporting(false);
    }
  };

  if (done != null) {
    return (
      <div className="oc-screen">
        <div className="oc-empty-state">
          <Check size={30} strokeWidth={1.6} />
          <h2>{done}件、読み込みました</h2>
          <p>アルバムに反映されています</p>
        </div>
        <button className="oc-button oc-button-primary" onClick={onClose}>
          アルバムを見る
        </button>
      </div>
    );
  }

  return (
    <div className="oc-screen">
      <div className="oc-today-header">
        <span className="oc-eyebrow">Import</span>
        <h2>まとめて読み込む</h2>
      </div>

      <p className="oc-import-desc">
        ノートの写真をチャットに送ってもらえれば、この形式のテキストに変換します。できたテキストをここに貼り付けてください。
      </p>

      <button type="button" className="oc-text-link" onClick={() => setShowTemplate((v) => !v)}>
        {showTemplate ? '入力例を隠す' : '入力例・書き方を見る'}
      </button>

      {showTemplate ? <pre className="oc-import-template">{IMPORT_TEMPLATE}</pre> : null}

      <label className="oc-field">
        <span>ここに貼り付け</span>
        <textarea
          rows={8}
          placeholder={'2026-06-01 | 元気いっぱい | よく食べた | よく遊んだ | 92 | 元気だった'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      {text.trim() ? (
        <div className="oc-card oc-import-preview">
          <div className="oc-summary-row">
            <span className="oc-badge">{records.length}件 読み込めます</span>
            {overwriteCount > 0 ? <span className="oc-badge oc-badge-warn">{overwriteCount}件は上書きされます</span> : null}
            {errors.length > 0 ? <span className="oc-badge oc-badge-warn">{errors.length}行 エラー</span> : null}
          </div>
          {errors.length > 0 ? (
            <div className="oc-import-errors">
              {errors.slice(0, 6).map((e, i) => (
                <p key={i}>
                  {e.line}行目: {e.message}
                </p>
              ))}
              {errors.length > 6 ? <p>他 {errors.length - 6}件のエラー</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="oc-form-actions">
        <button type="button" className="oc-button oc-button-ghost" onClick={onClose}>
          キャンセル
        </button>
        <button
          type="button"
          className="oc-button oc-button-primary"
          disabled={records.length === 0 || importing}
          onClick={handleImport}
        >
          {importing ? <Loader2 size={18} className="oc-spin" /> : <Check size={18} />}
          {records.length > 0 ? `${records.length}件を読み込む` : '読み込む'}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   プロフィールタブ
--------------------------------------------------------- */

function ProfileTab({ profile, records, onUpdateProfile, onResetAll, onImportRecords }) {
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(profile);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => setForm(profile), [profile]);

  const genderLabel = GENDER_OPTIONS.find((g) => g.id === profile.gender)?.label || '不明';

  if (importing) {
    return (
      <BulkImport
        existingDates={records.map((r) => r.date)}
        onImport={onImportRecords}
        onClose={() => setImporting(false)}
      />
    );
  }

  if (editing) {
    return (
      <div className="oc-screen">
        <div className="oc-today-header">
          <span className="oc-eyebrow">Profile</span>
          <h2>プロフィールを編集</h2>
        </div>
        <form
          className="oc-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await onUpdateProfile(form);
            setEditing(false);
          }}
        >
          <label className="oc-field">
            <span>名前</span>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="oc-field-row">
            <label className="oc-field">
              <span>誕生日</span>
              <input type="date" value={form.birthday || ''} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </label>
            <label className="oc-field">
              <span>お迎え日</span>
              <input type="date" value={form.adoptedDate || ''} onChange={(e) => setForm({ ...form, adoptedDate: e.target.value })} />
            </label>
          </div>
          <div className="oc-field">
            <span>性別</span>
            <div className="oc-chip-row">
              {GENDER_OPTIONS.map((g) => (
                <Chip key={g.id} active={form.gender === g.id} onClick={() => setForm({ ...form, gender: g.id })}>
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>
          <label className="oc-field">
            <span>写真URL</span>
            <input type="url" value={form.photoUrl || ''} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} />
          </label>
          <div className="oc-form-actions">
            <button type="button" className="oc-button oc-button-ghost" onClick={() => setEditing(false)}>
              キャンセル
            </button>
            <button type="submit" className="oc-button oc-button-primary">
              <Check size={18} /> 保存する
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="oc-screen">
      <div className="oc-profile-hero">
        <div className="oc-profile-portrait">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt={profile.name} onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : (
            <Bird size={36} strokeWidth={1.6} />
          )}
        </div>
        <h2>{profile.name}</h2>
        <p className="oc-profile-sub">{genderLabel}</p>
      </div>

      <div className="oc-card oc-stat-grid">
        <div className="oc-stat">
          <Egg size={18} strokeWidth={1.8} />
          <span className="oc-stat-value">{ageText(profile.birthday) || '未登録'}</span>
          <span className="oc-stat-label">生まれてから</span>
        </div>
        <div className="oc-stat">
          <CalendarHeart size={18} strokeWidth={1.8} />
          <span className="oc-stat-value">{profile.adoptedDate ? `${daysBetween(profile.adoptedDate)}日` : '未登録'}</span>
          <span className="oc-stat-label">お迎えから</span>
        </div>
        <div className="oc-stat">
          <BookOpen size={18} strokeWidth={1.8} />
          <span className="oc-stat-value">{records.length}日分</span>
          <span className="oc-stat-label">記録した日</span>
        </div>
      </div>

      <button className="oc-button oc-button-ghost" onClick={() => setEditing(true)}>
        <PenLine size={16} /> プロフィールを編集
      </button>

      <button className="oc-button oc-button-ghost" onClick={() => setImporting(true)}>
        <CalendarPlus size={16} /> ノートのデータをまとめて読み込む
      </button>

      <div className="oc-danger-zone">
        {confirmReset ? (
          <div className="oc-card oc-confirm-card">
            <p>本当にすべての記録を消去しますか？この操作は取り消せません。</p>
            <div className="oc-form-actions">
              <button className="oc-button oc-button-ghost oc-button-sm" onClick={() => setConfirmReset(false)}>
                やめる
              </button>
              <button
                className="oc-button oc-button-danger oc-button-sm"
                onClick={async () => {
                  await onResetAll();
                  setConfirmReset(false);
                }}
              >
                消去する
              </button>
            </div>
          </div>
        ) : (
          <button className="oc-text-danger" onClick={() => setConfirmReset(true)}>
            すべてのデータを消去する
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ルート
--------------------------------------------------------- */

const TABS = [
  { id: 'today', label: '今日', icon: Sun },
  { id: 'album', label: 'アルバム', icon: BookOpen },
  { id: 'profile', label: 'プロフィール', icon: Bird },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [tab, setTab] = useState('today');
  const [toast, setToast] = useState('');
  const [storageWarning, setStorageWarning] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get(PROFILE_KEY, false);
        if (p?.value) setProfile(JSON.parse(p.value));
      } catch (err) {
        /* プロフィール未登録、または読み込み失敗 */
        console.error('profile load error:', err);
      }
      let baseRecords = [];
      try {
        const r = await window.storage.get(RECORDS_KEY, false);
        if (r?.value) baseRecords = JSON.parse(r.value);
      } catch (err) {
        console.error('records load error:', err);
      }

      // ノートから読み取った過去分を、まだ無い日付だけ自動で追加する
      const existingDatesSet = new Set(baseRecords.map((r) => r.date));
      const missingSeed = SEED_RECORDS.filter((r) => !existingDatesSet.has(r.date));
      if (missingSeed.length) {
        const merged = [...baseRecords, ...missingSeed];
        setRecords(merged);
        try {
          if (window.storage) await window.storage.set(RECORDS_KEY, JSON.stringify(merged), false);
        } catch (err) {
          console.error('seed save error:', err);
        }
        setToast(`ノートから${missingSeed.length}日分を自動で読み込みました`);
        setTimeout(() => setToast(''), 2600);
      } else {
        setRecords(baseRecords);
      }

      setLoading(false);
    })();
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  // window.storageへの保存をまとめて行い、失敗したら画面上に分かる警告を出す
  const persist = useCallback(async (key, value) => {
    try {
      if (!window.storage) throw new Error('保存機能(window.storage)がこの画面では使えません');
      const result = await window.storage.set(key, value, false);
      if (!result) throw new Error('保存APIが空の応答を返しました');
      setStorageWarning('');
      return true;
    } catch (err) {
      console.error('storage save error:', err);
      setStorageWarning(err?.message || '保存に失敗しました');
      return false;
    }
  }, []);

  const handleCreateProfile = useCallback(
    async (formData) => {
      const newProfile = { ...formData, createdAt: Date.now() };
      setProfile(newProfile);
      const ok = await persist(PROFILE_KEY, JSON.stringify(newProfile));
      showToast(ok ? 'プロフィールを保存しました' : '保存に失敗しました(下の警告を確認してください)');
    },
    [persist, showToast]
  );

  const handleSaveRecord = useCallback(
    async (record) => {
      let nextRecords = null;
      setRecords((prev) => {
        nextRecords = [...prev.filter((r) => r.date !== record.date), record];
        return nextRecords;
      });
      const ok = await persist(RECORDS_KEY, JSON.stringify(nextRecords));
      showToast(ok ? '記録を保存しました' : '保存に失敗しました(下の警告を確認してください)');
    },
    [persist, showToast]
  );

  const handleUpdateProfile = useCallback(
    async (next) => {
      setProfile(next);
      const ok = await persist(PROFILE_KEY, JSON.stringify(next));
      showToast(ok ? 'プロフィールを更新しました' : '保存に失敗しました(下の警告を確認してください)');
    },
    [persist, showToast]
  );

  const handleImportRecords = useCallback(
    async (newRecords) => {
      let nextRecords = null;
      setRecords((prev) => {
        const byDate = new Map(prev.map((r) => [r.date, r]));
        newRecords.forEach((r) => byDate.set(r.date, r));
        nextRecords = [...byDate.values()];
        return nextRecords;
      });
      const ok = await persist(RECORDS_KEY, JSON.stringify(nextRecords));
      showToast(ok ? `${newRecords.length}件 読み込みました` : '保存に失敗しました(下の警告を確認してください)');
    },
    [persist, showToast]
  );

  const handleResetAll = useCallback(async () => {
    try {
      if (window.storage) await window.storage.delete(RECORDS_KEY, false);
    } catch (err) {
      /* もともと無い場合は無視 */
    }
    setRecords([]);
    showToast('記録を消去しました');
  }, [showToast]);

  const handleRetrySave = useCallback(async () => {
    let ok = true;
    if (profile) ok = (await persist(PROFILE_KEY, JSON.stringify(profile))) && ok;
    ok = (await persist(RECORDS_KEY, JSON.stringify(records))) && ok;
    showToast(ok ? '保存し直しました' : 'まだ保存できていません');
  }, [profile, records, persist, showToast]);

  return (
    <div className="oc-app">
      <style>{CSS}</style>
      <div className="oc-phone">
        {loading ? (
          <div className="oc-loading">
            <Loader2 size={28} className="oc-spin" />
          </div>
        ) : !profile ? (
          <Onboarding onComplete={handleCreateProfile} />
        ) : (
          <>
            <div className="oc-content">
              {storageWarning ? (
                <div className="oc-storage-banner">
                  <AlertCircle size={16} />
                  <div>
                    <strong>保存できていません</strong>
                    <p>{storageWarning}</p>
                    <p>この画面を閉じると、直前の変更が消える可能性があります。</p>
                  </div>
                  <button onClick={handleRetrySave}>再試行</button>
                </div>
              ) : null}
              {tab === 'today' ? <TodayTab profile={profile} records={records} onSaveRecord={handleSaveRecord} /> : null}
              {tab === 'album' ? <AlbumTab profile={profile} records={records} onSaveRecord={handleSaveRecord} /> : null}
              {tab === 'profile' ? (
                <ProfileTab
                  profile={profile}
                  records={records}
                  onUpdateProfile={handleUpdateProfile}
                  onResetAll={handleResetAll}
                  onImportRecords={handleImportRecords}
                />
              ) : null}
            </div>

            <nav className="oc-tabbar">
              {TABS.map((t) => (
                <button key={t.id} className={`oc-tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
                  <t.icon size={20} strokeWidth={tab === t.id ? 2.4 : 1.8} />
                  <span>{t.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        {toast ? <div className="oc-toast">{toast}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   スタイル
--------------------------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;600&display=swap');

:root {
  --bg: #E8E3D6;
  --surface: #FFFFFF;
  --surface-soft: #F6F2E7;
  --ink: #33301F;
  --ink-soft: #8A8272;
  --accent: #DD7A34;
  --accent-deep: #B85A1F;
  --accent-wash: #F5DFC6;
  --gold: #E3B23C;
  --sage: #7C8A6E;
  --line: #DED7C6;
  --danger: #B4432F;
}

.oc-app * { box-sizing: border-box; }
.oc-app {
  font-family: 'Noto Sans JP', sans-serif;
  color: var(--ink);
  display: flex;
  justify-content: center;
  padding: 24px 12px;
  background: radial-gradient(circle at 50% 0%, #EFE9DC 0%, #DFD8C6 100%);
  min-height: 100vh;
}

.oc-phone {
  width: 100%;
  max-width: 420px;
  min-height: 780px;
  background: var(--bg);
  border-radius: 34px;
  box-shadow: 0 30px 60px -20px rgba(51, 48, 31, 0.35), 0 0 0 10px #2B2820;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.oc-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.oc-spin { animation: oc-spin 1s linear infinite; }
@keyframes oc-spin { to { transform: rotate(360deg); } }

.oc-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 12px;
}

.oc-screen {
  padding: 28px 20px 20px;
}

/* --- タブバー --- */
.oc-tabbar {
  display: flex;
  border-top: 1px solid var(--line);
  background: var(--surface);
}
.oc-tab {
  flex: 1;
  border: none;
  background: none;
  padding: 10px 0 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: var(--ink-soft);
  font-size: 11px;
  font-family: 'Noto Sans JP', sans-serif;
  cursor: pointer;
}
.oc-tab.is-active { color: var(--accent-deep); font-weight: 600; }

/* --- 見出し --- */
.oc-eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-deep);
  font-weight: 700;
}
.oc-today-header { margin-bottom: 18px; display: flex; flex-direction: column; gap: 4px; }
.oc-today-header-row { flex-direction: row; align-items: center; justify-content: space-between; }
.oc-icon-button {
  width: 38px; height: 38px; border-radius: 50%; border: none;
  background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
}
.oc-warn { color: var(--accent-deep) !important; }

.oc-series-bar {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface-soft); border-radius: 12px; padding: 10px 12px;
  font-size: 12px; font-weight: 600; color: var(--ink-soft);
}
.oc-series-done {
  border: none; background: var(--accent); color: #fff; border-radius: 999px;
  padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
  font-family: 'Noto Sans JP', sans-serif;
}
.oc-date-row { display: flex; align-items: center; gap: 8px; }
.oc-date-row input { flex: 1; }
.oc-date-step {
  border: 1.5px solid var(--line); background: var(--surface); border-radius: 10px;
  width: 34px; height: 40px; display: flex; align-items: center; justify-content: center;
  color: var(--accent-deep); cursor: pointer; flex-shrink: 0;
}
.oc-series-toast {
  background: var(--accent-wash); color: var(--accent-deep); border-radius: 10px;
  padding: 8px 12px; font-size: 12px; font-weight: 600; margin: 0;
}

.oc-storage-banner {
  display: flex; align-items: flex-start; gap: 10px;
  background: #F5E3DC; border: 1px solid #E0A98A; color: var(--danger);
  border-radius: 14px; padding: 12px 14px; margin: 0 20px 4px;
}
.oc-storage-banner strong { display: block; font-size: 13px; margin-bottom: 2px; }
.oc-storage-banner p { margin: 0; font-size: 11px; line-height: 1.5; color: #8A4230; }
.oc-storage-banner button {
  margin-left: auto; flex-shrink: 0; border: none; background: var(--danger); color: #fff;
  border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
  font-family: 'Noto Sans JP', sans-serif;
}

.oc-import-desc { font-size: 12px; color: var(--ink-soft); line-height: 1.6; margin: 0 0 10px; }
.oc-text-link {
  background: none; border: none; color: var(--accent-deep); font-size: 12px; font-weight: 700;
  text-decoration: underline; cursor: pointer; padding: 0 0 12px; font-family: 'Noto Sans JP', sans-serif;
}
.oc-import-template {
  background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12px;
  padding: 12px; font-size: 11px; line-height: 1.7; white-space: pre-wrap; word-break: break-all;
  color: var(--ink-soft); margin: 0 0 14px; font-family: 'Noto Sans JP', sans-serif;
}
.oc-import-preview { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.oc-badge-warn { background: #F5E3DC; color: var(--danger); }
.oc-import-errors { display: flex; flex-direction: column; gap: 4px; }
.oc-import-errors p { margin: 0; font-size: 11px; color: var(--danger); }
.oc-today-header h2, .oc-section-label h3 {
  font-family: 'Zen Maru Gothic', sans-serif;
  font-weight: 900;
  font-size: 21px;
  margin: 0;
  color: var(--ink);
}
.oc-section-label { margin: 22px 0 10px; }
.oc-section-label-tight { margin: 0 0 6px; }

/* --- オンボーディング --- */
.oc-onboard-hero { text-align: center; margin-bottom: 24px; }
.oc-onboard-bird {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--accent-wash); color: var(--accent-deep);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.oc-onboard-hero h1 {
  font-family: 'Zen Maru Gothic', sans-serif;
  font-size: 23px; line-height: 1.5; font-weight: 900; margin: 0 0 8px;
}
.oc-onboard-hero p { color: var(--ink-soft); font-size: 13px; margin: 0; }

/* --- フォーム --- */
.oc-form { display: flex; flex-direction: column; gap: 14px; }
.oc-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; }
.oc-field em { color: var(--accent-deep); font-style: normal; font-size: 11px; margin-left: 4px; }
.oc-field small { font-weight: 400; color: var(--ink-soft); font-size: 11px; }
.oc-field-row { display: flex; gap: 10px; }
.oc-field-row .oc-field { flex: 1; }
.oc-field input, .oc-field textarea {
  font-family: 'Noto Sans JP', sans-serif;
  border: 1.5px solid var(--line);
  background: var(--surface);
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  color: var(--ink);
  outline: none;
}
.oc-field input:focus, .oc-field textarea:focus { border-color: var(--accent); }
.oc-weight-input {
  display: flex; align-items: center; gap: 8px;
  border: 1.5px solid var(--line); background: var(--surface);
  border-radius: 12px; padding: 4px 12px; color: var(--ink-soft);
}
.oc-weight-input input {
  border: none; padding: 7px 0; flex: 1; background: transparent;
}
.oc-weight-input input:focus { outline: none; }

.oc-triple-input { display: flex; gap: 8px; }
.oc-triple-input .oc-field { flex: 1; }
.oc-food-slot { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
.oc-food-slot-label { font-size: 11px; font-weight: 700; color: var(--accent-deep); display: block; margin-bottom: 6px; }
.oc-food-slot-inputs { margin-bottom: 0; }
.oc-food-eaten { color: var(--accent-deep); font-weight: 700; }
.oc-badge-label { font-size: 11px; font-weight: 700; color: var(--ink-soft); align-self: center; }
.oc-supplement { color: #8A6D2F; }
.oc-concern { color: var(--danger); }

.oc-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.oc-chip {
  display: flex; align-items: center; gap: 6px;
  border: 1.5px solid var(--line); background: var(--surface);
  border-radius: 999px; padding: 8px 14px;
  font-size: 13px; font-weight: 600; color: var(--ink-soft);
  cursor: pointer; font-family: 'Noto Sans JP', sans-serif;
}
.oc-chip.is-active { background: var(--accent); border-color: var(--accent); color: #fff; }

.oc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.oc-option-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  border: 1.5px solid var(--line); background: var(--surface);
  border-radius: 14px; padding: 14px 8px; cursor: pointer;
  color: var(--ink-soft); font-size: 12px; font-weight: 600;
  font-family: 'Noto Sans JP', sans-serif;
}
.oc-option-card.is-active { border-color: var(--accent); background: var(--accent-wash); color: var(--accent-deep); }

.oc-error { color: var(--danger); font-size: 12px; font-weight: 600; margin: 0; }

.oc-button {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  border: none; border-radius: 999px; padding: 13px 20px;
  font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 14px;
  cursor: pointer;
}
.oc-button-primary { background: var(--accent); color: #fff; }
.oc-button-primary:disabled { opacity: 0.6; }
.oc-button-ghost { background: transparent; color: var(--accent-deep); border: 1.5px solid var(--accent-wash); }
.oc-button-danger { background: var(--danger); color: #fff; }
.oc-button-sm { padding: 8px 14px; font-size: 12px; }
.oc-form-actions { display: flex; gap: 10px; margin-top: 4px; }
.oc-form-actions .oc-button { flex: 1; }

.oc-hint {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--ink-soft); margin-top: 16px; justify-content: center;
}

/* --- カード / 今日のまとめ --- */
.oc-card {
  background: var(--surface); border-radius: 18px; padding: 16px;
  border: 1px solid var(--line);
}
.oc-summary-card { display: flex; flex-direction: column; gap: 10px; }
.oc-summary-row { display: flex; gap: 8px; flex-wrap: wrap; }
.oc-badge {
  display: flex; align-items: center; gap: 4px;
  background: var(--accent-wash); color: var(--accent-deep);
  border-radius: 999px; padding: 5px 11px; font-size: 12px; font-weight: 700;
}
.oc-badge-soft { background: var(--surface-soft); color: var(--ink-soft); }
.oc-comment { font-size: 13px; line-height: 1.7; color: var(--ink); margin: 0; white-space: pre-wrap; }
.oc-comment-empty { color: var(--ink-soft); }
.oc-photo-link {
  display: inline-flex; align-items: center; gap: 6px; width: fit-content;
  font-size: 12px; font-weight: 700; color: var(--accent-deep); text-decoration: none;
  background: var(--accent-wash); border-radius: 999px; padding: 6px 12px;
}

/* --- アルバム / 羽根タイムライン --- */
.oc-empty-state {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 10px; padding: 60px 20px; color: var(--ink-soft);
}
.oc-empty-state h2 { font-family: 'Zen Maru Gothic', sans-serif; font-size: 17px; color: var(--ink); margin: 0; }
.oc-empty-state p { font-size: 13px; margin: 0; line-height: 1.6; }

.oc-chart-card { margin-bottom: 20px; touch-action: pan-y; }
.oc-chart-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.oc-chart-nav-label { display: flex; flex-direction: column; align-items: center; gap: 1px; flex: 1; }
.oc-chart-range { font-size: 12px; font-weight: 700; color: var(--ink); }
.oc-date-step:disabled { opacity: 0.35; cursor: default; }
.oc-chart-empty { text-align: center; font-size: 12px; color: var(--ink-soft); padding: 30px 0; margin: 0; }

.oc-feather-timeline { position: relative; padding: 10px 0 10px 4px; }
.oc-feather-shaft {
  position: absolute; left: 50%; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(var(--gold), var(--accent));
  transform: translateX(-50%); border-radius: 2px;
}
.oc-barb-row {
  position: relative; display: flex; align-items: center; width: 100%;
  border: none; background: none; padding: 0; margin-bottom: 22px; cursor: pointer;
  font-family: 'Noto Sans JP', sans-serif; text-align: left;
}
.oc-barb-dot {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 9px; height: 9px; border-radius: 50%; background: var(--accent); border: 2px solid var(--bg); z-index: 2;
}
.oc-barb-line { position: absolute; top: 50%; height: 2px; background: var(--accent); opacity: 0.55; z-index: 1; }
.oc-barb-card {
  display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 9px 12px; width: 46%; font-size: 12px; box-shadow: 0 4px 10px -6px rgba(51,48,31,0.25);
}
.oc-barb-date { font-weight: 700; color: var(--accent-deep); font-size: 11px; flex-shrink: 0; }
.oc-barb-icon { color: var(--accent-deep); flex-shrink: 0; }
.oc-barb-weight { font-size: 11px; color: var(--ink-soft); flex-shrink: 0; }
.oc-barb-comment {
  color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
.oc-barb-right { justify-content: flex-start; }
.oc-barb-right .oc-barb-card { margin-left: 54%; }
.oc-barb-right .oc-barb-line { left: 50%; width: 8%; }
.oc-barb-left { justify-content: flex-end; }
.oc-barb-left .oc-barb-card { margin-right: 54%; }
.oc-barb-left .oc-barb-line { right: 50%; width: 8%; }

/* --- モーダル --- */
.oc-modal-backdrop {
  position: absolute; inset: 0; background: rgba(51,48,31,0.45);
  display: flex; align-items: flex-end; z-index: 10; border-radius: 34px;
}
.oc-modal {
  background: var(--bg); width: 100%; border-radius: 22px 22px 0 0;
  padding: 22px 20px 26px; position: relative; display: flex; flex-direction: column; gap: 10px;
  max-height: 70%; overflow-y: auto;
}
.oc-modal-close {
  position: absolute; right: 16px; top: 16px; border: none; background: var(--surface-soft);
  width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: var(--ink-soft); cursor: pointer;
}

/* --- プロフィール --- */
.oc-profile-hero { text-align: center; margin-bottom: 18px; }
.oc-profile-portrait {
  width: 84px; height: 84px; border-radius: 50%; overflow: hidden;
  background: var(--accent-wash); color: var(--accent-deep);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px; border: 3px solid var(--surface); box-shadow: 0 0 0 1px var(--line);
}
.oc-profile-portrait img { width: 100%; height: 100%; object-fit: cover; }
.oc-profile-hero h2 { font-family: 'Zen Maru Gothic', sans-serif; font-size: 22px; margin: 0; }
.oc-profile-sub { color: var(--ink-soft); font-size: 12px; margin: 2px 0 0; }

.oc-stat-grid { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 16px; }
.oc-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--accent-deep); text-align: center; }
.oc-stat-value { font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; font-size: 14px; color: var(--ink); }
.oc-stat-label { font-size: 10px; color: var(--ink-soft); }

.oc-danger-zone { margin-top: 26px; text-align: center; }
.oc-text-danger { background: none; border: none; color: var(--danger); font-size: 12px; text-decoration: underline; cursor: pointer; }
.oc-confirm-card { text-align: center; }
.oc-confirm-card p { font-size: 12px; color: var(--ink); margin: 0 0 10px; }

/* --- トースト --- */
.oc-toast {
  position: absolute; bottom: 84px; left: 50%; transform: translateX(-50%);
  background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 999px;
  font-size: 12px; font-weight: 600; box-shadow: 0 10px 20px -8px rgba(0,0,0,0.4);
  animation: oc-toast-in 0.25s ease;
}
@keyframes oc-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

@media (max-width: 400px) {
  .oc-phone { border-radius: 0; box-shadow: none; min-height: 100vh; }
  .oc-app { padding: 0; }
}
`;
