import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Svg, {
  Path,
  Line,
  Text as SvgText,
  Circle,
  Polygon,
  Rect,
  G,
} from 'react-native-svg';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import type { EvalMeasure, EvalScoreType } from './EvaluationScreen';

// ─── Palette ────────────────────────────────────────────────────────────────
const PALETTE = {
  bg: '#F8F9FB',
  white: '#FFFFFF',
  accent: '#3B6FEB',
  accentLight: '#EEF3FD',
  border: '#E5E8EE',
  text: '#1A1D23',
  muted: '#6B7280',
  placeholder: '#9CA3AF',
};

// ─── Color picker palette (12 colors) ───────────────────────────────────────
const PICKER_COLORS = [
  '#E53E3E', // Red
  '#DD6B20', // Orange
  '#ECC94B', // Yellow
  '#38A169', // Green
  '#319795', // Teal
  '#3182CE', // Blue
  '#5A67D8', // Indigo
  '#805AD5', // Violet
  '#D53F8C', // Pink
  '#000000', // Black
  '#A0AEC0', // Gray
  '#FFFFFF', // White
];

// ─── Score types ────────────────────────────────────────────────────────────
type ScoreType = 'SS' | 'Scaled' | 'T' | 'Z' | 'Pct';
const SCORE_TYPE_OPTIONS: ScoreType[] = ['SS', 'Scaled', 'T', 'Z', 'Pct'];

// ─── Eval → graph score type mapping ────────────────────────────────────────
const EVAL_TO_GRAPH_SCORE_TYPE: Record<EvalScoreType, ScoreType> = {
  standard: 'SS',
  scaled: 'Scaled',
  tscore: 'T',
  zscore: 'Z',
  percentile: 'Pct',
};

// ─── Math helpers ───────────────────────────────────────────────────────────
function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function inverseCDF(p: number): number {
  if (p <= 0) return -4;
  if (p >= 1) return 4;
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00,
  ];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

