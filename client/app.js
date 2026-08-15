import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
const META = {
  RED:    { ar: 'الأحمر', css: '#ff3d45', pieceTint: '#f01828', outline: '#fff3f3', material: 'LUDO_COIN_M.003', camera: [-1, 1] },
  GREEN:  { ar: 'الأخضر', css: '#18a957', pieceTint: '#0b9f49', outline: '#e8fff0', material: 'LUDO_COIN_M', camera: [1, 1] },
  YELLOW: { ar: 'الأصفر', css: '#f3b812', pieceTint: '#f0aa00', outline: '#fff8d8', material: 'LUDO_COIN_M.001', camera: [1, -1] },
  BLUE:   { ar: 'الأزرق', css: '#259fe7', pieceTint: '#0873df', outline: '#eaf5ff', material: 'LUDO_COIN_M.002', camera: [-1, -1] }
};

const BASE_PATH = [
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
];
const PATH = [...BASE_PATH].reverse();
const START_CELL = { RED:[1,6], GREEN:[6,13], YELLOW:[13,8], BLUE:[8,1] };
const FINISH_LANES = {
  RED:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  GREEN:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  YELLOW:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  BLUE:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]
};
const START_INDEX = Object.fromEntries(COLORS.map(color => [
  color,
  PATH.findIndex(([r,c]) => r === START_CELL[color][0] && c === START_CELL[color][1])
]));
const VISUAL_SAFE_CELLS = COLORS.map(color => PATH[(START_INDEX[color] + 8) % PATH.length]);
const MAIN_TRACK_LAST_PROGRESS = 50;
const FINISH_LANE_START_PROGRESS = 51;
const FINAL_PROGRESS = 56;
const PIECE_BASE_SCALE = 0.82;

const DICE_FACE_NORMALS = {
  1:new THREE.Vector3(0,1,0), 2:new THREE.Vector3(0,0,1), 3:new THREE.Vector3(1,0,0),
  4:new THREE.Vector3(-1,0,0), 5:new THREE.Vector3(0,0,-1), 6:new THREE.Vector3(0,-1,0)
};

// DOM
const canvas = document.querySelector('#gameCanvas');
const loading = document.querySelector('#loading');
const rollBtn = document.querySelector('#rollBtn');
const playAgainBtn = document.querySelector('#playAgainBtn');
const roomExitBtn = document.querySelector('#roomExitBtn');
const playersPanel = document.querySelector('#playersPanel');
const pieceButtons = document.querySelector('#pieceButtons');
const turnName = document.querySelector('#turnName');
const turnSwatch = document.querySelector('#turnSwatch');
const statusText = document.querySelector('#statusText');
const subStatus = document.querySelector('#subStatus');
const diceFace = document.querySelector('#diceFace');
const autoCamera = document.querySelector('#autoCamera');
const cameraButtons = [...document.querySelectorAll('[data-view]')];
const helpDialog = document.querySelector('#helpDialog');
const helpBtn = document.querySelector('#helpBtn');
const mobileHelpBtn = document.querySelector('#mobileHelpBtn');
const closeHelp = document.querySelector('#closeHelp');
const toastEl = document.querySelector('#toast');
const connectionText = document.querySelector('#connectionText');
const networkOverlay = document.querySelector('#networkOverlay');
const homeScreen = document.querySelector('#homeScreen');
const lobbyScreen = document.querySelector('#lobbyScreen');
const nameInput = document.querySelector('#nameInput');
const roomCodeInput = document.querySelector('#roomCodeInput');
const createRoomBtn = document.querySelector('#createRoomBtn');
const joinRoomBtn = document.querySelector('#joinRoomBtn');
const roomCodeDisplay = document.querySelector('#roomCodeDisplay');
const copyCodeBtn = document.querySelector('#copyCodeBtn');
const copyLinkBtn = document.querySelector('#copyLinkBtn');
const shareRoomBtn = document.querySelector('#shareRoomBtn');
const lobbyCount = document.querySelector('#lobbyCount');
const leaveRoomBtn = document.querySelector('#leaveRoomBtn');
const lobbyPlayers = document.querySelector('#lobbyPlayers');
const waitingTimer = document.querySelector('#waitingTimer');
const fillBotsBtn = document.querySelector('#fillBotsBtn');
const lobbyHint = document.querySelector('#lobbyHint');
const loadingProgressBar = document.querySelector('#loadingProgressBar');
const loadingProgressText = document.querySelector('#loadingProgressText');
const loadingLabel = loading.querySelector('[data-loading-label]');
const quickClassicBtn = document.querySelector('#quickClassicBtn');
const quickTeamBtn = document.querySelector('#quickTeamBtn');
const computerBtn = document.querySelector('#computerBtn');
const createPublicRoomBtn = document.querySelector('#createPublicRoomBtn');
const roomModeSelect = document.querySelector('#roomModeSelect');
const publicRoomsList = document.querySelector('#publicRoomsList');
const refreshPublicRoomsBtn = document.querySelector('#refreshPublicRoomsBtn');
const matchmakingPanel = document.querySelector('#matchmakingPanel');
const matchmakingTitle = document.querySelector('#matchmakingTitle');
const matchmakingText = document.querySelector('#matchmakingText');
const cancelMatchmakingBtn = document.querySelector('#cancelMatchmakingBtn');
const lobbyMode = document.querySelector('#lobbyMode');
const pointsStoreBtn = document.querySelector('#pointsStoreBtn');
const pointsStoreSecondaryBtn = document.querySelector('#pointsStoreSecondaryBtn');
const pointsDialog = document.querySelector('#pointsDialog');
const closePointsBtn = document.querySelector('#closePointsBtn');
const pointPackages = document.querySelector('#pointPackages');
const paymentDemo = document.querySelector('#paymentDemo');
const purchasePreview = document.querySelector('#purchasePreview');
const purchaseIntentBtn = document.querySelector('#purchaseIntentBtn');
const comingSoonPurchase = document.querySelector('#comingSoonPurchase');
const finishPointsDemoBtn = document.querySelector('#finishPointsDemoBtn');
const exitDialog = document.querySelector('#exitDialog');
const closeExitDialog = document.querySelector('#closeExitDialog');
const cancelExitBtn = document.querySelector('#cancelExitBtn');
const confirmExitBtn = document.querySelector('#confirmExitBtn');
const exitDialogText = document.querySelector('#exitDialogText');
const gameOverDialog = document.querySelector('#gameOverDialog');
const gameOverTitle = document.querySelector('#gameOverTitle');
const gameOverSummary = document.querySelector('#gameOverSummary');
const gameOverRematchBtn = document.querySelector('#gameOverRematchBtn');
const gameOverNewGameBtn = document.querySelector('#gameOverNewGameBtn');
const gameOverHomeBtn = document.querySelector('#gameOverHomeBtn');
const gameOverHint = document.querySelector('#gameOverHint');

// Scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1015);
scene.fog = new THREE.Fog(0x0d1015, 16, 30);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 100);
camera.position.set(7,9,7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 17;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.35;
scene.add(new THREE.HemisphereLight(0xffffff, 0x242c38, 2.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.6);
keyLight.position.set(5,11,7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048,2048);
keyLight.shadow.camera.near=1; keyLight.shadow.camera.far=30;
keyLight.shadow.camera.left=-9; keyLight.shadow.camera.right=9; keyLight.shadow.camera.top=9; keyLight.shadow.camera.bottom=-9;
scene.add(keyLight);
const floor = new THREE.Mesh(new THREE.CircleGeometry(13,80), new THREE.MeshStandardMaterial({ color:0x171c24, roughness:.95 }));
floor.rotation.x = -Math.PI/2; floor.position.y=-.02; floor.receiveShadow=true; scene.add(floor);

let modelRoot = null;
let originalDiceRoot = null;
let diceRoot = null;
let diceHitMesh = null;
let diceRestY = null;
let safeStarsGroup = null;
let boardBounds = null;
let boardCenter = new THREE.Vector3(-.84,.22,-1.72);
let cellW=.57, cellD=.57, pieceGroundY=.255;
let piecesByColor = { RED:[], GREEN:[], YELLOW:[], BLUE:[] };
let pieceMeshes = [];
let hoverPieceId = null;
let moveQueue = [];
let cameraTween = null;
let diceSpin = null;
let toastTimer = null;
let modelReady = false;
let roomState = null;
let appliedRoomState = null;
let snapshotQueue = Promise.resolve();
let rollPending = false;
let clockOffset = 0;
let lobbyTimerHandle = null;
let resumeInFlight = false;
let initialCameraSet = false;
let syncRequestInFlight = false;
let lastEventIds = new Set();
let matchmakingMode = null;
let publicRooms = [];
let selectedPointPackage = null;
let selectedPaymentMethod = null;
let pointsIntentCompleted = false;
let lastGameOverDialogKey = null;
let exitInFlight = false;

// Network
const socket = window.io({ transports:['websocket','polling'] });
const SESSION_KEY = 'ludo3d.multiplayer.session';
const NAME_KEY = 'ludo3d.playerName';
const ANALYTICS_VISITOR_KEY = 'ludo3d.analytics.visitor';
const ANALYTICS_SESSION_KEY = 'ludo3d.analytics.session';
function persistentRandomId(key) {
  let value = localStorage.getItem(key);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}
const analyticsVisitorId = persistentRandomId(ANALYTICS_VISITOR_KEY);
const analyticsSessionId = sessionStorage.getItem(ANALYTICS_SESSION_KEY) || (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`);
sessionStorage.setItem(ANALYTICS_SESSION_KEY, analyticsSessionId);
function trackAnalytics(event, extra = {}) {
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ event, visitorId: analyticsVisitorId, sessionId: analyticsSessionId, ...extra })
  }).catch(() => {});
}
const savedName = localStorage.getItem(NAME_KEY);
if (savedName) nameInput.value = savedName;
const roomFromUrl = new URLSearchParams(location.search).get('room');
if (roomFromUrl) roomCodeInput.value = roomFromUrl.toUpperCase().slice(0,6);

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function saveSession(data) { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function saveName() { localStorage.setItem(NAME_KEY, nameInput.value.trim()); }
function makeActionId(prefix = 'action') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id}`;
}

function actionContext(prefix) {
  return {
    actionId: makeActionId(prefix),
    expectedVersion: roomState?.stateVersion ?? 0,
    expectedTurnId: roomState?.game?.turnId ?? 0
  };
}

function acceptSnapshot(snapshot) {
  if (!snapshot) return false;
  if (
    roomState?.id === snapshot.id &&
    Number.isInteger(roomState?.stateVersion) &&
    Number.isInteger(snapshot.stateVersion) &&
    snapshot.stateVersion < roomState.stateVersion
  ) return false;

  clockOffset = snapshot.serverNow - Date.now();
  roomState = snapshot;
  updateNetworkUI();
  snapshotQueue = snapshotQueue.then(() => applySnapshot(snapshot)).catch(console.error);
  return true;
}

function requestStateSync(reason = 'client') {
  if (!socket.connected || syncRequestInFlight) return;
  syncRequestInFlight = true;
  socket.emit('requestStateSync', { reason }, result => {
    syncRequestInFlight = false;
    if (result?.snapshot) acceptSnapshot(result.snapshot);
  });
}

socket.on('connect', () => {
  connectionText.textContent = 'Multiplayer • متصل';
  connectionText.classList.remove('connection-bad');
  const session = readSession();
  if (session?.roomId && session?.token && !resumeInFlight) {
    resumeInFlight = true;
    socket.emit('resumeSession', session, result => {
      resumeInFlight = false;
      if (!result?.ok) {
        clearSession();
        roomState = null;
        updateNetworkUI();
      } else if (result.snapshot) {
        acceptSnapshot(result.snapshot);
      }
    });
  } else {
    updateNetworkUI();
    if (matchmakingMode && nameInput.value.trim()) {
      socket.emit('quickMatch', { name:nameInput.value.trim(), mode:matchmakingMode }, result => {
        if (result?.queued) matchmakingText.textContent = `رجعنا لقائمة الانتظار — ${result.waiting} / 4`;
      });
    }
  }
});

socket.on('disconnect', () => {
  connectionText.textContent = 'Multiplayer • الاتصال انقطع…';
  connectionText.classList.add('connection-bad');
  rollPending = false;
  if (matchmakingMode && matchmakingText) matchmakingText.textContent = 'الاتصال انقطع — هنرجعك لقائمة الانتظار تلقائيًا.';
  renderHUD();
});

socket.on('roomState', snapshot => {
  acceptSnapshot(snapshot);
});

socket.on('publicRooms', rooms => {
  publicRooms = Array.isArray(rooms) ? rooms : [];
  renderPublicRooms();
});

socket.on('matchmakingStatus', status => {
  if (!matchmakingMode || status?.mode !== matchmakingMode) return;
  matchmakingPanel.hidden = false;
  matchmakingText.textContent = `في الانتظار ${status.waiting || 1} / 4 — فاضل ${Math.max(0, status.needed ?? 3)} لاعب`;
});

socket.on('matchFound', result => {
  matchmakingMode = null;
  matchmakingPanel.hidden = true;
  if (result?.roomId && result?.token) {
    saveSession({ roomId: result.roomId, token: result.token });
    history.replaceState(null, '', `?room=${result.roomId}`);
  }
  if (result?.snapshot) acceptSnapshot(result.snapshot);
  toast(result?.mode === 'TEAM_2V2' ? 'الماتش اتكوّن — 2 ضد 2 🔥' : 'لقينا 4 لاعبين — يلا بينا 🔥');
});

socket.on('resyncRequired', () => {
  requestStateSync('server_resync_required');
});

socket.on('gameEvent', event => {
  if (event?.eventId) {
    if (lastEventIds.has(event.eventId)) return;
    lastEventIds.add(event.eventId);
    if (lastEventIds.size > 256) lastEventIds.delete(lastEventIds.values().next().value);
  }
  if (roomState?.stateVersion != null && event?.stateVersion != null) {
    if (event.stateVersion < roomState.stateVersion) return;
    if (event.stateVersion > roomState.stateVersion + 1) requestStateSync('event_version_gap');
  }
  handleGameEvent(event);
});

socket.on('gameError', error => {
  rollPending = false;
  if (error?.code === 'STALE_ACTION') requestStateSync('stale_action');
  toast(errorMessage(error?.code));
  renderHUD();
});

function emitWithAck(event, payload, onSuccess) {
  socket.emit(event, payload, result => {
    if (result?.snapshot) acceptSnapshot(result.snapshot);
    if (!result?.ok) {
      if (result?.error?.code === 'STALE_ACTION') requestStateSync('ack_stale_action');
      toast(errorMessage(result?.error?.code));
      return;
    }
    onSuccess?.(result);
  });
}

function requirePlayerName() {
  const name = nameInput.value.trim();
  if (!name) { toast('اكتب اسمك الأول.'); return null; }
  saveName();
  return name;
}

function createRoomWithVisibility(visibility) {
  const name = requirePlayerName();
  if (!name) return;
  const mode = roomModeSelect?.value || 'CLASSIC';
  const button = visibility === 'PUBLIC' ? createPublicRoomBtn : createRoomBtn;
  button.disabled = true;
  emitWithAck('createRoom', { name, mode, visibility }, result => {
    button.disabled = false;
    saveSession({ roomId: result.roomId, token: result.token });
    history.replaceState(null, '', `?room=${result.roomId}`);
  });
  setTimeout(() => { button.disabled = false; }, 1500);
}

createRoomBtn.addEventListener('click', () => createRoomWithVisibility('PRIVATE'));
createPublicRoomBtn?.addEventListener('click', () => createRoomWithVisibility('PUBLIC'));

joinRoomBtn.addEventListener('click', () => {
  const name = requirePlayerName();
  const roomId = roomCodeInput.value.trim().toUpperCase();
  if (!name) return;
  if (roomId.length < 4) return toast('اكتب كود الروم.');
  joinRoomBtn.disabled = true;
  emitWithAck('joinRoom', { name, roomId }, result => {
    joinRoomBtn.disabled = false;
    saveSession({ roomId:result.roomId, token:result.token });
    history.replaceState(null, '', `?room=${result.roomId}`);
  });
  setTimeout(() => { joinRoomBtn.disabled = false; }, 1500);
});

function startQuickMatch(mode) {
  const name = requirePlayerName();
  if (!name || matchmakingMode) return;
  matchmakingMode = mode;
  matchmakingPanel.hidden = false;
  matchmakingTitle.textContent = mode === 'TEAM_2V2' ? 'بندورلك على ماتش 2 ضد 2…' : 'بندورلك على 3 لاعبين…';
  matchmakingText.textContent = 'دخلت قائمة الانتظار';
  socket.emit('quickMatch', { name, mode }, result => {
    if (!result?.ok) {
      matchmakingMode = null;
      matchmakingPanel.hidden = true;
      return toast(errorMessage(result?.error?.code));
    }
    if (result.queued) matchmakingText.textContent = `ترتيبك في الانتظار: ${result.position} — الموجودين ${result.waiting} / 4`;
  });
}
quickClassicBtn?.addEventListener('click', () => startQuickMatch('CLASSIC'));
quickTeamBtn?.addEventListener('click', () => startQuickMatch('TEAM_2V2'));
cancelMatchmakingBtn?.addEventListener('click', () => {
  socket.emit('cancelQuickMatch', {}, () => {});
  matchmakingMode = null;
  matchmakingPanel.hidden = true;
  toast('خرجت من قائمة الانتظار.');
});

computerBtn?.addEventListener('click', () => {
  const name = requirePlayerName();
  if (!name) return;
  computerBtn.disabled = true;
  socket.emit('playComputer', { name }, result => {
    computerBtn.disabled = false;
    if (!result?.ok) return toast(errorMessage(result?.error?.code));
    saveSession({ roomId: result.roomId, token: result.token });
    history.replaceState(null, '', `?room=${result.roomId}`);
    if (result.snapshot) acceptSnapshot(result.snapshot);
  });
  setTimeout(() => { computerBtn.disabled = false; }, 1500);
});

function requestPublicRooms() {
  if (!socket.connected) return;
  socket.emit('listPublicRooms', {}, result => {
    if (!result?.ok) return;
    publicRooms = result.rooms || [];
    renderPublicRooms();
  });
}

function renderPublicRooms() {
  if (!publicRoomsList) return;
  if (!publicRooms.length) {
    publicRoomsList.innerHTML = '<div class="public-empty">مفيش رومات عامة مستنية دلوقتي.<br>اعمل روم عام وخلي الناس تدخل.</div>';
    return;
  }
  publicRoomsList.innerHTML = publicRooms.map(room => {
    const modeLabel = room.mode === 'TEAM_2V2' ? '2 ضد 2' : 'فردي';
    return `<div class="public-room-item"><div><strong>${escapeHtml(room.ownerName)} • ${room.id}</strong><small>${modeLabel} • ${room.players}/4 لاعبين</small></div><button type="button" data-public-room="${room.id}">دخول</button></div>`;
  }).join('');
  publicRoomsList.querySelectorAll('[data-public-room]').forEach(button => button.addEventListener('click', () => {
    const name = requirePlayerName();
    if (!name) return;
    roomCodeInput.value = button.dataset.publicRoom;
    joinRoomBtn.click();
  }));
}
refreshPublicRoomsBtn?.addEventListener('click', requestPublicRooms);

roomCodeInput.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
});
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') quickClassicBtn?.click(); });
roomCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoomBtn.click(); });

