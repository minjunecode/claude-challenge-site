// ============================================
// Claude Max 챌린지 - 프론트엔드 (점수제)
// ============================================

// ★ 여기에 Google Apps Script 배포 URL을 입력하세요 ★
const API_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

// ── 상태 ──
let currentUser = null; // { nickname, isAdmin }
let dashboardData = null; // { members, submissions }

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('challengeUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showMain();
  }
  setupEventListeners();
});

function setupEventListeners() {
  // 로그인
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('btn-show-init').addEventListener('click', () => {
    document.getElementById('init-section').classList.toggle('hidden');
  });
  document.getElementById('btn-init').addEventListener('click', handleInit);

  // 로그아웃
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // 탭
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 업로드 - 세션
  document.getElementById('session-file').addEventListener('change', (e) => handleFileSelect(e, 'session'));
  document.getElementById('btn-upload-session').addEventListener('click', () => handleUpload('session'));

  // 업로드 - 주간
  document.getElementById('weekly-file').addEventListener('change', (e) => handleFileSelect(e, 'weekly'));
  document.getElementById('btn-upload-weekly').addEventListener('click', () => handleUpload('weekly'));

  // Ctrl+V 붙여넣기 지원
  setupPasteSupport('session');
  setupPasteSupport('weekly');

  // 뷰 탭 전환 (주간/월간)
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.cert-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
      if (tab.dataset.view === 'monthly') renderMonthlyCalendar();
    });
  });

  // 주간 네비게이션
  document.getElementById('btn-daily-prev').addEventListener('click', () => {
    dailyWeekOffset--;
    renderDashboard();
  });
  document.getElementById('btn-daily-next').addEventListener('click', () => {
    dailyWeekOffset++;
    renderDashboard();
  });
  // 레벨 정보 툴팁
  const levelInfoBtn = document.getElementById('level-info-btn');
  const levelTooltip = document.getElementById('level-tooltip');
  levelInfoBtn.addEventListener('mouseenter', () => levelTooltip.classList.remove('hidden'));
  levelInfoBtn.addEventListener('mouseleave', () => levelTooltip.classList.add('hidden'));
  levelInfoBtn.addEventListener('click', () => levelTooltip.classList.toggle('hidden'));

  // 월간 네비게이션
  document.getElementById('btn-month-prev').addEventListener('click', () => {
    monthOffset--;
    renderMonthlyCalendar();
  });
  document.getElementById('btn-month-next').addEventListener('click', () => {
    monthOffset++;
    renderMonthlyCalendar();
  });

  // 관리자
  document.getElementById('btn-add-member').addEventListener('click', handleAddMember);

  // 모달
  document.querySelector('.modal-overlay').addEventListener('click', closeModal);
  document.querySelector('.modal-close').addEventListener('click', closeModal);
}

// ── API 호출 ──
async function apiCall(action, params = {}) {
  if (API_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    showDemoMode();
    return null;
  }

  const body = { action, ...params };
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('API 응답 파싱 실패:', text);
    return { success: false, error: '서버 응답 오류' };
  }
}

function showDemoMode() {
  if (!dashboardData) {
    dashboardData = getDemoData();
  }
}

// ── 로그인 ──
async function handleLogin(e) {
  e.preventDefault();
  const nickname = document.getElementById('login-nickname').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  if (API_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    currentUser = { nickname: nickname || 'Mj', isAdmin: true };
    sessionStorage.setItem('challengeUser', JSON.stringify(currentUser));
    showMain();
    return;
  }

  const result = await apiCall('login', { nickname, password });
  if (!result) return;

  if (result.success) {
    currentUser = { nickname: result.nickname, isAdmin: result.isAdmin };
    sessionStorage.setItem('challengeUser', JSON.stringify(currentUser));
    showMain();
  } else {
    errorEl.textContent = result.error;
  }
}

function handleLogout() {
  currentUser = null;
  dashboardData = null;
  sessionStorage.removeItem('challengeUser');
  document.getElementById('main-view').classList.remove('active');
  document.getElementById('login-view').classList.add('active');
}

