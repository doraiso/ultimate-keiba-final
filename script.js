/* script.js */
const statusMessages = [
    "JRA全レースデータを解析中...",
    "馬のテンションを測定中...",
    "鞍上の勝負気配を検知...",
    "運命のプロットを自動生成中...",
    "最終的な『態度』を決定しています..."
];

const venueSettings = {
    "東京": { max: 18, min: 18 },
    "中山": { max: 18, min: 18 },
    "京都": { max: 18, min: 18 },
    "阪神": { max: 18, min: 18 },
    "中京": { max: 18, min: 18 },
    "小倉": { max: 18, min: 18 },
    "新潟": { max: 18, min: 18 },
    "福島": { max: 18, min: 18 },
    "函館": { max: 18, min: 18 },
    "札幌": { max: 18, min: 18 }
};

const monthlyVenues = {
    1: ['中山', '京都'],
    2: ['東京', '阪神', '小倉'],
    3: ['中山', '中京', '阪神'],
    4: ['東京', '福島'],
    5: ['東京', '京都', '新潟'],
    6: ['東京', '阪神'],
    7: ['函館', '福島', '小倉'],
    8: ['札幌', '新潟', '小倉'],
    9: ['中山', '中京'],
    10: ['東京', '京都', '新潟'],
    11: ['東京', '福島'],
    12: ['中山', '中京', '阪神']
};

function ymdJstParts(date) {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return { y, m, d, yyyymm: `${y}${m}` };
}

function venueFromRaceName(name) {
    // "2回小倉1日" -> "小倉"
    const s = String(name);
    const parts = s.split("回");
    const tail = (parts[1] ?? s);
    // "小倉1日" -> "小倉"（数字と「○日」を落とす）
    return tail.replace(/[0-9０-９]/g, "").replace(/日/g, "").trim();
}

async function getVenuesForDateFromJraJson(date) {
    const { yyyymm, d } = ymdJstParts(date);

    const res = await fetch(`data/jra/${yyyymm}.json`, { cache: "no-store" });
    if (!res.ok) return []; // まだファイルが無い等

    const json = await res.json();
    const dayNum = Number(d);

    const day = json?.[0]?.data?.find(x => Number(x.date) === dayNum);
    if (!day) return [];

    const races = day?.info?.[0]?.race ?? [];
    const venues = races
        .map(r => venueFromRaceName(r.name))
        .filter(v => v);

    return [...new Set(venues)];
}

async function getGradeRacesForDateFromJraJson(date) {
    const { yyyymm, d } = ymdJstParts(date);

    const res = await fetch(`data/jra/${yyyymm}.json`, { cache: "no-store" });
    if (!res.ok) return [];

    const json = await res.json();
    const day = json?.[0]?.data?.find(x => Number(x.date) === Number(d));
    if (!day) return [];

    const info0 = day?.info?.[0];
    const gradeRaces = info0?.gradeRace ?? [];
    const races = info0?.race ?? []; // A/B/C場情報

    // gradeRace: { name, detail, grade, pos } みたいなのが来る想定
    return gradeRaces.map(gr => {
        const pos = Number(gr.pos); // 1..3
        const venueNameRaw = races[pos - 1]?.name ?? "";
        const venue = venueNameRaw ? venueFromRaceName(venueNameRaw) : "";
        return {
            venue,
            name: gr.name || gr.detail || "",
            grade: gr.grade || "",
            date: toYmdJst(date), // ← 追加（YYYYMMDD）
        };
    }).filter(x => x.name);
}