function roomShareUrl() {
  return roomState ? `${location.origin}${location.pathname}?room=${roomState.id}` : location.href;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

copyCodeBtn.addEventListener('click', async () => {
  if (!roomState) return;
  const ok = await copyText(roomState.id);
  toast(ok ? 'كود الروم اتنسخ ✅' : `كود الروم: ${roomState.id}`);
});

copyLinkBtn.addEventListener('click', async () => {
  if (!roomState) return;
  const ok = await copyText(roomShareUrl());
  toast(ok ? 'لينك الروم اتنسخ ✅' : 'مقدرتش أنسخ اللينك.');
});

shareRoomBtn.addEventListener('click', async () => {
  if (!roomState) return;
  const url = roomShareUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title:'LUDO 3D', text:`ادخل روم ${roomState.id} ونلعب لودو`, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  const ok = await copyText(url);
  toast(ok ? 'المشاركة مش متاحة هنا، فنسختلك اللينك ✅' : 'مقدرتش أفتح المشاركة.');
});

fillBotsBtn.addEventListener('click', () => {
  fillBotsBtn.disabled = true;
  emitWithAck('fillWithBots', { expectedVersion: roomState?.stateVersion ?? 0 }, () => toast('تم ملء الأماكن ببوتات 🤖'));
  setTimeout(() => updateLobbyTimer(), 1000);
});

function openExitConfirmation() {
  if (!roomState || exitInFlight) return;
  const duringGame = roomState.status === 'PLAYING';
  exitDialogText.textContent = duringGame
    ? 'لو خرجت أثناء الماتش، البوت هيكمل مكانك علشان اللعبة ماتقفش. متأكد إنك عايز تخرج؟'
    : 'متأكد إنك عايز تخرج من الروم وترجع للصفحة الرئيسية؟';
  exitDialog?.showModal();
}

function resetToHome() {
  clearSession();
  roomState = null;
  appliedRoomState = null;
  lastGameOverDialogKey = null;
  matchmakingMode = null;
  history.replaceState(null, '', location.pathname);
  gameOverDialog?.close();
  exitDialog?.close();
  updateNetworkUI();
  window.setTimeout(() => document.querySelector('#networkOverlay')?.scrollTo?.({ top:0, behavior:'smooth' }), 0);
}

function leaveCurrentRoom({ afterLeave = null } = {}) {
  if (!roomState || exitInFlight) { afterLeave?.(); return; }
  exitInFlight = true;
  confirmExitBtn.disabled = true;
  socket.emit('leaveRoom', {}, result => {
    exitInFlight = false;
    confirmExitBtn.disabled = false;
    if (!result?.ok) {
      toast(errorMessage(result?.error?.code));
      return;
    }
    resetToHome();
    afterLeave?.();
  });
  setTimeout(() => {
    if (!exitInFlight) return;
    exitInFlight = false;
    confirmExitBtn.disabled = false;
    toast('الخروج أخد وقت أطول من المتوقع. جرّب تاني.');
  }, 5000);
}

leaveRoomBtn.addEventListener('click', openExitConfirmation);
roomExitBtn?.addEventListener('click', openExitConfirmation);
closeExitDialog?.addEventListener('click', () => exitDialog?.close());
cancelExitBtn?.addEventListener('click', () => exitDialog?.close());
exitDialog?.addEventListener('click', event => { if (event.target === exitDialog) exitDialog.close(); });
confirmExitBtn?.addEventListener('click', () => leaveCurrentRoom());

function requestRematch() {
  if (!roomState || roomState.status !== 'FINISHED') return;
  if (!roomState.you?.isOwner) {
    gameOverHint.textContent = 'مستني صاحب الروم يبدأ الريماتش. تقدر ترجع للرئيسية وتختار مود جديد.';
    return;
  }
  playAgainBtn.disabled = true;
  gameOverRematchBtn.disabled = true;
  emitWithAck('playAgain', { expectedVersion: roomState?.stateVersion ?? 0 }, () => {
    playAgainBtn.disabled = false;
    gameOverRematchBtn.disabled = false;
    gameOverDialog?.close();
  });
  setTimeout(() => { playAgainBtn.disabled = false; gameOverRematchBtn.disabled = false; }, 1500);
}

playAgainBtn.addEventListener('click', requestRematch);
gameOverRematchBtn?.addEventListener('click', requestRematch);
gameOverHomeBtn?.addEventListener('click', () => leaveCurrentRoom());
gameOverNewGameBtn?.addEventListener('click', () => leaveCurrentRoom());

function showGameOverDialog() {
  if (!roomState || roomState.status !== 'FINISHED') return;
  const key = `${roomState.id}:${roomState.stateVersion}`;
  if (lastGameOverDialogKey === key && gameOverDialog?.open) return;
  lastGameOverDialogKey = key;
  const me = yourPlayer(roomState);
  if (roomState.mode === 'TEAM_2V2') {
    const winner = roomState.game?.winningTeam;
    gameOverTitle.textContent = winner && me?.teamId === winner ? 'فريقك كسب! 🏆' : 'الماتش خلص';
    gameOverSummary.textContent = winner ? `الفريق ${winner} كسب الماتش. تقدروا تعملوا ريماتش في نفس الروم أو تبدأ لعبة جديدة.` : 'الماتش خلص. تقدر تعمل ريماتش أو تبدأ لعبة جديدة.';
  } else {
    const rank = me?.finishedRank;
    gameOverTitle.textContent = rank === 1 ? 'كسبت الماتش! 🏆' : 'الماتش خلص';
    gameOverSummary.textContent = rank ? `ترتيبك: المركز ${rank}. تقدر تلعبوا تاني في نفس الروم أو تختار مود جديد.` : 'النتيجة اتحسمت. تقدر تلعبوا تاني في نفس الروم أو تختار مود جديد.';
  }
  gameOverRematchBtn.hidden = !roomState.you?.isOwner;
  gameOverHint.textContent = roomState.you?.isOwner
    ? 'إنت صاحب الروم، فريماتش نفس الروم هيبدأ لكل الموجودين.'
    : 'الريماتش في نفس الروم يبدأه صاحب الروم. إنت تقدر ترجع للرئيسية في أي وقت.';
  if (!gameOverDialog.open) gameOverDialog.showModal();
}


function updateNetworkUI() {
  if (!modelReady) return;
  const waiting = roomState?.status === 'WAITING';
  const playing = roomState?.status === 'PLAYING' || roomState?.status === 'FINISHED';
  if (roomExitBtn) roomExitBtn.hidden = !roomState;
  document.body.classList.toggle('not-playing', !playing);
  networkOverlay.hidden = playing;
  homeScreen.hidden = !!roomState;
  lobbyScreen.hidden = !waiting;

  if (!roomState) {
    networkOverlay.hidden = false;
    homeScreen.hidden = false;
    lobbyScreen.hidden = true;
    stopLobbyTimer();
    gameOverDialog?.close();
    requestPublicRooms();
    return;
  }

  if (waiting) {
    roomCodeDisplay.textContent = roomState.id;
    if (lobbyMode) lobbyMode.textContent = roomState.mode === 'TEAM_2V2' ? 'غرفة 2 ضد 2' : (roomState.visibility === 'PUBLIC' ? 'غرفة عامة • فردي' : 'غرفة خاصة • فردي');
    if (lobbyCount) lobbyCount.textContent = `${roomState.players.length} / 4`;
    renderLobbyPlayers();
    startLobbyTimer();
  } else stopLobbyTimer();

  playAgainBtn.hidden = !(roomState.status === 'FINISHED' && roomState.you?.isOwner);
  if (roomState.status === 'FINISHED') queueMicrotask(showGameOverDialog);
  else if (gameOverDialog?.open) gameOverDialog.close();
}

function renderLobbyPlayers() {
  if (!roomState) return;
  if (lobbyCount) lobbyCount.textContent = `${roomState.players.length} / 4`;
  const slots = COLORS.map(color => roomState.players.find(player => player.color === color));
  lobbyPlayers.innerHTML = slots.map((player, index) => {
    if (!player) return `<div class="lobby-slot empty">مكان فاضي</div>`;
    return `<div class="lobby-slot">
      <span class="slot-dot" style="background:${META[player.color].css}"></span>
      <div><strong>${escapeHtml(player.name)}${player.isOwner ? ' 👑' : ''}${player.teamId ? `<span class="lobby-team-badge">فريق ${player.teamId}</span>` : ''}</strong><small>${player.type === 'BOT' ? 'BOT 🤖' : 'PLAYER'}</small></div>
    </div>`;
  }).join('');
}

function startLobbyTimer() {
  if (!lobbyTimerHandle) lobbyTimerHandle = setInterval(updateLobbyTimer, 250);
  updateLobbyTimer();
}
function stopLobbyTimer() { clearInterval(lobbyTimerHandle); lobbyTimerHandle = null; }
function updateLobbyTimer() {
  if (!roomState || roomState.status !== 'WAITING') return;
  const now = Date.now() + clockOffset;
  const ms = Math.max(0, roomState.waitingEndsAt - now);
  const seconds = Math.ceil(ms / 1000);
  waitingTimer.textContent = `00:${String(seconds).padStart(2,'0')}`;
  const canFill = !!roomState.you?.isOwner && ms <= 0 && roomState.players.length < 4;
  fillBotsBtn.disabled = !canFill;
  fillBotsBtn.hidden = !roomState.you?.isOwner;
  lobbyHint.textContent = roomState.players.length === 4
    ? 'العدد اكتمل — اللعبة بتبدأ…'
    : canFill
      ? 'الوقت خلص. تقدر تكمل الأماكن الفاضية ببوتات.'
      : roomState.you?.isOwner
        ? 'بعد انتهاء الدقيقة تقدر تكمل الأماكن الفاضية ببوتات.'
        : 'صاحب الروم يقدر يكمل ببوتات بعد انتهاء وقت الانتظار.';
}

// Points Store validation demo — analytics only, no real payment.
function resetPointsDemo() {
  selectedPointPackage = null;
  selectedPaymentMethod = null;
  pointsIntentCompleted = false;
  pointPackages?.querySelectorAll('.point-package').forEach(button => button.classList.remove('selected'));
  document.querySelectorAll('[data-payment]').forEach(button => button.classList.remove('selected'));
  if (paymentDemo) paymentDemo.hidden = true;
  if (comingSoonPurchase) comingSoonPurchase.hidden = true;
  if (purchaseIntentBtn) purchaseIntentBtn.disabled = true;
  if (purchasePreview) purchasePreview.textContent = 'اختار طريقة الدفع علشان تكمل.';
  if (pointPackages) pointPackages.hidden = false;
}
function openPointsStore() {
  resetPointsDemo();
  trackAnalytics('STORE_VIEW');
  pointsDialog?.showModal();
}
pointsStoreBtn?.addEventListener('click', openPointsStore);
pointsStoreSecondaryBtn?.addEventListener('click', openPointsStore);
closePointsBtn?.addEventListener('click', () => {
  if (selectedPointPackage && !pointsIntentCompleted) trackAnalytics('PURCHASE_CANCELLED', selectedPointPackage);
  pointsDialog?.close();
});
pointsDialog?.addEventListener('click', event => {
  if (event.target === pointsDialog) closePointsBtn?.click();
});
pointPackages?.querySelectorAll('.point-package').forEach(button => button.addEventListener('click', () => {
  pointPackages.querySelectorAll('.point-package').forEach(item => item.classList.toggle('selected', item === button));
  selectedPointPackage = {
    packageId: button.dataset.package,
    points: Number(button.dataset.points),
    price: Number(button.dataset.price)
  };
  selectedPaymentMethod = null;
  document.querySelectorAll('[data-payment]').forEach(item => item.classList.remove('selected'));
  paymentDemo.hidden = false;
  purchaseIntentBtn.disabled = true;
  purchasePreview.textContent = `${selectedPointPackage.points.toLocaleString()} Points مقابل ${selectedPointPackage.price} EGP`;
  trackAnalytics('PACKAGE_CLICK', selectedPointPackage);
}));
document.querySelectorAll('[data-payment]').forEach(button => button.addEventListener('click', () => {
  if (!selectedPointPackage) return;
  document.querySelectorAll('[data-payment]').forEach(item => item.classList.toggle('selected', item === button));
  selectedPaymentMethod = button.dataset.payment;
  purchaseIntentBtn.disabled = false;
  purchasePreview.textContent = `مهتم بشراء ${selectedPointPackage.points.toLocaleString()} Points بـ ${selectedPointPackage.price} EGP عن طريق ${selectedPaymentMethod === 'vodafone_cash' ? 'Vodafone Cash' : 'InstaPay'}.`;
  trackAnalytics('PAYMENT_METHOD_SELECTED', { ...selectedPointPackage, paymentMethod: selectedPaymentMethod });
}));
purchaseIntentBtn?.addEventListener('click', () => {
  if (!selectedPointPackage || !selectedPaymentMethod) return;
  pointsIntentCompleted = true;
  trackAnalytics('PURCHASE_INTENT', { ...selectedPointPackage, paymentMethod: selectedPaymentMethod });
  pointPackages.hidden = true;
  paymentDemo.hidden = true;
  comingSoonPurchase.hidden = false;
});
finishPointsDemoBtn?.addEventListener('click', () => pointsDialog?.close());

// Recorded clips supplied by the user. Other SFX stay synthesized below.
const RECORDED_SFX_PATHS = {
  capture: './assets/audio/capture.wav',
  disconnect: './assets/audio/player-disconnected.mp3',
  home: './assets/audio/piece-home.mp3',
  pieceOut: './assets/audio/piece-out.mp3'
};
const recordedSfx = Object.fromEntries(Object.entries(RECORDED_SFX_PATHS).map(([key, src]) => {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.load();
  return [key, audio];
}));
function playRecordedSfx(key, volume = 1) {
  const original = recordedSfx[key];
  if (!original) return false;
  const audio = original.cloneNode(true);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => {});
  return true;
}