// ── 계정 만들기 ──
async function handleInit() {
  const nickname = document.getElementById('init-nickname').value.trim();
  const password = document.getElementById('init-password').value.trim();
  const msgEl = document.getElementById('init-msg');

  if (!nickname || !password) {
    msgEl.textContent = '닉네임과 비밀번호를 입력하세요.';
    return;
  }

  const result = await apiCall('register', { nickname, password });
  if (!result) {
    msgEl.textContent = '데모 모드: API URL을 설정하면 계정이 생성됩니다.';
    msgEl.classList.remove('success-msg');
    return;
  }

  if (result.success) {
    msgEl.textContent = '가입 완료! 로그인해주세요.';
    msgEl.classList.add('success-msg');
    msgEl.classList.remove('error-msg');
    document.getElementById('init-nickname').value = '';
    document.getElementById('init-password').value = '';
  } else {
    msgEl.textContent = result.error;
    msgEl.classList.remove('success-msg');
  }
}

// ── 메인 화면 ──
async function showMain() {
  document.getElementById('login-view').classList.remove('active');
  document.getElementById('main-view').classList.add('active');
  document.getElementById('user-info').textContent =
    currentUser.nickname + (currentUser.isAdmin ? ' (관리자)' : '');

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = currentUser.isAdmin ? '' : 'none';
  });

  await loadDashboard();
  switchTab('dashboard');
}

// ── 탭 전환 ──
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'upload') renderUploadTab();
  if (tabName === 'admin') renderAdminTab();
}

// ── 대시보드 ──
async function loadDashboard() {
  const result = await apiCall('dashboard');
  if (result && result.success) {
    dashboardData = result;
  } else if (!dashboardData) {
    dashboardData = getDemoData();
  }
  renderDashboard();
}

// ── 레벨 시스템 ──
const LEVELS = [
  { name: 'Rookie', min: 0 },
  { name: 'Beginner', min: 10 },
  { name: 'Regular', min: 25 },
  { name: 'Dedicated', min: 50 },
  { name: 'Pro', min: 80 },
  { name: 'Expert', min: 120 },
  { name: 'Master', min: 170 },
  { name: 'Legend', min: 250 },
];

function getLevel(totalPts) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (totalPts >= l.min) level = l;
    else break;
  }
  return level;
}

function getNextLevel(totalPts) {
  for (const l of LEVELS) {
    if (totalPts < l.min) return l;
  }
  return null;
}

function getStreak(nickname, submissions, currentWeek, currentYear) {
  const weeklySet = new Set();
  submissions.forEach(s => {
    if (s.nickname === nickname) weeklySet.add(`${s.year}_${s.week}`);
  });
  let streak = 0;
  for (let w = currentWeek; w >= 1; w--) {
    if (weeklySet.has(`${currentYear}_${w}`)) streak++;
    else break;
  }
  return streak;
}

function getWeekDates(week, year) {
  // ISO week: find Monday of the given week
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);

  const days = [];
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ label: dayLabels[i], date: dateStr, dayNum: d.getDate() });
  }
  return days;
}

let dailyWeekOffset = 0; // 주 단위 오프셋
let monthOffset = 0; // 월 단위 오프셋

// ── 멤버 색상 관리 ──
const COLOR_PRESETS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#111111'];
const DEFAULT_DOT_COLOR = '#d1d5db';

function getMemberColor(nickname) {
  const saved = JSON.parse(localStorage.getItem('memberColors') || '{}');
  return saved[nickname] || DEFAULT_DOT_COLOR;
}

function setMemberColor(nickname, color) {
  const saved = JSON.parse(localStorage.getItem('memberColors') || '{}');
  saved[nickname] = color;
  localStorage.setItem('memberColors', JSON.stringify(saved));
}

