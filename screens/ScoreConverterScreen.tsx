import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  PanResponder,
  Platform,
} from 'react-native';

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = {
  bg:          '#F8F9FB',
  white:       '#FFFFFF',
  accent:      '#3B6FEB',
  accentLight: '#EEF3FD',
  border:      '#E5E8EE',
  text:        '#1A1D23',
  muted:       '#6B7280',
  placeholder: '#9CA3AF',
};

// ── Classification zones ──────────────────────────────────────────────────────

interface Zone {
  from:  number;
  to:    number;
  color: string;
  label: string;
}

const ZONES: Zone[] = [
  { from: -4,    to: -2,    color: '#EF4444', label: 'Extremely Low' },
  { from: -2,    to: -1.33, color: '#F97316', label: 'Borderline'    },
  { from: -1.33, to: -0.67, color: '#EAB308', label: 'Low Average'   },
  { from: -0.67, to:  0.67, color: '#22C55E', label: 'Average'       },
  { from:  0.67, to:  1.33, color: '#EAB308', label: 'High Average'  },
  { from:  1.33, to:  2,    color: '#F97316', label: 'Superior'      },
  { from:  2,    to:  4,    color: '#EF4444', label: 'Very Superior' },
];

// ── Math helpers ──────────────────────────────────────────────────────────────

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2315419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function inverseCDF(p: number): number {
  const a = [
    -3.969683028665376e+01,  2.209460984245205e+02,
    -2.759285104469687e+02,  1.383577518672690e+02,
    -3.066479806614716e+01,  2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,  1.615858368580409e+02,
    -1.556989798598866e+02,  6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
     4.374664141464968e+00,  2.938163982698783e+00,
  ];
  const d = [
     7.784695709041462e-03,  3.224671290700398e-01,
     2.445134137142996e+00,  3.754408661907416e+00,
  ];
  const pLow  = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
              ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

function gaussianPDF(z: number): number {
  return Math.exp(-0.5 * z * z) / 2.5066282746310002;
}

// ── Classification ────────────────────────────────────────────────────────────

function classify(z: number): { label: string; color: string } {
  if (z < -2)    return { label: 'Extremely Low', color: '#EF4444' };
  if (z < -1.33) return { label: 'Borderline',   color: '#F97316' };
  if (z < -0.67) return { label: 'Low Average',  color: '#EAB308' };
  if (z <  0.67) return { label: 'Average',      color: '#22C55E' };
  if (z <  1.33) return { label: 'High Average', color: '#EAB308' };
  if (z <  2)    return { label: 'Superior',     color: '#F97316' };
  return           { label: 'Very Superior',  color: '#EF4444' };
}

// ── Score conversion helpers ──────────────────────────────────────────────────

function zToSS    (z: number) { return Math.max(40,   Math.min(160,  Math.round(z * 15 + 100))); }
function zToScaled(z: number) { return Math.max(1,    Math.min(19,   Math.round(z * 3  + 10)));  }
function zToT     (z: number) { return Math.max(20,   Math.min(80,   Math.round(z * 10 + 50)));  }
function zToZ     (z: number) { return Math.max(-4,   Math.min(4,    z));                         }
function zToPct   (z: number) { return Math.max(0.1,  Math.min(99.9, normalCDF(z) * 100));        }

// ── Bell curve (SVG constants) ────────────────────────────────────────────────

const SVG_W        = 320;
const SVG_H        = 120;
const CURVE_BASE   = 96;   // y-coordinate of baseline
const CURVE_TOP    = 4;    // y-coordinate of peak

const PDF_PEAK = gaussianPDF(0); // ≈ 0.3989
const CURVE_H  = CURVE_BASE - CURVE_TOP;

function xAt(z: number) { return ((z + 4) / 8) * SVG_W; }
function yAt(z: number) { return CURVE_BASE - (gaussianPDF(z) / PDF_PEAK) * CURVE_H; }

function makeBellPath(fromZ: number, toZ: number): string {
  const N    = 40;
  const from = Math.max(-4, fromZ);
  const to   = Math.min(4,  toZ);
  let path   = `M ${xAt(from)} ${CURVE_BASE} L ${xAt(from)} ${yAt(from)}`;
  for (let i = 1; i <= N; i++) {
    const z = from + (i / N) * (to - from);
    path += ` L ${xAt(z)} ${yAt(z)}`;
  }
  path += ` L ${xAt(to)} ${CURVE_BASE} Z`;
  return path;
}

// ── WebBellCurve ──────────────────────────────────────────────────────────────

function WebBellCurve({ z }: { z: number }) {
  const curZ   = Math.max(-4, Math.min(4, z));
  const lineX  = xAt(curZ);

  // Filled color zone paths
  const zonePaths = ZONES.map((zone, i) =>
    React.createElement('path', {
      key:         i,
      d:           makeBellPath(zone.from, zone.to),
      fill:        zone.color,
      fillOpacity: '0.82',
    })
  );

  // White outline stroke along the top of the curve
  const outlinePts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const z_ = -4 + (i / 100) * 8;
    outlinePts.push(`${xAt(z_)} ${yAt(z_)}`);
  }
  const outline = React.createElement('path', {
    d:           `M ${outlinePts.join(' L ')}`,
    fill:        'none',
    stroke:      'rgba(255,255,255,0.55)',
    strokeWidth: '1.5',
  });

  // Baseline
  const baseline = React.createElement('line', {
    x1: '0', y1: String(CURVE_BASE),
    x2: String(SVG_W), y2: String(CURVE_BASE),
    stroke: PALETTE.border, strokeWidth: '1',
  });

  // Current-Z marker line
  const marker = React.createElement('line', {
    x1: String(lineX), y1: String(CURVE_TOP),
    x2: String(lineX), y2: String(CURVE_BASE),
    stroke:          PALETTE.text,
    strokeWidth:     '2',
    strokeLinecap:   'round',
    strokeDasharray: '4,3',
  });

  // Axis tick marks + SS labels
  const SS_AXIS = [55, 70, 85, 100, 115, 130, 145];
  const axisEls = SS_AXIS.flatMap((ss) => {
    const ax = xAt((ss - 100) / 15);
    return [
      React.createElement('line', {
        key:         `tick${ss}`,
        x1: String(ax), y1: String(CURVE_BASE),
        x2: String(ax), y2: String(CURVE_BASE + 5),
        stroke: PALETTE.placeholder, strokeWidth: '1',
      }),
      React.createElement('text', {
        key:        `lbl${ss}`,
        x:          String(ax),
        y:          String(SVG_H - 2),
        textAnchor: 'middle',
        fontSize:   '9',
        fill:       PALETTE.placeholder,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }, String(ss)),
    ];
  });

  return React.createElement(
    'svg',
    {
      viewBox: `0 0 ${SVG_W} ${SVG_H}`,
      style:   { width: '100%', height: SVG_H, display: 'block' },
    },
    ...zonePaths,
    outline,
    baseline,
    ...axisEls,
    marker,
  );
}

