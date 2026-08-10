import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity, Archive, ChevronRight, CircleHelp, Command, Download, Keyboard, Lightbulb, LoaderCircle, Settings2, Upload, Usb} from 'lucide-react';
import './styles.css';
import usbDefinition from '../public/definitions/crush80-rgb-usb.json';
import receiverDefinition from '../public/definitions/crush80-rgb-2.4g.json';
import {type ConnectionMode, normalizeDefinition} from './via/definition';
import {assertCompatibleViaDevice, observeHidDisconnect, requestAnyHidDevice, ViaHidClient} from './via/client';
import {parseOfficialLayout, type KeyboardKey} from './via/layout';
import {customKeycodeOptions, keycodeOptionsForProtocol, labelForKeycode, macroBasicKeyDictionary, macroKeycodeOptions, type KeycodeOption} from './via/keycodes';
import {byteToKeyMap, parseMacroBytes, serializeMacroBytes, type MacroStep} from './via/macros';
import {makeProfile, parseProfile, type LightingState} from './via/profile';

type Page = 'overview' | 'keymap' | 'lighting' | 'macros' | 'profiles';
type DeviceState = {layers: number[][]; lighting: LightingState; macros: number[]; macroCount: number; macroCapacity: number};
type Connection = {mode: ConnectionMode; productName: string; protocol: number; qmkKeycodesVersion?: number; layers: number; client: ViaHidClient; definition: typeof usbDefinition; keys: KeyboardKey[]};

const NAV: Array<[Page, string, React.ElementType]> = [
  ['overview', '概览', Activity], ['keymap', '键位设置', Keyboard], ['lighting', '灯光', Lightbulb], ['macros', '宏', Command], ['profiles', '配置与诊断', Archive],
];
const EFFECTS = ['关闭','波浪','彩云','漩涡','混色','呼吸','常亮','渐灭','石纹','激光','星空','花开','穿梭','波条','流星','雨滴','扫描','按键触发','中心扩散'];

