// API 기본 설정
const API_CONFIG = {
    BASE_URL: 'https://open.neis.go.kr/hub/mealServiceDietInfo',
    ATPT_OFCDC_SC_CODE: 'S10', // 시도교육청코드
    SD_SCHUL_CODE: '9091208',   // 표준학교코드
    TYPE: 'json'                // 응답 형식
};

// 급식 유형 매핑
const MEAL_TYPE_MAP = {
    '1': '조식',
    '2': '중식', 
    '3': '석식'
};

// 페이지 로드 시 오늘 날짜로 초기화
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    const dateInput = document.getElementById('meal-date');
    dateInput.value = formatDate(today);
    dateInput.max = formatDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)); // 30일 후까지
});

// 날짜 포맷팅 함수 (YYYY-MM-DD)
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 날짜를 YYYYMMDD 형식으로 변환
function formatDateForAPI(dateString) {
    return dateString.replace(/-/g, '');
}

// 날짜를 보기 좋은 형식으로 변환
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    
    return `${year}년 ${month}월 ${day}일 (${dayName})`;
}

// 급식정보 조회 함수
async function getMealInfo() {
    const dateInput = document.getElementById('meal-date');
    const selectedDate = dateInput.value;
    
    if (!selectedDate) {
        alert('날짜를 선택해주세요.');
        return;
    }
    
    // 로딩 상태 표시
    showLoading();
    
    try {
        const mealData = await fetchMealData(selectedDate);
        displayMealInfo(mealData, selectedDate);
    } catch (error) {
        console.error('급식정보 조회 중 오류 발생:', error);
        displayError(error.message);
    } finally {
        hideLoading();
    }
}

// API 호출 함수
async function fetchMealData(date) {
    const apiDate = formatDateForAPI(date);
    const url = `${API_CONFIG.BASE_URL}?Type=${API_CONFIG.TYPE}&ATPT_OFCDC_SC_CODE=${API_CONFIG.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${API_CONFIG.SD_SCHUL_CODE}&MLSV_YMD=${apiDate}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        // API 응답 구조 확인
        if (data.RESULT && data.RESULT.CODE !== 'INFO-000') {
            throw new Error(data.RESULT.MESSAGE || '데이터를 찾을 수 없습니다.');
        }
        
        return data.mealServiceDietInfo || null;
        
    } catch (error) {
        if (error.name === 'TypeError') {
            throw new Error('네트워크 연결을 확인해주세요.');
        }
        throw error;
    }
}

// 급식정보 화면 표시 함수
function displayMealInfo(mealData, selectedDate) {
    const mealInfoDiv = document.getElementById('meal-info');
    
    if (!mealData || !mealData[1] || !mealData[1].row || mealData[1].row.length === 0) {
        displayNoData(selectedDate);
        return;
    }
    
    const meals = mealData[1].row;
    const displayDate = formatDateForDisplay(selectedDate);
    
    let html = `
        <div class="meal-date">
            <h2>${displayDate}</h2>
            <p>급식 메뉴</p>
        </div>
        <div class="meal-content">
    `;
    
    // 급식 유형별로 그룹화
    const mealsByType = {};
    meals.forEach(meal => {
        const mealType = meal.MMEAL_SC_CODE;
        if (!mealsByType[mealType]) {
            mealsByType[mealType] = [];
        }
        mealsByType[mealType].push(meal);
    });
    
    // 각 급식 유형별로 표시
    Object.keys(mealsByType).sort().forEach(mealType => {
        const typeName = MEAL_TYPE_MAP[mealType] || `${mealType}식`;
        const mealsOfType = mealsByType[mealType];
        
        html += `
            <div class="meal-type">
                <h3>${typeName}</h3>
        `;
        
        mealsOfType.forEach(meal => {
            if (meal.DDISH_NM) {
                const menuItems = parseMealMenu(meal.DDISH_NM);
                html += `
                    <div class="meal-menu">
                        ${menuItems.map(item => `<span class="menu-item">${item}</span>`).join('')}
                    </div>
                `;
                
                // 칼로리 정보가 있으면 표시
                if (meal.CAL_INFO) {
                    html += `<p style="margin-top: 10px; color: #666; font-size: 0.9em;">칼로리: ${meal.CAL_INFO}</p>`;
                }
            }
        });
        
        html += `</div>`;
    });
    
    html += `</div>`;
    mealInfoDiv.innerHTML = html;
}

// 급식 메뉴 파싱 함수 (알레르기 정보 제거 및 메뉴 분리)
function parseMealMenu(menuString) {
    if (!menuString) return [];
    
    // HTML 태그 제거
    const cleanMenu = menuString.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
    
    // 줄바꿈으로 분리하고 각 항목 정리
    return cleanMenu.split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => {
            // 알레르기 정보 제거 (괄호 안의 숫자들)
            return item.replace(/\([0-9.,\s]*\)/g, '').trim();
        })
        .filter(item => item.length > 0);
}

// 데이터 없음 표시 함수
function displayNoData(selectedDate) {
    const mealInfoDiv = document.getElementById('meal-info');
    const displayDate = formatDateForDisplay(selectedDate);
    
    mealInfoDiv.innerHTML = `
        <div class="no-data">
            <h3>😔 급식정보 없음</h3>
            <p>${displayDate}에는 등록된 급식정보가 없습니다.</p>
            <p>주말이나 공휴일, 방학 기간일 수 있습니다.</p>
        </div>
    `;
}

// 오류 표시 함수
function displayError(errorMessage) {
    const mealInfoDiv = document.getElementById('meal-info');
    
    mealInfoDiv.innerHTML = `
        <div class="error">
            <h3>⚠️ 오류 발생</h3>
            <p>${errorMessage}</p>
            <p>잠시 후 다시 시도해주세요.</p>
        </div>
    `;
}

// 로딩 상태 표시
function showLoading() {
    const loadingDiv = document.getElementById('loading');
    const mealInfoDiv = document.getElementById('meal-info');
    
    loadingDiv.style.display = 'block';
    mealInfoDiv.style.display = 'none';
}

// 로딩 상태 숨김
function hideLoading() {
    const loadingDiv = document.getElementById('loading');
    const mealInfoDiv = document.getElementById('meal-info');
    
    loadingDiv.style.display = 'none';
    mealInfoDiv.style.display = 'block';
}

// 엔터키로 검색 가능하도록 이벤트 리스너 추가
document.getElementById('meal-date').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        getMealInfo();
    }
});

// 날짜 변경 시 자동 검색 (선택사항)
document.getElementById('meal-date').addEventListener('change', function() {
    // 원한다면 이 주석을 해제하여 날짜 선택 시 자동으로 검색되도록 할 수 있습니다
    // getMealInfo();
}); 