function showColorPicker(dot, nickname) {
  // 기존 팝업 제거
  document.querySelectorAll('.color-picker-popup').forEach(p => p.remove());

  const popup = document.createElement('div');
  popup.className = 'color-picker-popup';

  const rect = dot.getBoundingClientRect();
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 6}px`;

  const presets = document.createElement('div');
  presets.className = 'color-presets';
  COLOR_PRESETS.forEach(c => {
    const btn = document.createElement('div');
    btn.className = 'color-preset';
    btn.style.background = c;
    btn.addEventListener('click', () => {
      setMemberColor(nickname, c);
      dot.style.background = c;
      popup.remove();
      renderDashboard(); // 주간 테이블도 업데이트
    });
    presets.appendChild(btn);
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '#hex';
  input.value = getMemberColor(nickname) || '';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (/^#[0-9a-fA-F]{3,6}$/.test(val)) {
        setMemberColor(nickname, val);
        dot.style.background = val;
        popup.remove();
        renderDashboard();
      }
    }
  });

  popup.appendChild(presets);
  popup.appendChild(input);
  document.body.appendChild(popup);

  // 외부 클릭 시 닫기
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target) && e.target !== dot) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    });
  }, 0);
}

function renderDailyTable(members, submissions, currentWeek, currentYear) {
  const today = getTodayStr();

  // 현재 주 + 오프셋의 월~일 생성
  const days = [];
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  // 이번 주 월요일 구하기
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 일=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 + dailyWeekOffset * 7);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      label: dayLabels[d.getDay()],
      dayNum: d.getDate(),
      month: d.getMonth() + 1,
      date: dateStr,
    });
  }

  // 멤버별 날짜별 세션 인증 여부 맵
  const dailyMap = {};
  members.forEach(m => { dailyMap[m.nickname] = new Set(); });

  submissions.forEach(s => {
    if (s.type === 'session') {
      const dateStr = (s.screenshotTime || s.submittedAt || '').slice(0, 10);
      if (dateStr && dailyMap[s.nickname]) {
        dailyMap[s.nickname].add(dateStr);
      }
    }
  });

  // 주차 라벨: 목요일이 속한 월 기준
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const thuMonth = thursday.getMonth() + 1;
  const thuDay = thursday.getDate();
  // 해당 월에서 몇 번째 주인지 (목요일 날짜 기준)
  const weekInMonth = Math.ceil(thuDay / 7);
  document.getElementById('weekly-label').textContent = `${thuMonth}월 ${weekInMonth}주차`;

  // 헤더
  const headerRow = document.getElementById('daily-header');
  headerRow.innerHTML = '<th></th>';
  days.forEach(d => {
    const th = document.createElement('th');
    if (d.date === today) {
      th.innerHTML = `${d.month}/${d.dayNum}(${d.label})<br><span style="font-size:0.65rem;">오늘</span>`;
      th.classList.add('daily-th-today');
    } else {
      th.textContent = `${d.month}/${d.dayNum}(${d.label})`;
    }
    headerRow.appendChild(th);
  });

  // 바디
  const tbody = document.getElementById('daily-body');
  tbody.innerHTML = '';

  members.forEach((m, mIdx) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    const dot = document.createElement('span');
    dot.className = 'member-color-dot';
    dot.style.background = getMemberColor(m.nickname);
    if (currentUser && m.nickname === currentUser.nickname) {
      dot.classList.add('editable');
      dot.addEventListener('click', (e) => { e.stopPropagation(); showColorPicker(dot, m.nickname); });
    }
    nameTd.appendChild(dot);
    nameTd.appendChild(document.createTextNode(m.nickname));
    tr.appendChild(nameTd);

    days.forEach(d => {
      const td = document.createElement('td');

      if (d.date > today) {
        // 미래: 빈 투명
        td.classList.add('daily-td-future');
      } else if (d.date === today) {
        // 오늘
        if (dailyMap[m.nickname].has(d.date)) {
          td.classList.add('daily-td-done');
          td.textContent = 'O';
        } else {
          td.classList.add('daily-td-pending');
          td.textContent = '-';
        }
        td.classList.add('daily-td-today');
      } else {
        // 과거
        if (dailyMap[m.nickname].has(d.date)) {
          td.classList.add('daily-td-done');
          td.textContent = 'O';
        } else {
          td.classList.add('daily-td-miss');
          td.textContent = 'X';
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function renderMonthlyCalendar() {
  if (!dashboardData || !currentUser) return;

  const today = getTodayStr();
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-indexed

  // 라벨
  document.getElementById('month-label').textContent =
    `${year}년 ${month + 1}월`;

  // 본인의 세션 인증 날짜 Set
  const myDates = new Set();
  dashboardData.submissions.forEach(s => {
    if (s.nickname === currentUser.nickname && s.type === 'session') {
      const dateStr = (s.screenshotTime || s.submittedAt || '').slice(0, 10);
      if (dateStr) myDates.add(dateStr);
    }
  });

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // 요일 헤더 (첫 칸은 주차 라벨용 빈칸)
  const dayHeaders = ['', '월', '화', '수', '목', '금', '토', '일'];
  dayHeaders.forEach(dh => {
    const el = document.createElement('div');
    el.className = dh === '' ? 'cal-week-label' : 'cal-header';
    el.textContent = dh;
    grid.appendChild(el);
  });

  // 첫째 날 요일 (월=0, 일=6)
  const firstDay = targetDate.getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 주차 계산 헬퍼: 해당 주의 목요일이 몇 월 몇 째 주인지
  function getWeekLabel(dayNum) {
    const d = new Date(year, month, dayNum);
    const dow = d.getDay() || 7; // 월=1 ~ 일=7
    const thu = new Date(d);
    thu.setDate(d.getDate() + (4 - dow)); // 그 주의 목요일
    const thuMonth = thu.getMonth() + 1;
    const weekInMonth = Math.ceil(thu.getDate() / 7);
    return `${thuMonth}월 ${weekInMonth}주`;
  }

  // 행 단위로 렌더링
  let dayNum = 1 - startOffset; // 빈 칸 포함 시작점

  while (dayNum <= daysInMonth) {
    // 주차 라벨
    const labelEl = document.createElement('div');
    labelEl.className = 'cal-week-label';
    // 이 행에서 유효한 날짜 중 하나로 주차 계산
    const labelDay = Math.max(1, Math.min(daysInMonth, dayNum + 3)); // 목요일 근처
    labelEl.textContent = getWeekLabel(labelDay) + '차';
    grid.appendChild(labelEl);

    // 7일 렌더
    for (let col = 0; col < 7; col++) {
      const el = document.createElement('div');
      el.className = 'cal-day';

      if (dayNum < 1 || dayNum > daysInMonth) {
        el.classList.add('empty');
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        el.innerHTML = `<span class="cal-num">${dayNum}</span>`;

        if (dateStr > today) {
          el.classList.add('future');
        } else if (dateStr === today) {
          el.classList.add('today');
          el.classList.add(myDates.has(dateStr) ? 'done' : 'pending');
        } else {
          el.classList.add(myDates.has(dateStr) ? 'done' : 'miss');
        }
      }

      grid.appendChild(el);
      dayNum++;
    }
  }
}

function renderDashboard() {
  if (!dashboardData) return;

  const { members, submissions } = dashboardData;
  const currentWeek = getISOWeek(new Date());
  const currentYear = new Date().getFullYear();

  // 점수 계산
  const scores = {};
  members.forEach(m => {
    scores[m.nickname] = { weekly: 0, total: 0, streak: 0 };
  });

  submissions.forEach(s => {
    const pts = s.points || (s.type === 'weekly' ? 5 : 1);
    if (scores[s.nickname]) {
      scores[s.nickname].total += pts;
      if (s.year === currentYear && s.week === currentWeek) {
        scores[s.nickname].weekly += pts;
      }
    }
  });

  members.forEach(m => {
    scores[m.nickname].streak = getStreak(m.nickname, submissions, currentWeek, currentYear);
  });

  const ranked = members
    .map(m => ({ nickname: m.nickname, ...scores[m.nickname] }))
    .sort((a, b) => b.total - a.total);

  // ── 일간 인증 OX 테이블 ──
  renderDailyTable(members, submissions, currentWeek, currentYear);

  // ── 내 현황 카드 ──
  const myRankIdx = ranked.findIndex(r => r.nickname === currentUser.nickname);
  const myData = myRankIdx >= 0 ? ranked[myRankIdx] : { weekly: 0, total: 0, streak: 0 };
  const myLevel = getLevel(myData.total);
  const myNext = getNextLevel(myData.total);

  document.getElementById('my-rank-badge').textContent = myRankIdx >= 0 ? myRankIdx + 1 : '-';
  document.getElementById('my-status-name').textContent = currentUser.nickname;
  document.getElementById('my-status-level').textContent = myLevel.name;
  document.getElementById('my-weekly-pts').textContent = myData.weekly;
  document.getElementById('my-total-pts').textContent = myData.total;
  document.getElementById('my-streak').textContent = myData.streak;

  // 레벨 진행률
  document.getElementById('level-current').textContent = myLevel.name;
  if (myNext) {
    document.getElementById('level-next').textContent = myNext.name;
    const progress = ((myData.total - myLevel.min) / (myNext.min - myLevel.min)) * 100;
    document.getElementById('level-progress-fill').style.width = `${Math.min(100, progress)}%`;
    document.getElementById('level-progress-text').textContent =
      `${myNext.min - myData.total}pt more to ${myNext.name}`;
  } else {
    document.getElementById('level-next').textContent = 'MAX';
    document.getElementById('level-progress-fill').style.width = '100%';
    document.getElementById('level-progress-text').textContent = 'Maximum level reached';
  }

  // ── 포디움 (Top 3) ──
  const podium = document.getElementById('podium');
  podium.innerHTML = '';
  const top3 = ranked.slice(0, 3);
  // 순서: 2nd, 1st, 3rd
  const podiumOrder = top3;

  const medals = ['🥇', '🥈', '🥉'];
  podiumOrder.forEach((r, i) => {
    const level = getLevel(r.total);
    const card = document.createElement('div');
    card.className = `podium-card${i === 0 ? ' first' : ''}`;
    card.innerHTML = `
      <div class="podium-medal">${medals[i] || ''}</div>
      <div class="podium-name">${escapeHtml(r.nickname)}</div>
      <div class="podium-level">${level.name}</div>
      <div class="podium-pts">${r.total}pt</div>
      <div class="podium-weekly">this week +${r.weekly}</div>
      ${r.streak > 0 ? `<span class="podium-streak${r.streak >= 3 ? ' hot' : ''}">${r.streak}w streak</span>` : ''}
    `;
    podium.appendChild(card);
  });

  // ── 나머지 순위 ──
  const restRanking = document.getElementById('rest-ranking');
  restRanking.innerHTML = '';
  const restMembers = ranked.slice(3);

  if (restMembers.length > 0) {
    const listEl = document.createElement('div');
    listEl.className = 'rest-rank-list';

    restMembers.forEach((r, i) => {
      const level = getLevel(r.total);
      const item = document.createElement('div');
      item.className = 'rest-rank-item';
      item.innerHTML = `
        <span class="rest-rank-num">${i + 4}</span>
        <div class="rest-rank-info">
          <div class="rest-rank-name">${escapeHtml(r.nickname)}</div>
          <div class="rest-rank-level">${level.name}${r.streak > 0 ? ` · ${r.streak}w streak` : ''}</div>
        </div>
        <span class="rest-rank-pts">${r.total}pt</span>
      `;
      listEl.appendChild(item);
    });

    // 기본 접힌 상태
    const isExpanded = restRanking.dataset.expanded === 'true';
    listEl.style.display = isExpanded ? '' : 'none';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'rest-rank-toggle';
    toggleBtn.textContent = isExpanded ? `접기` : `${restMembers.length}명 더 보기`;
    toggleBtn.addEventListener('click', () => {
      const showing = listEl.style.display !== 'none';
      listEl.style.display = showing ? 'none' : '';
      toggleBtn.textContent = showing ? `${restMembers.length}명 더 보기` : '접기';
      restRanking.dataset.expanded = !showing;
    });

    restRanking.appendChild(toggleBtn);
    restRanking.appendChild(listEl);
  }

  // ── 최근 인증 내역 ──
  const activityList = document.getElementById('activity-list');
  activityList.innerHTML = '';

  const recentSubs = [...submissions]
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
    .slice(0, 10);

  if (recentSubs.length === 0) {
    activityList.innerHTML = '<div class="activity-item" style="color:var(--text-muted);justify-content:center;">아직 인증 내역이 없습니다.</div>';
    return;
  }

  recentSubs.forEach(s => {
    const pts = s.points || (s.type === 'weekly' ? 5 : 1);
    const typeLabel = s.type === 'weekly' ? '주간' : '세션';
    const typeClass = s.type === 'weekly' ? 'weekly' : 'session';
    const timeSource = s.screenshotTime || s.submittedAt || '';
    const dateStr = timeSource.slice(0, 10);
    const timeStr = timeSource.slice(11, 16);

    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="activity-type ${typeClass}">${typeLabel}</span>
      <span class="activity-name">${escapeHtml(s.nickname)}</span>
      <span class="activity-date">${dateStr}${timeStr ? ' ' + timeStr : ''}</span>
      <span class="activity-points">+${pts}pt</span>
    `;

    if (s.imageUrl) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        document.getElementById('modal-title').textContent =
          `${s.nickname} · ${typeLabel} 인증`;
        document.getElementById('modal-image').src = s.imageUrl;
        document.getElementById('image-modal').classList.remove('hidden');
      });
    }

    activityList.appendChild(item);
  });
}

