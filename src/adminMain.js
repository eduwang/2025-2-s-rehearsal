// 🔗 Firebase SDK에서 필요한 함수들 가져오기
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { marked } from 'marked';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebaseConfig.js";
import Swal from 'sweetalert2';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';

// ✅ 관리자 권한 UID 설정
const allowedAdmins = ["P3GN9l3O2eaHNylv46FMA1JiKTD3", "pbUud8kcDKZyRkwgOmpCXBwPF5v1", "AJtocEddS2ZZ0dQe6fgtPeoUqEP2"];

// 🔧 DOM 요소 참조
const userSelect = document.getElementById("user-select");
const feedbackDisplayCheckbox = document.getElementById("feedback-display-checkbox");
const scenarioSelect = document.getElementById("scenario-select");
const dateCheckboxes = document.getElementById("date-checkboxes");
const resultsContainer = document.getElementById("results-container");
const feedbackEnabled = document.getElementById("feedback-enabled");

const scenarioTextArea = document.getElementById("scenario-text");
const starterTableContainer = document.getElementById("starter-conversation-table");
const saveScenarioBtn = document.getElementById("save-scenario-btn");

// Handsontable 인스턴스
let starterTable;

let allUsers = [];
let allScenarios = [];
let starterConversation = [];
let todayString = new Date().toISOString().split("T")[0];
let selectedScenarioId = null;

// 🔐 로그인 확인 및 관리자 권한 검증
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user && allowedAdmins.includes(user.uid)) {
      initAdminPage();
      loadScenarioList();
    } else {
      Swal.fire({
        icon: 'error',
        title: '접근 불가',
        text: '접근 권한이 없습니다.'
      }).then(() => window.location.href = "/");
    }
  });
});

// 🔄 관리자 페이지 초기화
async function initAdminPage() {
  await loadAllScenarios();
  await loadFeedbackSettings();
  
  // Handsontable 초기화
  initStarterTable();

  // 이벤트 리스너 등록
  userSelect.addEventListener("change", filterAndRender);
  feedbackDisplayCheckbox.addEventListener("change", filterAndRender);
  scenarioSelect.addEventListener("change", filterAndRender);
  // 날짜 체크박스는 개별적으로 이벤트 리스너가 등록되어 있음

  // 피드백 기능 제어 이벤트 리스너
  feedbackEnabled.addEventListener("change", saveFeedbackSettings);

  // 테이블 컨트롤 버튼 이벤트 리스너
  document.getElementById("add-row-btn").addEventListener("click", addRow);
  document.getElementById("delete-row-btn").addEventListener("click", deleteRow);

  // 스크롤 탑 버튼 생성
  createScrollTopButton();

  // 초기 데이터 로드 (사용자 드롭다운은 filterAndRender에서 업데이트됨)
  await loadAllDocuments();
  
  // 초기 필터링 및 렌더링
  filterAndRender();
}

// 🎛️ 스크롤 탑 버튼 생성
function createScrollTopButton() {
  // 버튼 요소 생성
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.id = 'scroll-top-btn';
  scrollTopBtn.innerHTML = '⬆️';
  scrollTopBtn.title = '맨 위로 이동';
  
  // 버튼 스타일 적용
  Object.assign(scrollTopBtn.style, {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: '1000',
    opacity: '0',
    visibility: 'hidden',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  });
  
  // 클릭 이벤트: 부드러운 스크롤
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // 호버 효과
  scrollTopBtn.addEventListener('mouseenter', () => {
    scrollTopBtn.style.backgroundColor = '#059669';
    scrollTopBtn.style.transform = 'scale(1.1)';
  });
  
  scrollTopBtn.addEventListener('mouseleave', () => {
    scrollTopBtn.style.backgroundColor = '#10b981';
    scrollTopBtn.style.transform = 'scale(1)';
  });
  
  // 스크롤 이벤트: 버튼 표시/숨김
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      scrollTopBtn.style.opacity = '1';
      scrollTopBtn.style.visibility = 'visible';
    } else {
      scrollTopBtn.style.opacity = '0';
      scrollTopBtn.style.visibility = 'hidden';
    }
  });
  
  // 페이지에 추가
  document.body.appendChild(scrollTopBtn);
}

// 📊 Handsontable 초기화
function initStarterTable() {
  console.log('Handsontable 초기화 시작');
  console.log('Container:', starterTableContainer);
  
  if (!starterTableContainer) {
    console.error('starterTableContainer를 찾을 수 없습니다!');
    return;
  }
  
  try {
    starterTable = new Handsontable(starterTableContainer, {
      data: [['', '']], // 빈 행 하나 추가
      colHeaders: ['화자', '메시지'],
      columns: [
        { data: 0, type: 'text' },
        { data: 1, type: 'text' }
      ],
      rowHeaders: true,
      height: 300,
      minSpareRows: 1,
      stretchH: 'all',
      licenseKey: 'non-commercial-and-evaluation',
      contextMenu: true,
      afterChange: function(changes, source) {
        if (source === 'loadData') return;
        
        // 데이터 변경 시 starterConversation 배열 업데이트
        const data = starterTable.getData();
        starterConversation = data
          .filter(row => row[0] && row[1]) // 빈 행 제거
          .map(row => ({ speaker: row[0], message: row[1] }));
      }
    });
    
    console.log('Handsontable 초기화 완료:', starterTable);
  } catch (error) {
    console.error('Handsontable 초기화 실패:', error);
  }
}

// ➕ 행 추가
function addRow() {
  if (starterTable) {
    starterTable.alter('insert_row_below');
    console.log('행 추가됨');
  }
}