// ── NativeBellCurve ───────────────────────────────────────────────────────────

function NativeBellCurve({ z }: { z: number }) {
  const N      = 80;
  const chartH = 80;
  const curZ   = Math.max(-4, Math.min(4, z));

  // Precompute bar geometry once (heights + colors don't change with z)
  const bars = useMemo(() =>
    Array.from({ length: N }, (_, i) => {
      const barZ = -4 + ((i + 0.5) / N) * 8;
      return {
        barZ,
        barH:  (gaussianPDF(barZ) / PDF_PEAK) * chartH,
        color: classify(barZ).color,
      };
    }), []
  );

  const threshold = (8 / N) * 1.5;

  return (
    <View>
      <View style={{ height: chartH, flexDirection: 'row', alignItems: 'flex-end' }}>
        {bars.map(({ barZ, barH, color }, i) => {
          const isNear = Math.abs(barZ - curZ) < threshold;
          return (
            <View
              key={i}
              style={{
                flex:            1,
                height:          barH,
                backgroundColor: isNear ? PALETTE.text : color,
                opacity:         isNear ? 1 : 0.78,
              }}
            />
          );
        })}
      </View>
      {/* SS axis labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 }}>
        {[55, 70, 85, 100, 115, 130, 145].map(ss => (
          <Text key={ss} style={{ fontSize: 9, color: PALETTE.placeholder }}>{ss}</Text>
        ))}
      </View>
    </View>
  );
}

// ── BellCurve dispatcher ──────────────────────────────────────────────────────

function BellCurve({ z }: { z: number }) {
  return Platform.OS === 'web' ? <WebBellCurve z={z} /> : <NativeBellCurve z={z} />;
}

// ── CustomSlider ──────────────────────────────────────────────────────────────

interface SliderProps {
  value:    number;
  min:      number;
  max:      number;
  step:     number;
  onChange: (v: number) => void;
}

function WebSlider({ value, min, max, step, onChange }: SliderProps) {
  return React.createElement('input', {
    type:     'range',
    min:      String(min),
    max:      String(max),
    step:     String(step),
    value:    String(value),
    onChange: (e: { target: { value: string } }) => onChange(parseFloat(e.target.value)),
    style: {
      width:       '100%',
      accentColor: PALETTE.accent,
      cursor:      'pointer',
      margin:      0,
      padding:     0,
      display:     'block',
    },
  });
}

function NativeSlider({ value, min, max, step, onChange }: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const trackWidthRef = useRef(1);
  const startXRef     = useRef(0);
  const onChangeRef   = useRef(onChange);
  const minRef        = useRef(min);
  const maxRef        = useRef(max);
  const stepRef       = useRef(step);

  // Keep refs in sync with latest props (avoids stale closures in PanResponder)
  onChangeRef.current = onChange;
  minRef.current      = min;
  maxRef.current      = max;
  stepRef.current     = step;

  const computeFromX = (x: number): number => {
    const ratio  = Math.max(0, Math.min(1, x / trackWidthRef.current));
    const raw    = minRef.current + ratio * (maxRef.current - minRef.current);
    const stepped = Math.round(raw / stepRef.current) * stepRef.current;
    return Math.max(minRef.current, Math.min(maxRef.current, stepped));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        startXRef.current = evt.nativeEvent.locationX;
        onChangeRef.current(computeFromX(evt.nativeEvent.locationX));
      },
      onPanResponderMove: (_, gs) => {
        onChangeRef.current(computeFromX(startXRef.current + gs.dx));
      },
    })
  ).current;

  const thumbRatio = Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min)));
  const thumbPx    = thumbRatio * trackWidth;

  return (
    <View style={sliderStyles.wrapper}>
      <View
        style={sliderStyles.track}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          trackWidthRef.current = w;
          setTrackWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        <View style={[sliderStyles.fill, { width: thumbPx }]} />
        <View style={[sliderStyles.thumb, { left: thumbPx - 8 }]} />
      </View>
    </View>
  );
}

function CustomSlider(props: SliderProps) {
  return Platform.OS === 'web' ? <WebSlider {...props} /> : <NativeSlider {...props} />;
}

const sliderStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    paddingVertical:   10,
  },
  track: {
    height:          4,
    backgroundColor: PALETTE.border,
    borderRadius:    2,
  },
  fill: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    backgroundColor: PALETTE.accent,
    borderRadius:    2,
  },
  thumb: {
    position:        'absolute',
    top:             -6,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: PALETTE.accent,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.25,
    shadowRadius:    2,
    elevation:       2,
  },
});

// ── Score configs ─────────────────────────────────────────────────────────────

type ScoreKey = 'ss' | 'scaled' | 't' | 'z' | 'pct';

interface ScoreConfig {
  key:   ScoreKey;
  label: string;
  min:   number;
  max:   number;
  step:  number;
}

const SCORE_CONFIGS: ScoreConfig[] = [
  { key: 'ss',     label: 'Standard Score', min: 40,   max: 160,  step: 1   },
  { key: 'scaled', label: 'Scaled Score',   min: 1,    max: 19,   step: 1   },
  { key: 't',      label: 'T-Score',        min: 20,   max: 80,   step: 1   },
  { key: 'z',      label: 'Z-Score',        min: -4,   max: 4,    step: 0.1 },
  { key: 'pct',    label: 'Percentile',     min: 0.1,  max: 99.9, step: 0.1 },
];

// ── Texts state type ──────────────────────────────────────────────────────────

interface Texts {
  ss:     string;
  scaled: string;
  t:      string;
  z:      string;
  pct:    string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScoreConverterScreen({ onBack }: Props) {
  const [zVal, setZVal]   = useState(0);
  const [texts, setTexts] = useState<Texts>({
    ss: '100', scaled: '10', t: '50', z: '0.0', pct: '50.0',
  });

  const cls = classify(zVal);

  // Slider values are always derived from zVal
  const sliderValues: Record<ScoreKey, number> = {
    ss:     zToSS(zVal),
    scaled: zToScaled(zVal),
    t:      zToT(zVal),
    z:      zToZ(zVal),
    pct:    zToPct(zVal),
  };

  // Update all fields from a new z; optionally skip updating one text field
  // (used when user is typing in that field so we don't stomp their cursor)
  function updateAllFrom(newZ: number, skipKey?: ScoreKey) {
    const cz = Math.max(-4, Math.min(4, newZ));
    setZVal(cz);
    setTexts(prev => ({
      ss:     skipKey === 'ss'     ? prev.ss     : String(zToSS(cz)),
      scaled: skipKey === 'scaled' ? prev.scaled : String(zToScaled(cz)),
      t:      skipKey === 't'      ? prev.t      : String(zToT(cz)),
      z:      skipKey === 'z'      ? prev.z      : zToZ(cz).toFixed(1),
      pct:    skipKey === 'pct'    ? prev.pct    : zToPct(cz).toFixed(1),
    }));
  }

  function handleTextChange(key: ScoreKey, text: string) {
    // Keep the typed text in this field; update other fields if the value parses
    setTexts(prev => ({ ...prev, [key]: text }));
    const v = parseFloat(text);
    if (isNaN(v)) return;

    let newZ = 0;
    switch (key) {
      case 'ss':     newZ = (v - 100) / 15; break;
      case 'scaled': newZ = (v - 10)  / 3;  break;
      case 't':      newZ = (v - 50)  / 10; break;
      case 'z':      newZ = v;              break;
      case 'pct': {
        const cp = Math.max(0.001, Math.min(0.999, v / 100));
        newZ = inverseCDF(cp);
        break;
      }
    }
    updateAllFrom(newZ, key);
  }

  function handleSliderChange(key: ScoreKey, sv: number) {
    // Slider sets all fields (including its own text)
    let newZ = 0;
    switch (key) {
      case 'ss':     newZ = (sv - 100) / 15; break;
      case 'scaled': newZ = (sv - 10)  / 3;  break;
      case 't':      newZ = (sv - 50)  / 10; break;
      case 'z':      newZ = sv;              break;
      case 'pct': {
        const cp = Math.max(0.001, Math.min(0.999, sv / 100));
        newZ = inverseCDF(cp);
        break;
      }
    }
    const cz = Math.max(-4, Math.min(4, newZ));
    setZVal(cz);
    setTexts({
      ss:     String(zToSS(cz)),
      scaled: String(zToScaled(cz)),
      t:      String(zToT(cz)),
      z:      zToZ(cz).toFixed(1),
      pct:    zToPct(cz).toFixed(1),
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Score Converter</Text>
        <View style={{ minWidth: 64 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Bell Curve Card ──────────────────────────────────────────────── */}
        <View style={styles.curveCard}>
          <BellCurve z={zVal} />
          <View style={[styles.classPill, { backgroundColor: cls.color + '22' }]}>
            <Text style={[styles.classPillText, { color: cls.color }]}>{cls.label}</Text>
          </View>
        </View>

        {/* ── Score Fields ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>SCORE CONVERTER</Text>
        <View style={styles.fieldsCard}>
          {SCORE_CONFIGS.map((cfg, i) => (
            <View
              key={cfg.key}
              style={[
                styles.scoreField,
                i < SCORE_CONFIGS.length - 1 && styles.scoreFieldDivider,
              ]}
            >
              <Text style={styles.scoreLabel}>{cfg.label}</Text>
              <TextInput
                style={styles.scoreInput}
                value={texts[cfg.key]}
                onChangeText={v => handleTextChange(cfg.key, v)}
                keyboardType="numbers-and-punctuation"
                selectTextOnFocus
              />
              <View style={styles.sliderWrap}>
                <CustomSlider
                  value={sliderValues[cfg.key]}
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  onChange={v => handleSliderChange(cfg.key, v)}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: PALETTE.bg,
  },
  // Header
  header: {
    flexDirection:       'row',
    alignItems:          'center',
    backgroundColor:     PALETTE.white,
    paddingHorizontal:   16,
    paddingVertical:     14,
    borderBottomWidth:   1,
    borderBottomColor:   PALETTE.border,
  },
  backBtn: {
    minWidth: 64,
  },
  backBtnText: {
    fontSize:   14,
    color:      PALETTE.accent,
    fontWeight: '500',
  },
  headerTitle: {
    flex:          1,
    fontSize:      16,
    fontWeight:    '700',
    color:         PALETTE.text,
    textAlign:     'center',
    letterSpacing: -0.2,
  },
  scroll: {
    paddingTop:    16,
    paddingBottom: 40,
  },
  // Bell curve card
  curveCard: {
    marginHorizontal: 16,
    backgroundColor:  PALETTE.white,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      PALETTE.border,
    paddingTop:       14,
    paddingHorizontal: 10,
    paddingBottom:    14,
    overflow:         'hidden',
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.05,
    shadowRadius:     4,
    elevation:        1,
  },
  classPill: {
    alignSelf:        'center',
    marginTop:        12,
    paddingHorizontal: 18,
    paddingVertical:   7,
    borderRadius:     20,
  },
  classPillText: {
    fontSize:      14,
    fontWeight:    '700',
    letterSpacing: 0.1,
  },
  // Section header
  sectionHeader: {
    fontSize:         11,
    fontWeight:       '700',
    color:            PALETTE.accent,
    letterSpacing:    0.8,
    marginTop:        24,
    marginBottom:     8,
    marginHorizontal: 16,
  },
  // Score fields card
  fieldsCard: {
    marginHorizontal: 16,
    backgroundColor:  PALETTE.white,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      PALETTE.border,
    overflow:         'hidden',
  },
  scoreField: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               10,
  },
  scoreFieldDivider: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  sliderWrap: {
    flex: 1,
  },
  scoreLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      PALETTE.text,
  },
  scoreInput: {
    fontSize:        15,
    fontWeight:      '600',
    color:           PALETTE.accent,
    borderWidth:     1,
    borderColor:     PALETTE.border,
    borderRadius:    7,
    paddingHorizontal: 10,
    paddingVertical:  5,
    minWidth:        68,
    textAlign:       'center',
    backgroundColor: PALETTE.bg,
  },
});
