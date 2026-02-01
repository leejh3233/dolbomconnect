/**
 * DOLBOM CONNECT - FINAL ENGINE
 * Last Updated: 2026-01-25
 */

var ADMIN_MASTER_PASSWORD = "dolbom4146"; 

/**
 * 1. 라우팅 매니저 (긴급 안정화)
 * 구글 드라이브 에러 페이지 원천 차단 및 SID 라우팅 강화
 */
function doGet(e) {
  try {
    initSheets(); // 최상단에서 시트 확보 (에러 방지)
    var p = (e && e.parameter) ? e.parameter : {};
    var scriptUrl = ScriptApp.getService().getUrl();
    
    // A. 관리 도구 진입 (page 파라미터 우선순위)
    if (p.page === "portal") {
      var t = HtmlService.createTemplateFromFile('Portal');
      t.scriptUrl = scriptUrl;
      return t.evaluate().setTitle("돌봄매트 통합 포털").addMetaTag('viewport', 'width=device-width, initial-scale=1');
    } else if (p.page === "partner") {
      var t = HtmlService.createTemplateFromFile('Partner');
      t.scriptUrl = scriptUrl;
      return t.evaluate().setTitle("파트너 대시보드").addMetaTag('viewport', 'width=device-width, initial-scale=1');
    } else if (p.page === "admin") {
      var t = HtmlService.createTemplateFromFile('Admin');
      t.scriptUrl = scriptUrl;
      return t.evaluate().setTitle("관리자 대시보드").addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    
    // B. 고객용 견적 신청 페이지 (SID 처리 로직 강화)
    var empId = "본사"; var source = "직접유입";
    
    if (p.sid) {
      var sidInfo = getInfoBySid(p.sid);
      if (sidInfo) {
        var status = checkPartnerNameStatus(sidInfo.empId);
        if (status.exists && !status.isBlocked) { 
          empId = sidInfo.empId; source = sidInfo.source; 
        } else if (status.isBlocked) {
          source = "계약만료(" + sidInfo.source + ")"; 
        } else {
          source = "삭제된파트너(" + sidInfo.source + ")";
        }
      }
    } else {
      if (p.empId) {
        var status = checkPartnerNameStatus(p.empId);
        if (status.exists && !status.isBlocked) {
          empId = p.empId; 
          source = p.source || "직접링크";
        } else if (status.isBlocked) {
          source = "계약만료(" + (p.source || "직접") + ")";
        } else {
          source = "삭제된파트너(" + (p.source || "직접") + ")";
        }
      } else if (p.source) {
        source = p.source;
      }
    }
    
    var template = HtmlService.createTemplateFromFile('Index');
    template.empId = empId; template.source = source; template.scriptUrl = scriptUrl;
    return template.evaluate()
      .setTitle("돌봄매트 간편 견적 신청")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // 리다이렉션 호환성 위해 추가
  } catch (err) {
    // 런타임 에러 시 구글 드라이브 기본 에러창 대신 안전한 안내문 출력
    return HtmlService.createHtmlOutput("<div style='padding:20px; font-family:sans-serif;'><h2>서비스 일시 점검 중</h2><p>잠시 후 다시 시도해 주세요.</p><small>" + err.toString() + "</small></div>");
  }
}

function verifyAdminPassword(pwd) { return pwd === ADMIN_MASTER_PASSWORD; }

/**
 * 2. 시트 초기화
 */
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName("Partners")) ss.insertSheet("Partners").appendRow(["이름", "비밀번호", "은행", "계좌번호", "유형", "만료일", "등록일", "상태"]);
  if (!ss.getSheetByName("ShortLinks")) ss.insertSheet("ShortLinks").appendRow(["SID", "이름", "유입경로"]);
}

/**
 * 3. 데이터 저장 (유입 시)
 */
function saveData(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var nextRow = sheet.getLastRow() + 1;
  // [V12.4] 수식 대신 0을 기본값으로 입력 (서버단 계산 원칙)
  sheet.appendRow([new Date(), data.source, data.area, data.empId, data.aptName, data.pyeong, data.scope, "상담대기", false, false, 0, 0, "미정산"]);
  sheet.getRange(nextRow, 9, 1, 2).insertCheckboxes();
  return "Success";
}

/**
 * 4. 파트너 대시보드 데이터 (V13.2 - 정산 집계 강화)
 */