function closeModal() {
  document.getElementById('image-modal').classList.add('hidden');
  document.getElementById('modal-image').src = '';
}

// ── 업로드 ──
const MIN_SESSION_INTERVAL_HOURS = 2; // 세션 인증 간 최소 간격 (시간)

const uploadState = {
  session: { base64: null, fileName: null, screenshotTime: null },
  weekly: { base64: null, fileName: null, screenshotTime: null },
};

// ── Ctrl+V 붙여넣기 ──
function setupPasteSupport(type) {
  const card = document.getElementById(`${type}-card`);

  card.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        processFile(file, type);
        return;
      }
    }
  });

  // 드래그 앤 드롭도 지원
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file, type);
    }
  });
}

function processFile(file, type) {
  const now = Date.now();
  const fileTime = file.lastModified || now;
  const fileAge = now - fileTime;
  const msgEl = document.getElementById(`${type}-msg`);

  // 스크린샷 시각 저장 (파일 수정시간 기준)
  const screenshotDate = new Date(fileTime);
  uploadState[type].screenshotTime = formatDateTime(screenshotDate);

  // 파일 수정 시간이 24시간 이상 오래되었으면 경고
  if (fileAge > 24 * 60 * 60 * 1000) {
    const hoursAgo = Math.round(fileAge / (60 * 60 * 1000));
    msgEl.textContent = `이 파일은 약 ${hoursAgo}시간 전에 생성되었습니다. 최근 스크린샷을 사용해주세요.`;
    msgEl.classList.remove('success-msg');
    msgEl.classList.add('error-msg');
  } else {
    msgEl.textContent = `스크린샷 시각: ${uploadState[type].screenshotTime}`;
    msgEl.classList.remove('error-msg');
    msgEl.classList.add('success-msg');
  }

  // 세션 인증: 이전 인증과 간격 체크
  if (type === 'session' && dashboardData) {
    const mySessions = dashboardData.submissions
      .filter(s => s.nickname === currentUser.nickname && s.type === 'session' && s.screenshotTime)
      .map(s => new Date(s.screenshotTime).getTime())
      .filter(t => !isNaN(t));

    if (mySessions.length > 0) {
      const lastSessionTime = Math.max(...mySessions);
      const gapHours = (fileTime - lastSessionTime) / (60 * 60 * 1000);

      if (gapHours < MIN_SESSION_INTERVAL_HOURS) {
        const remainMin = Math.ceil((MIN_SESSION_INTERVAL_HOURS - gapHours) * 60);
        msgEl.textContent = `이전 세션 인증과 ${MIN_SESSION_INTERVAL_HOURS}시간 이상 간격이 필요합니다. (약 ${remainMin}분 후 가능)`;
        msgEl.classList.remove('success-msg');
        msgEl.classList.add('error-msg');
        uploadState[type].base64 = null;
        return;
      }
    }
  }

  const name = file.name || `paste_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`;
  document.getElementById(`${type}-file-name`).textContent = name;
  uploadState[type].fileName = name;

  const reader = new FileReader();
  reader.onload = function (ev) {
    const base64Full = ev.target.result;
    uploadState[type].base64 = base64Full.split(',')[1];

    document.getElementById(`${type}-preview`).src = base64Full;
    document.getElementById(`${type}-preview-wrapper`).classList.remove('hidden');

    const btn = document.getElementById(`btn-upload-${type}`);
    if (btn.textContent !== '오늘 완료' && btn.textContent !== '이번 주 완료') {
      btn.disabled = false;
    }
  };
  reader.readAsDataURL(file);
}

