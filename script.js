/* script.js */
const statusMessages = [
    "JRA全レースデータを解析中...",
    "馬のテンションを測定中...",
    "鞍上の勝負気配を検知...",
    "運命のプロットを自動生成中...",
    "最終的な『態度』を決定しています..."
];

// ステップ1: venueSettingsを拡張
const venueSettings = {
    "東京": { max: 18, min: 18 },
    "中山": { max: 18, min: 18 },
    "京都": { max: 18, min: 18 }, // ← 追加
    "阪神": { max: 18, min: 18 },
    "中京": { max: 18, min: 18 },
    "小倉": { max: 18, min: 18 },
    "新潟": { max: 18, min: 18 },
    "福島": { max: 18, min: 18 },
    "函館": { max: 18, min: 18 },
    "札幌": { max: 18, min: 18 }
};

// 月ごとの主要開催競馬場
const monthlyVenues = {
    1: ['中山', '京都'],                    // 1月: 中山、京都
    2: ['東京', '京都', '小倉'],            // 2月: 東京、京都、小倉
    3: ['中山', '中京', '阪神'],            // 3月: 中山、中京、阪神
    4: ['東京', '福島'],                    // 4月: 東京、福島
    5: ['東京', '京都', '新潟'],            // 5月: 東京、京都、新潟
    6: ['東京', '阪神'],                    // 6月: 東京、阪神
    7: ['函館', '福島', '小倉'],            // 7月: 函館、福島、小倉
    8: ['札幌', '新潟', '小倉'],            // 8月: 札幌、新潟、小倉
    9: ['中山', '中京'],                    // 9月: 中山、中京
    10: ['東京', '京都', '新潟'],           // 10月: 東京、京都、新潟
    11: ['東京', '福島'],                   // 11月: 東京、福島
    12: ['中山', '中京', '阪神']            // 12月: 中山、中京、阪神
};

function getCurrentMonthVenues() {
    const currentMonth = new Date().getMonth() + 1; // 0-11 → 1-12
    return monthlyVenues[currentMonth] || ['東京', '中京', '小倉'];
}

// ステップ2: updateRaceListを修正（上記の完全修正版を使う）

// async function getVenuesFromICS() {
//   try {
//     const response = await fetch('jrarace2026.ics');
//     const icsText = await response.text();
    
//     const venues = [];
//     const lines = icsText.split('\n');
    
//     for (let i = 0; i < lines.length; i++) {
//       if (lines[i].startsWith('SUMMARY:')) {
//         const match = lines[i].match(/SUMMARY:(.+?)競馬/);
//         if (match) {
//           venues.push(match[1].trim());
//         }
//       }
//     }
    
//     // 重複除去して返す
//     return [...new Set(venues)];
//   } catch (error) {
//     console.log('ICS取得失敗、デフォルト値にフォールバック');
//     return ['東京', '中京', '小倉']; // フォールバック
//   }
// }

// async function loadVenuesFromLocalICS() {
//     try {
//         // ローカルのICSファイルを取得
//         const response = await fetch('/data/calendar.ics');
//         const icsText = await response.text();
        
//         // 今日の日付
//         const today = new Date().toISOString().replace(/-/g, '').slice(0, 8);
        
//         // パース
//         const venues = new Set();
//         const events = icsText.split('BEGIN:VEVENT');
        
//         for (const event of events) {
//             if (event.includes(`DTSTART:${today}`) && event.includes('競馬')) {
//                 const match = event.match(/SUMMARY:(.+?)競馬/);
//                 if (match) {
//                     venues.add(match[1].trim());
//                 }
//             }
//         }
        
//         return Array.from(venues);
//     } catch (error) {
//         console.log('ローカルICS読み込み失敗', error);
//         return null;
//     }
// }