// ➖ 행 삭제
function deleteRow() {
  if (starterTable) {
    const selected = starterTable.getSelected();
    if (selected && selected.length > 0) {
      // 선택된 행들 삭제
      const rowsToDelete = selected.map(range => range[0].from.row).sort((a, b) => b - a);
      rowsToDelete.forEach(rowIndex => {
        starterTable.alter('remove_row', rowIndex);
      });
      console.log('선택된 행들 삭제됨');
    } else {
      // 마지막 행 삭제
      const rowCount = starterTable.countRows();
      if (rowCount > 1) {
        starterTable.alter('remove_row', rowCount - 1);
        console.log('마지막 행 삭제됨');
      }
    }
  }
}

// 🎛️ 피드백 설정 로드
async function loadFeedbackSettings() {
  try {
    const feedbackDoc = await getDoc(doc(db, "lessonPlaySettings", "feedback"));
    if (feedbackDoc.exists()) {
      const data = feedbackDoc.data();
      feedbackEnabled.checked = data.enabled || false;
    } else {
      // 기본값: 비활성화
      feedbackEnabled.checked = false;
    }
  } catch (error) {
    console.error("피드백 설정 로드 실패:", error);
    feedbackEnabled.checked = false;
  }
}

// 💾 피드백 설정 저장
async function saveFeedbackSettings() {
  try {
    const enabled = feedbackEnabled.checked;
    await setDoc(doc(db, "lessonPlaySettings", "feedback"), {
      enabled: enabled,
      updatedAt: new Date()
    });
    
    // 성공 메시지 표시
    Swal.fire({
      icon: "success",
      title: "설정 저장 완료",
      text: `AI 피드백 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (error) {
    console.error("피드백 설정 저장 실패:", error);
    Swal.fire({
      icon: "error",
      title: "설정 저장 실패",
      text: "설정을 저장하는 중 오류가 발생했습니다."
    });
  }
}

// 🔍 Firestore에서 모든 문서 로드 및 정렬
async function loadAllDocuments() {
  const snapshot = await getDocs(collection(db, "lessonPlayResponses"));
  const documents = [];
  const userMap = new Map();
  const dateSet = new Set();

  snapshot.forEach(doc => {
    const data = doc.data();
    
    // 문서 ID에서 타입 추출 (lessonPlay 또는 lessonPlayFeedback)
    const docType = doc.id.includes('lessonPlayFeedback') ? 'lessonPlayFeedback' : 
                   doc.id.includes('lessonPlay') ? 'lessonPlay' : null;
    
         if (data.uid && data.scenarioId && docType) {
       // createdAt이 있으면 사용, 없으면 updatedAt 사용
       const timestamp = data.createdAt?.toDate?.() || data.updatedAt?.toDate?.() || new Date();
       
       // 토글 제목용: 원본 시간 그대로 사용 (이미 한국 시간)
       const displayTime = timestamp;
       
       // 날짜 체크박스용: UTC 시간으로 변환 후 한국 시간으로 다시 변환
       // (Firestore의 toDate()는 UTC 시간을 반환하므로)
       let utcTime;
       if (timestamp === data.createdAt?.toDate?.() || timestamp === data.updatedAt?.toDate?.()) {
         // Firestore Timestamp인 경우 UTC 시간으로 처리
         utcTime = timestamp;
       } else {
         // 이미 Date 객체인 경우 (이미 한국 시간으로 변환된 경우)
         // UTC 시간으로 되돌리기 위해 9시간 빼기
         utcTime = new Date(timestamp.getTime() - (9 * 60 * 60 * 1000));
       }
       
       // UTC 시간을 한국 시간으로 변환하여 날짜 문자열 생성
       const koreanTime = new Date(utcTime.getTime() + (9 * 60 * 60 * 1000));
       const year = koreanTime.getFullYear();
       const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
       const day = String(koreanTime.getDate()).padStart(2, '0');
       const dateStr = `${year}-${month}-${day}`;
       
       documents.push({
         id: doc.id,
         ...data,
         type: docType, // 추출한 타입을 명시적으로 설정
         createdAt: displayTime, // 토글 제목용: 원본 시간 그대로
         dateStr: dateStr // 날짜 체크박스용: 정확한 한국 날짜
       });

      // 사용자 정보 수집
      if (!userMap.has(data.uid)) {
        userMap.set(data.uid, {
          displayName: data.displayName || data.uid,
          email: data.email || ""
        });
      }

      // 날짜 수집
      dateSet.add(dateStr);
    }
  });

  // 날짜 내림차순 정렬
  const sortedDates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));
  
  // 사용자 이름순 정렬
  allUsers = Array.from(userMap.entries())
    .map(([uid, { displayName, email }]) => ({ uid, name: displayName, email }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  // 날짜 체크박스 구성
  populateDateCheckboxes(sortedDates);
  
  // 사용자 드롭다운 구성
  populateUserDropdown();

  // 캐시 업데이트
  window.cachedDocuments = documents;

  return documents;
}

// 📅 날짜 체크박스 구성
function populateDateCheckboxes(dates) {
  dateCheckboxes.innerHTML = "";
  
  // 전체 선택 체크박스
  const allDatesItem = createDateCheckboxItem("all", "전체 날짜", true);
  const allCheckbox = allDatesItem.querySelector('input[type="checkbox"]');
  allCheckbox.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    // 모든 날짜 체크박스 상태 변경
    dateCheckboxes.querySelectorAll('.date-checkbox-item input[type="checkbox"]').forEach(checkbox => {
      if (checkbox.value !== "all") {
        checkbox.checked = isChecked;
      }
    });
    filterAndRender();
  });
  dateCheckboxes.appendChild(allDatesItem);

  // 개별 날짜 체크박스들
  dates.forEach(date => {
    // date는 이미 YYYY-MM-DD 형태의 문자열이므로 직접 파싱
    const [year, month, day] = date.split('-');
    const displayDate = `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
    
    const dateItem = createDateCheckboxItem(date, displayDate, false);
    const dateCheckbox = dateItem.querySelector('input[type="checkbox"]');
    dateCheckbox.addEventListener("change", () => {
      // 전체 선택 체크박스 상태 업데이트
      updateAllDatesCheckbox();
      filterAndRender();
    });
    dateCheckboxes.appendChild(dateItem);
  });
}

// 📅 날짜 체크박스 아이템 생성
function createDateCheckboxItem(value, label, isChecked) {
  // div 컨테이너 생성
  const container = document.createElement("div");
  container.classList.add("date-checkbox-item");
  
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = value;
  checkbox.checked = isChecked;
  checkbox.id = `date-checkbox-${value}`;
  
  const checkmark = document.createElement("span");
  checkmark.classList.add("checkmark-small");
  
  const dateLabel = document.createElement("span");
  dateLabel.classList.add("date-label");
  dateLabel.textContent = label;
  
  // label 요소 생성하여 checkbox와 연결
  const labelElement = document.createElement("label");
  labelElement.setAttribute("for", checkbox.id);
  labelElement.appendChild(checkmark);
  labelElement.appendChild(dateLabel);
  
  // checkbox를 container에 추가 (label과 형제 요소로)
  container.appendChild(checkbox);
  container.appendChild(labelElement);
  
  return container;
}

// 📅 전체 날짜 체크박스 상태 업데이트
function updateAllDatesCheckbox() {
  const allCheckbox = dateCheckboxes.querySelector('input[value="all"]');
  const individualCheckboxes = dateCheckboxes.querySelectorAll('input[type="checkbox"]:not([value="all"])');
  const allChecked = Array.from(individualCheckboxes).every(cb => cb.checked);
  
  allCheckbox.checked = allChecked;
}

// 👤 사용자 드롭다운 구성
function populateUserDropdown() {
  userSelect.innerHTML = "";
  
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "전체 사용자 보기";
  userSelect.appendChild(allOption);

  allUsers.forEach(user => {
    const option = document.createElement("option");
    option.value = user.uid;
    option.textContent = `${user.name}${user.email ? ` (${user.email})` : ""}`;
    userSelect.appendChild(option);
  });
}

// 👤 필터링된 사용자 드롭다운 업데이트
function updateUserDropdown(filteredUsers) {
  const currentSelection = userSelect.value;
  
  userSelect.innerHTML = "";
  
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "전체 사용자 보기";
  userSelect.appendChild(allOption);

  filteredUsers.forEach(user => {
    const option = document.createElement("option");
    option.value = user.uid;
    option.textContent = `${user.name}${user.email ? ` (${user.email})` : ""}`;
    userSelect.appendChild(option);
  });

  // 이전 선택이 여전히 유효한지 확인하고, 유효하지 않으면 "전체"로 설정
  const optionExists = Array.from(userSelect.options).some(option => option.value === currentSelection);
  if (!optionExists) {
    userSelect.value = "all";
  }
}

// 🔍 Firestore에서 시나리오 목록 로드
async function loadAllScenarios() {
  allScenarios = [];
  scenarioSelect.innerHTML = "";
  const snapshot = await getDocs(collection(db, "lessonPlayScenarios"));
  snapshot.forEach(doc => {
    if (doc.id !== "config") {
      allScenarios.push({ id: doc.id, title: doc.data().title || "새로 입력하기" });
    }
  });

  allScenarios.forEach(s => {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = s.title;
    scenarioSelect.appendChild(option);
  });
}

// 📅 날짜 입력 기본값 설정
function populateDate() {
  dateSelect.value = todayString;
}

// 🔍 선택된 조건으로 결과 필터링 및 렌더링
async function filterAndRender() {
  const uid = userSelect.value;
  const showFeedback = feedbackDisplayCheckbox.checked;
  const scenarioId = scenarioSelect.value;
  
  // 선택된 날짜들 가져오기
  const selectedDates = Array.from(dateCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .filter(value => value !== "all");

  // 전체 선택 체크박스가 체크되어 있으면 모든 날짜 허용
  const allDatesChecked = dateCheckboxes.querySelector('input[value="all"]')?.checked || false;
  
  resultsContainer.innerHTML = "";

  // 모든 문서 로드 (캐시된 데이터 사용)
  let allDocuments = [];
  try {
    // 이미 로드된 데이터가 있으면 사용, 없으면 새로 로드
    if (window.cachedDocuments && window.cachedDocuments.length > 0) {
      allDocuments = window.cachedDocuments;
    } else {
      allDocuments = await loadAllDocuments();
      window.cachedDocuments = allDocuments; // 캐시에 저장
    }
  } catch (error) {
    console.error("문서 로드 실패:", error);
    return;
  }
  
  // 필터링
  let filteredDocs = allDocuments.filter(doc => {
    // 시나리오 필터
    if (scenarioId && doc.scenarioId !== scenarioId) return false;
    
    // 날짜 필터
    // 전체 선택이 체크되어 있으면 모든 날짜 허용
    // 전체 선택이 체크되어 있지 않으면 선택된 개별 날짜만 허용
    if (!allDatesChecked && selectedDates.length === 0) return false; // 아무 날짜도 선택되지 않으면 모든 문서 제외
    if (!allDatesChecked && selectedDates.length > 0 && !selectedDates.includes(doc.dateStr)) return false;
    
    // 사용자 필터
    if (uid !== "all" && doc.uid !== uid) return false;
    
    // 피드백 표시 필터 (lessonPlayFeedback 타입만 피드백으로 간주)
    if (!showFeedback && doc.type === 'lessonPlayFeedback') return false;
    
    return true;
  });

  // 날짜 내림차순, 사용자 이름 오름차순, 시간 내림차순 정렬
  filteredDocs.sort((a, b) => {
    // 1차: 날짜 내림차순
    if (b.dateStr !== a.dateStr) {
      return new Date(b.dateStr) - new Date(a.dateStr);
    }
    
    // 2차: 사용자 이름 오름차순 (같은 날짜일 때)
    const userA = allUsers.find(u => u.uid === a.uid)?.name || '';
    const userB = allUsers.find(u => u.uid === b.uid)?.name || '';
    if (userA !== userB) {
      return userA.localeCompare(userB, 'ko');
    }
    
    // 3차: 시간 내림차순 (같은 날짜, 같은 사용자일 때)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // 필터링된 사용자 목록 생성 및 드롭다운 업데이트
  const filteredUsers = [];
  const userMap = new Map();
  
  filteredDocs.forEach(doc => {
    if (!userMap.has(doc.uid)) {
      const user = allUsers.find(u => u.uid === doc.uid);
      if (user) {
        filteredUsers.push(user);
        userMap.set(doc.uid, user);
      }
    }
  });
  
  // 사용자 이름순 정렬
  filteredUsers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  
  // 사용자 드롭다운 업데이트
  updateUserDropdown(filteredUsers);

  // 결과 렌더링
  filteredDocs.forEach(doc => {
    const user = allUsers.find(u => u.uid === doc.uid);
    const resultCard = renderResultCard(doc, user);
    resultsContainer.appendChild(resultCard);
  });
  
  // 다운로드 버튼 추가
  addDownloadButtons(filteredDocs);
}

// 🧩 결과 카드 생성 (토글 가능한 형태)
function renderResultCard(doc, user) {
  const card = document.createElement("div");
  card.classList.add("result-card");

  // 헤더 (제목 + 토글 아이콘)
  const header = document.createElement("div");
  header.classList.add("result-header");
  header.onclick = () => toggleResultCard(card);

  const title = document.createElement("div");
  title.classList.add("result-title");
  
  // createdAt은 이미 한국 시간으로 변환되어 있으므로 그대로 사용
  // toLocaleString('ko-KR')을 사용하면 다시 한국 시간으로 변환되어 +9시간이 추가됨
  const displayDateTime = doc.createdAt.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const typeText = doc.type === 'lessonPlayFeedback' ? ' (피드백)' : '';
  title.textContent = `${user?.name || '알 수 없음'} (${displayDateTime})${typeText}`;

  const toggleIcon = document.createElement("span");
  toggleIcon.classList.add("result-toggle-icon");
  toggleIcon.textContent = "▼";

  header.appendChild(title);
  header.appendChild(toggleIcon);

  // 내용 (접혀있음)
  const content = document.createElement("div");
  content.classList.add("result-content");

  // 2열 레이아웃 생성
  const columnsContainer = document.createElement("div");
  columnsContainer.classList.add("results-columns");

  // 왼쪽 컬럼: 대화 내용
  const leftColumn = document.createElement("div");
  leftColumn.classList.add("results-column");
  
  const leftTitle = document.createElement("h3");
  leftTitle.textContent = "대화 내용";
  leftColumn.appendChild(leftTitle);

  // 대화문을 테이블 형식으로 표시 (pageLP.js 방식)
  const conversationTable = document.createElement("div");
  conversationTable.classList.add("conversation-table");
  
  if (Array.isArray(doc.conversation)) {
    doc.conversation.forEach(entry => {
      const row = document.createElement("div");
      row.classList.add("conversation-row");
      if (entry.isUser) row.classList.add("user-entry");
      
      const speaker = document.createElement("span");
      speaker.classList.add("speaker");
      speaker.textContent = entry.speaker;
      
      const message = document.createElement("span");
      message.classList.add("message");
      message.textContent = entry.message;
      
      row.appendChild(speaker);
      row.appendChild(message);
      conversationTable.appendChild(row);
    });
  } else {
    const row = document.createElement("div");
    row.classList.add("conversation-row");
    row.innerHTML = '<span class="message">대화 내용 없음</span>';
    conversationTable.appendChild(row);
  }

  leftColumn.appendChild(conversationTable);

  columnsContainer.appendChild(leftColumn);
  
  // 오른쪽 컬럼: 피드백이 있는 경우에만 생성
  if (doc.feedback && doc.type === 'lessonPlayFeedback') {
    const rightColumn = document.createElement("div");
    rightColumn.classList.add("results-column");
    
    const rightTitle = document.createElement("h3");
    rightTitle.textContent = "AI 피드백";
    rightColumn.appendChild(rightTitle);

    const feedbackContent = document.createElement("div");
    feedbackContent.classList.add("feedback-preview");
    // 마크다운을 HTML로 변환하여 렌더링
    feedbackContent.innerHTML = marked.parse(doc.feedback);
    rightColumn.appendChild(feedbackContent);
    
    columnsContainer.appendChild(rightColumn);
  }
  content.appendChild(columnsContainer);

  // 버튼 컨테이너
  const buttonContainer = document.createElement("div");
  buttonContainer.style.marginTop = "16px";
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.flexWrap = "wrap";

  // 개별 CSV 다운로드 버튼
  const csvBtn = document.createElement("button");
  csvBtn.textContent = "📊 CSV";
  csvBtn.classList.add("btn", "btn-download");
  csvBtn.style.backgroundColor = "#3b82f6";
  csvBtn.onclick = (e) => {
    e.stopPropagation();
    downloadSingleCSV(doc);
  };

  // 개별 이미지 다운로드 버튼
  const imgBtn = document.createElement("button");
  imgBtn.textContent = "🖼️ 이미지";
  imgBtn.classList.add("btn", "btn-download");
  imgBtn.style.backgroundColor = "#10b981";
  imgBtn.onclick = (e) => {
    e.stopPropagation();
    downloadSingleImage(doc, card);
  };

  // 삭제 버튼
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️ 삭제";
  deleteBtn.classList.add("btn", "btn-delete");
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteResult(doc.id, card);
  };

  buttonContainer.appendChild(csvBtn);
  buttonContainer.appendChild(imgBtn);
  buttonContainer.appendChild(deleteBtn);
  content.appendChild(buttonContainer);

  card.appendChild(header);
  card.appendChild(content);

  return card;
}

// 🔄 결과 카드 토글
function toggleResultCard(card) {
  const content = card.querySelector(".result-content");
  const toggleIcon = card.querySelector(".result-toggle-icon");
  
  if (content.classList.contains("show")) {
    content.classList.remove("show");
    toggleIcon.textContent = "▼";
  } else {
    content.classList.add("show");
    toggleIcon.textContent = "▲";
  }
}

// 🗑️ 결과 삭제
async function deleteResult(docId, cardElement) {
  const result = await Swal.fire({
    title: "정말 삭제하시겠습니까?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "삭제",
    cancelButtonText: "취소"
  });
  
  if (!result.isConfirmed) return;
  
  try {
    await deleteDoc(doc(db, "lessonPlayResponses", docId));
    cardElement.remove();
    Swal.fire({
      icon: "success",
      title: "삭제 완료",
      text: "문서가 삭제되었습니다!"
    });
  } catch (err) {
    console.error("삭제 실패:", err);
    Swal.fire({
      icon: "error",
      title: "삭제 실패",
      text: "문서 삭제 중 오류가 발생했습니다."
    });
  }
}


// 📊 Handsontable에 데이터 로드
function loadStarterTableData(data) {
  if (starterTable && data && Array.isArray(data)) {
    const tableData = data.map(item => [item.speaker, item.message]);
    starterTable.loadData(tableData);
  } else if (starterTable) {
    starterTable.loadData([]);
  }
}

// 📊 Handsontable에서 데이터 가져오기
function getStarterTableData() {
  if (starterTable) {
    const data = starterTable.getData();
    return data
      .filter(row => row[0] && row[1]) // 빈 행 제거
      .map(row => ({ speaker: row[0], message: row[1] }));
  }
  return [];
}

// 💾 시나리오 저장 (새로 저장만 가능)
saveScenarioBtn.addEventListener("click", async () => {
  const title = document.getElementById("scenario-title").value.trim();
  const text = scenarioTextArea.value.trim();
  
  // Handsontable에서 데이터 가져오기
  const conversationData = getStarterTableData();

  if (!title || !text) {
    Swal.fire({
      icon: 'warning',
      title: '입력 필요',
      text: '제목과 시나리오 내용을 모두 입력하세요.'
    });
    return;
  }

  const docId = `scenario_${Date.now()}`;

  try {
    await setDoc(doc(db, "lessonPlayScenarios", docId), {
      title,
      scenarioText: text,
      starterConversation: conversationData
    });

    Swal.fire({
      icon: 'success',
      title: '저장 완료',
      text: '✅ 시나리오가 저장되었습니다!'
    });
    selectedScenarioId = null;
    document.getElementById("update-scenario-btn").disabled = true;
    document.getElementById("delete-scenario-btn").disabled = true;
    document.getElementById("scenario-title").value = "";
    scenarioTextArea.value = "";
    starterConversation = [];
    loadStarterTableData([]);
    await loadAllScenarios();
    await loadScenarioList();
  } catch (err) {
    console.error("❌ 저장 실패:", err);
    Swal.fire({
      icon: 'error',
      title: '저장 실패',
      text: '❌ 저장 실패. 콘솔을 확인하세요.'
    });
  }
});

// 📄 시나리오 목록 버튼 생성
async function loadScenarioList() {
  const listContainer = document.getElementById("scenario-list");
  listContainer.innerHTML = "";

  const snapshot = await getDocs(collection(db, "lessonPlayScenarios"));
  snapshot.forEach(docSnap => {
    if (docSnap.id === "config") return;
    const data = docSnap.data();
    const button = document.createElement("button");
    button.textContent = data.title || "새로 입력하기";
    button.classList.add("nav-button");
    button.style.marginRight = "10px";
    button.onclick = async () => {
      scenarioTextArea.value = data.scenarioText || "";
      starterConversation = data.starterConversation || [];
      loadStarterTableData(starterConversation);
      document.getElementById("scenario-title").value = data.title || "";
      selectedScenarioId = docSnap.id;
      try {
        await setDoc(doc(db, "lessonPlayScenarios", "config"), {
          selectedScenarioId: docSnap.id,
        }, { merge: true });
        document.getElementById("update-scenario-btn").disabled = false;
        document.getElementById("delete-scenario-btn").disabled = false;
      } catch (err) {
        console.error("❌ 선택 ID 저장 실패:", err);
      }
    };
    listContainer.appendChild(button);
  });
}

// 🎛️ 시나리오 편집기 열기/닫기 토글
document.getElementById("toggle-scenario-editor").addEventListener("click", () => {
  const editor = document.querySelector(".scenario-editor");
  const btn = document.getElementById("toggle-scenario-editor");
  const btnText = btn.querySelector(".btn-text");
  const toggleIcon = btn.querySelector(".toggle-icon");

  if (editor.classList.contains("hidden")) {
    editor.classList.remove("hidden");
    btn.classList.add("expanded");
    btnText.textContent = "🛠️ 시나리오 설정 닫기";
    toggleIcon.textContent = "▲";
  } else {
    editor.classList.add("hidden");
    btn.classList.remove("expanded");
    btnText.textContent = "🛠️ 시나리오 설정 열기";
    toggleIcon.textContent = "▼";
  }
});

// 📝 시나리오 수정
document.getElementById("update-scenario-btn").addEventListener("click", async () => {
  if (!selectedScenarioId) {
    Swal.fire({
      icon: 'info',
      title: '알림',
      text: '수정할 시나리오를 먼저 선택하세요!'
    });
    return;
  }
  const title = document.getElementById("scenario-title").value.trim();
  const text = scenarioTextArea.value.trim();
  
  // Handsontable에서 데이터 가져오기
  const conversationData = getStarterTableData();
  
  if (!title || !text) {
    Swal.fire({
      icon: 'warning',
      title: '입력 필요',
      text: '제목과 시나리오 내용을 모두 입력하세요.'
    });
    return;
  }
  try {
    await setDoc(doc(db, "lessonPlayScenarios", selectedScenarioId), {
      title,
      scenarioText: text,
      starterConversation: conversationData
    }, { merge: true });
    Swal.fire({
      icon: 'success',
      title: '수정 완료',
      text: '✅ 시나리오 수정 완료!'
    });
    await loadAllScenarios();
    await loadScenarioList();
  } catch (err) {
    console.error("❌ 수정 실패:", err);
    Swal.fire({
      icon: 'error',
      title: '수정 실패',
      text: '❌ 수정 실패. 콘솔을 확인하세요.'
    });
  }
});

// 🗑️ 시나리오 삭제
document.getElementById("delete-scenario-btn").addEventListener("click", async () => {
  if (!selectedScenarioId) {
    Swal.fire({
      icon: 'info',
      title: '알림',
      text: '삭제할 시나리오를 먼저 선택하세요!'
    });
    return;
  }
  const result = await Swal.fire({
    title: '정말 삭제하시겠습니까?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '삭제',
    cancelButtonText: '취소'
  });
  if (!result.isConfirmed) return;

  try {
    await deleteDoc(doc(db, "lessonPlayScenarios", selectedScenarioId));
    Swal.fire({
      icon: 'success',
      title: '삭제 완료',
      text: '✅ 시나리오 삭제 완료!'
    });
    selectedScenarioId = null;
    document.getElementById("update-scenario-btn").disabled = true;
    document.getElementById("delete-scenario-btn").disabled = true;
    document.getElementById("scenario-title").value = "";
    scenarioTextArea.value = "";
    starterConversation = [];
    loadStarterTableData([]);
    await loadAllScenarios();
    await loadScenarioList();
  } catch (err) {
    console.error("❌ 삭제 실패:", err);
    Swal.fire({
      icon: 'error',
      title: '삭제 실패',
      text: '❌ 삭제 실패. 콘솔을 확인하세요.'
    });
  }
});

// 새 시나리오 입력
document.getElementById("new-scenario-btn").addEventListener("click", () => {
  document.getElementById("scenario-title").value = "";
  document.getElementById("scenario-text").value = "";
  starterConversation = [];
  loadStarterTableData([]);

  selectedScenarioId = null;
  document.getElementById("update-scenario-btn").disabled = true;
  document.getElementById("delete-scenario-btn").disabled = true;
});

// 📥 다운로드 버튼 추가
function addDownloadButtons(filteredDocs) {
  // 기존 다운로드 버튼 제거
  const existingControls = document.querySelector('.download-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // 문서가 없으면 버튼도 추가하지 않음
  if (!filteredDocs || filteredDocs.length === 0) {
    return;
  }
  
  // 다운로드 컨트롤 컨테이너 생성
  const downloadControls = document.createElement('div');
  downloadControls.className = 'download-controls';
  
  // CSV 다운로드 버튼
  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn-download btn-download-csv';
  csvBtn.innerHTML = '📊 CSV 다운로드';
  csvBtn.onclick = () => downloadAsCSV(filteredDocs);
  
  // 개별 CSV 다운로드 버튼
  const individualCsvBtn = document.createElement('button');
  individualCsvBtn.className = 'btn-download btn-download-csv';
  individualCsvBtn.innerHTML = '📊 개별 CSV 다운로드';
  individualCsvBtn.onclick = () => downloadAllAsIndividualCSV(filteredDocs);
  
  // 이미지 다운로드 버튼
  const imgBtn = document.createElement('button');
  imgBtn.className = 'btn-download';
  imgBtn.innerHTML = '🖼️ 이미지 다운로드';
  imgBtn.onclick = () => downloadAsImage(filteredDocs);
  
  // 개별 이미지 다운로드 버튼
  const individualImgBtn = document.createElement('button');
  individualImgBtn.className = 'btn-download';
  individualImgBtn.innerHTML = '🖼️ 개별 이미지 다운로드';
  individualImgBtn.onclick = () => downloadAllAsIndividualImages(filteredDocs);
  
  downloadControls.appendChild(csvBtn);
  downloadControls.appendChild(individualCsvBtn);
  downloadControls.appendChild(imgBtn);
  downloadControls.appendChild(individualImgBtn);
  
  // results-container 앞에 삽입
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.parentNode.insertBefore(downloadControls, resultsContainer);
}

// 📊 CSV 다운로드
function downloadAsCSV(filteredDocs) {
  let csvContent = '';
  
  filteredDocs.forEach((doc, index) => {
    const user = allUsers.find(u => u.uid === doc.uid);
    const userName = user?.name || '알 수 없음';
    const dateTime = doc.createdAt.toLocaleString('ko-KR');
    
    // 헤더 행 추가
    if (index === 0) {
      if (doc.type === 'lessonPlayFeedback') {
        csvContent += '사용자,날짜/시간,화자,메시지,AI 피드백\n';
      } else {
        csvContent += '사용자,날짜/시간,화자,메시지\n';
      }
    }
    
    // 대화 내용을 CSV로 변환
    if (Array.isArray(doc.conversation)) {
      doc.conversation.forEach((entry, convIndex) => {
        const row = [
          `"${userName}"`,
          `"${dateTime}"`,
          `"${entry.speaker}"`,
          `"${entry.message.replace(/"/g, '""')}"`
        ];
        
        // 피드백이 있는 경우 첫 번째 행에만 피드백 추가
        if (doc.type === 'lessonPlayFeedback' && convIndex === 0) {
          row.push(`"${doc.feedback.replace(/"/g, '""')}"`);
        } else if (doc.type === 'lessonPlayFeedback') {
          row.push('""'); // 빈 피드백 열
        }
        
        csvContent += row.join(',') + '\n';
      });
    }
    
    // 문서 간 구분을 위한 빈 행 추가
    csvContent += '\n';
  });
  
  // UTF-8 BOM 추가 (한글 깨짐 방지)
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csvContent;
  
  // CSV 파일 다운로드
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `사용자_활동_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 📊 단일 문서 CSV 다운로드
function downloadSingleCSV(doc) {
  const user = allUsers.find(u => u.uid === doc.uid);
  const userName = user?.name || '알 수 없음';
  const dateTime = doc.createdAt.toLocaleString('ko-KR');
  
  let csvContent = '';
  
  // 헤더 행 추가
  if (doc.type === 'lessonPlayFeedback') {
    csvContent += '사용자,날짜/시간,화자,메시지,AI 피드백\n';
  } else {
    csvContent += '사용자,날짜/시간,화자,메시지\n';
  }
  
  // 대화 내용을 CSV로 변환
  if (Array.isArray(doc.conversation)) {
    doc.conversation.forEach((entry, convIndex) => {
      const row = [
        `"${userName}"`,
        `"${dateTime}"`,
        `"${entry.speaker}"`,
        `"${entry.message.replace(/"/g, '""')}"`
      ];
      
      // 피드백이 있는 경우 첫 번째 행에만 피드백 추가
      if (doc.type === 'lessonPlayFeedback' && convIndex === 0) {
        row.push(`"${doc.feedback.replace(/"/g, '""')}"`);
      } else if (doc.type === 'lessonPlayFeedback') {
        row.push('""'); // 빈 피드백 열
      }
      
      csvContent += row.join(',') + '\n';
    });
  }
  
  // UTF-8 BOM 추가 (한글 깨짐 방지)
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csvContent;
  
  // CSV 파일 다운로드
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${userName}_${dateTime.replace(/[/:]/g, '-')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 🖼️ 단일 문서 이미지 다운로드
async function downloadSingleImage(doc, card) {
  try {
    // 카드를 펼치기
    const content = card.querySelector('.result-content');
    if (content && !content.classList.contains('show')) {
      content.classList.add('show');
      const toggleIcon = card.querySelector('.result-toggle-icon');
      if (toggleIcon) {
        toggleIcon.textContent = '▲';
      }
    }
    
    // 잠시 대기하여 DOM 업데이트 완료
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // html2canvas를 사용하여 해당 카드만 이미지로 변환
    const canvas = await html2canvas(card, {
      backgroundColor: '#ffffff',
      scale: 2, // 고해상도
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0
    });
    
    // 이미지 다운로드
    const user = allUsers.find(u => u.uid === doc.uid);
    const userName = user?.name || '알 수 없음';
    const dateTime = doc.createdAt.toLocaleString('ko-KR');
    const link = document.createElement('a');
    link.download = `${userName}_${dateTime.replace(/[/:]/g, '-')}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    // 카드를 다시 접기
    if (content && content.classList.contains('show')) {
      content.classList.remove('show');
      const toggleIcon = card.querySelector('.result-toggle-icon');
      if (toggleIcon) {
        toggleIcon.textContent = '▼';
      }
    }
    
  } catch (error) {
    console.error('이미지 다운로드 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '다운로드 실패',
      text: '이미지 다운로드 중 오류가 발생했습니다.'
    });
  }
}

// 📊 모든 문서를 개별 CSV 파일로 다운로드
async function downloadAllAsIndividualCSV(filteredDocs) {
  try {
    // 진행 상황 표시
    const progressModal = Swal.fire({
      title: 'CSV 파일 생성 중...',
      html: `<div id="csv-progress">0 / ${filteredDocs.length} 파일 생성 완료</div>`,
      allowOutsideClick: false,
      showConfirmButton: false
    });
    
    const progressElement = document.getElementById('csv-progress');
    
    // 각 문서를 개별 CSV로 다운로드
    for (let i = 0; i < filteredDocs.length; i++) {
      const doc = filteredDocs[i];
      const user = allUsers.find(u => u.uid === doc.uid);
      const userName = user?.name || '알 수 없음';
      const dateTime = doc.createdAt.toLocaleString('ko-KR');
      
      let csvContent = '';
      
      // 헤더 행 추가
      if (doc.type === 'lessonPlayFeedback') {
        csvContent += '사용자,날짜/시간,화자,메시지,AI 피드백\n';
      } else {
        csvContent += '사용자,날짜/시간,화자,메시지\n';
      }
      
      // 대화 내용을 CSV로 변환
      if (Array.isArray(doc.conversation)) {
        doc.conversation.forEach((entry, convIndex) => {
          const row = [
            `"${userName}"`,
            `"${dateTime}"`,
            `"${entry.speaker}"`,
            `"${entry.message.replace(/"/g, '""')}"`
          ];
          
          // 피드백이 있는 경우 첫 번째 행에만 피드백 추가
          if (doc.type === 'lessonPlayFeedback' && convIndex === 0) {
            row.push(`"${doc.feedback.replace(/"/g, '""')}"`);
          } else if (doc.type === 'lessonPlayFeedback') {
            row.push('""'); // 빈 피드백 열
          }
          
          csvContent += row.join(',') + '\n';
        });
      }
      
      // UTF-8 BOM 추가 (한글 깨짐 방지)
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;
      
      // CSV 파일 다운로드
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${userName}_${dateTime.replace(/[/:]/g, '-')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 진행 상황 업데이트
      progressElement.textContent = `${i + 1} / ${filteredDocs.length} 파일 생성 완료`;
      
      // 브라우저가 너무 많은 다운로드를 처리할 수 있도록 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 완료 메시지
    progressModal.close();
    Swal.fire({
      icon: 'success',
      title: '다운로드 완료!',
      text: `${filteredDocs.length}개의 CSV 파일이 다운로드되었습니다.`,
      timer: 3000,
      showConfirmButton: false
    });
    
  } catch (error) {
    console.error('개별 CSV 다운로드 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '다운로드 실패',
      text: '개별 CSV 파일 다운로드 중 오류가 발생했습니다.'
    });
  }
}