function renderUploadTab() {
  if (!dashboardData) return;

  const week = getISOWeek(new Date());
  const year = new Date().getFullYear();
  const today = getTodayStr();
  const mySubs = dashboardData.submissions.filter(s => s.nickname === currentUser.nickname);

  // 세션: 오늘 몇 회?
  const sessionToday = mySubs.filter(s =>
    s.type === 'session' && s.submittedAt && s.submittedAt.startsWith(today)
  ).length;
  const sessionLeft = Math.max(0, 3 - sessionToday);

  const sessionStatus = document.getElementById('session-status');
  sessionStatus.textContent = `오늘 ${sessionToday}/3회 사용`;
  if (sessionLeft === 0) {
    sessionStatus.classList.add('maxed');
  } else {
    sessionStatus.classList.remove('maxed');
  }

  const btnSession = document.getElementById('btn-upload-session');
  if (sessionLeft === 0) {
    btnSession.disabled = true;
    btnSession.textContent = '오늘 완료';
  } else {
    btnSession.disabled = !uploadState.session.base64;
    btnSession.textContent = '업로드';
  }

  // 주간: 이번 주 인증 여부
  const weeklyDone = mySubs.some(s =>
    s.type === 'weekly' && s.week === week && s.year === year
  );

  const weeklyStatus = document.getElementById('weekly-status');
  weeklyStatus.textContent = weeklyDone ? '이번 주 인증 완료' : '이번 주 0/1회';
  if (weeklyDone) {
    weeklyStatus.classList.add('maxed');
  } else {
    weeklyStatus.classList.remove('maxed');
  }

  const btnWeekly = document.getElementById('btn-upload-weekly');
  if (weeklyDone) {
    btnWeekly.disabled = true;
    btnWeekly.textContent = '이번 주 완료';
  } else {
    btnWeekly.disabled = !uploadState.weekly.base64;
    btnWeekly.textContent = '업로드';
  }

  // 메시지 초기화
  document.getElementById('session-msg').textContent = '';
  document.getElementById('weekly-msg').textContent = '';
}

