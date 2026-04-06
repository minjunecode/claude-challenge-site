// ============================================
// Claude Max 토큰 챌린지 - Google Apps Script (점수제)
// 이 코드를 Google Sheets의 Apps Script에 붙여넣으세요
// ============================================

// CORS 대응: GET 요청 처리
function doGet(e) {
  return handleRequest(e);
}

// POST 요청 처리
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params;
  try {
    params = JSON.parse(e.postData ? e.postData.contents : '{}');
  } catch (err) {
    params = e.parameter || {};
  }

  var action = params.action || (e.parameter && e.parameter.action) || '';
  var result;

  switch (action) {
    case 'login':
      result = handleLogin(params);
      break;
    case 'dashboard':
      result = handleDashboard();
      break;
    case 'upload':
      result = handleUpload(params);
      break;
    case 'addMember':
      result = handleAddMember(params);
      break;
    case 'deleteMember':
      result = handleDeleteMember(params);
      break;
    case 'updatePassword':
      result = handleUpdatePassword(params);
      break;
    case 'init':
      result = handleInit(params);
      break;
    case 'register':
      result = handleRegister(params);
      break;
    default:
      result = { success: false, error: '알 수 없는 action: ' + action };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 로그인 ──
function handleLogin(params) {
  var nickname = (params.nickname || '').trim();
  var password = (params.password || '').trim();

  if (!nickname || !password) {
    return { success: false, error: '닉네임과 비밀번호를 입력하세요.' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('멤버');
  if (!sheet) return { success: false, error: '"멤버" 시트를 찾을 수 없습니다.' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname && data[i][1] === password) {
      return {
        success: true,
        nickname: nickname,
        isAdmin: data[i][2] === true || data[i][2] === 'TRUE'
      };
    }
  }

  return { success: false, error: '닉네임 또는 비밀번호가 틀렸습니다.' };
}

// ── 대시보드 데이터 ──
function handleDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var memberSheet = ss.getSheetByName('멤버');
  if (!memberSheet) return { success: false, error: '"멤버" 시트를 찾을 수 없습니다.' };

  var memberData = memberSheet.getDataRange().getValues();
  var members = [];
  for (var i = 1; i < memberData.length; i++) {
    if (memberData[i][0]) {
      members.push({
        nickname: memberData[i][0],
        isAdmin: memberData[i][2] === true || memberData[i][2] === 'TRUE'
      });
    }
  }

  // 인증 기록 (컬럼: nickname, week, year, imageUrl, submittedAt, type, points, screenshotTime)
  var recordSheet = ss.getSheetByName('인증기록');
  var submissions = [];
  if (recordSheet && recordSheet.getLastRow() > 1) {
    var recordData = recordSheet.getDataRange().getValues();
    for (var j = 1; j < recordData.length; j++) {
      if (recordData[j][0]) {
        submissions.push({
          nickname: recordData[j][0],
          week: recordData[j][1],
          year: recordData[j][2],
          imageUrl: recordData[j][3],
          submittedAt: recordData[j][4],
          type: recordData[j][5] || 'session',
          points: recordData[j][6] || 1,
          screenshotTime: recordData[j][7] || recordData[j][4]
        });
      }
    }
  }

  return { success: true, members: members, submissions: submissions };
}

// ── 스크린샷 업로드 (점수제) ──
function handleUpload(params) {
  var nickname = (params.nickname || '').trim();
  var week = parseInt(params.week);
  var year = parseInt(params.year);
  var type = params.type || 'session'; // 'session' | 'weekly'
  var points = type === 'weekly' ? 5 : 1;
  var screenshotTime = params.screenshotTime || '';
  var imageBase64 = params.imageBase64 || '';
  var fileName = params.fileName || 'screenshot.png';

  var MIN_SESSION_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2시간

  if (!nickname || !week || !year || !imageBase64) {
    return { success: false, error: '필수 파라미터가 누락되었습니다.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('인증기록');
  if (!sheet) return { success: false, error: '"인증기록" 시트를 찾을 수 없습니다.' };

  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  var today = now.substring(0, 10); // yyyy-MM-dd

  // 제한 체크
  var data = sheet.getDataRange().getValues();

  if (type === 'session') {
    // 하루 3회 제한
    var todayCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === nickname && data[i][5] === 'session') {
        var subDate = String(data[i][4]).substring(0, 10);
        if (subDate === today) todayCount++;
      }
    }
    if (todayCount >= 3) {
      return { success: false, error: '오늘 세션 인증 3회를 이미 사용했습니다.' };
    }

    // 2시간 간격 체크 (스크린샷 시각 기준)
    if (screenshotTime) {
      var newTime = new Date(screenshotTime).getTime();
      for (var m = 1; m < data.length; m++) {
        if (data[m][0] === nickname && data[m][5] === 'session' && data[m][7]) {
          var prevTime = new Date(data[m][7]).getTime();
          if (!isNaN(prevTime) && !isNaN(newTime) && Math.abs(newTime - prevTime) < MIN_SESSION_INTERVAL_MS) {
            return { success: false, error: '세션 인증은 최소 2시간 간격이 필요합니다.' };
          }
        }
      }
    }
  } else if (type === 'weekly') {
    // 주 1회 제한
    for (var k = 1; k < data.length; k++) {
      if (data[k][0] === nickname && data[k][1] === week && data[k][2] === year && data[k][5] === 'weekly') {
        return { success: false, error: '이번 주 주간 인증을 이미 완료했습니다.' };
      }
    }
  }

  // 이미지를 Google Drive에 저장
  var folder = getOrCreateFolder(year, week);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(imageBase64),
    'image/png',
    nickname + '_' + type + '_week' + week + '_' + fileName
  );
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var imageUrl = 'https://drive.google.com/uc?id=' + file.getId();

  // 새 기록 추가 (screenshotTime 컬럼 추가)
  sheet.appendRow([nickname, week, year, imageUrl, now, type, points, screenshotTime]);

  return { success: true, imageUrl: imageUrl, points: points };
}