// Audio
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
function tone(freq, duration=.12, { type='sine', gain=.08, delay=0, endFreq=null }={}) {
  const ctx=getAudioContext(); if(!ctx)return; const start=ctx.currentTime+delay;
  const osc=ctx.createOscillator(), amp=ctx.createGain(); osc.type=type; osc.frequency.setValueAtTime(freq,start);
  if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),start+duration);
  amp.gain.setValueAtTime(.0001,start); amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+Math.min(.018,duration*.25));
  amp.gain.exponentialRampToValueAtTime(.0001,start+duration); osc.connect(amp).connect(ctx.destination); osc.start(start); osc.stop(start+duration+.02);
}
function noise(duration=.12,{gain=.06,delay=0,highpass=0,lowpass=0}={}) {
  const ctx=getAudioContext(); if(!ctx)return; const rate=ctx.sampleRate; const buffer=ctx.createBuffer(1,Math.max(1,Math.floor(rate*duration)),rate);
  const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=ctx.createBufferSource(); source.buffer=buffer; const amp=ctx.createGain(); const start=ctx.currentTime+delay;
  amp.gain.setValueAtTime(gain,start); amp.gain.exponentialRampToValueAtTime(.0001,start+duration); let last=source;
  if(highpass){const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=highpass;last.connect(f);last=f;}
  if(lowpass){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=lowpass;last.connect(f);last=f;}
  last.connect(amp).connect(ctx.destination); source.start(start);
}
const SFX={
  diceRoll(){getAudioContext();for(let i=0;i<7;i++){noise(.055,{gain:.035,delay:i*.075,highpass:800,lowpass:5000});tone(170+Math.random()*130,.045,{type:'square',gain:.018,delay:i*.075});}},
  six(){[880,1174,1568].forEach((f,i)=>tone(f,.20,{gain:.055,delay:i*.075}));},
  tripleSix(){[330,277,220,165].forEach((f,i)=>tone(f,.30,{type:'sawtooth',gain:.045,delay:i*.16,endFreq:f*.82}));},
  pieceOut(){tone(180,.18,{gain:.06,endFreq:520});tone(690,.11,{type:'triangle',gain:.035,delay:.08});},
  step(){noise(.045,{gain:.035,highpass:900,lowpass:3500});tone(240,.045,{type:'triangle',gain:.02});},
  safe(){tone(520,.18,{type:'triangle',gain:.05});tone(780,.28,{gain:.035,delay:.06});},
  capture(){noise(.18,{gain:.09,lowpass:1600});tone(120,.25,{type:'sawtooth',gain:.065,endFreq:70});tone(620,.16,{type:'square',gain:.025,delay:.05,endFreq:210});},
  chase(){[0,.16,.32].forEach(d=>{tone(90,.08,{gain:.065,delay:d});tone(135,.06,{gain:.04,delay:d+.07});});},
  blockade(){noise(.13,{gain:.075,highpass:250,lowpass:1800});tone(105,.28,{type:'square',gain:.045,endFreq:72});tone(410,.15,{type:'triangle',gain:.025,delay:.05});},
  home(){[660,880,1047,1320].forEach((f,i)=>tone(f,.22,{type:'triangle',gain:.05,delay:i*.07}));noise(.16,{gain:.018,delay:.12,highpass:2600});},
  exactWait(){tone(1250,.045,{type:'square',gain:.028});tone(1250,.045,{type:'square',gain:.028,delay:.32});},
  victory(){[523,659,784,1047,1319].forEach((f,i)=>tone(f,.34,{type:'triangle',gain:.065,delay:i*.12}));for(let i=0;i<11;i++)noise(.08,{gain:.025,delay:.45+i*.075,highpass:1200,lowpass:5200});},
  loss(){[294,247,196,147].forEach((f,i)=>tone(f,.38,{gain:.04,delay:i*.18,endFreq:f*.9}));}
};