// ローカル開発用のICS読み込み関数
async function loadLocalICS() {
    // ローカル開発中の回避策
    if (window.location.protocol === 'file:') {
        console.log('ローカルファイル環境のためICSスキップ');
        return null;
    }
    
    try {
        // GitHub Pagesやローカルサーバーではこれで動く
        const response = await fetch('data/jrarace2026.ics');
        if (!response.ok) throw new Error('Fetch failed');
        return await response.text();
    } catch (error) {
        console.log('ICS読み込み失敗:', error.message);
        return null;
    }
}

async function initVenueSelector() {
    const selector = document.getElementById('place-selector');
    const today = new Date();
    
    try {
        const response = await fetch('data/jrarace2026.ics');
        const icsText = await response.text();
        
        // 未来のグレードレースを検索...
        const futureRaces = findFutureGradeRaces(icsText, today);
        
        if (futureRaces.length > 0) {
            // グレードレースがある場合はそれを表示
            displayGradeRaces(selector, futureRaces);
        } else {
            // グレードレースがない場合 → 今月の通常開催を表示
            console.log('グレードレースなし、今月の通常開催を表示');
            
            // 動的に今月の開催場所得
            const currentVenues = getCurrentMonthVenues(); // ← ここが動的！
            
            let options = '<option value="">今月の通常開催を選択</option>';
            
            // 月と季節を表示
            const month = today.getMonth() + 1;
            const seasons = ['冬', '冬', '春', '春', '初夏', '初夏', 
                            '夏', '夏', '秋', '秋', '冬前', '冬前'];
            const season = seasons[month - 1];
            
            options += `<option value="" disabled>${month}月 (${season})の主な開催場</option>`;
            
            currentVenues.forEach(venue => {
                options += `<option value="${venue}">${venue}</option>`;
            });
            
            selector.innerHTML = options;
        }
        
    } catch (error) {
        console.log('エラー:', error);
        // エラー時も動的に
        const fallbackVenues = getCurrentMonthVenues();
        selector.innerHTML = `
            <option value="">${new Date().getMonth()+1}月の開催地</option>
            ${fallbackVenues.map(v => `<option value="${v}">${v}</option>`).join('')}
        `;
    }
    
    selector.onchange = updateRaceList;
}
// 日付表示用フォーマット
function formatDateForDisplay(dateStr) {
    const date = new Date(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8))
    );
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 次回開催までの日数計算
function calculateDaysUntil(dateStr) {
    const eventDate = new Date(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8))
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}
// ヘルパー関数
function parseDate(dateStr) {
    return new Date(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8))
    );
}

function getPrevDate(dateStr, daysBack) {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() - daysBack);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', initVenueSelector);
// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    initVenueSelector();
    
    // 既存の他の初期化もここに書く
    // updateRaceListの初期化など...
});

function spin() {
    const total = Number(document.getElementById('total').value);
    const place = document.getElementById('place-selector').value;
    const race = document.getElementById('race-selector').value;

    resetDisplay();

    if (!place || !race) {
        showError("⚠️ 開催地とレースを選んでください！");
        return;
    }

    runProgressAnimation(() => {
        showFinalResult(total);
    });
}

function resetDisplay() {
    const res = document.getElementById('result');
    const pContainer = document.getElementById('progress-container');
    const pBar = document.getElementById('progress-bar');
    res.innerText = "-";
    res.style.transform = "scale(0.5)";
    pContainer.style.display = "block";
    pBar.style.width = "0%";
}

function showError(message) {
    const res = document.getElementById('result');
    const sText = document.getElementById('status-text');
    res.innerText = "選択不能";
    res.style.fontSize = "1.5rem";
    res.style.color = "#555";
    res.style.textShadow = "none";
    sText.innerText = message;
}