function handleFileSelect(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  processFile(file, type);
}

async function handleUpload(type) {
  if (!uploadState[type].base64) return;

  const week = getISOWeek(new Date());
  const year = new Date().getFullYear();
  const msgEl = document.getElementById(`${type}-msg`);
  const progressEl = document.getElementById(`${type}-progress`);
  const btn = document.getElementById(`btn-upload-${type}`);
  const points = type === 'weekly' ? 5 : 1;

  msgEl.textContent = '';
  progressEl.classList.remove('hidden');
  btn.disabled = true;

  const result = await apiCall('upload', {
    nickname: currentUser.nickname,
    week,
    year,
    type,
    points,
    screenshotTime: uploadState[type].screenshotTime || formatDateTime(new Date()),
    imageBase64: uploadState[type].base64,
    fileName: uploadState[type].fileName,
  });

  progressEl.classList.add('hidden');

  if (result && result.success) {
    msgEl.textContent = `+${points}pt 인증 완료!`;
    msgEl.classList.add('success-msg');
    msgEl.classList.remove('error-msg');

    // 상태 초기화
    uploadState[type].base64 = null;
    uploadState[type].fileName = null;
    uploadState[type].screenshotTime = null;
    document.getElementById(`${type}-file-name`).textContent = '선택된 파일 없음';
    document.getElementById(`${type}-preview-wrapper`).classList.add('hidden');

    await loadDashboard();
    renderUploadTab();
  } else if (result) {
    msgEl.textContent = result.error || '업로드 실패';
    msgEl.classList.remove('success-msg');
    btn.disabled = false;
  } else {
    // 데모 모드
    msgEl.textContent = '데모 모드: API URL을 설정하세요.';
    btn.disabled = false;
  }
}