function handleGameEvent(event) {
  switch(event.type) {
    case 'DICE_ROLL_STARTED':
      SFX.diceRoll(); startDiceRolling(); if(event.playerId===roomState?.you?.playerId) rollPending=true; break;
    case 'DICE_ROLLED':
      setDiceValue(event.value); orientDiceToValue(event.value); rollPending=false; break;
    case 'TRIPLE_SIX_PENALTY': SFX.tripleSix(); toast('3 ستات متتالية — الرمية الثالثة اتلغت'); break;
    case 'PIECE_LEFT_BASE': playRecordedSfx('pieceOut',.95); break;
    case 'PIECE_ENTERED_SAFE_CELL': SFX.safe(); break;
    case 'PIECE_CAPTURED': playRecordedSfx('capture',.95); toast('أكل! عندك رمية إضافية 🔥'); break;
    case 'BLOCKADE_FORMED': SFX.blockade(); break;
    case 'MOVE_REJECTED_BLOCKADE': SFX.blockade(); break;
    case 'CHASE_THREAT': SFX.chase(); break;
    case 'PIECE_REACHED_HOME': playRecordedSfx('home',.95); toast('قطعة وصلت للبيت 🎉'); break;
    case 'EXACT_FINISH_WAIT': SFX.exactWait(); break;
    case 'PLAYER_FINISHED':
      if(roomState?.mode!=='TEAM_2V2'&&event.rank===1)SFX.victory();
      if(roomState?.mode!=='TEAM_2V2'&&event.rank<=3)toast(`المركز ${event.rank} اتحسم 🏆`);
      break;
    case 'GAME_FINISHED':
      if(roomState?.mode==='TEAM_2V2'){
        const myTeam=roomState?.you?.teamId;
        if(event.winningTeam===myTeam){SFX.victory();toast('فريقك كسب الماتش 🏆');}
        else toast('الماتش خلص.');
      }
      break;
    case 'PLAYER_DISCONNECTED_TO_BOT': playRecordedSfx('disconnect',.95); toast('لاعب فصل — البوت هيكمل مكانه 🤖'); break;
    case 'GAME_STARTED': toast('اللعبة بدأت! 🎲'); break;
  }
  renderHUD();
}