const cloneState = (state: DeviceState): DeviceState => ({layers: state.layers.map(layer => [...layer]), lighting: {...state.lighting, color: [...state.lighting.color] as [number, number]}, macros: [...state.macros], macroCount: state.macroCount, macroCapacity: state.macroCapacity});
const equalArray = (left: number[], right: number[]) => left.length === right.length && left.every((value, index) => value === right[index]);
const equalLighting = (left: LightingState, right: LightingState) => left.brightness === right.brightness && left.effect === right.effect && left.speed === right.speed && left.color[0] === right.color[0] && left.color[1] === right.color[1];
const hexToHs = (hex: string): [number, number] => {
  const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!rgb) return [0, 0];
  const r = Number.parseInt(rgb[1], 16) / 255, g = Number.parseInt(rgb[2], 16) / 255, b = Number.parseInt(rgb[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) hue = max === r ? ((g - b) / delta + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / delta + 2) / 6 : ((r - g) / delta + 4) / 6;
  return [Math.round(hue * 255), Math.round((max === 0 ? 0 : delta / max) * 255)];
};
const hsToHex = (hue: number, saturation: number) => {
  const h = hue / 255, s = saturation / 255, v = 1;
  const f = (n: number) => { const k = (n + h * 6) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return `#${[f(5), f(3), f(1)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
};
const downloadJson = (name: string, value: unknown) => { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'})); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };

function App() {
  const [mode, setMode] = useState<ConnectionMode>('usb');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [baseline, setBaseline] = useState<DeviceState | null>(null);
  const [draft, setDraft] = useState<DeviceState | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [selectedKey, setSelectedKey] = useState('0:0');
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [selectedMacro, setSelectedMacro] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeDefinition = mode === 'usb' ? usbDefinition : receiverDefinition;

  const dirty = useMemo(() => {
    if (!baseline || !draft) return {keys: 0, lighting: false, macros: false, total: 0};
    const keys = draft.layers.reduce((count, layer, layerIndex) => count + layer.filter((keycode, index) => keycode !== baseline.layers[layerIndex][index]).length, 0);
    const lighting = !equalLighting(draft.lighting, baseline.lighting);
    const macros = !equalArray(draft.macros, baseline.macros);
    return {keys, lighting, macros, total: keys + Number(lighting) + Number(macros)};
  }, [baseline, draft]);

  useEffect(() => {
    if (!connection) return;
    return observeHidDisconnect(connection.client, () => {
      setNotice('键盘或接收器已断开；本地草稿仍在，但不会写入设备。');
      setConnection(null); setBaseline(null); setDraft(null);
    });
  }, [connection]);

  const loadState = async (client: ViaHidClient, protocol: number, layerCount: number): Promise<DeviceState> => {
    const normalized = normalizeDefinition(activeDefinition);
    const layers: number[][] = [];
    for (let layer = 0; layer < layerCount; layer++) layers.push(await client.readLayer(normalized.matrix.rows, normalized.matrix.cols, layer, protocol));
    const [brightness, effect, speed, color, macroCount] = await Promise.all([
      client.getMenuValue(3, 1), client.getMenuValue(3, 2), client.getMenuValue(3, 3), client.getMenuValue(3, 4, 2), client.macroCount(),
    ]);
    const macroCapacity = macroCount > 0 ? await client.macroBufferSize() : 0;
    const macros = macroCount > 0 && macroCapacity > 0 ? await client.readMacroBytes() : [];
    return {layers, lighting: {brightness: brightness[0], effect: effect[0], speed: speed[0], color: [color[0], color[1]]}, macros, macroCount, macroCapacity};
  };

  const connect = async () => {
    setBusy(true); setNotice('正在等待浏览器的原生 HID 设备选择窗口…');
    try {
      const device = await requestAnyHidDevice();
      const definition = mode === 'usb' ? usbDefinition : receiverDefinition;
      const normalized = normalizeDefinition(definition);
      assertCompatibleViaDevice(device, normalized.vendorId, normalized.productId);
      const client = new ViaHidClient(device);
      const protocol = await client.protocolVersion();
      if (protocol < 7) throw new Error(`设备报告 VIA 协议版本 ${protocol}，不属于本工具支持的标准 VIA 范围。`);
      const layerCount = await client.layerCount(protocol);
      if (layerCount < 1 || layerCount > 16) throw new Error(`设备报告了异常 Layer 数：${layerCount}。已停止，不会写入。`);
      const qmkKeycodesVersion = protocol >= 13 ? await client.qmkKeycodesVersion() : undefined;
      if (protocol >= 13 && qmkKeycodesVersion !== 0x00000008) throw new Error(`设备返回未受当前工具支持的 QMK 键码版本 0x${qmkKeycodesVersion?.toString(16).padStart(8,'0')}；已停止，不会写入。`);
      setNotice('正在从键盘读取键位、官方灯光菜单和宏缓冲区；此过程只读，不会修改设备。');
      const state = await loadState(client, protocol, layerCount);
      setConnection({mode, productName: device.productName || definition.name, protocol, qmkKeycodesVersion, layers: layerCount, client, definition, keys: parseOfficialLayout(definition)});
      setBaseline(state); setDraft(cloneState(state)); setSelectedLayer(0); setSelectedKey(parseOfficialLayout(definition)[0]?.id ?? '0:0'); setPage('overview');
      setNotice('读取完成。所有改动会先留在本地草稿；只有点击“写入并读回验证”才会发送标准 VIA 写入。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '连接失败。'); }
    finally { setBusy(false); }
  };

  const applyDraft = async () => {
    if (!connection || !baseline || !draft || dirty.total === 0) return;
    setBusy(true); setNotice('正在按变更列表写入，并逐项从键盘读回验证。请勿断开键盘或接收器。');
    try {
      for (let layer = 0; layer < draft.layers.length; layer++) {
        for (let index = 0; index < draft.layers[layer].length; index++) {
          const oldCode = baseline.layers[layer][index], newCode = draft.layers[layer][index];
          if (oldCode === newCode) continue;
          const row = Math.floor(index / 16), col = index % 16;
          await connection.client.setKey(layer, row, col, newCode);
          const readBack = await connection.client.getKey(layer, row, col);
          if (readBack !== newCode) throw new Error(`Layer ${layer}，矩阵 ${row},${col} 读回为 0x${readBack.toString(16)}，与草稿不一致；已停止后续写入。`);
        }
      }
      if (!equalLighting(baseline.lighting, draft.lighting)) {
        await connection.client.setMenuValue(3, 1, [draft.lighting.brightness]);
        await connection.client.setMenuValue(3, 2, [draft.lighting.effect]);
        await connection.client.setMenuValue(3, 3, [draft.lighting.speed]);
        await connection.client.setMenuValue(3, 4, draft.lighting.color);
        await connection.client.saveMenu(3);
        const [brightness, effect, speed, color] = await Promise.all([connection.client.getMenuValue(3, 1), connection.client.getMenuValue(3, 2), connection.client.getMenuValue(3, 3), connection.client.getMenuValue(3, 4, 2)]);
        const received: LightingState = {brightness: brightness[0], effect: effect[0], speed: speed[0], color: [color[0], color[1]]};
        if (!equalLighting(received, draft.lighting)) throw new Error('灯光参数读回与草稿不一致；已停止。');
      }
      if (!equalArray(baseline.macros, draft.macros)) {
        await connection.client.writeMacroBytes(draft.macros);
        const received = await connection.client.readMacroBytes();
        if (!equalArray(received, draft.macros)) throw new Error('宏缓冲区读回与草稿不一致；已停止。');
      }
      setBaseline(cloneState(draft)); setNotice('全部变更均已由键盘读回验证。');
    } catch (error) { setNotice(error instanceof Error ? `写入未完全通过：${error.message}` : '写入失败。未验证部分不会显示成功。'); }
    finally { setBusy(false); }
  };

  const updateSelectedKey = (value: number) => {
    if (!connection || !draft) return;
    const [row, col] = selectedKey.split(':').map(Number); const index = row * 16 + col;
    setDraft(previous => { if (!previous) return previous; const next = cloneState(previous); next.layers[selectedLayer][index] = value; return next; });
  };

  const updateLighting = (update: Partial<LightingState>) => setDraft(previous => previous ? {...previous, lighting: {...previous.lighting, ...update}} : previous);
  const macroDictionary = useMemo(() => macroBasicKeyDictionary(connection?.protocol ?? 9), [connection?.protocol]);
  const macroByteToKey = useMemo(() => byteToKeyMap(macroDictionary), [macroDictionary]);
  const macroSteps = useMemo(() => draft && connection && draft.macroCount ? parseMacroBytes(draft.macros, draft.macroCount, macroByteToKey, connection.protocol) : [], [draft, connection, macroByteToKey]);
  const updateMacros = (steps: MacroStep[][]) => { if (!draft || !connection) return; try { const bytes = serializeMacroBytes(steps, macroDictionary, connection.protocol); if (bytes.length > draft.macroCapacity) throw new Error(`宏共需 ${bytes.length} 字节，设备容量为 ${draft.macroCapacity} 字节。`); setDraft(previous => previous ? {...previous, macros: bytes} : previous); } catch (error) { setNotice(error instanceof Error ? error.message : '宏编码失败。'); } };
  const exportProfile = () => { if (!connection || !draft) return; downloadJson(`crush80-${connection.mode}-${new Date().toISOString().slice(0,10)}.json`, makeProfile({mode: connection.mode, vendorId: Number.parseInt(connection.definition.vendorId, 16), productId: Number.parseInt(connection.definition.productId, 16), matrix: {rows: 8, cols: 16}, layers: draft.layers, lighting: draft.lighting, macros: draft.macros})); };
  const importProfile = async (file?: File) => { if (!file || !connection) return; try { const profile = parseProfile(await file.text()); if (profile.vendorId !== Number.parseInt(connection.definition.vendorId, 16) || profile.productId !== Number.parseInt(connection.definition.productId, 16)) throw new Error('档案连接模式与当前键盘不一致。'); if (profile.layers.length !== connection.layers) throw new Error(`档案含 ${profile.layers.length} 层，当前键盘为 ${connection.layers} 层。`); if (profile.macros.length > (draft?.macroCapacity ?? 0)) throw new Error('档案宏超出当前设备缓冲区。'); setDraft(previous => previous ? {...previous, layers: profile.layers.map(layer => [...layer]), lighting: {...profile.lighting, color: [...profile.lighting.color] as [number, number]}, macros: [...profile.macros]} : previous); setNotice('档案已导入为本地草稿。请核对底部变更摘要后，再明确写入。'); } catch (error) { setNotice(error instanceof Error ? error.message : '导入失败。'); } finally { if (inputRef.current) inputRef.current.value = ''; } };

  if (!connection || !draft || !baseline) return <ConnectionPage mode={mode} setMode={setMode} connect={connect} busy={busy} notice={notice}/>;
  const selected = connection.keys.find(key => key.id === selectedKey) ?? connection.keys[0];
  const selectedCode = draft.layers[selectedLayer][selected.row * 16 + selected.col];
  const options = [...keycodeOptionsForProtocol(connection.protocol), ...customKeycodeOptions(connection.definition.customKeycodes, connection.protocol), ...macroKeycodeOptions(draft.macroCount, connection.protocol)];

  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => setPage('overview')}><span className="brand-orb">C</span><span>Crush 80<small>CONTROL CENTER</small></span></button><nav>{NAV.map(([id,label,Icon]) => <button className={page === id ? 'nav-item active' : 'nav-item'} key={id} onClick={() => setPage(id)}><Icon size={18}/>{label}</button>)}</nav><div className="device-mini"><span className="live-dot"/> 已连接<b>{connection.mode === 'usb' ? 'USB 有线' : '2.4G 接收器'}</b><small>{connection.productName}</small></div></aside><main className="content"><header className="utility"><span><span className="live-dot"/> 标准 VIA 已连接</span><span>{connection.mode === 'usb' ? 'USB 有线' : '2.4G 接收器'}</span><button aria-label="设置"><Settings2 size={17}/></button></header><div className="page-enter">{page === 'overview' && <Overview connection={connection} dirty={dirty} setPage={setPage}/>} {page === 'keymap' && <Keymap connection={connection} draft={draft} selectedLayer={selectedLayer} setSelectedLayer={setSelectedLayer} selectedKey={selectedKey} setSelectedKey={setSelectedKey} selected={selected} selectedCode={selectedCode} options={options} updateSelectedKey={updateSelectedKey}/>} {page === 'lighting' && <Lighting lighting={draft.lighting} update={updateLighting}/>} {page === 'macros' && <Macros protocol={connection.protocol} capacity={draft.macroCapacity} selectedMacro={selectedMacro} setSelectedMacro={setSelectedMacro} macros={macroSteps} update={updateMacros}/>} {page === 'profiles' && <Profiles connection={connection} dirty={dirty} exportProfile={exportProfile} chooseImport={() => inputRef.current?.click()} discard={() => setDraft(cloneState(baseline))} notice={setNotice}/>}</div></main><input ref={inputRef} className="visually-hidden" type="file" accept="application/json" onChange={event => void importProfile(event.target.files?.[0])}/><footer className={'savebar ' + (dirty.total ? 'show' : '')}><span><b>{dirty.total} 项待写入</b>{dirty.total ? ` · 键位 ${dirty.keys}，灯光 ${dirty.lighting ? 1 : 0}，宏 ${dirty.macros ? 1 : 0}` : ''}</span><div><button disabled={busy} onClick={() => setDraft(cloneState(baseline))}>放弃草稿</button><button className="primary" disabled={busy || !dirty.total} onClick={() => void applyDraft}>{busy ? <LoaderCircle className="spin" size={16}/> : '写入并读回验证'} <ChevronRight size={16}/></button></div></footer>{notice && <div className="toast"><CircleHelp size={17}/><span>{notice}</span><button onClick={() => setNotice('')}>×</button></div>}</div>;
}

function ConnectionPage({mode,setMode,connect,busy,notice}:{mode: ConnectionMode; setMode: (mode: ConnectionMode) => void; connect: () => void; busy: boolean; notice: string}) { return <div className="connection-page"><header className="connect-top"><span className="brand-orb">C</span><b>Crush 80 <small>CONTROL CENTER</small></b><span>RGB 旗舰版</span></header><section className="connect-copy"><p className="eyebrow">本地标准 VIA 控制中心</p><h1>让每一个按键，<br/>恰好落在你的习惯里。</h1><p>选择当前连接方式。浏览器将显示原生 HID 权限窗口；工具会先验证官方 VID/PID 与 VIA collection，再进行只读同步。</p><div className="mode-cards"><button className={mode === 'usb' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('usb')}><Usb/><b>USB 有线</b><small>官方 ID：0x320F : 0x5055</small></button><button className={mode === '2.4g' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('2.4g')}><Activity/><b>2.4G 接收器</b><small>官方 ID：0x320F : 0x5088</small></button></div><button className="connect-btn" disabled={busy} onClick={connect}>{busy ? <LoaderCircle className="spin"/> : <Usb/>}{busy ? '正在读取设备…' : '连接键盘'}</button>{notice && <p className="connect-notice">{notice}</p>}</section><div className="product-stage"><KeyboardHero/></div></div>; }
function KeyboardHero() { return <div className="hero-keyboard">{Array.from({length: 58}, (_, index) => <i key={index} style={{'--h': `${(index * 23) % 360}deg`} as React.CSSProperties}/>)}</div>; }
function PageTitle({eyebrow,title,children}:{eyebrow:string;title:string;children?:React.ReactNode}) { return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</header>; }
function Overview({connection,dirty,setPage}:{connection:Connection;dirty:{keys:number;lighting:boolean;macros:boolean;total:number};setPage:(page:Page)=>void}) { return <><PageTitle eyebrow="设备已同步" title="现在，键盘的状态在这里。"><p>下列数据已通过标准 VIA 只读命令从当前设备读取。更改会留在草稿中，直到你明确写入。</p></PageTitle><section className="overview-top"><article className="device-hero"><div><span className="live-dot"/> 当前设备</div><h2>Crush 80 <small>RGB 旗舰版</small></h2><dl><div><dt>连接方式</dt><dd>{connection.mode === 'usb' ? 'USB 有线' : '2.4G 接收器'}</dd></div><div><dt>VIA 协议</dt><dd>v{connection.protocol}</dd></div><div><dt>Layer 数</dt><dd>{connection.layers}</dd></div></dl></article><article className="quick-actions"><button onClick={() => setPage('keymap')}><Keyboard/> <b>键位设置</b><small>读取、暂存、逐键读回验证</small><ChevronRight/></button><button onClick={() => setPage('lighting')}><Lightbulb/> <b>灯光</b><small>仅限官方 JSON 声明的四项参数</small><ChevronRight/></button><button onClick={() => setPage('profiles')}><Archive/> <b>配置档案</b><small>本机导入、导出和变更审查</small><ChevronRight/></button></article></section><section className="session-strip"><b>本次会话</b><span>官方矩阵 8 × 16</span><span>物理键位 93 个</span>{dirty.total > 0 && <span className="dirty-tag">{dirty.total} 项待写入</span>}</section></>; }
function Keymap({connection,draft,selectedLayer,setSelectedLayer,selectedKey,setSelectedKey,selected,selectedCode,options,updateSelectedKey}:{connection:Connection;draft:DeviceState;selectedLayer:number;setSelectedLayer:(value:number)=>void;selectedKey:string;setSelectedKey:(value:string)=>void;selected:KeyboardKey;selectedCode:number;options:KeycodeOption[];updateSelectedKey:(value:number)=>void}) { const categories = ['常用','输入','媒体','层','设备','宏']; const [category,setCategory] = useState('常用'); const visible = options.filter(option => option.category === category); return <><PageTitle eyebrow="键位设置" title="映射你的工作方式。"><p>键位位置严格读取官方 VIA JSON；每一枚可写键以 <code>Layer:Row:Column</code> 唯一标识。</p></PageTitle><div className="layer-bar">{Array.from({length: connection.layers}, (_, index) => <button key={index} className={selectedLayer === index ? 'active' : ''} onClick={() => setSelectedLayer(index)}>Layer {index}</button>)}</div><section className="keymap-grid"><div className="keymap-canvas"><OfficialKeyboard keys={connection.keys} selected={selectedKey} keycodes={draft.layers[selectedLayer]} custom={connection.definition.customKeycodes} macroCount={draft.macroCount} onSelect={setSelectedKey}/><p>当前选择：矩阵 {selected.row},{selected.col} · 原始 keycode 显示在右侧。ISO/ANSI 兼容重复坐标已去重，不会生成重复写入。</p></div><aside className="key-inspector"><p className="eyebrow">当前选择</p><h2>{labelForKeycode(selectedCode, connection.definition.customKeycodes, draft.macroCount)}</h2><small>Layer {selectedLayer} · Row {selected.row} · Column {selected.col} · 0x{selectedCode.toString(16).toUpperCase().padStart(4,'0')}</small><div className="key-categories">{categories.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="key-options">{visible.length ? visible.map(option => <button key={option.code} className={selectedCode === option.value ? 'active' : ''} onClick={() => updateSelectedKey(option.value)}><b>{option.label}</b><small>{option.code}</small></button>) : <p>当前类别没有受官方定义允许的可选项。</p>}</div></aside></section></>; }
function OfficialKeyboard({keys,selected,keycodes,custom,macroCount,onSelect}:{keys:KeyboardKey[];selected:string;keycodes:number[];custom:typeof usbDefinition.customKeycodes;macroCount:number;onSelect:(id:string)=>void}) { const width = Math.max(...keys.map(key => key.x + key.width)); const height = Math.max(...keys.map(key => key.y + key.height)); return <div className="official-keyboard" style={{'--layout-width': String(width), '--layout-height': String(height)} as React.CSSProperties}>{keys.map(key => <button key={key.id} title={`${key.id} · ${labelForKeycode(keycodes[key.row * 16 + key.col], custom, macroCount)}`} className={selected === key.id ? 'selected' : ''} onClick={() => onSelect(key.id)} style={{left: `${key.x / width * 100}%`, top: `${key.y / height * 100}%`, width: `${key.width / width * 100}%`, height: `${key.height / height * 100}%`, '--key-color': key.color} as React.CSSProperties}><span>{labelForKeycode(keycodes[key.row * 16 + key.col], custom, macroCount)}</span></button>)}</div>; }
function Lighting({lighting,update}:{lighting:LightingState;update:(value:Partial<LightingState>)=>void}) { const color = hsToHex(lighting.color[0], lighting.color[1]); return <><PageTitle eyebrow="官方 Lighting 菜单" title="让光停在恰好的地方。"><p>只显示官方 JSON 定义的 Brightness、Effect、Effect Speed、Color；没有虚构区域灯光或性能项。</p></PageTitle><section className="lighting-grid"><div className="light-stage"><div className="preview-label"><span className="rainbow-dot"/>效果预览 · {EFFECTS[lighting.effect]}</div><KeyboardHero/></div><aside className="lighting-card"><label>亮度 <output>{lighting.brightness} / 9</output><input type="range" min="0" max="9" value={lighting.brightness} onChange={event => update({brightness: Number(event.target.value)})}/></label><label>灯效<select value={lighting.effect} onChange={event => update({effect: Number(event.target.value)})}>{EFFECTS.map((name,index) => <option key={name} value={index}>{index} · {name}</option>)}</select></label><label>速度 <output>{lighting.speed} / 4</output><input disabled={lighting.effect === 0} type="range" min="0" max="4" value={lighting.speed} onChange={event => update({speed: Number(event.target.value)})}/></label><label>颜色 <input disabled={lighting.effect === 0} type="color" value={color} onChange={event => update({color: hexToHs(event.target.value)})}/><small>标准 VIA 颜色菜单以 HSV 的 Hue/Saturation 两字节保存。</small></label></aside></section></>; }
function Macros({protocol,capacity,selectedMacro,setSelectedMacro,macros,update}:{protocol:number;capacity:number;selectedMacro:number;setSelectedMacro:(value:number)=>void;macros:MacroStep[][];update:(value:MacroStep[][])=>void}) { const current = macros[selectedMacro] ?? []; const add = (step: MacroStep) => { const next = macros.map(items => [...items]); next[selectedMacro] = [...(next[selectedMacro] ?? []), step]; update(next); }; const remove = (index:number) => { const next = macros.map(items => [...items]); next[selectedMacro].splice(index, 1); update(next); }; if (!macros.length) return <><PageTitle eyebrow="宏" title="此设备报告未启用宏。"><p>官方 VIA 协议返回的宏数量为 0，因此本工具不会猜测或强行启用宏功能。</p></PageTitle></>; return <><PageTitle eyebrow="宏" title="把重复留给一次设置。"><p>容量 {capacity} 字节。使用 VIA 标准宏缓冲区；协议 v{protocol}{protocol >= 11 ? ' 支持延迟。' : ' 不支持延迟。'}</p></PageTitle><section className="macro-grid"><aside className="macro-sidebar">{macros.map((steps,index) => <button className={selectedMacro === index ? 'active' : ''} key={index} onClick={() => setSelectedMacro(index)}><b>宏 {index}</b><small>{steps.length ? `${steps.length} 个动作` : '未设置'}</small></button>)}</aside><div className="macro-work"><div className="macro-head"><div><p className="eyebrow">宏 {selectedMacro}</p><h2>{current.length ? '编辑动作序列' : '空宏'}</h2></div><button onClick={() => { const next = macros.map(items => [...items]); next[selectedMacro] = []; update(next); }}>清空</button></div><ol>{current.map((step,index) => <li key={index}><span>{String(index + 1).padStart(2,'0')}</span><b>{step.type === 'tap' ? '按下并松开' : step.type === 'down' ? '按下' : step.type === 'up' ? '松开' : step.type === 'delay' ? '等待' : '文本'}</b><kbd>{step.type === 'delay' ? `${step.milliseconds} ms` : step.type === 'text' ? step.text : step.keycode}</kbd><button onClick={() => remove(index)}>删除</button></li>)}</ol></div><aside className="insert-actions"><p className="eyebrow">插入动作</p><button onClick={() => add({type:'tap', keycode:'KC_A'})}>按键 A</button><button onClick={() => { add({type:'down', keycode:'KC_LCTL'}); add({type:'tap', keycode:'KC_C'}); add({type:'up', keycode:'KC_LCTL'}); }}>组合键 Ctrl + C</button><button onClick={() => add({type:'text', text:'text'})}>ASCII 文本</button><button disabled={protocol < 11} onClick={() => add({type:'delay', milliseconds:100})}>延迟 100ms</button></aside></section></>; }
function Profiles({connection,dirty,exportProfile,chooseImport,discard,notice}:{connection:Connection;dirty:{keys:number;lighting:boolean;macros:boolean;total:number};exportProfile:()=>void;chooseImport:()=>void;discard:()=>void;notice:(message:string)=>void}) { const copy = async () => { const value = [`Crush 80 Control Center`, `模式：${connection.mode}`, `VID/PID：${connection.definition.vendorId}:${connection.definition.productId}`, `VIA protocol：${connection.protocol}`, `Layer：${connection.layers}`, `只使用官方 JSON 与标准 VIA 协议。`].join('\n'); try { await navigator.clipboard.writeText(value); notice('诊断信息已复制到剪贴板。'); } catch { notice('浏览器未授予剪贴板权限。'); } }; return <><PageTitle eyebrow="配置与诊断" title="保存现在，也保留回去的路。"><p>档案仅保存在你的电脑上，不上传键位、宏或设备数据。导入后先成为草稿，仍需显式写入和读回验证。</p></PageTitle><section className="profile-cards"><article><p className="eyebrow">配置档案</p><h2>当前工作区</h2><p>导出 Layer、官方灯光菜单和宏缓冲区。导入时验证官方矩阵、PID、层数和宏容量。</p><div><button className="primary" onClick={exportProfile}><Download size={16}/> 导出备份</button><button onClick={chooseImport}><Upload size={16}/> 导入档案</button></div></article><article><p className="eyebrow">会话保护</p><h2>{dirty.total} 项未保存改动</h2><p>键位 {dirty.keys} 项；灯光 {dirty.lighting ? '已修改' : '未修改'}；宏 {dirty.macros ? '已修改' : '未修改'}。</p><button className="danger" onClick={discard}>放弃未保存改动</button></article></section><section className="diagnostic-card"><div className="section-header"><h2>设备诊断</h2><button onClick={() => void copy()}>复制诊断信息</button></div><dl>{[['设备名称',connection.productName],['连接方式',connection.mode === 'usb' ? 'USB 有线':'2.4G 接收器'],['Vendor ID',connection.definition.vendorId],['Product ID',connection.definition.productId],['VIA 协议版本',String(connection.protocol)],['Layer 数',String(connection.layers)]].map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section></>; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