function gaussianPDF(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

function toSS(value: number, type: ScoreType): number {
  switch (type) {
    case 'SS': return value;
    case 'Scaled': return ((value - 10) / 3) * 15 + 100;
    case 'T': return ((value - 50) / 10) * 15 + 100;
    case 'Z': return value * 15 + 100;
    case 'Pct': {
      const z = inverseCDF(Math.max(0.001, Math.min(0.999, value / 100)));
      return z * 15 + 100;
    }
  }
}

function ssToZ(ss: number): number { return (ss - 100) / 15; }

// ─── Axis data ───────────────────────────────────────────────────────────────
const SS_AXIS = [40, 55, 70, 85, 100, 115, 130, 145, 160];
const SCALED_AXIS = [2, 4, 6, 8, 10, 12, 14, 16, 18];
const TZ_AXIS = SS_AXIS.map(ss => {
  const z = ssToZ(ss);
  const t = Math.round(z * 10 + 50);
  const zStr = Number.isInteger(z) ? z.toFixed(0) : z.toFixed(1);
  return `${t}/${zStr}`;
});
const PCT_AXIS_VALUES = [1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99];

// ─── Chart geometry (fixed size) ─────────────────────────────────────────────
const CHART_PADDING_LEFT = 8;
const CHART_PADDING_RIGHT = 8;
const CURVE_TOP_PAD = 10;
const AXIS_ROWS_H = 68;
const BAND_LABEL_H = 20;
const SCORE_LABEL_H = 80;
const SS_MIN = 40;
const SS_MAX = 160;

const CHART_W = 850;
const SVG_H = 600;
const CURVE_H = SVG_H - SCORE_LABEL_H - CURVE_TOP_PAD - AXIS_ROWS_H - BAND_LABEL_H - 4;

function ssToX(ss: number, w: number): number {
  return CHART_PADDING_LEFT + ((ss - SS_MIN) / (SS_MAX - SS_MIN)) * (w - CHART_PADDING_LEFT - CHART_PADDING_RIGHT);
}

function zToCurveY(z: number, curveH: number): number {
  const maxPdf = gaussianPDF(0);
  return SCORE_LABEL_H + CURVE_TOP_PAD + (1 - gaussianPDF(z) / maxPdf) * curveH;
}

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface ScoreEntry {
  id: string;
  label: string;
  score: string;
  scoreType: ScoreType;
  color: string;
}

interface CategoryLine {
  id: string;
  score: string;
  scoreType: ScoreType;
  leftLabel: string;
  shade: boolean;
  shadeColor: string;
}

function emptyEntry(id: string, colorIdx: number): ScoreEntry {
  return { id, label: '', score: '', scoreType: 'SS', color: PICKER_COLORS[colorIdx % PICKER_COLORS.length] };
}

// ─── Default category lines ───────────────────────────────────────────────────
const DEFAULT_CATEGORY_LINES: CategoryLine[] = [
  { id: 'cl1', score: '70',  scoreType: 'SS', leftLabel: 'Extremely Below', shade: false, shadeColor: '#3182CE' },
  { id: 'cl2', score: '80',  scoreType: 'SS', leftLabel: 'Well Below',       shade: false, shadeColor: '#3182CE' },
  { id: 'cl3', score: '90',  scoreType: 'SS', leftLabel: 'Below Average',    shade: false, shadeColor: '#3182CE' },
  { id: 'cl4', score: '110', scoreType: 'SS', leftLabel: 'Average',          shade: true,  shadeColor: '#3182CE' },
  { id: 'cl5', score: '120', scoreType: 'SS', leftLabel: 'Above Average',    shade: false, shadeColor: '#3182CE' },
  { id: 'cl6', score: '130', scoreType: 'SS', leftLabel: 'Well Above',       shade: false, shadeColor: '#3182CE' },
];

// ─── Graph params (passed from evaluation flow) ───────────────────────────────
export interface GraphParams {
  measures: EvalMeasure[];
  studentName: string;
  evalType: string;
  evalDate: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
  params?: GraphParams;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function BellCurveGraphScreen({ onBack, params }: Props) {
  const [title, setTitle] = useState(() =>
    params ? params.studentName + ' \u2014 ' + params.evalType : 'Bell Curve Graph');

  const [entries, setEntries] = useState<ScoreEntry[]>(() => {
    if (params?.measures && params.measures.length > 0) {
      return params.measures.map((m, i) => ({
        id: m.id,
        label: m.name,
        score: String(m.score),
        scoreType: EVAL_TO_GRAPH_SCORE_TYPE[m.scoreType],
        color: PICKER_COLORS[i % PICKER_COLORS.length],
      }));
    }
    return [emptyEntry('e1', 0), emptyEntry('e2', 1)];
  });

  const [categoryLines, setCategoryLines] = useState<CategoryLine[]>(DEFAULT_CATEGORY_LINES);
  const [rightmostCategoryLabel, setRightmostCategoryLabel] = useState('Extremely Above');
  const [rightmostShade, setRightmostShade] = useState(false);
  const [rightmostShadeColor, setRightmostShadeColor] = useState('#3182CE');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCompleteRef = useRef(false);

  // ── Firestore load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid, 'calculators', 'bellCurveGraph'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (!params) {
            // Standalone mode: restore title and entries
            if (data.title !== undefined) setTitle(data.title);
            if (Array.isArray(data.entries) && data.entries.length > 0) setEntries(data.entries);
          }
          // Always load category lines and shading (shared preference)
          if (Array.isArray(data.categoryLines) && data.categoryLines.length > 0) {
            setCategoryLines(data.categoryLines.map((cl: CategoryLine) => ({
              ...cl,
              shade: cl.shade ?? false,
              shadeColor: cl.shadeColor ?? '#3182CE',
            })));
          }
          if (data.rightmostCategoryLabel !== undefined) setRightmostCategoryLabel(data.rightmostCategoryLabel);
          if (data.rightmostShade !== undefined) setRightmostShade(data.rightmostShade);
          if (data.rightmostShadeColor !== undefined) setRightmostShadeColor(data.rightmostShadeColor);
        }
      })
      .catch(() => {})
      .finally(() => { loadCompleteRef.current = true; });
  }, []);

  // ── Firestore save (debounced) ─────────────────────────────────────────────
  const scheduleSave = useCallback((
    t: string,
    ent: ScoreEntry[],
    catLines: CategoryLine[],
    rightmost: string,
    rShade: boolean,
    rShadeColor: string,
  ) => {
    if (!loadCompleteRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        await setDoc(
          doc(db, 'users', uid, 'calculators', 'bellCurveGraph'),
          {
            // In eval mode, skip title/entries to avoid overwriting standalone calculator state
            ...(params ? {} : { title: t, entries: ent, scoreColors: ent.map(e => e.color) }),
            categoryLines: catLines,
            rightmostCategoryLabel: rightmost,
            rightmostShade: rShade,
            rightmostShadeColor: rShadeColor,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch { /* silent */ }
    }, 500);
  }, [params]);

  // ── Helpers to snapshot all current state into save ────────────────────────
  const save = (
    t = title,
    ent = entries,
    catLines = categoryLines,
    rightmost = rightmostCategoryLabel,
    rShade = rightmostShade,
    rShadeColor = rightmostShadeColor,
  ) => scheduleSave(t, ent, catLines, rightmost, rShade, rShadeColor);

  // ── State updaters ─────────────────────────────────────────────────────────
  const updateTitle = (v: string) => { setTitle(v); save(v); };

  const updateEntries = (next: ScoreEntry[]) => { setEntries(next); save(title, next); };

  const updateCategoryLines = (next: CategoryLine[]) => { setCategoryLines(next); save(title, entries, next); };

  const updateRightmost = (v: string) => {
    setRightmostCategoryLabel(v);
    save(title, entries, categoryLines, v);
  };
  const updateRightmostShade = (v: boolean) => {
    setRightmostShade(v);
    save(title, entries, categoryLines, rightmostCategoryLabel, v);
  };
  const updateRightmostShadeColor = (v: string) => {
    setRightmostShadeColor(v);
    save(title, entries, categoryLines, rightmostCategoryLabel, rightmostShade, v);
  };

  // ── Entry actions ──────────────────────────────────────────────────────────
  const addEntry = () => {
    if (entries.length >= 12) return;
    updateEntries([...entries, emptyEntry(`e${Date.now()}`, entries.length)]);
  };
  const deleteEntry = (id: string) => updateEntries(entries.filter(e => e.id !== id));
  const updateEntry = (id: string, field: keyof ScoreEntry, value: string) =>
    updateEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  // ── Category line actions ──────────────────────────────────────────────────
  const addCategoryLine = () => {
    if (categoryLines.length >= 8) return;
    updateCategoryLines([...categoryLines, { id: `cl${Date.now()}`, score: '', scoreType: 'SS', leftLabel: '', shade: false, shadeColor: '#3182CE' }]);
  };
  const deleteCategoryLine = (id: string) => updateCategoryLines(categoryLines.filter(cl => cl.id !== id));
  const updateCategoryLine = (id: string, field: keyof CategoryLine, value: string | boolean) =>
    updateCategoryLines(categoryLines.map(cl => cl.id === id ? { ...cl, [field]: value } : cl));

  // ── Bell curve outline path ────────────────────────────────────────────────
  const curveOutlinePath = useMemo(() => {
    const pts: string[] = [];
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const ss = SS_MIN + (i / steps) * (SS_MAX - SS_MIN);
      const z = ssToZ(ss);
      const x = ssToX(ss, CHART_W);
      const y = zToCurveY(z, CURVE_H);
      pts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    return pts.join(' ');
  }, []);

  // ── Sorted valid category lines ────────────────────────────────────────────
  const catLinesSS = useMemo(() => {
    return categoryLines
      .map(cl => {
        const n = parseFloat(cl.score);
        if (isNaN(n)) return null;
        return { ...cl, ss: toSS(n, cl.scoreType) };
      })
      .filter((cl): cl is CategoryLine & { ss: number } => cl !== null)
      .sort((a, b) => a.ss - b.ss);
  }, [categoryLines]);

  // ── Category regions (each with shade settings) ────────────────────────────
  const categoryRegions = useMemo(() => {
    type Region = { fromSS: number; toSS: number; label: string; shade: boolean; shadeColor: string };
    const regions: Region[] = [];
    if (catLinesSS.length === 0) {
      regions.push({ fromSS: SS_MIN, toSS: SS_MAX, label: rightmostCategoryLabel, shade: rightmostShade, shadeColor: rightmostShadeColor });
      return regions;
    }
    regions.push({ fromSS: SS_MIN, toSS: catLinesSS[0].ss, label: catLinesSS[0].leftLabel, shade: catLinesSS[0].shade, shadeColor: catLinesSS[0].shadeColor });
    for (let i = 1; i < catLinesSS.length; i++) {
      regions.push({ fromSS: catLinesSS[i - 1].ss, toSS: catLinesSS[i].ss, label: catLinesSS[i].leftLabel, shade: catLinesSS[i].shade, shadeColor: catLinesSS[i].shadeColor });
    }
    regions.push({ fromSS: catLinesSS[catLinesSS.length - 1].ss, toSS: SS_MAX, label: rightmostCategoryLabel, shade: rightmostShade, shadeColor: rightmostShadeColor });
    return regions;
  }, [catLinesSS, rightmostCategoryLabel, rightmostShade, rightmostShadeColor]);

  // ── Shaded region paths ────────────────────────────────────────────────────
  const shadedRegionPaths = useMemo(() => {
    const bY = zToCurveY(ssToZ(SS_MIN), CURVE_H);
    return categoryRegions
      .filter(r => r.shade)
      .map(r => {
        const from = Math.max(SS_MIN, r.fromSS);
        const to = Math.min(SS_MAX, r.toSS);
        if (from >= to) return null;
        const pts: string[] = [];
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
          const ss = from + (i / steps) * (to - from);
          const x = ssToX(ss, CHART_W);
          const y = zToCurveY(ssToZ(ss), CURVE_H);
          pts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
        }
        pts.push(`L ${ssToX(to, CHART_W)} ${bY}`);
        pts.push(`L ${ssToX(from, CHART_W)} ${bY}`);
        pts.push('Z');
        return { path: pts.join(' '), color: r.shadeColor };
      })
      .filter(Boolean) as Array<{ path: string; color: string }>;
  }, [categoryRegions]);

  // ── Valid score entries for plotting ──────────────────────────────────────
  const plotEntries = useMemo(() => {
    return entries.map((e, idx) => {
      const num = parseFloat(e.score);
      if (isNaN(num)) return null;
      const ss = toSS(num, e.scoreType);
      if (ss < SS_MIN || ss > SS_MAX) return null;
      const z = ssToZ(ss);
      const x = ssToX(ss, CHART_W);
      const curveYVal = zToCurveY(z, CURVE_H);
      const isWhite = e.color === '#FFFFFF';
      const shape = idx % 3;
      return { ...e, ss, x, curveYVal, isWhite, shape, idx };
    }).filter(Boolean) as Array<{
      id: string; label: string; score: string; scoreType: ScoreType; color: string;
      ss: number; x: number; curveYVal: number; isWhite: boolean; shape: number; idx: number;
    }>;
  }, [entries]);

  // ── Axis Y positions ───────────────────────────────────────────────────────
  const baseY = zToCurveY(ssToZ(SS_MIN), CURVE_H);
  const axisRowY = [baseY + 14, baseY + 28, baseY + 42, baseY + 56];
  const axisLabelX = CHART_PADDING_LEFT - 2;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        {params ? (
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{params.studentName}</Text>
            <Text style={styles.headerSub}>{params.evalType} · {params.evalDate}</Text>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Bell Curve Graph</Text>
        )}
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Chart Title - hidden in eval mode */}
        {!params && (
          <View style={styles.titleWrap}>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={updateTitle}
              placeholder="Chart title..."
              placeholderTextColor={PALETTE.placeholder}
            />
          </View>
        )}

        {/* Bell Curve SVG */}
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.chartScroll}>
          <Svg width={CHART_W} height={SVG_H}>

            {/* Per-region shading */}
            {shadedRegionPaths.map((r, i) => (
              <Path key={i} d={r.path} fill={r.color} opacity={0.2} />
            ))}

            {/* Bell curve outline */}
            <Path d={curveOutlinePath} fill="none" stroke="#3B6FEB" strokeWidth={2} />

            {/* Category divider lines */}
            {catLinesSS.map(cl => {
              const x = ssToX(cl.ss, CHART_W);
              return (
                <Line
                  key={cl.id}
                  x1={x} y1={SCORE_LABEL_H + CURVE_TOP_PAD}
                  x2={x} y2={baseY}
                  stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3,3"
                />
              );
            })}

            {/* Baseline */}
            <Line
              x1={ssToX(SS_MIN, CHART_W)} y1={baseY}
              x2={ssToX(SS_MAX, CHART_W)} y2={baseY}
              stroke={PALETTE.border} strokeWidth={1}
            />

            {/* SS axis labels */}
            {SS_AXIS.map(ss => (
              <SvgText key={`ss-${ss}`} x={ssToX(ss, CHART_W)} y={axisRowY[0]} textAnchor="middle" fontSize={9} fill={PALETTE.text} fontWeight="600">
                {ss}
              </SvgText>
            ))}

            {/* Scaled axis labels */}
            {SCALED_AXIS.map((sc, i) => (
              <SvgText key={`sc-${sc}`} x={ssToX(SS_AXIS[i], CHART_W)} y={axisRowY[1]} textAnchor="middle" fontSize={9} fill={PALETTE.muted}>
                {sc}
              </SvgText>
            ))}

            {/* T/Z axis labels */}
            {TZ_AXIS.map((tz, i) => (
              <SvgText key={`tz-${i}`} x={ssToX(SS_AXIS[i], CHART_W)} y={axisRowY[2]} textAnchor="middle" fontSize={8} fill={PALETTE.muted}>
                {tz}
              </SvgText>
            ))}

            {/* Percentile axis labels */}
            {PCT_AXIS_VALUES.map(pct => {
              const ss = inverseCDF(pct / 100) * 15 + 100;
              if (ss < SS_MIN || ss > SS_MAX) return null;
              return (
                <SvgText key={`pct-${pct}`} x={ssToX(ss, CHART_W)} y={axisRowY[3]} textAnchor="middle" fontSize={8} fill={PALETTE.muted}>
                  {pct}
                </SvgText>
              );
            })}

            {/* Axis row labels (left side) */}
            {['SS', 'Sc', 'T/Z', '%'].map((lbl, i) => (
              <SvgText key={`axlbl-${i}`} x={axisLabelX} y={axisRowY[i]} textAnchor="end" fontSize={8} fill={PALETTE.muted} fontWeight="600">
                {lbl}
              </SvgText>
            ))}

            {/* Category region labels */}
            {categoryRegions.map((r, i) => {
              const clampedFrom = Math.max(SS_MIN, r.fromSS);
              const clampedTo = Math.min(SS_MAX, r.toSS);
              if (clampedFrom >= clampedTo) return null;
              return (
                <SvgText
                  key={`cat-${i}`}
                  x={ssToX((clampedFrom + clampedTo) / 2, CHART_W)}
                  y={baseY + AXIS_ROWS_H + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fill={PALETTE.muted}
                  fontWeight="500"
                >
                  {r.label}
                </SvgText>
              );
            })}

            {/* Score lines and markers */}
            {plotEntries.map(entry => {
              const lineTopY = SCORE_LABEL_H - 4;
              return (
                <G key={entry.id}>
                  {entry.isWhite && (
                    <Line x1={entry.x} y1={lineTopY} x2={entry.x} y2={baseY} stroke="#000000" strokeWidth={3} />
                  )}
                  <Line x1={entry.x} y1={lineTopY} x2={entry.x} y2={baseY} stroke={entry.color} strokeWidth={1.5} />
                  {entry.shape === 0 && (
                    <Rect x={entry.x - 5} y={entry.curveYVal - 5} width={10} height={10}
                      fill={entry.color} stroke={entry.isWhite ? '#000000' : 'none'} strokeWidth={entry.isWhite ? 1.5 : 0} />
                  )}
                  {entry.shape === 1 && (
                    <Circle cx={entry.x} cy={entry.curveYVal} r={5}
                      fill={entry.color} stroke={entry.isWhite ? '#000000' : 'none'} strokeWidth={entry.isWhite ? 1.5 : 0} />
                  )}
                  {entry.shape === 2 && (
                    <Polygon
                      points={`${entry.x},${entry.curveYVal - 6} ${entry.x - 5},${entry.curveYVal + 4} ${entry.x + 5},${entry.curveYVal + 4}`}
                      fill={entry.color} stroke={entry.isWhite ? '#000000' : 'none'} strokeWidth={entry.isWhite ? 1.5 : 0} />
                  )}
                  <SvgText
                    x={entry.x} y={lineTopY - 2}
                    textAnchor="start" fontSize={9}
                    fill={entry.isWhite ? '#000000' : entry.color}
                    fontWeight="600"
                    transform={`rotate(-90, ${entry.x}, ${lineTopY - 2})`}
                  >
                    {(entry.label || entry.score).substring(0, 14)}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </ScrollView>

        {/* Score entries */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scores</Text>

          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryGroup}>
              <View style={styles.entryRow}>
                <View style={[styles.colorDot, { backgroundColor: entry.color, borderWidth: entry.color === '#FFFFFF' ? 1 : 0, borderColor: PALETTE.border }]} />
                <TextInput
                  style={styles.entryLabelInput}
                  placeholder="Label"
                  placeholderTextColor={PALETTE.placeholder}
                  value={entry.label}
                  onChangeText={v => updateEntry(entry.id, 'label', v)}
                />
                <TextInput
                  style={styles.entryScoreInput}
                  placeholder="Score"
                  placeholderTextColor={PALETTE.placeholder}
                  value={entry.score}
                  onChangeText={v => updateEntry(entry.id, 'score', v)}
                  keyboardType="numeric"
                />
                <View style={styles.typePickerWrap}>
                  {SCORE_TYPE_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt} style={[styles.typeBtn, entry.scoreType === opt && styles.typeBtnActive]} onPress={() => updateEntry(entry.id, 'scoreType', opt)}>
                      <Text style={[styles.typeBtnText, entry.scoreType === opt && styles.typeBtnTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => deleteEntry(entry.id)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.deleteBtnText}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.swatchRow}>
                {PICKER_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.swatch, { backgroundColor: color, borderColor: entry.color === color ? PALETTE.accent : color === '#FFFFFF' ? PALETTE.border : 'transparent' }]}
                    onPress={() => updateEntry(entry.id, 'color', color)}
                  />
                ))}
              </View>
            </View>
          ))}

          {entries.length < 12 && (
            <TouchableOpacity style={styles.addBtn} onPress={addEntry}>
              <Text style={styles.addBtnText}>+ Add Score</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Lines */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Lines</Text>
          <Text style={styles.cardHint}>Each line divides the curve. "Left Label" names the region to the left of that line. Toggle shading and pick a fill color per region.</Text>

          {categoryLines.map(cl => (
            <View key={cl.id} style={styles.entryGroup}>
              {/* Main row */}
              <View style={styles.entryRow}>
                <TextInput
                  style={styles.catScoreInput}
                  placeholder="Score"
                  placeholderTextColor={PALETTE.placeholder}
                  value={cl.score}
                  onChangeText={v => updateCategoryLine(cl.id, 'score', v)}
                  keyboardType="numeric"
                />
                <View style={styles.typePickerWrap}>
                  {SCORE_TYPE_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt} style={[styles.typeBtn, cl.scoreType === opt && styles.typeBtnActive]} onPress={() => updateCategoryLine(cl.id, 'scoreType', opt)}>
                      <Text style={[styles.typeBtnText, cl.scoreType === opt && styles.typeBtnTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.catLabelInput}
                  placeholder="Left category label"
                  placeholderTextColor={PALETTE.placeholder}
                  value={cl.leftLabel}
                  onChangeText={v => updateCategoryLine(cl.id, 'leftLabel', v)}
                />
                {/* Shade toggle */}
                <TouchableOpacity
                  style={[styles.shadeToggle, cl.shade && { backgroundColor: cl.shadeColor, borderColor: cl.shadeColor }]}
                  onPress={() => updateCategoryLine(cl.id, 'shade', !cl.shade)}
                >
                  <Text style={[styles.shadeToggleText, cl.shade && styles.shadeToggleTextOn]}>
                    {cl.shade ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCategoryLine(cl.id)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.deleteBtnText}>×</Text>
                </TouchableOpacity>
              </View>
              {/* Shade color swatches (only when shade is on) */}
              {cl.shade && (
                <View style={styles.swatchRow}>
                  {PICKER_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.swatch, { backgroundColor: color, borderColor: cl.shadeColor === color ? PALETTE.accent : color === '#FFFFFF' ? PALETTE.border : 'transparent' }]}
                      onPress={() => updateCategoryLine(cl.id, 'shadeColor', color)}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}

          {categoryLines.length < 8 && (
            <TouchableOpacity style={styles.addBtn} onPress={addCategoryLine}>
              <Text style={styles.addBtnText}>+ Add Line</Text>
            </TouchableOpacity>
          )}

          {/* Rightmost region */}
          <View style={styles.rightmostSection}>
            <View style={styles.entryRow}>
              <Text style={styles.rightmostLabel}>Rightmost region:</Text>
              <TextInput
                style={styles.catLabelInput}
                value={rightmostCategoryLabel}
                onChangeText={updateRightmost}
                placeholder="Rightmost category label"
                placeholderTextColor={PALETTE.placeholder}
              />
              <TouchableOpacity
                style={[styles.shadeToggle, rightmostShade && { backgroundColor: rightmostShadeColor, borderColor: rightmostShadeColor }]}
                onPress={() => updateRightmostShade(!rightmostShade)}
              >
                <Text style={[styles.shadeToggleText, rightmostShade && styles.shadeToggleTextOn]}>
                  {rightmostShade ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
            </View>
            {rightmostShade && (
              <View style={styles.swatchRow}>
                {PICKER_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.swatch, { backgroundColor: color, borderColor: rightmostShadeColor === color ? PALETTE.accent : color === '#FFFFFF' ? PALETTE.border : 'transparent' }]}
                    onPress={() => updateRightmostShadeColor(color)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: PALETTE.white, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: PALETTE.border,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, color: PALETTE.accent, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: PALETTE.text, letterSpacing: -0.2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub: { fontSize: 12, color: PALETTE.muted, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  titleWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  titleInput: {
    backgroundColor: PALETTE.white, borderRadius: 10, borderWidth: 1, borderColor: PALETTE.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: PALETTE.text,
  },
  chartScroll: {
    marginHorizontal: 16, backgroundColor: PALETTE.white,
    borderRadius: 12, borderWidth: 1, borderColor: PALETTE.border,
  },
  card: {
    marginHorizontal: 16, marginTop: 16, backgroundColor: PALETTE.white,
    borderRadius: 12, borderWidth: 1, borderColor: PALETTE.border, padding: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.text, marginBottom: 4, letterSpacing: -0.1 },
  cardHint: { fontSize: 11, color: PALETTE.muted, marginBottom: 12 },
  // Entry group
  entryGroup: { marginBottom: 14 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  entryLabelInput: {
    flex: 2, maxWidth: 400, backgroundColor: PALETTE.bg, borderRadius: 7,
    borderWidth: 1, borderColor: PALETTE.border, paddingHorizontal: 9, paddingVertical: 7,
    fontSize: 13, color: PALETTE.text,
  },
  entryScoreInput: {
    width: 58, backgroundColor: PALETTE.bg, borderRadius: 7, borderWidth: 1,
    borderColor: PALETTE.border, paddingHorizontal: 9, paddingVertical: 7,
    fontSize: 13, color: PALETTE.text, textAlign: 'center',
  },
  typePickerWrap: { flexDirection: 'row', gap: 2 },
  typeBtn: {
    paddingHorizontal: 5, paddingVertical: 5, borderRadius: 5,
    backgroundColor: PALETTE.bg, borderWidth: 1, borderColor: PALETTE.border,
  },
  typeBtnActive: { backgroundColor: PALETTE.accent, borderColor: PALETTE.accent },
  typeBtnText: { fontSize: 10, color: PALETTE.muted, fontWeight: '500' },
  typeBtnTextActive: { color: PALETTE.white, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 20, color: PALETTE.placeholder, lineHeight: 22 },
  // Color swatches
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7, paddingLeft: 16 },
  swatch: { width: 20, height: 20, borderRadius: 4, borderWidth: 2 },
  addBtn: {
    marginTop: 6, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: PALETTE.border, alignItems: 'center', backgroundColor: PALETTE.bg,
  },
  addBtnText: { fontSize: 14, color: PALETTE.accent, fontWeight: '600' },
  // Category line fields
  catScoreInput: {
    width: 58, backgroundColor: PALETTE.bg, borderRadius: 7, borderWidth: 1,
    borderColor: PALETTE.border, paddingHorizontal: 9, paddingVertical: 7,
    fontSize: 13, color: PALETTE.text, textAlign: 'center',
  },
  catLabelInput: {
    flex: 1, backgroundColor: PALETTE.bg, borderRadius: 7, borderWidth: 1,
    borderColor: PALETTE.border, paddingHorizontal: 9, paddingVertical: 7,
    fontSize: 13, color: PALETTE.text,
  },
  // Shade toggle
  shadeToggle: {
    width: 26, height: 26, borderRadius: 5, borderWidth: 1,
    borderColor: PALETTE.border, backgroundColor: PALETTE.bg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  shadeToggleText: { fontSize: 13, color: PALETTE.placeholder },
  shadeToggleTextOn: { color: PALETTE.white },
  // Rightmost section
  rightmostSection: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: PALETTE.border,
  },
  rightmostLabel: { fontSize: 13, color: PALETTE.muted, fontWeight: '500', flexShrink: 0 },
});