// ── 관리자 ──
function renderAdminTab() {
  if (!dashboardData) return;

  const list = document.getElementById('member-list');
  list.innerHTML = '';

  dashboardData.members.forEach(m => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.innerHTML =
      `<span class="member-name">${escapeHtml(m.nickname)}</span>` +
      (m.isAdmin ? '<span class="member-badge">관리자</span>' : '');
    li.appendChild(nameSpan);

    if (!m.isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-small';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => handleDeleteMember(m.nickname));
      li.appendChild(delBtn);
    }

    list.appendChild(li);
  });
}

async function handleAddMember() {
  const nickname = document.getElementById('new-member-nickname').value.trim();
  const password = document.getElementById('new-member-password').value.trim();
  const msgEl = document.getElementById('admin-msg');

  if (!nickname || !password) {
    msgEl.textContent = '닉네임과 비밀번호를 입력하세요.';
    return;
  }

  const result = await apiCall('addMember', {
    adminNickname: currentUser.nickname,
    nickname,
    password,
  });

  if (result && result.success) {
    msgEl.textContent = `${nickname} 추가 완료!`;
    msgEl.classList.add('success-msg');
    msgEl.classList.remove('error-msg');
    document.getElementById('new-member-nickname').value = '';
    document.getElementById('new-member-password').value = '';
    await loadDashboard();
    renderAdminTab();
  } else if (result) {
    msgEl.textContent = result.error;
    msgEl.classList.remove('success-msg');
  }
}