// Client-side rendering of authoritative state
function currentPlayer(room=roomState) {
  if (!room?.game) return null;
  return room.players.find(player => player.id === room.game.currentPlayerId) || null;
}
function yourPlayer(room=roomState) { return room?.players.find(player => player.id === room.you?.playerId) || null; }
function getPieceFromRoom(room, pieceId) {
  for (const player of room?.players ?? []) {
    const piece = player.pieces?.find(item => item.id === pieceId);
    if (piece) return piece;
  }
  return null;
}
function cellForProgress(color, progress) {
  if (progress < 0 || progress > FINAL_PROGRESS) return null;
  if (progress <= MAIN_TRACK_LAST_PROGRESS) return PATH[(START_INDEX[color]+progress)%PATH.length];
  return FINISH_LANES[color][Math.min(5,progress-FINISH_LANE_START_PROGRESS)];
}
function cellKey(cell){return cell?`${cell[0]},${cell[1]}`:null;}
function gridToWorld([row,col], y=pieceGroundY){return new THREE.Vector3(boardBounds.min.x+(col+.5)*cellW,y,boardBounds.max.z-(row+.5)*cellD);}
function visualRef(piece){return piecesByColor[piece.color]?.[piece.index]||null;}
function occupancyForRoom(room){
  const map=new Map();
  for(const player of room?.players??[])for(const piece of player.pieces??[]){
    if(piece.progress<0||piece.finished)continue; const cell=cellForProgress(piece.color,piece.progress); const key=cellKey(cell);
    if(!map.has(key))map.set(key,[]); map.get(key).push(piece);
  }
  return map;
}
function stackOffset(index,total){if(total<=1)return new THREE.Vector3();const d=Math.min(cellW,cellD)*.19;const layouts={2:[[-d,0],[d,0]],3:[[0,-d],[-d,d],[d,d]],4:[[-d,-d],[d,-d],[-d,d],[d,d]]};const chosen=layouts[Math.min(4,total)]||layouts[4];const [x,z]=chosen[Math.min(index,chosen.length-1)];return new THREE.Vector3(x,0,z);}
function worldPosition(piece, progress=piece.progress, room=roomState, useStack=true){
  const ref=visualRef(piece); if(!ref)return new THREE.Vector3(); if(progress<0)return ref.homeWorld.clone();
  let pos=gridToWorld(cellForProgress(piece.color,progress));
  if(progress===FINAL_PROGRESS){const off=[[-.13,-.13],[.13,-.13],[-.13,.13],[.13,.13]][piece.index];pos.x+=off[0];pos.z+=off[1];return pos;}
  if(useStack){const map=occupancyForRoom(room);const group=map.get(cellKey(cellForProgress(piece.color,progress)))||[];if(group.length>1){const ordered=[...group].sort((a,b)=>a.index-b.index||a.color.localeCompare(b.color));const idx=ordered.findIndex(p=>p.id===piece.id);pos.add(stackOffset(Math.max(0,idx),group.length));}}
  return pos;
}
function moveObjectWorld(object, worldPosition){const local=worldPosition.clone();object.parent?.worldToLocal(local);object.position.copy(local);}
function animatePieceTo(piece,destination,duration=240){return new Promise(resolve=>{const ref=visualRef(piece);if(!ref){resolve();return;}const root=ref.root;const start=new THREE.Vector3();root.getWorldPosition(start);moveQueue.push({root,start,end:destination.clone(),startTime:performance.now(),duration,resolve});});}
async function animatePieceChange(oldPiece,newPiece,newRoom){
  const ref=visualRef(newPiece); if(!ref)return;
  if(newPiece.progress===oldPiece.progress)return;
  if(newPiece.progress<0){await animatePieceTo(newPiece,ref.homeWorld.clone(),420);return;}
  if(oldPiece.progress<0){await animatePieceTo(newPiece,worldPosition(newPiece,newPiece.progress,newRoom,false),430);return;}
  if(newPiece.progress>oldPiece.progress){for(let p=oldPiece.progress+1;p<=newPiece.progress;p++){SFX.step();await animatePieceTo(newPiece,worldPosition(newPiece,p,newRoom,false),150);}}
  else await animatePieceTo(newPiece,worldPosition(newPiece,newPiece.progress,newRoom,false),300);
}
async function settleRoomPieces(room,duration=130){const tasks=[];for(const player of room?.players??[])for(const piece of player.pieces??[]){const ref=visualRef(piece);if(ref)tasks.push(animatePieceTo(piece,worldPosition(piece,piece.progress,room,true),duration));}await Promise.all(tasks);}

async function applySnapshot(snapshot) {
  if (!modelReady) return;
  if (
    appliedRoomState?.id === snapshot.id &&
    Number.isInteger(appliedRoomState?.stateVersion) &&
    Number.isInteger(snapshot.stateVersion) &&
    snapshot.stateVersion < appliedRoomState.stateVersion
  ) return;
  if (
    roomState?.id === snapshot.id &&
    Number.isInteger(roomState?.stateVersion) &&
    Number.isInteger(snapshot.stateVersion) &&
    snapshot.stateVersion < roomState.stateVersion
  ) return;
  const previous = appliedRoomState;
  roomState = snapshot;
  renderHUD();

  if (!snapshot.game) {
    appliedRoomState = structuredClone(snapshot);
    return;
  }

  if (!previous?.game || previous.id !== snapshot.id) {
    for (const player of snapshot.players) for (const piece of player.pieces ?? []) {
      const ref = visualRef(piece); if (ref) moveObjectWorld(ref.root, worldPosition(piece,piece.progress,snapshot,true));
    }
  } else {
    const animations=[];
    for(const player of snapshot.players)for(const piece of player.pieces??[]){
      const oldPiece=getPieceFromRoom(previous,piece.id); if(oldPiece&&oldPiece.progress!==piece.progress)animations.push(animatePieceChange(oldPiece,piece,snapshot));
    }
    if(animations.length){await Promise.all(animations);await settleRoomPieces(snapshot,120);}
  }

  appliedRoomState = structuredClone(snapshot);
  syncPieceHighlights();
  if (autoCamera.checked && snapshot.you?.color && !initialCameraSet) {
    initialCameraSet=true; setPlayerView(snapshot.you.color,true);
  }
}

function renderPlayers(){
  if(!roomState?.players){playersPanel.innerHTML='';return;}
  const currentId=roomState.game?.currentPlayerId;
  playersPanel.innerHTML=roomState.players.map(player=>{
    const finished=player.pieces?.filter(piece=>piece.finished).length||0;
    const rank=roomState.mode==='TEAM_2V2'?'':(player.finishedRank?['','🥇','🥈','🥉','4️⃣'][player.finishedRank]:'');
    const me=player.id===roomState.you?.playerId?' • إنت':'';
    const team=roomState.mode==='TEAM_2V2'&&player.teamId?` • فريق ${player.teamId}`:'';
    return `<div class="player-card ${player.id===currentId?'active':''}">
      <span class="player-color" style="background:${META[player.color].css}"></span>
      <div><strong>${escapeHtml(player.name)}${player.type==='BOT'?' 🤖':''}${me}</strong><small>${finished}/4 قطع وصلت${team}</small></div><span class="player-rank">${rank}</span></div>`;
  }).join('');
}
function renderPieceButtons(){
  const me=yourPlayer(); const legal=new Set(roomState?.game?.legalPieceIds||[]);
  if(!me){pieceButtons.innerHTML='';return;}
  pieceButtons.innerHTML=(me.pieces||[]).map((piece,i)=>{
    const label=piece.finished?'✓':piece.progress<0?'بيت':piece.progress>=FINISH_LANE_START_PROGRESS?'نهاية':piece.progress;
    const enabled=legal.has(piece.id)&&roomState.game?.currentPlayerId===me.id;
    return `<button class="piece-btn ${enabled?'legal':''}" data-piece-id="${piece.id}" ${enabled?'':'disabled'}>قطعة ${i+1}<br><small>${label}</small></button>`;
  }).join('');
  pieceButtons.querySelectorAll('[data-piece-id]').forEach(btn=>btn.addEventListener('click',()=>requestMove(btn.dataset.pieceId)));
}
function renderHUD(){
  const game=roomState?.game; const current=currentPlayer(); const me=yourPlayer();
  if(!game||!current){renderPlayers();return;}
  turnName.textContent=`${current.name}${current.type==='BOT'?' 🤖':''}`; turnSwatch.style.background=META[current.color].css;
  const myTurn=game.currentPlayerId===roomState.you?.playerId;
  rollBtn.disabled=!myTurn||game.phase!=='ROLL'||rollPending||roomState.status!=='PLAYING';
  renderPlayers(); renderPieceButtons(); syncPieceHighlights();

  if(game.gameOver){
    if (game.mode === 'TEAM_2V2' && game.winningTeam) {
      const winners = roomState.players.filter(p => p.teamId === game.winningTeam).map(p => p.name).join(' + ');
      statusText.textContent=`فريق ${game.winningTeam} كسب 🏆`; subStatus.textContent=winners;
    } else {
      const names=game.rankings.map((id,i)=>`${['🥇','🥈','🥉','4️⃣'][i]} ${roomState.players.find(p=>p.id===id)?.name||'Player'}`).join(' • ');
      statusText.textContent='انتهت اللعبة 🏆'; subStatus.textContent=names;
    }
  } else if(myTurn&&game.phase==='ROLL') { statusText.textContent=rollPending?'النرد بيلف…':'دورك — ارمي النرد'; subStatus.textContent='على الموبايل اضغط النرد الـ3D في نص البورد.'; }
  else if(myTurn&&game.phase==='MOVE') { statusText.textContent=`طلعت ${game.rolled}`; subStatus.textContent=game.legalPieceIds.length===1?'الحركة الوحيدة هتتنفذ تلقائيًا.':'اختار قطعة من البورد.'; }
  else { statusText.textContent=`دور ${current.name}`; subStatus.textContent=current.type==='BOT'?'البوت بيفكر…':'مستني اللاعب يرمي النرد.'; }
}
function syncPieceHighlights(){
  const currentColor=currentPlayer()?.color??null; const legal=new Set(roomState?.game?.legalPieceIds||[]);
  for(const color of COLORS)for(const [index,ref] of piecesByColor[color].entries()){
    const player=roomState?.players?.find(p=>p.color===color); const piece=player?.pieces?.[index]; if(!ref)continue;
    const active=piece&&legal.has(piece.id)&&player.id===roomState?.you?.playerId; const hover=piece?.id===hoverPieceId;
    ref.root.scale.copy(ref.homeScale).multiplyScalar(active?(hover?1.17:1.10):1);
    if(ref.outline){ref.outline.visible=color===currentColor;ref.outline.scale.setScalar(hover?1.115:1.085);}
  }
}
function canLocalRoll(){return !!(roomState?.status==='PLAYING'&&roomState.game?.phase==='ROLL'&&roomState.game.currentPlayerId===roomState.you?.playerId&&!rollPending);}
function requestRoll(){if(!canLocalRoll())return;rollPending=true;renderHUD();const payload=actionContext('roll');socket.emit('rollDice',payload,result=>{if(result?.snapshot)acceptSnapshot(result.snapshot);if(!result?.ok){rollPending=false;if(result?.error?.code==='STALE_ACTION')requestStateSync('roll_stale');renderHUD();}});}
function requestMove(pieceId){const legal=roomState?.game?.legalPieceIds||[];if(!legal.includes(pieceId)||roomState.game.currentPlayerId!==roomState.you?.playerId)return;const payload={pieceId,...actionContext('move')};socket.emit('movePiece',payload,result=>{if(result?.snapshot)acceptSnapshot(result.snapshot);if(!result?.ok&&result?.error?.code==='STALE_ACTION')requestStateSync('move_stale');});}
rollBtn.addEventListener('click',requestRoll);

