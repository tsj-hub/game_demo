/* ============================================================
   game-state.js  —  全游戏共享状态管理
   通过 localStorage 持久化：当前场景、已收集证据、各关得分
   在所有场景 HTML 中通过 <script src=".../game-state.js"></script> 引入
   ============================================================ */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'unnamed_game_state_v1';

  // ====== 根目录定位（用于跨目录导航） ======
  // 捕获本脚本所在目录，作为"游戏根目录"。
  // 这样 goTo() 即使从子目录页面调用，也能正确跳转到根目录下的目标 URL。
  let _ROOT_URL = '';
  try {
    const cur = document.currentScript;
    if (cur && cur.src) {
      // 形如 .../游戏部分/game-state.js → 去掉文件名，保留目录
      _ROOT_URL = cur.src.replace(/[^/]*$/, '');
    }
  } catch (e) { /* ignore */ }
  // 兜底：空字符串（退化为相对当前页的路径）
  if (!_ROOT_URL) {
    _ROOT_URL = '';
  }

  // ====== 场景流程定义 ======
  // 每个场景: id → { url, name, next }
  const SCENES = {
    'menu':              { url: 'index.html',                          name: '主菜单' },
    'prologue':          { url: 'prologue.html',                       name: '序幕 · 警察局', next: 'level1' },
    'level1':            { url: '2_1/游戏/timeline_puzzle.html',       name: '关卡 1 · 时间线拼图', next: 'story2' },
    'story2':            { url: 'story2.html',                         name: '剧情 2 · 中段转折', next: 'level2-monitor' },
    'level2-monitor':    { url: '2.2监控里的黑影/index.html',          name: '关卡 2A · 监控里的黑影', next: 'level2-hospital' },
    'level2-hospital':   { url: 'level2-hospital.html',                name: '关卡 2B · 医院现场', next: 'story3-dorm' },
    'story3-dorm':       { url: 'story3-dorm.html',                    name: '剧情 3 · 张荣宿舍搜查', next: 'level2-trial' },
    'level2-trial':      { url: '审讯质证/审讯质证.html',               name: '关卡 2C · 审讯赵医生', next: 'story4-legend' },
    'story4-legend':     { url: 'story4-legend.html',                  name: '剧情 4 · 传说揭示', next: 'level3-final' },
    'level3-final':      { url: '2.4（2）/2.4/evidence_board.html',    name: '关卡 3 · 终局追捕', next: 'menu' }
  };

  // ====== 证据目录（全游戏所有证据的元数据） ======
  // id → { name, icon, desc, scene }
  const EVIDENCE_META = {
    'phone':              { name: '新娘的手机',          icon: '📱', desc: '未婚夫交出，最后草稿："衣柜好像被人动过"', scene: 'prologue' },
    'hammer-fragment':    { name: '羊角锤碎片',          icon: '🔨', desc: '酒店更衣室地上发现', scene: 'level1' },
    'pry-mark':           { name: '撬痕照片',            icon: '🪟', desc: '窗户锁扣被撬痕迹', scene: 'level1' },
    'closet-scratch':     { name: '衣柜刮痕记录',        icon: '🚪', desc: '衣柜内侧刮痕', scene: 'level1' },
    'timeline':           { name: '完整时间线图',        icon: '🕒', desc: '6 事件时间线还原', scene: 'level1' },
    'forensic':           { name: '法医报告',            icon: '🧾', desc: '伤口与羊角锤吻合', scene: 'level1' },
    'forum-msg':          { name: '论坛私信截图',        icon: '💬', desc: 'NEST IS READY', scene: 'level1' },
    'anonymous-warn':     { name: '匿名警告',            icon: '⚠️', desc: '删掉。不要回复。立刻。', scene: 'level1' },
    'nemesis-card':       { name: 'NEMESIS 线索卡',      icon: '🔪', desc: '复仇女神代号', scene: 'level1' },
    'tech-report-1':      { name: '技术部门报告·第一阶段', icon: '📡', desc: 'NEST 与 BIRD 同一时段出现', scene: 'story2' },
    'cipher-1':           { name: '暗语残片 × 1',        icon: '🧩', desc: 'NEST IS READY', scene: 'story2' },
    'cipher-2':           { name: '暗语残片 × 2',        icon: '🧩', desc: 'BIRD IS FLYING', scene: 'story2' },
    'monitor-shots':      { name: '监控截图（5 处标记）', icon: '📹', desc: '4 号病房走廊黑影 5 处疑点', scene: 'level2-monitor' },
    'xiaoyu-painting':    { name: '小雨画作·最后一张',   icon: '🎨', desc: '穿白衣的人 + "晚安"', scene: 'level2-hospital' },
    'girl-testimony':     { name: '小女孩证词',          icon: '👧', desc: '"她什么时候醒？"', scene: 'level2-hospital' },
    'xiaoyu-record':      { name: '小雨病历',            icon: '📋', desc: '心内科会诊记录，签名赵医生', scene: 'level2-hospital' },
    'dorm-manuscript':    { name: '手抄传说+批注',       icon: '📜', desc: '"我也能成为另一个人"', scene: 'story3-dorm' },
    'dorm-clippings':     { name: '墙上剪报三则',        icon: '📰', desc: '半年质疑→求助→必须动手', scene: 'story3-dorm' },
    'dorm-bottle':        { name: '床底药瓶一组',        icon: '💊', desc: '胰岛素/地西泮/氯化钾', scene: 'story3-dorm' },
    'trial-confession':   { name: '赵医生完整供述',      icon: '📑', desc: '张荣=ORPHEUS，三局两胜，第三局即将开始', scene: 'level2-trial' },
    'full-legend':        { name: '完整传说',            icon: '📖', desc: '《复仇者与诗人的赌约》', scene: 'story4-legend' }
  };

  // ====== 默认状态 ======
  function defaultState() {
    return {
      currentScene: 'menu',
      evidence: [],          // 已收集的证据 id 列表
      scores: {              // 各关得分（键使用连字符，与 HTML 调用方保持一致）
        'level1': null,          // 时间线：完成即 1
        'level2-monitor': null,  // 监控：完成即 1
        'level2-trial': null,    // 审讯质证：0-3 （3 轮质证正确数）
        'level3-quiz': null,     // 终局推理：0-3 （3 道终极推理正确数）
        'level3-pursuit': null   // 追捕选择：0/1 （0=错 1=对）
      },
      visited: [],           // 已访问场景
      flags: {}              // 杂项标志位
    };
  }

  // ====== 读写 localStorage ======
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // 合并默认值，避免新字段缺失
      const def = defaultState();
      return Object.assign(def, parsed, {
        scores: Object.assign(def.scores, parsed.scores || {}),
        flags: Object.assign(def.flags, parsed.flags || {})
      });
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[GameState] 保存失败', e);
    }
  }

  let state = load();

  // ====== 公共 API ======
  const GameState = {
    SCENES,
    EVIDENCE_META,

    /** 获取当前完整状态 */
    getAll() { return JSON.parse(JSON.stringify(state)); },

    /** 从 localStorage 重新加载状态（用于跨 iframe 同步） */
    // 父页面(index.html)与 iframe 场景是独立的 JS 上下文，各自维护一份
    // in-memory state。iframe 场景收集证据后写入 localStorage，但父页面的
    // state 不会自动更新。调用此方法可重新读取 localStorage，使父页面的
    // 证据板、分数线等显示最新数据。
    reload() {
      state = load();
      this._refreshPanelIfOpen();
    },

    /** 如果证据面板当前已打开，则刷新其内容 */
    _refreshPanelIfOpen() {
      const panel = document.getElementById('__gs_evidence_panel');
      if (panel && panel.classList.contains('show')) {
        this._renderEvidenceGrid(panel);
      }
    },

    /** 重置游戏 */
    reset() {
      state = defaultState();
      save(state);
    },

    /** 获取当前场景 id */
    getCurrentScene() { return state.currentScene; },

    /** 设置当前场景（不跳转，仅记录） */
    setCurrentScene(id) {
      if (!SCENES[id]) {
        console.warn('[GameState] 未知场景 id:', id);
        return;
      }
      state.currentScene = id;
      if (!state.visited.includes(id)) state.visited.push(id);
      save(state);
    },

    /** 跳转到指定场景 */
    goTo(id) {
      if (!SCENES[id]) {
        console.warn('[GameState] 未知场景 id:', id);
        return;
      }
      this.setCurrentScene(id);
      // 以 game-state.js 所在目录为根，正确处理跨子目录导航
      const target = SCENES[id].url;
      if (/^https?:|^file:|^\/\//.test(target)) {
        window.location.href = target;
      } else if (_ROOT_URL) {
        window.location.href = _ROOT_URL + target;
      } else {
        window.location.href = target;
      }
    },

    /** 跳转到下一个场景（按 SCENES 流程） */
    next() {
      const cur = state.currentScene;
      const def = SCENES[cur];
      if (!def || !def.next) {
        console.warn('[GameState] 当前场景无 next:', cur);
        return;
      }
      this.goTo(def.next);
    },

    /** 添加证据（去重） */
    addEvidence(id) {
      if (!EVIDENCE_META[id]) {
        console.warn('[GameState] 未知证据 id:', id);
        return false;
      }
      if (state.evidence.includes(id)) return false;
      state.evidence.push(id);
      save(state);
      this._notifyEvidenceChange(id, 'add');
      return true;
    },

    /** 批量添加证据 */
    addEvidences(ids) {
      ids.forEach(id => this.addEvidence(id));
    },

    /** 移除证据 */
    removeEvidence(id) {
      const i = state.evidence.indexOf(id);
      if (i >= 0) {
        state.evidence.splice(i, 1);
        save(state);
        this._notifyEvidenceChange(id, 'remove');
      }
    },

    /** 获取已收集证据 id 列表 */
    getEvidence() { return state.evidence.slice(); },

    /** 获取已收集证据的完整元数据 */
    getEvidenceDetails() {
      return state.evidence.map(id => Object.assign({ id }, EVIDENCE_META[id] || { name: id, icon: '❓', desc: '' }));
    },

    /** 是否已收集某证据 */
    hasEvidence(id) { return state.evidence.includes(id); },

    /** 设置某关得分（允许写入新键，兼容未来扩展） */
    setScore(key, value) {
      if (!key) { console.warn('[GameState] setScore key 为空'); return; }
      state.scores[key] = value;
      save(state);
    },

    /** 获取某关得分 */
    getScore(key) { return state.scores[key]; },

    /** 设置标志位 */
    setFlag(key, value) {
      state.flags[key] = value;
      save(state);
    },

    /** 获取标志位 */
    getFlag(key, def) { return state.flags.hasOwnProperty(key) ? state.flags[key] : def; },

    // ====== 证据变更通知（用于刷新证据面板） ======
    _listeners: [],
    onEvidenceChange(fn) {
      this._listeners.push(fn);
    },
    _notifyEvidenceChange(id, action) {
      this._listeners.forEach(fn => {
        try { fn(id, action); } catch (e) { console.warn(e); }
      });
    },

    // ====== 证据板面板（侧边按钮 + 弹窗） ======
    /**
     * 在当前页面注入"证据板"按钮和面板
     * 自动适应页面已有的样式
     */
    injectEvidencePanel(options) {
      options = options || {};
      const theme = options.theme || 'dark'; // 'dark' | 'paper' | 'cork'

      // 防止重复注入
      if (document.getElementById('__gs_evidence_btn')) return;

      const btn = document.createElement('button');
      btn.id = '__gs_evidence_btn';
      btn.textContent = '证据板';
      btn.setAttribute('aria-label', '打开证据板');

      const panel = document.createElement('div');
      panel.id = '__gs_evidence_panel';

      const style = document.createElement('style');
      style.textContent = `
        #__gs_evidence_btn {
          position: fixed;
          right: 18px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 9998;
          padding: 14px 10px;
          writing-mode: vertical-rl;
          text-orientation: upright;
          letter-spacing: 4px;
          font-size: 13px;
          font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.25s ease;
          user-select: none;
        }
        /* 主题：暗色（2_1 青色风） */
        body[data-gs-theme="dark"] #__gs_evidence_btn,
        #__gs_evidence_btn[data-theme="dark"] {
          background: #0c1220;
          border: 1px solid #007a94;
          color: #00d4ff;
          box-shadow: 0 0 12px rgba(0, 212, 255, 0.18);
        }
        body[data-gs-theme="dark"] #__gs_evidence_btn:hover,
        #__gs_evidence_btn[data-theme="dark"]:hover {
          background: rgba(0, 212, 255, 0.1);
          box-shadow: 0 0 22px rgba(0, 212, 255, 0.4);
        }
        /* 主题：纸墨（2.2 橙黄风） */
        body[data-gs-theme="paper"] #__gs_evidence_btn,
        #__gs_evidence_btn[data-theme="paper"] {
          background: #1a1814;
          border: 1px solid #c8924a;
          color: #c8924a;
          box-shadow: 0 0 10px rgba(200, 146, 74, 0.2);
        }
        body[data-gs-theme="paper"] #__gs_evidence_btn:hover,
        #__gs_evidence_btn[data-theme="paper"]:hover {
          background: rgba(200, 146, 74, 0.12);
          box-shadow: 0 0 18px rgba(200, 146, 74, 0.4);
        }
        /* 主题：软木板（2.4） */
        body[data-gs-theme="cork"] #__gs_evidence_btn,
        #__gs_evidence_btn[data-theme="cork"] {
          background: #2a2d35;
          border: 1px solid #b71c1c;
          color: #d4dae6;
          box-shadow: 0 0 10px rgba(183, 28, 28, 0.3);
        }
        body[data-gs-theme="cork"] #__gs_evidence_btn:hover,
        #__gs_evidence_btn[data-theme="cork"]:hover {
          background: rgba(183, 28, 28, 0.2);
          box-shadow: 0 0 18px rgba(183, 28, 28, 0.5);
        }

        #__gs_evidence_panel {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(6px);
          display: none;
          align-items: center;
          justify-content: center;
          padding: 30px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        #__gs_evidence_panel.show {
          display: flex;
          opacity: 1;
        }
        #__gs_evidence_panel .gs-panel-box {
          width: 90%;
          max-width: 880px;
          max-height: 85vh;
          overflow-y: auto;
          background: linear-gradient(180deg, #0e1420 0%, #050810 100%);
          border: 1px solid #00d4ff;
          border-radius: 8px;
          padding: 30px 36px 28px;
          box-shadow: 0 0 50px rgba(0, 212, 255, 0.25);
          color: #d4e4f5;
          font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
          position: relative;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-panel-box {
          background: linear-gradient(180deg, #1f1c16 0%, #16140f 100%);
          border-color: #c8924a;
          box-shadow: 0 0 40px rgba(200, 146, 74, 0.25);
          color: #d8c9a3;
        }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-panel-box {
          background: linear-gradient(180deg, #2d3038 0%, #1e2027 100%);
          border-color: #b71c1c;
          box-shadow: 0 0 40px rgba(183, 28, 28, 0.25);
          color: #d4dae6;
        }
        #__gs_evidence_panel .gs-panel-title {
          font-size: 20px;
          letter-spacing: 6px;
          text-align: center;
          margin-bottom: 6px;
          color: #00d4ff;
          text-shadow: 0 0 12px rgba(0, 212, 255, 0.5);
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-panel-title { color: #c8924a; text-shadow: 0 0 12px rgba(200, 146, 74, 0.4); }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-panel-title { color: #d4dae6; text-shadow: 0 0 12px rgba(183, 28, 28, 0.4); }
        #__gs_evidence_panel .gs-panel-sub {
          font-size: 12px;
          text-align: center;
          color: #6b8399;
          letter-spacing: 2px;
          margin-bottom: 22px;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-panel-sub { color: #8a7e62; }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-panel-sub { color: #5a6478; }
        #__gs_evidence_panel .gs-panel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 14px;
        }
        #__gs_evidence_panel .gs-ev-item {
          background: rgba(10, 16, 28, 0.6);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 6px;
          padding: 12px 14px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-ev-item {
          background: rgba(20, 19, 15, 0.6);
          border-color: rgba(200, 146, 74, 0.25);
        }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-ev-item {
          background: rgba(30, 32, 39, 0.6);
          border-color: rgba(183, 28, 28, 0.3);
        }
        #__gs_evidence_panel .gs-ev-icon {
          font-size: 22px;
          line-height: 1;
          flex-shrink: 0;
        }
        #__gs_evidence_panel .gs-ev-info { flex: 1; min-width: 0; }
        #__gs_evidence_panel .gs-ev-name {
          font-size: 13px;
          letter-spacing: 1px;
          margin-bottom: 4px;
          color: #00d4ff;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-ev-name { color: #c8924a; }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-ev-name { color: #d4dae6; }
        #__gs_evidence_panel .gs-ev-desc {
          font-size: 11.5px;
          color: #8aa0b8;
          line-height: 1.6;
          letter-spacing: 0.3px;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-ev-desc { color: #8a7e62; }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-ev-desc { color: #5a6478; }
        #__gs_evidence_panel .gs-ev-locked {
          opacity: 0.35;
          filter: grayscale(0.6);
        }
        #__gs_evidence_panel .gs-ev-locked .gs-ev-name { color: #6b8399; }
        #__gs_evidence_panel .gs-ev-locked .gs-ev-name::after { content: " · 未获得"; font-size: 10px; }
        #__gs_evidence_panel .gs-panel-empty {
          text-align: center;
          padding: 40px 20px;
          color: #6b8399;
          font-size: 14px;
          letter-spacing: 2px;
        }
        #__gs_evidence_panel .gs-panel-close {
          position: absolute;
          top: 14px;
          right: 18px;
          background: transparent;
          border: 1px solid currentColor;
          color: #00d4ff;
          font-size: 12px;
          padding: 4px 12px;
          cursor: pointer;
          border-radius: 3px;
          letter-spacing: 2px;
          font-family: inherit;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-panel-close { color: #c8924a; }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-panel-close { color: #d4dae6; }
        #__gs_evidence_panel .gs-panel-close:hover {
          background: rgba(0, 212, 255, 0.12);
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-panel-close:hover { background: rgba(200, 146, 74, 0.12); }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-panel-close:hover { background: rgba(183, 28, 28, 0.15); }
        #__gs_evidence_panel .gs-panel-progress {
          text-align: center;
          margin-top: 18px;
          font-size: 12px;
          color: #6b8399;
          letter-spacing: 2px;
        }
        body[data-gs-theme="paper"] #__gs_evidence_panel .gs-panel-progress { color: #8a7e62; }
        body[data-gs-theme="cork"] #__gs_evidence_panel .gs-panel-progress { color: #5a6478; }

        @media (max-width: 600px) {
          #__gs_evidence_panel .gs-panel-grid { grid-template-columns: 1fr; }
          #__gs_evidence_panel .gs-panel-box { padding: 22px 18px 20px; }
          #__gs_evidence_btn { right: 10px; padding: 10px 8px; font-size: 11px; }
        }
      `;
      document.head.appendChild(style);

      btn.dataset.theme = theme;
      document.body.setAttribute('data-gs-theme', theme);
      btn.addEventListener('click', () => this._openEvidencePanel(panel));
      document.body.appendChild(btn);

      panel.innerHTML = `
        <div class="gs-panel-box">
          <button class="gs-panel-close" id="__gs_ev_close">关 闭</button>
          <div class="gs-panel-title">证 据 板</div>
          <div class="gs-panel-sub">— 收集到的所有线索 —</div>
          <div class="gs-panel-grid" id="__gs_ev_grid"></div>
          <div class="gs-panel-progress" id="__gs_ev_progress"></div>
        </div>
      `;
      panel.addEventListener('click', (e) => {
        if (e.target === panel) panel.classList.remove('show');
      });
      panel.querySelector('#__gs_ev_close').addEventListener('click', () => {
        panel.classList.remove('show');
      });
      document.body.appendChild(panel);

      // 监听证据变化，刷新面板
      this.onEvidenceChange(() => {
        if (panel.classList.contains('show')) {
          this._renderEvidenceGrid(panel);
        }
      });
    },

    _openEvidencePanel(panel) {
      this._renderEvidenceGrid(panel);
      panel.classList.add('show');
    },

    _renderEvidenceGrid(panel) {
      const grid = panel.querySelector('#__gs_ev_grid');
      const progress = panel.querySelector('#__gs_ev_progress');
      const collected = state.evidence;
      const all = Object.keys(EVIDENCE_META);

      grid.innerHTML = '';
      if (collected.length === 0) {
        grid.innerHTML = '<div class="gs-panel-empty">尚未收集到任何证据<br>请继续推进调查</div>';
      } else {
        // 按 scene 顺序展示已收集
        const ordered = all.filter(id => collected.includes(id));
        ordered.forEach(id => {
          const meta = EVIDENCE_META[id];
          const item = document.createElement('div');
          item.className = 'gs-ev-item';
          item.innerHTML = `
            <div class="gs-ev-icon">${meta.icon}</div>
            <div class="gs-ev-info">
              <div class="gs-ev-name">${meta.name}</div>
              <div class="gs-ev-desc">${meta.desc}</div>
            </div>
          `;
          grid.appendChild(item);
        });
      }
      progress.textContent = `已收集 ${collected.length} / ${all.length} 项证据`;
    },

    /** 设置页面主题（用于证据面板配色） */
    setTheme(theme) {
      document.body.setAttribute('data-gs-theme', theme);
      const btn = document.getElementById('__gs_evidence_btn');
      if (btn) btn.dataset.theme = theme;
    }
  };

  window.GameState = GameState;
})(window);