function getPartnerData(empId, password) {
  verifyOrRegisterPartner(empId, password);
  var leads = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getDataRange().getValues();
  var stats = { monthly: {}, allLeads: [], totalSettled: 0, totalPending: 0 };
  
  for (var i = leads.length - 1; i >= 1; i--) {
    var r = leads[i];
    if (String(r[3]).trim() == String(empId).trim()) {
      var dateObj = new Date(r[0]);
      var monthKey = Utilities.formatDate(dateObj, "Asia/Seoul", "yyyy-MM");
      if (!stats.monthly[monthKey]) stats.monthly[monthKey] = { leads: 0, bookings: 0, completed: 0, saleAmount: 0, incentive: 0, settled: 0, pending: 0 };
      
      var isCompleted = (r[9] === true || String(r[9]).toLowerCase() === "true");
      var incV = isCompleted ? 20000 : 0;
      var isSettled = (r[12] === "정산완료");
      
      stats.monthly[monthKey].leads++;
      if (r[8] === true || String(r[8]).toLowerCase() === "true") stats.monthly[monthKey].bookings++;
      
      if (isCompleted) {
        stats.monthly[monthKey].completed++;
        stats.monthly[monthKey].saleAmount += (parseFloat(r[10])||0);
        stats.monthly[monthKey].incentive += incV;
        
        if (isSettled) {
          stats.monthly[monthKey].settled += incV;
          stats.totalSettled += incV;
        } else {
          stats.monthly[monthKey].pending += incV;
          stats.totalPending += incV;
        }
      }
      stats.allLeads.push({ month: monthKey, date: Utilities.formatDate(dateObj, "Asia/Seoul", "MM-dd"), source: r[1], region: r[2], apt: r[4], isBooking: (r[8] === true || String(r[8]).toLowerCase() === "true"), isCompleted: isCompleted, saleAmount: parseFloat(r[10])||0, incentive: incV, settlement: r[12] || "미정산" });
    }
  }
  
  // [V13.3] 파트너 추가 정보 가져오기
  var partnerInfo = checkPartnerNameStatus(empId);
  var account = getPartnerAccount(empId);
  
  return { 
    stats: stats, 
    type: partnerInfo.type, 
    bank: account ? account.bank : "", 
    account: account ? account.account : "" 
  };
}

/**
 * 5. 관리자 데이터 (인센티브 계산 강제화)
 */
function getAdminData() {
  initSheets();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leads = ss.getSheets()[0].getDataRange().getValues();
  var partnerRows = ss.getSheetByName("Partners").getDataRange().getValues();
  
  var partners = [];
  var ph = partnerRows[0]; // Header row

  // Helper to find column index by header name
  var getColIdx = function(possibleNames, defaultIdx) {
    for (var j = 0; j < ph.length; j++) {
      var header = String(ph[j]).toLowerCase();
      if (possibleNames.some(function(name) { return header.indexOf(name.toLowerCase()) !== -1; })) return j;
    }
    return defaultIdx;
  };

  var nameIdx = getColIdx(['이름', 'PartnerName', '성함'], 0);
  var typeIdx = getColIdx(['유형', 'Type', '영업구분'], 4);
  var statusIdx = getColIdx(['상태', 'Status'], 7);
  var bankIdx = getColIdx(['은행', 'BankName', '은행명'], 2);
  var accIdx = getColIdx(['계좌번호', 'Account', '계좌'], 3);

  partnerRows.slice(1).forEach(r => {
    partners.push({ 
      name: r[nameIdx] || "", 
      type: r[typeIdx] || "외부파트너", 
      status: r[statusIdx] || "Active", 
      bank: r[bankIdx] || "", 
      account: r[accIdx] || "", 
      pendingMap: {},
      settledMap: {} 
    });
  });

  var leadData = [];
  var globalTotalSettled = 0;
  var globalTotalPending = 0;
  var ph = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners").getRowElements()[0]; // Just to get headers if needed, but indices are used below
  
  leads.slice(1).forEach((r, i) => {
    var isComp = (r[9] === true || String(r[9]).toLowerCase() === "true");
    var amount = isComp ? 20000 : 0;
    var isSettled = (r[12] === "정산완료");
    var monthKey = Utilities.formatDate(new Date(r[0]), "Asia/Seoul", "yyyy-MM");
    
    if (isComp) {
      var p = partners.find(ptr => ptr.name === r[3]);
      if (p) {
        if (isSettled) {
          if (!p.settledMap[monthKey]) p.settledMap[monthKey] = 0;
          p.settledMap[monthKey] += amount;
        } else {
          if (!p.pendingMap[monthKey]) p.pendingMap[monthKey] = 0;
          p.pendingMap[monthKey] += amount;
        }
      }
    }

    leadData.push({ 
      rowId: i + 2, 
      date: Utilities.formatDate(new Date(r[0]), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"), 
      shortDate: Utilities.formatDate(new Date(r[0]), "Asia/Seoul", "MM-dd"), 
      fullMonth: monthKey, 
      source: r[1], 
      partner: r[3], 
      apt: r[4], 
      isBooking: (r[8] === true || String(r[8]).toLowerCase() === "true"), 
      isCompleted: isComp, 
      saleAmount: parseFloat(String(r[10]).replace(/,/g,'')) || 0, // 쉼표 제거 로직 강화
      incentive: amount, 
      settlement: r[12] || "미정산" 
    });
    
    if (isComp) {
      if (isSettled) globalTotalSettled += amount;
      else globalTotalPending += amount;
    }
  });

  return { leads: leadData.reverse(), partners: partners, totalSettled: globalTotalSettled, totalPending: globalTotalPending };
}

/**
 * 6. 상태 업데이트 및 정산 처리
 */
function updateLeadStatus(rowId, col, val) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.getRange(rowId, col).setValue(val);
  
  // 시공완료(10열) 변경 시 인센티브(12열) 즉시 업데이트
  if(col == 10) {
    var incentive = (val === true || String(val).toLowerCase() === "true") ? 20000 : 0;
    sheet.getRange(rowId, 12).setValue(incentive);
  }
  return "OK";
}