// 3D dice
function setDiceValue(value){diceFace.dataset.value=String(value);diceFace.setAttribute('aria-label',`قيمة النرد ${value}`);}
function createDiceFaceTexture(value){const size=256,pipR=24,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#cf1618';ctx.fillRect(0,0,size,size);ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=8;ctx.strokeRect(4,4,size-8,size-8);const dots={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]},off=size*.23;ctx.fillStyle='#fff';for(const[gx,gy]of dots[value]){ctx.beginPath();ctx.arc(size/2+gx*off,size/2+gy*off,pipR,0,Math.PI*2);ctx.fill();}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
function buildCustomDice(){const materials=[3,4,1,6,2,5].map(value=>new THREE.MeshStandardMaterial({map:createDiceFaceTexture(value),roughness:.45,metalness:.03}));const cube=new THREE.Mesh(new THREE.BoxGeometry(.46,.46,.46),materials);cube.castShadow=true;cube.receiveShadow=true;cube.userData.isGameDice=true;diceHitMesh=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));diceHitMesh.userData.isGameDice=true;diceRoot=new THREE.Group();diceRoot.add(cube,diceHitMesh);diceRestY=pieceGroundY+.21;diceRoot.position.set(boardCenter.x,diceRestY,boardCenter.z);scene.add(diceRoot);orientDiceToValue(1,true);}
function quaternionForDiceValue(value){const q=new THREE.Quaternion().setFromUnitVectors(DICE_FACE_NORMALS[value].clone().normalize(),new THREE.Vector3(0,1,0));const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(Math.floor(Math.random()*4)*Math.PI)/2);return yaw.multiply(q);}
function startDiceRolling(){if(!diceRoot)return;if(diceRestY==null)diceRestY=pieceGroundY+.21;diceRoot.position.set(boardCenter.x,diceRestY,boardCenter.z);diceSpin={mode:'rolling',start:performance.now(),baseY:diceRestY,last:performance.now()};}
function orientDiceToValue(value,immediate=false){if(!diceRoot)return;if(diceRestY==null)diceRestY=pieceGroundY+.21;const q=quaternionForDiceValue(value);if(immediate){diceRoot.quaternion.copy(q);diceRoot.position.set(boardCenter.x,diceRestY,boardCenter.z);return;}diceSpin={mode:'settle',start:performance.now(),duration:360,from:diceRoot.quaternion.clone(),to:q,baseY:diceRestY};}

// Model
function createStarGeometry(outer,inner,points=5){const shape=new THREE.Shape();for(let i=0;i<points*2;i++){const r=i%2===0?outer:inner,a=-Math.PI/2+i*Math.PI/points,x=Math.cos(a)*r,y=Math.sin(a)*r;i===0?shape.moveTo(x,y):shape.lineTo(x,y);}shape.closePath();const geo=new THREE.ShapeGeometry(shape);geo.center();return geo;}
function addSafeStars(){safeStarsGroup=new THREE.Group();const outer=Math.min(cellW,cellD)*.31,geo=createStarGeometry(outer,outer*.46),mat=new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.22,roughness:.44,side:THREE.DoubleSide});for(const cell of VISUAL_SAFE_CELLS){const mesh=new THREE.Mesh(geo,mat);mesh.rotation.x=-Math.PI/2;mesh.position.copy(gridToWorld(cell,pieceGroundY+.004));safeStarsGroup.add(mesh);}scene.add(safeStarsGroup);}
function mapModelPieces(root){piecesByColor={RED:[],GREEN:[],YELLOW:[],BLUE:[]};pieceMeshes=[];const materialToColor=Object.fromEntries(COLORS.map(c=>[META[c].material,c]));root.updateMatrixWorld(true);root.traverse(obj=>{if(!obj.isMesh)return;obj.castShadow=true;obj.receiveShadow=true;const matName=obj.material?.name,color=materialToColor[matName];if(color){const movableRoot=obj.parent&&obj.parent!==root?obj.parent:obj;const homeWorld=new THREE.Vector3();movableRoot.getWorldPosition(homeWorld);const scaledHome=movableRoot.scale.clone().multiplyScalar(PIECE_BASE_SCALE);movableRoot.scale.copy(scaledHome);obj.material=obj.material.clone();obj.material.color.set(META[color].pieceTint);if('roughness'in obj.material)obj.material.roughness=.38;if('metalness'in obj.material)obj.material.metalness=.08;const outline=new THREE.Mesh(obj.geometry,new THREE.MeshBasicMaterial({color:META[color].outline,side:THREE.BackSide,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));outline.scale.setScalar(1.085);outline.visible=false;outline.renderOrder=4;outline.raycast=()=>{};obj.add(outline);const ref={mesh:obj,root:movableRoot,outline,color,homeWorld,homeScale:scaledHome.clone(),homeQuaternion:movableRoot.quaternion.clone()};piecesByColor[color].push(ref);pieceMeshes.push(obj);obj.userData.pieceVisual=ref;}if(matName==='DICE_M'&&obj.parent)originalDiceRoot=obj.parent;});if(originalDiceRoot)originalDiceRoot.visible=false;for(const color of COLORS)piecesByColor[color].sort((a,b)=>(b.homeWorld.z-a.homeWorld.z)||(a.homeWorld.x-b.homeWorld.x));const ys=COLORS.flatMap(c=>piecesByColor[c].map(p=>p.homeWorld.y));if(ys.length)pieceGroundY=ys.reduce((a,b)=>a+b,0)/ys.length;}
function calculateBoard(root){const candidates=[];root.traverse(obj=>{if(!obj.isMesh)return;const name=obj.material?.name||'';if(!name.startsWith('LUDO_BOARD_UPPER'))return;const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3());candidates.push({box,area:size.x*size.z,yThickness:size.y});});if(candidates.length){candidates.sort((a,b)=>Math.abs(a.yThickness-b.yThickness)>1e-5?a.yThickness-b.yThickness:a.area-b.area);boardBounds=candidates[0].box.clone();}else boardBounds=new THREE.Box3().setFromObject(root);const size=boardBounds.getSize(new THREE.Vector3());boardCenter=boardBounds.getCenter(new THREE.Vector3());cellW=size.x/15;cellD=size.z/15;controls.target.set(boardCenter.x,pieceGroundY,boardCenter.z);}

function setLoadingProgress(percent, label) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  if (loadingProgressBar) loadingProgressBar.style.width = `${value}%`;
  if (loadingProgressText) loadingProgressText.textContent = `${value}%`;
  if (label && loadingLabel) loadingLabel.textContent = label;
}
setLoadingProgress(2, 'جاري تحميل البورد ثلاثي الأبعاد');