async function getWeekendGradeRacesFromJraJson(base = new Date()) {
    const day = base.getDay();
    const sat = new Date(base);
    sat.setDate(base.getDate() + ((6 - day + 7) % 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    const [satGR, sunGR] = await Promise.all([
        getGradeRacesForDateFromJraJson(sat),
        getGradeRacesForDateFromJraJson(sun),
    ]);

    // 同じ重賞が重複しないように軽くユニーク化
    const key = (x) => `${x.venue}|${x.grade}|${x.name}|${x.date}`;
    const map = new Map();
    [...satGR, ...sunGR].forEach(x => map.set(key(x), x));
    return Array.from(map.values());
}

function getNextWeekendDates(base = new Date()) {
    const day = base.getDay(); // 0=Sun
    const sat = new Date(base);
    sat.setDate(base.getDate() + ((6 - day + 7) % 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    return { sat, sun };
}

function getSelectedDate() {
    const { sat, sun } = getNextWeekendDates(new Date());
    const v = document.querySelector('input[name="raceDay"]:checked')?.value || "sat";
    return v === "sun" ? sun : sat;
}

function getMainRacePivotDate(now = new Date()) {
    const { sat, sun } = getNextWeekendDates(now); // sat/sun は 0:00 で返ってくる :contentReference[oaicite:2]{index=2}

    // 土曜 16:00 を締切にする
    const satCutoff = new Date(sat);
    satCutoff.setHours(16, 0, 0, 0);

    // まだ土曜16:00より前なら土曜、以降は日曜
    return now.getTime() < satCutoff.getTime() ? sat : sun;
}


async function renderWeekendGradeRaces() {
    const list = await getWeekendGradeRacesFromJraJson(new Date());
    const el = document.querySelector("#weekendGradeRaces");
    if (!el) return;

    if (list.length === 0) {
        el.textContent = "今週末の重賞：なし";
        return;
    }

    // 例：中山 G2 弥生賞 / 阪神 G3 ○○
    el.textContent =
        "今週末の重賞： " +
        list.map(x => `${x.venue} ${x.grade} ${x.name}`).join(" / ");
}

// 週末表示用：土日を合算（片方だけ出る変則対策）
async function getWeekendVenuesFromJraJson(base = new Date()) {
    const day = base.getDay(); // 0=Sun..6=Sat
    const sat = new Date(base);
    sat.setDate(base.getDate() + ((6 - day + 7) % 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    const [vSat, vSun] = await Promise.all([
        getVenuesForDateFromJraJson(sat),
        getVenuesForDateFromJraJson(sun),
    ]);

    return [...new Set([...vSat, ...vSun])];
}

function getCurrentMonthVenues() {
    const currentMonth = new Date().getMonth() + 1;
    return monthlyVenues[currentMonth] || ['東京', '中京', '小倉'];
}


function toYmd(d) {
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('');
}

function toYmdJst(date) {
    const p = ymdJstParts(date);
    return `${p.y}${p.m}${p.d}`;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    d.setHours(0, 0, 0, 0);
    return d;
}

function pickRace(foundRaces, baseDateStr) {
    foundRaces.sort((a, b) => a.date.localeCompare(b.date));
    return foundRaces.find(r => r.date >= baseDateStr) || foundRaces[0] || null;
}

function isFutureOrToday(dateStr) {
    const eventDate = parseYmd(dateStr); // 00:00想定
    const now = new Date();

    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    // 今日の0:00
    const today0 = new Date(y, m, d, 0, 0, 0, 0);
    // 今日の締切（適当に16:00とか。好きに調整）
    const cutoff = new Date(y, m, d, 16, 0, 0, 0);

    // eventDateが今日より未来ならOK
    if (eventDate.getTime() > today0.getTime()) return true;

    // eventDateが今日なら、締切前だけOK
    if (eventDate.getTime() === today0.getTime()) return now.getTime() < cutoff.getTime();

    // それ以外（過去）はNG
    return false;
}

function calculateDaysUntilRaw(dateStr) {
    const eventDate = parseYmd(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 負も返す
}

// 表示用（今の仕様維持したいなら）
function calculateDaysUntil(dateStr) {
    return Math.max(0, calculateDaysUntilRaw(dateStr));
}


function nextDow(dow) { // 0=日 .. 6=土（今日を含む）
    const d = new Date();
    const diff = (dow - d.getDay() + 7) % 7; // 0なら今日
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

async function getMainRaceName(date = new Date()) {
    const races = await getWeekendGradeRacesFromJraJson(date);

    if (!races.length) return null;

    const priority = { G1: 1, G2: 2, G3: 3 };

    races.sort((a, b) => priority[a.grade] - priority[b.grade]);

    return races[0].name;
}

function updateSpinButtonState() {
    const place = document.getElementById('place-selector').value;
    const race = document.getElementById('race-selector').value;
    const button = document.querySelector('button[onclick="spin()"]');

    const enabled = place && race;

    button.disabled = !enabled;
    button.classList.toggle('disabled', !enabled);
}


function calculateDaysUntil(dateStr) {
    const eventDate = parseYmd(dateStr);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays); // 過去の場合は0
}

async function initVenueSelector() {
    const selector = document.getElementById('place-selector');
    const today = new Date();

    // まず venues を確定させる（JRA月別JSON → ICS → 月別）
    let venues;
    try {
        venues = await getWeekendVenuesFromJraJson(today); // ← これだけにする
        if (!venues || venues.length === 0) throw new Error("次の土日の開催地が0件");
    } catch (e1) {
        console.log('開催地JSON取得失敗。ICSにフォールバック:', e1);
        try {
            venues = await getWeekendVenuesFromJraJson(today); // ← これだけにする
        } catch (e2) {
            console.log('開催地ICS取得失敗。月別にフォールバック:', e2);
            venues = getCurrentMonthVenues();
        }
    }

    const month = today.getMonth() + 1;
    const season = ['冬', '冬', '春', '春', '初夏', '初夏', '夏', '夏', '秋', '秋', '冬前', '冬前'][month - 1];

    // let options = '';

    let options = '<option value="" selected>開催地を選択...</option>';
    options += `<option value="" disabled>${month}月 (${season})の開催場</option>`;
    venues.forEach(v => {
        options += `<option value="${v}">${v}</option>`;
    });

    selector.innerHTML = options;

    // 初期選択 + レース更新
    // if (venues.length > 0) {
    //     selector.value = venues[0];
    //     setTimeout(() => updateRaceList(venues[0]), 0);
    // }

    selector.onchange = function () {
        const selectedVenue = this.value;
        if (selectedVenue) {
            updateRaceList(selectedVenue);
        } else {
            document.getElementById('race-selector').innerHTML = '<option value="">先に開催地を選んでください</option>';
        }
    };

    // addTestButton がある時だけ呼ぶ（無ければ何もしない）
    if (typeof addTestButton === 'function') addTestButton();
}

async function getMainRaceInfoForVenue(venue, pivotDate = new Date()) {
    const races = await getWeekendGradeRacesFromJraJson(pivotDate); // Date前提で getDay() を呼ぶ :contentReference[oaicite:5]{index=5}
    const list = races.filter(r => r.venue === venue);

    if (list.length === 0) {
        return {
            name: "メインレース",
            grade: "",
            date: "",
            daysUntil: 0
        };
    }

    const preferred = toYmdJst(pivotDate);
    const priority = { G1: 1, G2: 2, G3: 3 };

    list.sort((a, b) => {
        const ad = String(a.date || "");
        const bd = String(b.date || "");

        // ① pivotDate と同じ日付を最優先
        const aPref = ad === preferred ? 0 : 1;
        const bPref = bd === preferred ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;

        // ② 同日内はグレード優先
        const pa = priority[a.grade] ?? 99;
        const pb = priority[b.grade] ?? 99;
        if (pa !== pb) return pa - pb;

        // ③ 同条件なら日付→名前
        const cmp = ad.localeCompare(bd);
        if (cmp !== 0) return cmp;
        return String(a.name).localeCompare(String(b.name));
    });

    const main = list[0];
    return {
        name: main.name,
        grade: main.grade,
        date: main.date,
        daysUntil: calculateDaysUntil(main.date),
    };
}

async function updateRaceList(place) {
    const raceSelector = document.getElementById('race-selector');

    if (!place) {
        raceSelector.innerHTML = '<option value="">先に開催地を選んでください</option>';
        return;
    }

    raceSelector.innerHTML = '<option value="">レースを読み込み中...</option>';

    try {
        //const raceInfo = await getMainRaceName(place);
        const pivotDate = getMainRacePivotDate(new Date());
        const raceInfo = await getMainRaceInfoForVenue(place, pivotDate);

        raceSelector.innerHTML = '<option value="">レースを選択...</option>';

        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = String(i);

            if (i === 11 && raceInfo) {
                const daysText = raceInfo.daysUntil > 0 ? ` (あと${raceInfo.daysUntil}日)` : ` (今日開催)`;
                const gradeText = raceInfo.grade ? ` [${raceInfo.grade}]` : '';
                const g = (raceInfo.grade || "")
                    .replace(/[Ｇ]/g, "G")
                    .replace(/[Ⅰ]/g, "I")
                    .replace(/[Ⅱ]/g, "II")
                    .replace(/[Ⅲ]/g, "III")
                    .replace(/G1/g, "GI")
                    .replace(/G2/g, "GII")
                    .replace(/G3/g, "GIII");

                if (g === "GI") option.style.color = "#d4af37";
                else if (g === "GII") option.style.color = "#c0c0c0";
                else if (g === "GIII") option.style.color = "#cd7f32";

                option.text = `11R 🏆 ${raceInfo.name}${gradeText}${daysText}`;
                option.dataset.isMain = 'true';
                option.dataset.raceName = raceInfo.name;
                option.dataset.raceDate = raceInfo.date;
                option.dataset.grade = raceInfo.grade || 'G?';
            } else {
                option.text = `${i}R`;
                option.dataset.isMain = 'false';
            }

            raceSelector.appendChild(option);
        }
    } catch (error) {
        console.log('レースリスト更新エラー:', error);

        raceSelector.innerHTML = '<option value="">レースを選択...</option>';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = String(i);
            option.text = `${i}R${i === 11 ? ' メインレース' : ''}`;
            option.dataset.isMain = i === 11 ? 'true' : 'false';
            raceSelector.appendChild(option);
        }
    }
}


function spin() {
    const total = Number(document.getElementById('total').value);
    const place = document.getElementById('place-selector').value;
    const raceSelect = document.getElementById('race-selector');
    const race = raceSelect.value;

    if (!place || !race) {
        resetDisplay();
        showError("⚠️ 開催地とレースを選んでください！");
        return;
    }

    const selectedOption = raceSelect.options[raceSelect.selectedIndex];
    const isMainRace = selectedOption.dataset.isMain === 'true';
    const mainRaceName = selectedOption.dataset.raceName || "メインレース";
    const grade = selectedOption.dataset.grade || "G?";

    resetDisplay();

    runProgressAnimation(() => {
        showFinalResult(total, isMainRace, mainRaceName, grade);
    });
}


function resetDisplay() {
    const res = document.getElementById('result');
    const pContainer = document.getElementById('progress-container');
    const pBar = document.getElementById('progress-bar');
    const glow = document.querySelector('.result-glow');

    res.classList.remove('error-mode');
    res.innerText = "-";
    res.style.transform = "scale(0.5)";
    res.style.color = "";
    res.style.textShadow = "";
    res.style.fontSize = "";

    pContainer.style.display = "block";
    pBar.style.width = "0%";

    // 追加：初期は光らせない
    if (glow) glow.classList.remove('active');
    res.classList.remove('result-normal');
    res.classList.remove('result-grade');

}


function showError(message) {
    const res = document.getElementById('result');
    const sText = document.getElementById('status-text');
    const pContainer = document.getElementById('progress-container');

    res.classList.add('error-mode');
    res.innerText = "選択不能";
    res.style.fontSize = "1.5rem";
    res.style.color = "#555";
    res.style.textShadow = "none";
    sText.innerText = message;
    pContainer.style.display = "none";
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

function showFinalResult(total, isMainRace, mainRaceName, grade = "G?") {
    const res = document.getElementById('result');
    const sText = document.getElementById('status-text');
    const glow = document.querySelector('.result-glow');

    setTimeout(() => {
        const luckyNumber = Math.floor(Math.random() * total) + 1;
        res.innerText = luckyNumber;

        // 見た目はCSSクラスに統一
        res.classList.remove('result-normal');
        res.classList.remove('result-grade');

        if (isMainRace) {
            res.classList.add('result-grade');   // 赤
        } else {
            res.classList.add('result-normal');  // 黄
        }


        if (glow) glow.classList.add('active');

        if (isMainRace) {
            sText.innerHTML = `
        <div style="color:#ff4757; font-weight:bold; font-size:1.2rem; margin-bottom:5px;">
          🏆 ${mainRaceName} 🏆
        </div>
        <span style="color:#ff4757; font-weight:bold; font-size:1.5rem;">
          【 ${grade} 勝 利 馬 番 】
        </span>
      `;
            setTimeout(() => { res.style.transform = "scale(1.5) rotate(-8deg)"; }, 100);
        } else {
            sText.innerHTML = "<span style='color:#ffeb3b; font-weight:bold; font-size:1.5rem; text-shadow:0 0 10px #f00;'>【 確 定 】</span>";
        }

        res.style.transform = "scale(1.3) rotate(-5deg)";
        document.getElementById('progress-container').style.display = "none";

        setTimeout(() => { res.style.transform = "scale(1.1) rotate(-5deg)"; }, 150);
    }, 400);
}


function syncTotal() {
    // document.getElementById('total').value = document.getElementById('race-selector').value;
}

function changeTotal(n) {
    const input = document.getElementById('total');
    let val = parseInt(input.value) + n;
    input.value = Math.min(18, Math.max(2, val));
}

async function debugCurrentDate() {
    const today = new Date();
    console.log('=== 現在の日付情報 ===');
    console.log(`日付オブジェクト: ${today}`);
    console.log(`getFullYear(): ${today.getFullYear()}`);
    console.log(`getMonth(): ${today.getMonth()} (0-11)`);
    console.log(`getMonth()+1: ${today.getMonth() + 1}`);
    console.log(`フォーマット後: ${String(today.getMonth() + 1).padStart(2, '0')}`);
    console.log(`完全な日付: ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`);
}

// 実行
debugCurrentDate();


function normalizeDate(dateStr) {
    // 様々なフォーマットをYYYYMMDDに統一
    if (!dateStr) return null;

    // YYYYMMDD形式
    if (/^\d{8}$/.test(dateStr)) {
        return dateStr;
    }

    // YYYY-MM-DD形式
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr.replace(/-/g, '');
    }

    // その他はそのまま返す（解析できない）
    console.warn(`不明な日付フォーマット: ${dateStr}`);
    return dateStr;
}

function extractYearMonth(dateStr) {
    const normalized = normalizeDate(dateStr);
    if (!normalized || normalized.length < 6) return { year: null, month: null };

    return {
        year: normalized.substring(0, 4),
        month: normalized.substring(4, 6)
    };
}

// ページ読み込み時に現在の日付をチェック
function testCurrentDate() {
    const now = new Date();
    console.log('=== 現在のシステム日付 ===');
    console.log(`new Date(): ${now}`);
    console.log(`toISOString(): ${now.toISOString()}`);
    console.log(`toLocaleString('ja-JP'): ${now.toLocaleString('ja-JP')}`);
    console.log(`getFullYear(): ${now.getFullYear()}`);
    console.log(`getMonth(): ${now.getMonth()} (0=1月, 1=2月, ...)`);
    console.log(`実際の月: ${now.getMonth() + 1}月`);

    // HTMLにも表示
    const debugDiv = document.createElement('div');
    debugDiv.style.cssText = 'position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:white; padding:10px; z-index:9999; font-size:12px;';
    // debugDiv.innerHTML = `
    //     <strong>デバッグ情報</strong><br>
    //     現在日付: ${now.toLocaleDateString('ja-JP')}<br>
    //     月: ${now.getMonth() + 1}月<br>
    //     getMonth(): ${now.getMonth()}
    // `;
    document.body.appendChild(debugDiv);
}

// 実行
testCurrentDate();

function extractRaceNameFromSummary(summary, venue) {
    // 元の文字列を保持
    console.log(`抽出開始: "${summary}" (開催地: ${venue})`);

    let raceName = summary;

    // 1. 開催地名を除去（複数パターン）
    const venuePatterns = [
        `${venue}競馬`,
        `${venue}競馬場`,
        `${venue} `,
        ` ${venue}`,
        venue,
    ];

    venuePatterns.forEach(pattern => {
        const old = raceName;
        raceName = raceName.replace(/\(.*?\)/g, '').trim();;
        if (old !== raceName) {
            console.log(`  開催地除去 "${pattern}": "${old}" → "${raceName}"`);
        }
    });

    // 2. グレード表記の処理（よりスマートに）
    // 例: "G1 天皇賞(秋)" → "天皇賞(秋)"
    // 例: "東京競馬 東京新聞杯 (GIII)" → "東京新聞杯"
    raceName = raceName
        .replace(/^(G[Ⅰ-Ⅲ1-3]|GI{1,3}|GRADE\s*\d)\s+/, '')  // 先頭のグレード表記
        .replace(/\s+\((G[Ⅰ-Ⅲ1-3]|GI{1,3})\)/, '')          // 末尾の (GIII) 形式
        .replace(/\s+G[Ⅰ-Ⅲ1-3]\s*$/, '')                    // 末尾の GIII 形式
        .replace(/\s+GRADE\s*\d\s*$/, '');                  // 末尾の GRADE 形式

    // 3. 不要な語句を除去
    const removePatterns = [
        '競馬',
        'レース',
        'JRA',
        'ダート',
        '芝',
        'メインレース',
        '特別'
    ];

    removePatterns.forEach(pattern => {
        raceName = raceName.replace(new RegExp(pattern, 'g'), '');
    });

    // 4. 括弧の処理（より注意深く）
    // まず、括弧内がグレード表記だけの場合を除去
    raceName = raceName.replace(/\s*\((G[Ⅰ-Ⅲ1-3]|GI{1,3})\)/, '');

    // それ以外の括弧は保持（例: "天皇賞(秋)"）
    // ただし、余分な空白や記号は整理
    raceName = raceName
        .replace(/\s+/g, ' ')           // 連続する空白を1つに
        .replace(/^\s+|\s+$/g, '')      // 前後の空白を除去
        .replace(/[　]+/g, ' ')         // 全角スペースを半角に
        .replace(/^[:\-\s]+|[:\-\s]+$/g, ''); // 前後の記号を除去

    console.log(`抽出結果: "${raceName}"`);
    return raceName;
}

// ICSの実際のフォーマットを分析
function analyzeICSFormat(icsText, venue) {
    const events = icsText.split('BEGIN:VEVENT');
    const venueEvents = [];

    events.forEach((event, index) => {
        const summaryMatch = event.match(/SUMMARY[^:]*:(.+?)(?:\r?\n|$)/);
        if (summaryMatch) {
            const summary = summaryMatch[1].trim();
            if (summary.includes(venue)) {
                venueEvents.push({
                    index,
                    summary,
                    raw: summary
                });
            }
        }
    });

    console.log(`=== ${venue}のICSサマリー分析 ===`);
    venueEvents.slice(0, 5).forEach((item, i) => {
        console.log(`${i + 1}. ${item.summary}`);
    });

    return venueEvents;
}

function extractRaceNameSmart(summary, venue) {
    console.log(`スマート抽出開始: "${summary}" (開催地: ${venue})`);

    // パターン1: "東京競馬 東京新聞杯 (GIII)" のような形式
    const pattern1 = new RegExp(`${venue}競馬\\s+(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?$`, 'i');

    // パターン2: "東京 東京新聞杯 (GIII)" 
    const pattern2 = new RegExp(`${venue}\\s+(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?$`, 'i');

    // パターン3: "東京新聞杯 (GIII)"（開催地名から直接始まる）
    const pattern3 = new RegExp(`${venue}(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?$`, 'i');

    // パターン4: "東京競馬 フェブラリーステークス (G1)"
    const pattern4 = /競馬\s+(.+?)(?:\s*\(G[Ⅰ-Ⅲ1-3]\))?$/;

    // パターン5: "東京新聞杯(GIII) 東京競馬" のような順番
    const pattern5 = new RegExp(`(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?\\s+${venue}競馬$`, 'i');

    const patterns = [pattern1, pattern2, pattern3, pattern4, pattern5];

    for (let i = 0; i < patterns.length; i++) {
        const match = summary.match(patterns[i]);
        if (match && match[1]) {
            let extracted = match[1].trim();
            console.log(`  パターン${i + 1}マッチ: "${extracted}"`);

            // 余分な空白や記号を除去
            extracted = cleanRaceName(extracted);
            return extracted;
        }
    }

    console.log('  パターンマッチせず、フォールバック処理');

    // フォールバック：安全な開催地除去
    let result = removeVenueNameSafely(summary, venue);

    // グレード表記を除去
    result = result
        .replace(/\s*\(G[Ⅰ-Ⅲ1-3]\)/g, '')      // (GIII) を除去
        .replace(/\s+G[Ⅰ-Ⅲ1-3]\s*$/g, '')      // 末尾の GIII を除去
        .replace(/競馬/g, '')                   // 競馬を除去
        .replace(/\s+/g, ' ')                   // 連続する空白を1つに
        .replace(/^\s+|\s+$/g, '')              // 前後の空白を除去
        .replace(/^[:\-\s]+|[:\-\s]+$/g, '');   // 前後の記号を除去

    result = cleanRaceName(result);
    console.log(`  フォールバック結果: "${result}"`);
    return result;
}

function cleanRaceName(name) {
    return name
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .replace(/^[「"『]|[」"』]$/g, '')  // 引用符を除去
        .replace(/^[:\-\.]\s*|\s*[:\-\.]$/g, ''); // 前後の記号を除去
}

function extractRaceNameForKnownPatterns(summary, venue) {
    console.log(`既知パターン抽出: "${summary}"`);

    // よくあるパターンのマッピング
    const knownPatterns = [
        // 東京関連
        {
            pattern: /東京競馬\s+東京新聞杯\s*\(GIII\)/i,
            extract: "東京新聞杯"
        },
        {
            pattern: /東京\s+フェブラリーステークス\s*\(G1\)/i,
            extract: "フェブラリーステークス"
        },
        {
            pattern: /東京\s+天皇賞\(秋\)\s*\(G1\)/i,
            extract: "天皇賞(秋)"
        },
        {
            pattern: /東京\s+ジャパンカップ\s*\(G1\)/i,
            extract: "ジャパンカップ"
        },

        // 中山関連
        {
            pattern: /中山競馬\s+中山記念\s*\(GII\)/i,
            extract: "中山記念"
        },
        {
            pattern: /中山\s+皐月賞\s*\(G1\)/i,
            extract: "皐月賞"
        },

        // 京都関連
        {
            pattern: /京都競馬\s+桜花賞\s*\(G1\)/i,
            extract: "桜花賞"
        },
        {
            pattern: /京都\s+菊花賞\s*\(G1\)/i,
            extract: "菊花賞"
        },

        // 阪神関連
        {
            pattern: /阪神競馬\s+宝塚記念\s*\(G1\)/i,
            extract: "宝塚記念"
        },
        {
            pattern: /阪神\s+大阪杯\s*\(GII\)/i,
            extract: "大阪杯"
        }
    ];

    for (const known of knownPatterns) {
        if (known.pattern.test(summary)) {
            console.log(`  既知パターンマッチ: "${known.extract}"`);
            return known.extract;
        }
    }

    return null;
}

function extractRaceNameIntelligent(summary, venue) {
    console.log(`インテリジェント抽出: "${summary}" (開催地: ${venue})`);

    // 1. 既知のパターンから抽出
    const knownPatterns = [
        { pattern: /東京競馬\s+東京新聞杯\s*\(GIII\)/i, extract: "東京新聞杯" },
        { pattern: /東京\s+フェブラリーステークス\s*\(G1\)/i, extract: "フェブラリーステークス" },
        { pattern: /東京\s+天皇賞\(秋\)\s*\(G1\)/i, extract: "天皇賞(秋)" },
        { pattern: /東京\s+ジャパンカップ\s*\(G1\)/i, extract: "ジャパンカップ" },
        { pattern: /中山競馬\s+中山記念\s*\(GII\)/i, extract: "中山記念" },
        { pattern: /中山\s+皐月賞\s*\(G1\)/i, extract: "皐月賞" },
        { pattern: /京都競馬\s+桜花賞\s*\(G1\)/i, extract: "桜花賞" },
        { pattern: /京都\s+菊花賞\s*\(G1\)/i, extract: "菊花賞" },
        { pattern: /阪神競馬\s+宝塚記念\s*\(G1\)/i, extract: "宝塚記念" },
        { pattern: /阪神\s+大阪杯\s*\(GII\)/i, extract: "大阪杯" }
    ];

    for (const known of knownPatterns) {
        if (known.pattern.test(summary)) {
            console.log(`  既知パターンマッチ: "${known.extract}"`);
            return known.extract;
        }
    }

    // 2. 改善されたパターン
    const patterns = [
        // パターン1: "東京競馬 東京新聞杯 (GIII)"
        new RegExp(`${venue}競馬\\s+(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?$`, 'i'),

        // パターン2: "東京 東京新聞杯 (GIII)" - 開催地とレース名の間に空白
        new RegExp(`${venue}\\s+(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?$`, 'i'),

        // パターン3: "東京新聞杯 (GIII)" - 開催地名がレース名の一部の場合
        // 注意: このパターンは「東京新聞杯」のようなレース名の場合に誤動作する
        // new RegExp(`${venue}(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?$`, 'i'), // ← 問題のあるパターン

        // パターン4: "競馬 フェブラリーステークス (G1)"
        /競馬\s+(.+?)(?:\s*\(G[Ⅰ-Ⅲ1-3]\))?$/,

        // パターン5: "東京新聞杯(GIII) 東京競馬"
        new RegExp(`(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?\\s+${venue}競馬$`, 'i'),

        // パターン6: "東京新聞杯 (GIII) 東京競馬"
        new RegExp(`(.+?)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?\\s+${venue}競馬$`, 'i'),

        // パターン7: 開催地名で始まり、その後にレース名が続くが、開催地名がレース名の一部の場合の特別処理
        new RegExp(`(${venue}[^\\s(]+)(?:\\s*\\(G[Ⅰ-Ⅲ1-3]\\))?`, 'i')
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = summary.match(patterns[i]);
        if (match && match[1]) {
            let extracted = match[1].trim();
            console.log(`  パターン${i + 1}マッチ: "${extracted}"`);

            // クリーンアップ
            extracted = cleanRaceName(extracted, venue);

            // 抽出結果が開催地のみ（例: "東京"）の場合や短すぎる場合はスキップ
            if (extracted === venue || extracted.length < 2) {
                console.log(`  抽出結果が不適切: "${extracted}"、次のパターンを試します`);
                continue;
            }

            return extracted;
        }
    }

    // 3. キーワード抽出
    console.log('  パターンマッチせず、キーワード抽出を試みる');
    const raceName = extractRaceNameByKeywords(summary, venue);

    return raceName;
}

function cleanRaceName(name, venue) {
    let cleaned = name
        .replace(/\s*\(G[Ⅰ-Ⅲ1-3]\)/g, '')      // (GIII) を除去
        .replace(/\s+G[Ⅰ-Ⅲ1-3]\s*$/g, '')      // 末尾の GIII を除去
        .replace(/競馬/g, '')                   // 競馬を除去
        .replace(/\s+/g, ' ')                   // 連続する空白を1つに
        .replace(/^\s+|\s+$/g, '')              // 前後の空白を除去
        .replace(/^[:\-\s]+|[:\-\s]+$/g, '');   // 前後の記号を除去

    // 開催地名が先頭にある場合は保持（例: "東京新聞杯"）
    // ただし、開催地名のみの場合は除去
    if (cleaned.startsWith(venue) && cleaned !== venue) {
        // "東京新聞杯" はそのまま保持
        console.log(`  開催地名がレース名の一部として保持: "${cleaned}"`);
    } else if (cleaned.includes(venue + ' ') || cleaned.includes(' ' + venue)) {
        // 開催地名が単独で含まれる場合は除去
        cleaned = cleaned.replace(new RegExp(`\\b${venue}\\b`, 'g'), '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    return cleaned;
}

function extractRaceNameByKeywords(summary, venue) {
    const keywords = [
        'ステークス', '記念', 'カップ', '賞', '杯', 'ハンデキャップ',
        'クラシック', 'グランプリ', 'プレート', 'タイトル'
    ];

    // 単語に分割
    const words = summary.split(/\s+/);

    // キーワードを含む単語を探す
    for (const word of words) {
        if (word === venue || word === '競馬' || word === '競馬場') {
            continue;
        }

        for (const keyword of keywords) {
            if (word.includes(keyword)) {
                let cleaned = word
                    .replace(/\(G[Ⅰ-Ⅲ1-3]\)/g, '')
                    .replace(/\(.*\)/g, '');

                // 開催地名がレース名の一部かチェック
                if (word.includes(venue) && word !== venue) {
                    // "東京新聞杯" のようなパターン
                    console.log(`  キーワード抽出（開催地名含む）: "${word}" -> "${cleaned}"`);
                    return cleaned;
                }

                console.log(`  キーワード抽出: "${cleaned}"`);
                return cleaned;
            }
        }
    }

    // 最も長い単語を探す
    let longestWord = '';
    for (const word of words) {
        if (word.length > longestWord.length &&
            !word.includes('G') &&
            word !== venue &&
            word !== '競馬' &&
            word !== '競馬場') {
            longestWord = word;
        }
    }

    if (longestWord) {
        const cleaned = longestWord.replace(/\(.*\)/g, '');
        console.log(`  最長単語抽出: "${cleaned}"`);
        return cleaned;
    }

    // 完全フォールバック
    console.log(`  完全フォールバック: "${summary}"`);
    return summary.replace(venue, '').replace('競馬', '').trim();
}

function extractRaceNameKeywords(summary, venue) {
    // サマリーからレース名らしい部分を抽出
    const keywords = [
        'ステークス', '記念', 'カップ', '賞', '杯', 'ハンデキャップ',
        'クラシック', 'グランプリ', 'プレート', 'タイトル'
    ];

    // 単語に分割
    const words = summary.split(/\s+/);

    // キーワードを含む単語を探す
    for (const word of words) {
        // 開催地名はスキップ
        if (word.includes(venue) || word === '競馬' || word === '競馬場') {
            continue;
        }

        // キーワードを含むかチェック
        for (const keyword of keywords) {
            if (word.includes(keyword)) {
                // 括弧内のグレード表記を除去
                let cleaned = word.replace(/\(G[Ⅰ-Ⅲ1-3]\)/g, '');
                cleaned = cleaned.replace(/\(.*\)/g, '');
                console.log(`  キーワード抽出: "${cleaned}"`);
                return cleaned;
            }
        }
    }

    // キーワードが見つからない場合は最後の意味ありそうな単語
    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        if (word.length > 1 &&
            !word.includes(venue) &&
            !/^G[Ⅰ-Ⅲ1-3]$/.test(word) &&
            word !== '競馬' &&
            word !== '競馬場') {

            const cleaned = word.replace(/\(.*\)/g, '');
            console.log(`  最後の単語抽出: "${cleaned}"`);
            return cleaned;
        }
    }

    console.log(`  完全フォールバック: "${summary}"`);
    return summary;
}

function testRaceNameExtraction() {
    const testCases = [
        { input: "東京競馬 東京新聞杯 (GIII)", venue: "東京", expected: "東京新聞杯" },
        { input: "東京 G1 天皇賞(秋)", venue: "東京", expected: "天皇賞(秋)" },
        { input: "中山競馬 中山記念 (GII)", venue: "中山", expected: "中山記念" },
        { input: "京都 桜花賞 G1", venue: "京都", expected: "桜花賞" },
        { input: "阪神競馬 宝塚記念 (GI)", venue: "阪神", expected: "宝塚記念" },
    ];

    console.log('=== レース名抽出テスト ===');
    testCases.forEach((test, i) => {
        console.log(`\nテスト ${i + 1}:`);
        console.log(`  入力: "${test.input}"`);
        console.log(`  開催地: ${test.venue}`);
        const result = extractRaceNameSmart(test.input, test.venue);
        console.log(`  結果: "${result}"`);
        console.log(`  期待: "${test.expected}"`);
        console.log(`  一致: ${result === test.expected ? '✓' : '✗'}`);
    });
}



// 実行
testRaceNameExtraction();


function testExtraction() {
    const testCases = [
        { input: "東京競馬 東京新聞杯 (GIII)", venue: "東京", expected: "東京新聞杯" },
        { input: "東京 フェブラリーステークス (G1)", venue: "東京", expected: "フェブラリーステークス" },
        { input: "東京新聞杯 (GIII)", venue: "東京", expected: "東京新聞杯" },
        { input: "東京競馬 中山記念 (GII)", venue: "東京", expected: "中山記念" }, // 別開催地のレース
        { input: "京都競馬 桜花賞 G1", venue: "京都", expected: "桜花賞" },
        { input: "阪神競馬 宝塚記念 (GI)", venue: "阪神", expected: "宝塚記念" },
    ];

    console.log('=== レース名抽出完全テスト ===');
    testCases.forEach((test, i) => {
        console.log(`\nテスト ${i + 1}:`);
        console.log(`  入力: "${test.input}"`);
        console.log(`  開催地: ${test.venue}`);
        const result = extractRaceNameIntelligent(test.input, test.venue);
        console.log(`  結果: "${result}"`);
        console.log(`  期待: "${test.expected}"`);
        console.log(`  一致: ${result === test.expected ? '✓' : '✗'}`);

        if (result !== test.expected) {
            console.log(`  差分分析:`);
            console.log(`    結果長さ: ${result.length}`);
            console.log(`    期待長さ: ${test.expected.length}`);
        }
    });
}

// 実行
testExtraction();

function isFutureOrToday(dateStr) {
    const eventDate = parseYmd(dateStr);
    const now = new Date();

    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0);

    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() > today0.getTime()) return true;
    if (eventDate.getTime() === today0.getTime()) return now.getTime() < cutoff.getTime();
    return false;
}


function parseYmd(dateStr) {
    // YYYYMMDD形式をDateオブジェクトに変換
    if (!dateStr || dateStr.length !== 8) return new Date();

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-based
    const day = parseInt(dateStr.substring(6, 8));

    return new Date(year, month, day);
}



// レース情報を詳細に表示
function displayRaceDebugInfo(raceInfo) {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'race-debug-info';
    debugDiv.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        font-size: 12px;
        z-index: 9999;
        max-width: 300px;
        border-radius: 5px;
    `;

    debugDiv.innerHTML = `
        <strong>レース情報デバッグ</strong><br>
        開催地: ${document.getElementById('place-selector').value}<br>
        レース名: ${raceInfo.name}<br>
        開催日: ${raceInfo.date}<br>
        開催まで: ${raceInfo.daysUntil}日<br>
        現在時刻: ${new Date().toLocaleString('ja-JP')}
    `;

    // 既存のデバッグ情報があれば削除
    const existing = document.getElementById('race-debug-info');
    if (existing) existing.remove();

    document.body.appendChild(debugDiv);
}

function isGradeRace(event, summary) {
    // G表記のチェック（より包括的に）
    const hasGradeNotation =
        event.includes('G1') || event.includes('GI') ||
        event.includes('G2') || event.includes('GII') ||
        event.includes('G3') || event.includes('GIII') ||
        event.includes('GRADE1') || event.includes('GRADE2') || event.includes('GRADE3') ||
        summary.includes('(G1)') || summary.includes('(GI)') ||
        summary.includes('(GII)') || summary.includes('(GIII)') ||
        summary.includes('（G1）') || summary.includes('（GI）') ||
        summary.includes('（GII）') || summary.includes('（GIII）');

    // 主要なレース名パターン
    const isMajorRace =
        summary.includes('ステークス') ||
        summary.includes('記念') ||
        summary.includes('カップ') ||
        summary.includes('賞') ||
        summary.includes('杯') ||
        summary.includes('ハンデキャップ');

    // グレード表記があるか、主要なレース名パターンがある場合
    return hasGradeNotation || isMajorRace;
}

function removeVenueNameSafely(text, venue) {
    console.log(`開催地除去前: "${text}"`);

    // まず、完全一致で開催地を除去するパターン
    const patterns = [
        // パターン1: "東京競馬 " の形式
        new RegExp(`${venue}競馬\\s+`, 'gi'),

        // パターン2: "東京 " の形式（単独の開催地）
        new RegExp(`^${venue}\\s+`, 'gi'),
        new RegExp(`\\s+${venue}\\s+`, 'gi'),

        // パターン3: "東京競馬場" の形式
        new RegExp(`${venue}競馬場`, 'gi'),

        // パターン4: 開催地名で始まり、その後が空白か終端の場合
        new RegExp(`^${venue}(?:\\s+|$)`, 'gi'),
    ];

    let result = text;
    let changed = false;

    patterns.forEach((pattern, index) => {
        const before = result;
        result = result.replace(pattern, (match, offset) => {
            // 置換位置が0（先頭）または前が空白の場合のみ置換
            if (offset === 0 || result[offset - 1].match(/\s/)) {
                changed = true;
                return '';
            }
            return match; // 置換しない
        });
        if (before !== result) {
            console.log(`  パターン${index + 1}適用: "${before}" → "${result}"`);
        }
    });

    console.log(`開催地除去後: "${result}"`);
    return result;
}

// console.log(`元のsummary: "${summary}"`);
// console.log(`venuePatterns除去後: "${raceName}"`);


// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function () {
    initVenueSelector();
    // 週末に重賞があれば上部におまけ表示
    renderWeekendGradeRaces().catch(console.error);
});

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('place-selector')
        .addEventListener('change', updateSpinButtonState);

    document.getElementById('race-selector')
        .addEventListener('change', updateSpinButtonState);

    updateSpinButtonState();
});

function setupHoldRepeat(buttonEl, step) {
    let timer = null;
    let interval = 140; // 最初はゆっくり
    let pressCount = 0;

    const tick = () => {
        // ここで頭数を動かす（あなたの既存関数に合わせて）
        changeTotal(step);           // ← 既存がこれならこれ
        // syncTotal();              // ← 必要ならここで同期

        pressCount++;
        // 押し続けたら加速（ほどほど）
        if (pressCount === 8) interval = 90;
        if (pressCount === 20) interval = 60;

        timer = setTimeout(tick, interval);
    };

    const start = (e) => {
        e.preventDefault();
        if (timer) return;
        interval = 140;
        pressCount = 0;

        // 1回目は即反映
        tick();
    };

    const stop = () => {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;

        // 離した瞬間に「確定」させたい処理があればここ
        // updateSpinButtonState(); // ボタン制御があるなら
    };

    // スマホ優先（pointerが一番安定）
    buttonEl.addEventListener('pointerdown', start, { passive: false });
    buttonEl.addEventListener('pointerup', stop);
    buttonEl.addEventListener('pointercancel', stop);
    buttonEl.addEventListener('pointerleave', stop);

    // 長押し中のコンテキストメニュー抑止（Android/一部ブラウザ）
    buttonEl.addEventListener('contextmenu', (e) => e.preventDefault());
}

document.addEventListener('DOMContentLoaded', () => {
    const minus = document.getElementById('minus-btn');
    const plus = document.getElementById('plus-btn');
    if (minus) setupHoldRepeat(minus, -1);
    if (plus) setupHoldRepeat(plus, +1);
});