function updateSaleAmount(rowId, amount) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.getRange(rowId, 11).setValue(parseFloat(amount) || 0);
  // 시공완료 체크 여부에 따라 인센티브 재검증
  var isComp = sheet.getRange(rowId, 10).getValue();
  var incentive = (isComp === true || String(isComp).toLowerCase() === "true") ? 20000 : 0;
  sheet.getRange(rowId, 12).setValue(incentive);
  return "OK";
}

function updatePartnerStatus(name, status) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners");
  var d = sheet.getRange("A:H").getValues();
  for(var i=1; i<d.length; i++) { if(String(d[i][0]).trim()==String(name).trim()) { sheet.getRange(i+1, 8).setValue(status); return "OK"; } }
}

function deletePartner(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners");
  var d = sheet.getRange("A:H").getValues();
  for(var i=1; i<d.length; i++) { 
    if(String(d[i][0]).trim()==String(name).trim()) { 
      sheet.deleteRow(i+1); 
      return "OK"; 
    } 
  }
  return "NOT_FOUND";
}

function settlePartnerBulk(partnerName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var range = sheet.getDataRange();
  var data = range.getValues();
  var changed = false;
  
  for (var i = 1; i < data.length; i++) {
    var isComp = (data[i][9] === true || String(data[i][9]).toLowerCase() === "true");
    var partner = String(data[i][3]).trim();
    var settlement = String(data[i][12]).trim();
    
    if (partner === String(partnerName).trim() && isComp && settlement !== "정산완료") {
      data[i][12] = "정산완료";
      changed = true;
    }
  }
  
  if (changed) {
    range.setValues(data);
  }
  return "OK";
}

/**
 * [Tools] 링크 관리 (V12.6 - 풀 URL 방식 전환)
 */
function getPartnerLinks(name) {
  var d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ShortLinks").getDataRange().getValues();
  var links = [];
  var scriptUrl = ScriptApp.getService().getUrl();
  for (var i = 1; i < d.length; i++) { 
    if (String(d[i][1]).trim() == String(name).trim()) {
      // 신규 방식 풀 URL 생성 (교체 없이 추가)
      var fullUrl = scriptUrl + "?empId=" + encodeURIComponent(d[i][1]) + "&source=" + encodeURIComponent(d[i][2]);
      links.push({ sid: d[i][0], source: d[i][2], url: fullUrl }); 
    } 
  }
  return links;
}

function generateShortLink(n, p, s, b, a) {
  verifyOrRegisterPartner(n,p,b,a);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("ShortLinks");
  var data = sheet.getDataRange().getValues();
  var scriptUrl = ScriptApp.getService().getUrl();
  
  // 중복 체크
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() == String(n).trim() && String(data[i][2]).trim() == String(s).trim()) {
      return scriptUrl + "?empId=" + encodeURIComponent(n) + "&source=" + encodeURIComponent(s);
    }
  }
  
  var sid = Math.random().toString(36).substring(2, 8).toUpperCase();
  sheet.appendRow([sid, n, s]);
  return scriptUrl + "?empId=" + encodeURIComponent(n) + "&source=" + encodeURIComponent(s);
}

function deleteShortLink(sid) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ShortLinks");
  var d = sheet.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) { if (String(d[i][0]).trim() == String(sid).trim()) { sheet.deleteRow(i + 1); return "OK"; } }
}