async function handleDeleteMember(nickname) {
  if (!confirm(`${nickname} 멤버를 삭제하시겠습니까?`)) return;

  const result = await apiCall('deleteMember', {
    adminNickname: currentUser.nickname,
    nickname,
  });

  if (result && result.success) {
    await loadDashboard();
    renderAdminTab();
  } else if (result) {
    document.getElementById('admin-msg').textContent = result.error;
  }
}

// ── 유틸리티 ──
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 데모 데이터 ──
function getDemoData() {
  const week = getISOWeek(new Date());
  const year = new Date().getFullYear();
  const today = getTodayStr();

  // 이번 주 월~일 날짜 생성
  const weekDates = getWeekDates(week, year);
  const dayDates = weekDates.map(d => d.date);
  const todayIdx = dayDates.indexOf(today);

  // 헬퍼: 과거 날짜만 사용
  function pastDate(idx) {
    return idx <= todayIdx ? dayDates[idx] : null;
  }

  const subs = [];

  function addSession(nick, dayIdx, hour, min) {
    const d = pastDate(dayIdx);
    if (!d) return;
    subs.push({ nickname: nick, week, year, type: 'session', points: 1, imageUrl: '',
      submittedAt: `${d} ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`,
      screenshotTime: `${d} ${String(hour).padStart(2,'0')}:${String(min-2).padStart(2,'0')}:00` });
  }
  function addWeekly(nick, dayIdx, hour) {
    const d = pastDate(dayIdx);
    if (!d) return;
    subs.push({ nickname: nick, week, year, type: 'weekly', points: 5, imageUrl: '',
      submittedAt: `${d} ${String(hour).padStart(2,'0')}:00:00`,
      screenshotTime: `${d} ${String(hour).padStart(2,'0')}:00:00` });
  }

  // Mj: 매일 꼬박꼬박 (월~오늘)
  for (let i = 0; i <= Math.min(todayIdx, 6); i++) addSession('Mj', i, 9 + i, 30);
  addWeekly('Mj', 2, 18);

  // Dc: 월화수금 인증 (목 빠짐)
  [0, 1, 2, 4].forEach(i => addSession('Dc', i, 10, 15));
  addWeekly('Dc', 1, 20);

  // S: 월수 인증
  [0, 2].forEach(i => addSession('S', i, 11, 45));

  // L: 월화 인증
  [0, 1].forEach(i => addSession('L', i, 14, 20));
  addWeekly('L', 0, 21);

  // Jh: 오늘만
  if (todayIdx >= 0) addSession('Jh', todayIdx, 8, 10);

  // Jc: 월화수 인증
  [0, 1, 2].forEach(i => addSession('Jc', i, 13, 40));

  // Dg: 월 인증
  [0].forEach(i => addSession('Dg', i, 16, 5));

  // 지난주 데이터 (랭킹 + 월간뷰용)
  const prevWeekDate = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  // 지난주 매일 데이터 (Mj, Dc)
  for (let dayBack = 7; dayBack <= 13; dayBack++) {
    const d = new Date(); d.setDate(d.getDate() - dayBack);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const prevW = getISOWeek(d);
    subs.push({ nickname: 'Mj', week: prevW, year, type: 'session', points: 1, imageUrl: '',
      submittedAt: `${ds} 10:00:00`, screenshotTime: `${ds} 10:00:00` });
    if (dayBack % 2 === 0) {
      subs.push({ nickname: 'Dc', week: prevW, year, type: 'session', points: 1, imageUrl: '',
        submittedAt: `${ds} 11:00:00`, screenshotTime: `${ds} 11:00:00` });
    }
  }
  ['Mj', 'Dc'].forEach(n => {
    subs.push({ nickname: n, week: week-1, year, type: 'weekly', points: 5, imageUrl: '',
      submittedAt: `${prevWeekDate} 10:00:00`, screenshotTime: `${prevWeekDate} 10:00:00` });
  });
  subs.push({ nickname: 'S', week: week-1, year, type: 'weekly', points: 5, imageUrl: '',
    submittedAt: `${prevWeekDate} 14:00:00`, screenshotTime: `${prevWeekDate} 14:00:00` });

  return {
    success: true,
    members: [
      { nickname: 'Mj', isAdmin: true },
      { nickname: 'Dc', isAdmin: false },
      { nickname: 'S', isAdmin: false },
      { nickname: 'L', isAdmin: false },
      { nickname: 'Jh', isAdmin: false },
      { nickname: 'Jc', isAdmin: false },
      { nickname: 'Dg', isAdmin: false },
    ],
    submissions: subs,
  };
}