// 🖼️ 모든 문서를 개별 이미지 파일로 다운로드
async function downloadAllAsIndividualImages(filteredDocs) {
  try {
    // 진행 상황 표시
    const progressModal = Swal.fire({
      title: '이미지 파일 생성 중...',
      html: `<div id="img-progress">0 / ${filteredDocs.length} 파일 생성 완료</div>`,
      allowOutsideClick: false,
      showConfirmButton: false
    });
    
    const progressElement = document.getElementById('img-progress');
    
    // 모든 카드를 펼치기
    const allCards = document.querySelectorAll('.result-card');
    allCards.forEach(card => {
      const content = card.querySelector('.result-content');
      if (content && !content.classList.contains('show')) {
        content.classList.add('show');
        const toggleIcon = card.querySelector('.result-toggle-icon');
        if (toggleIcon) {
          toggleIcon.textContent = '▲';
        }
      }
    });
    
    // 잠시 대기하여 DOM 업데이트 완료
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 각 문서를 개별 이미지로 다운로드
    for (let i = 0; i < filteredDocs.length; i++) {
      const doc = filteredDocs[i];
      const card = allCards[i];
      
      if (card) {
        const user = allUsers.find(u => u.uid === doc.uid);
        const userName = user?.name || '알 수 없음';
        const dateTime = doc.createdAt.toLocaleString('ko-KR');
        
        // html2canvas를 사용하여 해당 카드만 이미지로 변환
        const canvas = await html2canvas(card, {
          backgroundColor: '#ffffff',
          scale: 2, // 고해상도
          useCORS: true,
          allowTaint: true,
          scrollX: 0,
          scrollY: 0
        });
        
        // 이미지 다운로드
        const link = document.createElement('a');
        link.download = `${userName}_${dateTime.replace(/[/:]/g, '-')}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        // 진행 상황 업데이트
        progressElement.textContent = `${i + 1} / ${filteredDocs.length} 파일 생성 완료`;
        
        // 브라우저가 너무 많은 다운로드를 처리할 수 있도록 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // 모든 카드를 다시 접기
    allCards.forEach(card => {
      const content = card.querySelector('.result-content');
      if (content && content.classList.contains('show')) {
        content.classList.remove('show');
        const toggleIcon = card.querySelector('.result-toggle-icon');
        if (toggleIcon) {
          toggleIcon.textContent = '▼';
        }
      }
    });
    
    // 완료 메시지
    progressModal.close();
    Swal.fire({
      icon: 'success',
      title: '다운로드 완료!',
      text: `${filteredDocs.length}개의 이미지 파일이 다운로드되었습니다.`,
      timer: 3000,
      showConfirmButton: false
    });
    
  } catch (error) {
    console.error('개별 이미지 다운로드 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '다운로드 실패',
      text: '개별 이미지 파일 다운로드 중 오류가 발생했습니다.'
    });
  }
}

// 🖼️ 전체 이미지 다운로드
async function downloadAsImage(filteredDocs) {
  try {
    // 모든 카드를 펼치기
    const allCards = document.querySelectorAll('.result-card');
    allCards.forEach(card => {
      const content = card.querySelector('.result-content');
      if (content && !content.classList.contains('show')) {
        content.classList.add('show');
        const toggleIcon = card.querySelector('.result-toggle-icon');
        if (toggleIcon) {
          toggleIcon.textContent = '▲';
        }
      }
    });
    
    // 잠시 대기하여 DOM 업데이트 완료
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // html2canvas를 사용하여 전체 결과 영역을 이미지로 변환
    const resultsContainer = document.getElementById('results-container');
    const downloadControls = document.querySelector('.download-controls');
    
    // 다운로드 버튼을 임시로 숨김
    if (downloadControls) {
      downloadControls.style.display = 'none';
    }
    
    // 결과 컨테이너를 이미지로 변환
    const canvas = await html2canvas(resultsContainer, {
      backgroundColor: '#ffffff',
      scale: 2, // 고해상도
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0
    });
    
    // 다운로드 버튼 다시 표시
    if (downloadControls) {
      downloadControls.style.display = 'flex';
    }
    
    // 이미지 다운로드
    const link = document.createElement('a');
    link.download = `사용자_활동_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    // 모든 카드를 다시 접기
    allCards.forEach(card => {
      const content = card.querySelector('.result-content');
      if (content && content.classList.contains('show')) {
        content.classList.remove('show');
        const toggleIcon = card.querySelector('.result-toggle-icon');
        if (toggleIcon) {
          toggleIcon.textContent = '▼';
        }
      }
    });
    
  } catch (error) {
    console.error('이미지 다운로드 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '다운로드 실패',
      text: '이미지 다운로드 중 오류가 발생했습니다.'
    });
  }
}