const loader=new GLTFLoader();
loader.load('./assets/ludo_board_games.glb',gltf=>{setLoadingProgress(92,'جاري تجهيز المجسم والخامات…');modelRoot=gltf.scene;scene.add(modelRoot);modelRoot.updateMatrixWorld(true);mapModelPieces(modelRoot);calculateBoard(modelRoot);addSafeStars();buildCustomDice();modelReady=true;setLoadingProgress(100,'جاهزين!');setTimeout(()=>loading.classList.add('hidden'),220);updateNetworkUI();if(roomState)snapshotQueue=snapshotQueue.then(()=>applySnapshot(roomState));},xhr=>{if(xhr.loaded>0){const ratio=xhr.total>0?xhr.loaded/xhr.total:Math.min(.9,xhr.loaded/(12*1024*1024));setLoadingProgress(4+ratio*84,ratio>.65?'قربنا نخلص تحميل البورد…':'جاري تحميل البورد ثلاثي الأبعاد');}},error=>{console.error(error);loading.querySelector('[data-loading-title]').textContent='مقدرناش نحمّل ملف الـ3D';setLoadingProgress(0,'تأكد إن السيرفر شغال عن طريق npm start.');});

// Picking / camera
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pointerFromEvent(e){const rect=canvas.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;}
canvas.addEventListener('pointermove',e=>{if(!roomState?.game){hoverPieceId=null;syncPieceHighlights();return;}pointerFromEvent(e);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...pieceMeshes,...(diceHitMesh?[diceHitMesh]:[])],false);hoverPieceId=null;if(hits[0]){if(hits[0].object.userData.isGameDice){canvas.style.cursor=canLocalRoll()?'pointer':'grab';return;}const ref=hits[0].object.userData.pieceVisual;const me=yourPlayer();const piece=me?.pieces?.find((p,i)=>piecesByColor[p.color]?.[i]===ref);if(piece&&(roomState.game.legalPieceIds||[]).includes(piece.id)){hoverPieceId=piece.id;}}canvas.style.cursor=hoverPieceId?'pointer':'grab';syncPieceHighlights();});
canvas.addEventListener('pointerdown',e=>{if(!roomState?.game)return;pointerFromEvent(e);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...pieceMeshes,...(diceHitMesh?[diceHitMesh]:[])],false);if(!hits[0])return;if(hits[0].object.userData.isGameDice){requestRoll();return;}const ref=hits[0].object.userData.pieceVisual;const me=yourPlayer();const piece=me?.pieces?.find((p,i)=>piecesByColor[p.color]?.[i]===ref);if(piece)requestMove(piece.id);});

function setPlayerView(color,immediate=false){
  const isFree=color==='FREE';
  cameraButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===color));
  if(isFree){
    controls.enabled=true;
    autoCamera.checked=false;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    toast('المنظور الحر: لف البورد بإيدك.');
    return;
  }

  controls.enabled=true;
  const[dx,dz]=META[color].camera;
  const boardSize=Math.max(boardBounds?.getSize(new THREE.Vector3()).x||8.55,8.55);
  const target=boardCenter.clone();
  target.y=pieceGroundY;
  const isMobile=matchMedia('(max-width:820px)').matches;
  const isPortrait=isMobile&&innerHeight>=innerWidth;
  const isTablet=!isMobile&&innerWidth<=1180;

  // Mobile keeps the dedicated top-down framing. Desktop/tablet move closer so the
  // board uses more of the available canvas now that the HUD is a single right rail.
  const desired=isPortrait
    ? new THREE.Vector3(target.x+dx*boardSize*.08,target.y+boardSize*2.35,target.z+dz*boardSize*.08)
    : isMobile
      ? new THREE.Vector3(target.x+dx*boardSize*.45,target.y+boardSize*1.20,target.z+dz*boardSize*.45)
      : isTablet
        ? new THREE.Vector3(target.x+dx*boardSize*.66,target.y+boardSize*.82,target.z+dz*boardSize*.66)
        : new THREE.Vector3(target.x+dx*boardSize*.68,target.y+boardSize*.80,target.z+dz*boardSize*.68);

  camera.fov=isPortrait?47:isMobile?45:isTablet?43:41;
  if(isMobile){
    camera.clearViewOffset();
  }else{
    // Shift the framing slightly left so the enlarged board does not sit under the HUD.
    const hudWidth=Math.min(400,Math.max(300,innerWidth*(isTablet?.29:.24)));
    const framingPad=Math.round(hudWidth*.42);
    camera.setViewOffset(innerWidth+framingPad,innerHeight,framingPad,0,innerWidth,innerHeight);
  }
  camera.updateProjectionMatrix();
  controls.target.copy(target);

  if(immediate){
    camera.position.copy(desired);
    camera.lookAt(target);
    controls.update();
    cameraTween=null;
  }else{
    cameraTween={start:performance.now(),duration:650,from:camera.position.clone(),to:desired};
  }
}
autoCamera.addEventListener('change',()=>{if(autoCamera.checked&&roomState?.you?.color)setPlayerView(roomState.you.color);});
cameraButtons.forEach(btn=>btn.addEventListener('click',()=>setPlayerView(btn.dataset.view)));
helpBtn.addEventListener('click',()=>helpDialog.showModal()); mobileHelpBtn?.addEventListener('click',()=>helpDialog.showModal()); closeHelp.addEventListener('click',()=>helpDialog.close()); helpDialog.addEventListener('click',e=>{if(e.target===helpDialog)helpDialog.close();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));if(autoCamera.checked&&roomState?.you?.color)setPlayerView(roomState.you.color,true);});

function updateMoveQueue(now){for(let i=moveQueue.length-1;i>=0;i--){const m=moveQueue[i],t=Math.min(1,(now-m.startTime)/m.duration),smooth=t*t*(3-2*t),world=m.start.clone().lerp(m.end,smooth);world.y+=Math.sin(Math.PI*t)*.22;moveObjectWorld(m.root,world);if(t>=1){moveObjectWorld(m.root,m.end);moveQueue.splice(i,1);m.resolve();}}}
function animate(now){requestAnimationFrame(animate);updateMoveQueue(now);if(cameraTween){const t=Math.min(1,(now-cameraTween.start)/cameraTween.duration),s=1-Math.pow(1-t,3);camera.position.lerpVectors(cameraTween.from,cameraTween.to,s);if(t>=1)cameraTween=null;}if(diceSpin&&diceRoot){if(diceSpin.mode==='rolling'){const dt=Math.min(.05,(now-diceSpin.last)/1000);diceSpin.last=now;diceRoot.rotateX(dt*8);diceRoot.rotateY(dt*10);diceRoot.rotateZ(dt*6);diceRoot.position.y=diceSpin.baseY+Math.abs(Math.sin(now*.01))*.16;}else{const t=Math.min(1,(now-diceSpin.start)/diceSpin.duration),s=1-Math.pow(1-t,3);diceRoot.quaternion.slerpQuaternions(diceSpin.from,diceSpin.to,s);diceRoot.position.y=diceSpin.baseY+Math.sin(Math.PI*t)*.18;if(t>=1){diceRoot.quaternion.copy(diceSpin.to);diceRoot.position.y=diceSpin.baseY;diceSpin=null;}}}controls.update();renderer.render(scene,camera);}
requestAnimationFrame(animate);

function toast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1800);}
function errorMessage(code){return ({ROOM_NOT_FOUND:'الروم مش موجودة.',ROOM_FULL:'الروم مكتملة.',GAME_ALREADY_STARTED:'اللعبة بدأت بالفعل.',NOT_ROOM_OWNER:'الزر ده لصاحب الروم فقط.',WAITING_TIME_NOT_FINISHED:'استنى لحد ما الدقيقة تخلص.',SESSION_NOT_FOUND:'الجلسة القديمة انتهت. ادخل الروم من جديد.',NOT_YOUR_TURN:'مش دورك.',ROLL_NOT_ALLOWED:'مش وقت رمي النرد.',MOVE_NOT_ALLOWED:'مش وقت تحريك قطعة.',INVALID_MOVE:'الحركة دي مش قانونية.',BLOCKADE_LANDING_FORBIDDEN:'الخانة مقفولة بتحصين مزدوج.',ACTION_IN_PROGRESS:'استنى الحركة الحالية تخلص.',STALE_ACTION:'الحالة اتغيرت — بنزامن اللعبة تلقائيًا.',ACTION_ID_REQUIRED:'تعذر تأكيد الحركة. جرّب مرة ثانية.',ALREADY_IN_ROOM:'إنت بالفعل داخل روم.'})[code]||'حصل خطأ. جرّب تاني.';}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