function checkPartnerNameStatus(n) {
  initSheets();
  var d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners").getDataRange().getValues();
  var targetName = String(n).trim();
  for (var i = 1; i < d.length; i++) { 
    if (String(d[i][0]).trim() == targetName) return { exists: true, isRegistered: d[i][1] !== "", type: d[i][4], isBlocked: d[i][7] == "Expired" }; 
  }
  return { exists: false };
}

function verifyOrRegisterPartner(n, p, b, a) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners");
  var d = sheet.getDataRange().getValues();
  var inputName = String(n || "").trim();
  var inputPwd = String(p || "").trim();

  for (var i = 1; i < d.length; i++) {
    var sheetName = String(d[i][0] || "").trim();
    if (sheetName === inputName) {
      if (d[i][7] == "Expired") throw new Error("계약이 만료된 계정입니다.");
      
      var isEmployee = (d[i][4] == "직원");
      var sheetPwd = String(d[i][1] || "").trim();
      
      if (sheetPwd === "") {
        if (!inputPwd || inputPwd.length !== 4) throw new Error("비밀번호 4자리 설정이 필요합니다.");
        // [V13.0] 직원은 계좌 정보가 없어도 등록 가능
        if (!isEmployee && (!b || !a)) throw new Error("외부파트너는 정산용 계좌 정보가 필요합니다.");
        sheet.getRange(i+1, 2, 1, 3).setValues([[inputPwd, b||"", a||""]]);
        return "SUCCESS";
      } else {
        if (sheetPwd === inputPwd) return "LOGGED_IN";
        throw new Error("비밀번호가 틀렸습니다.");
      }
    }
  }
  throw new Error("등록되지 않은 사용자입니다. 관리자에게 문의하세요.");
}

function getInfoBySid(sid) {
  var d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ShortLinks").getDataRange().getValues();
  var targetSid = String(sid).trim().toUpperCase();
  for (var i = 1; i < d.length; i++) { 
    if (String(d[i][0]).trim().toUpperCase() == targetSid) return { empId: d[i][1], source: d[i][2] }; 
  }
  return null;
}

function getPartnerStatus(n) {
  var d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners").getDataRange().getValues();
  for (var i = 1; i < d.length; i++) { if (d[i][0] == n) return { isValid: d[i][7] !== "Expired" }; }
  return { isValid: true };
}

function getPartnerAccount(n) {
  var d = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners").getDataRange().getValues();
  for (var i = 1; i < d.length; i++) { if (d[i][0] == n) return { bank: d[i][2], account: d[i][3] }; }
}


function adminPreRegisterPartner(n, t) {
  initSheets();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners");
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Helper to find column index by header name
  var getColIdx = function(name) {
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).indexOf(name) !== -1) return i + 1;
    }
    return -1;
  };

  var row = sheet.getLastRow() + 1;
  // Initialize with empty columns
  sheet.appendRow(new Array(headers.length).fill(""));
  
  var nIdx = getColIdx("이름"); if (nIdx !== -1) sheet.getRange(row, nIdx).setValue(n);
  var tIdx = getColIdx("유형"); if (tIdx === -1) tIdx = getColIdx("영업구분");
  if (tIdx !== -1) sheet.getRange(row, tIdx).setValue(t || "외부파트너");
  
  var dIdx = getColIdx("등록일"); if (dIdx === -1) dIdx = getColIdx("CreatedDate");
  if (dIdx !== -1) sheet.getRange(row, dIdx).setValue(new Date());
  
  var sIdx = getColIdx("상태"); if (sIdx !== -1) sheet.getRange(row, sIdx).setValue("Active");
  
  return "OK";
}

/**
 * 7. 파트너 프로필 업데이트 (비밀번호 + 계좌)
 */
function updatePartnerProfile(name, oldPwd, newPwd, bank, account) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Partners");
  var d = sheet.getRange("A:H").getValues();
  var inputName = String(name || "").trim();
  var inputOldPwd = String(oldPwd || "").trim();
  
  for (var i = 1; i < d.length; i++) {
    if (String(d[i][0] || "").trim() === inputName) {
      if (String(d[i][1] || "").trim() !== inputOldPwd) {
        throw new Error("현재 비밀번호가 일치하지 않습니다.");
      }
      
      var updates = {};
      if (newPwd && String(newPwd).trim().length === 4) {
        sheet.getRange(i + 1, 2).setValue(String(newPwd).trim());
      }
      
      // 외부파트너인 경우만 계좌 정보 업데이트 (또는 구분 없이 업데이트 가능하도록 허용)
      if (bank !== undefined) sheet.getRange(i + 1, 3).setValue(bank);
      if (account !== undefined) sheet.getRange(i + 1, 4).setValue(account);
      
      return "SUCCESS";
    }
  }
  throw new Error("사용자를 찾을 수 없습니다.");
}