function runProgressAnimation(callback) {
    const pBar = document.getElementById('progress-bar');
    const sText = document.getElementById('status-text');
    const tickMs = 50;
    const steps = [
        { pct: 20, msg: statusMessages[0], dur: 1000 },
        { pct: 40, msg: statusMessages[1], dur: 700 },
        { pct: 60, msg: statusMessages[2], dur: 500 },
        { pct: 80, msg: statusMessages[3], dur: 800 },
        { pct: 100, msg: statusMessages[4], dur: 1200 },
    ];

    let stepIndex = 0;
    let progress = 0;

    const runStep = () => {
        const step = steps[stepIndex];
        sText.innerText = step.msg;
        const start = progress;
        const delta = step.pct - start;
        const ticks = Math.max(1, Math.floor(step.dur / tickMs));
        let t = 0;

        let timer = setInterval(() => {
            t++;
            progress = start + delta * (t / ticks);
            pBar.style.width = progress.toFixed(1) + "%";
            if (t >= ticks) {
                clearInterval(timer);
                stepIndex++;
                if (stepIndex < steps.length) runStep();
                else callback();
            }
        }, tickMs);
    };
    runStep();
}

function showFinalResult(total) {
    const res = document.getElementById('result');
    const sText = document.getElementById('status-text');
    setTimeout(() => {
        const luckyNumber = Math.floor(Math.random() * total) + 1;
        res.innerText = luckyNumber;
        res.style.fontSize = ""; // CSSのclamp設定を優先させるために空にする
        res.style.color = "#fff200";
        res.style.transform = "scale(1.3) rotate(-5deg)";
        document.getElementById('progress-container').style.display = "none";
        sText.innerHTML = "<span style='color:#ffeb3b; font-weight:bold; font-size:1.5rem; text-shadow:0 0 10px #f00;'>【 確 定 】</span>";
        setTimeout(() => { res.style.transform = "scale(1.1) rotate(-5deg)"; }, 150);
    }, 400);
}

function updateRaceList() {
    const place = document.getElementById('place-selector').value;
    const raceSelector = document.getElementById('race-selector');
    raceSelector.innerHTML = '<option value="">レースを選択...</option>';
    if (venueSettings[place]) {
        for (let i = 1; i <= 12; i++) {
            // const horses = Math.floor(Math.random() * (venueSettings[place].max - venueSettings[place].min + 1)) + venueSettings[place].min;
            let opt = document.createElement('option');
            // opt.value = horses;
            opt.value = 16;
            opt.text = `${i}R${i === 11 ? " (メイン)" : ""}`;
            raceSelector.appendChild(opt);
        }
    }
}

function syncTotal() {
    document.getElementById('total').value = document.getElementById('race-selector').value;
}

function changeTotal(n) {
    const input = document.getElementById('total');
    let val = parseInt(input.value) + n;
    input.value = Math.min(18, Math.max(2, val));
}

/* script.js */

/**
 * 表示の初期化（エラーモードを解除する）
 */
function resetDisplay() {
    const res = document.getElementById('result');
    const pContainer = document.getElementById('progress-container');
    const pBar = document.getElementById('progress-bar');

    // エラークラスを外して元の巨大スタイルに戻す準備
    res.classList.remove('error-mode');
    
    res.innerText = "-";
    res.style.transform = "scale(0.5)"; 
    pContainer.style.display = "block";
    pBar.style.width = "0%";
}

/**
 * エラー表示（エラーモードを適用する）
 */
function showError(message) {
    const res = document.getElementById('result');
    const sText = document.getElementById('status-text');
    const pContainer = document.getElementById('progress-container');

    // エラー専用の控えめなクラスを付与
    res.classList.add('error-mode');
    
    res.innerText = "選択不能";
    sText.innerText = message;
    pContainer.style.display = "none";
}

// コンソールで実行して確認
async function testICS() {
    const res = await fetch('data/jrarace2026.ics');
    const text = await res.text();
    
    console.log('=== ICSファイル解析 ===');
    
    // LOCATION行だけ表示
    const locations = text.split('\n')
        .filter(line => line.startsWith('LOCATION:'))
        .map(line => line.replace('LOCATION:', '').trim());
    
    console.log('LOCATION一覧:', locations);
    
    // 抽出テスト
    locations.forEach(loc => {
        const venue = loc.replace('競馬場', '').trim();
        console.log(`${loc} → ${venue}`);
    });
}