// ── 멤버 추가 (관리자) ──
function handleAddMember(params) {
  var adminNickname = (params.adminNickname || '').trim();
  var nickname = (params.nickname || '').trim();
  var password = (params.password || '').trim();

  if (!isAdmin(adminNickname)) {
    return { success: false, error: '관리자 권한이 필요합니다.' };
  }
  if (!nickname || !password) {
    return { success: false, error: '닉네임과 비밀번호를 입력하세요.' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('멤버');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname) {
      return { success: false, error: '이미 존재하는 닉네임입니다.' };
    }
  }

  sheet.appendRow([nickname, password, false]);
  return { success: true };
}

// ── 멤버 삭제 (관리자) ──
function handleDeleteMember(params) {
  var adminNickname = (params.adminNickname || '').trim();
  var nickname = (params.nickname || '').trim();

  if (!isAdmin(adminNickname)) {
    return { success: false, error: '관리자 권한이 필요합니다.' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('멤버');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: '해당 멤버를 찾을 수 없습니다.' };
}

// ── 비밀번호 변경 ──
function handleUpdatePassword(params) {
  var nickname = (params.nickname || '').trim();
  var oldPassword = (params.oldPassword || '').trim();
  var newPassword = (params.newPassword || '').trim();

  if (!nickname || !oldPassword || !newPassword) {
    return { success: false, error: '모든 필드를 입력하세요.' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('멤버');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname && data[i][1] === oldPassword) {
      sheet.getRange(i + 1, 2).setValue(newPassword);
      return { success: true };
    }
  }

  return { success: false, error: '현재 비밀번호가 틀렸습니다.' };
}

// ── 초기 설정 (최초 1회: 관리자 계정 생성) ──
function handleInit(params) {
  var nickname = (params.nickname || '').trim();
  var password = (params.password || '').trim();

  if (!nickname || !password) {
    return { success: false, error: '관리자 닉네임과 비밀번호를 입력하세요.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var memberSheet = ss.getSheetByName('멤버');
  if (!memberSheet) {
    memberSheet = ss.insertSheet('멤버');
    memberSheet.appendRow(['nickname', 'password', 'isAdmin']);
  }

  if (memberSheet.getLastRow() > 1) {
    return { success: false, error: '이미 초기화되어 있습니다. 멤버가 존재합니다.' };
  }

  memberSheet.appendRow([nickname, password, true]);

  // 인증기록 시트 확인/생성 (점수제 컬럼 포함)
  var recordSheet = ss.getSheetByName('인증기록');
  if (!recordSheet) {
    recordSheet = ss.insertSheet('인증기록');
    recordSheet.appendRow(['nickname', 'week', 'year', 'imageUrl', 'submittedAt', 'type', 'points', 'screenshotTime']);
  }

  return { success: true, message: '초기 설정 완료! 관리자 계정이 생성되었습니다.' };
}

// ── 일반 계정 만들기 ──
function handleRegister(params) {
  var nickname = (params.nickname || '').trim();
  var password = (params.password || '').trim();

  if (!nickname || !password) {
    return { success: false, error: '닉네임과 비밀번호를 입력하세요.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('멤버');
  if (!sheet) {
    return { success: false, error: '초기 설정이 필요합니다. 관리자에게 문의하세요.' };
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname) {
      return { success: false, error: '이미 존재하는 닉네임입니다.' };
    }
  }

  sheet.appendRow([nickname, password, false]);
  return { success: true };
}

// ── 유틸리티 ──
function isAdmin(nickname) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('멤버');
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === nickname && (data[i][2] === true || data[i][2] === 'TRUE')) {
      return true;
    }
  }
  return false;
}

function getOrCreateFolder(year, week) {
  var rootFolderName = '챌린지_인증스크린샷';
  var folders = DriveApp.getFoldersByName(rootFolderName);
  var rootFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(rootFolderName);

  var yearFolderName = String(year);
  var yearFolders = rootFolder.getFoldersByName(yearFolderName);
  var yearFolder = yearFolders.hasNext() ? yearFolders.next() : rootFolder.createFolder(yearFolderName);

  var weekFolderName = 'week' + week;
  var weekFolders = yearFolder.getFoldersByName(weekFolderName);
  return weekFolders.hasNext() ? weekFolders.next() : yearFolder.createFolder(weekFolderName);
}
