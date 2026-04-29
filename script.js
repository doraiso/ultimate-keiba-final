/* script.js */
const statusMessages = [
    "JRA全レースデータを解析中...",
    "馬のテンションを測定中...",
    "鞍上の勝負気配を検知...",
    "運命のプロットを自動生成中...",
    "最終的な『態度』を決定しています..."
];

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
    const { sat, sun } = getThisWeekendDates(base); // ← ここに寄せる（0:00固定も込み）

    const [satGR, sunGR] = await Promise.all([
        getGradeRacesForDateFromJraJson(sat),
        getGradeRacesForDateFromJraJson(sun),
    ]);

    const key = (x) => `${x.venue}|${x.grade}|${x.name}|${x.date}`;
    const map = new Map();
    [...satGR, ...sunGR].forEach(x => map.set(key(x), x));
    return Array.from(map.values());
}

function getNextWeekendDates(base = new Date()) {
    const day = base.getDay(); // 0=Sun
    const sat = new Date(base);
    sat.setDate(base.getDate() + (6 - day));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    return { sat, sun };
}

function getThisWeekendDates(base = new Date()) {
    const day = base.getDay(); // 0=Sun..6=Sat
    const sat = new Date(base);

    // 日曜なら「昨日(土曜)」、それ以外は「今週土曜」
    sat.setDate(base.getDate() + (day === 0 ? -1 : (6 - day)));
    sat.setHours(0, 0, 0, 0);

    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    sun.setHours(0, 0, 0, 0);

    return { sat, sun };
}

function getSelectedDate() {
    const { sat, sun } = getThisWeekendDates(new Date());
    const v = document.querySelector('input[name="raceDay"]:checked')?.value || "sat";
    return v === "sun" ? sun : sat;
}

function getMainRacePivotDate(now = new Date()) {
    const { sat, sun } = getThisWeekendDates(now);

    const satCutoff = new Date(sat);
    satCutoff.setHours(16, 0, 0, 0);

    const sunCutoff = new Date(sun);
    sunCutoff.setHours(16, 0, 0, 0);

    if (now < satCutoff) return sat;   // 土曜メイン
    if (now < sunCutoff) return sun;   // 日曜メイン

    // 日曜終了後 → 次週土曜
    return addDays(sat, 7);
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

async function getWeekendVenuesFromJraJson(base = new Date()) {
    const { sat, sun } = getThisWeekendDates(base);

    const [vSat, vSun] = await Promise.all([
        getVenuesForDateFromJraJson(sat),
        getVenuesForDateFromJraJson(sun),
    ]);

    return [...new Set([...vSat, ...vSun])];
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

    // まず venues を確定させる
    let venues;
    try {
        venues = await getWeekendVenuesFromJraJson(today);
    } catch (err) {
        console.error("開催地取得エラー:", err);
        throw err; // 上位で扱う
    }

    if (!Array.isArray(venues) || venues.length === 0) {
        selector.innerHTML = '<option value="">開催地が取得できませんでした</option>';
        return;
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

function gradeRank(gradeRaw) {
    const g = String(gradeRaw || "").trim().toUpperCase();
    const m = g.match(/(?:J[・\.]?)?\s*G\s*([123])/);
    return m ? Number(m[1]) : 99; // G1=1, G2=2, G3=3
}

function isJumpGrade(gradeRaw) {
    const g = String(gradeRaw || "").trim().toUpperCase();
    return /^J(?:[・\.]?\s*)?G\s*[123]/.test(g); // J・G2 / JG2 / J G2 / J.G2
}

async function getMainRaceInfoForVenue(venue, pivotDate = new Date()) {
    const races = await getWeekendGradeRacesFromJraJson(pivotDate);
    const list = races.filter(r => r.venue === venue);

if (list.length === 0) {
    return {
        name: "メインレース",
        grade: "",
        date: toYmdJst(pivotDate),
        daysUntil: calculateDaysUntil(toYmdJst(pivotDate)),
        isFallbackMain: true,
    };
}

    const preferred = toYmdJst(pivotDate);

    list.sort((a, b) => {
        const ad = String(a.date || "");
        const bd = String(b.date || "");

        // ① pivotDate と同じ日付を最優先
        const aPref = ad === preferred ? 0 : 1;
        const bPref = bd === preferred ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;

        // ② 同日内はグレード優先（G1→G2→G3→その他）
        const pa = gradeRank(a.grade);
        const pb = gradeRank(b.grade);
        if (pa !== pb) return pa - pb;

        // ②.5 同日・同格なら平地を優先（障害＝J を後ろへ）
        const aIsJump = isJumpGrade(a.grade);
        const bIsJump = isJumpGrade(b.grade);
        if (aIsJump !== bIsJump) return aIsJump ? 1 : -1;

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

    const setOptions = (html) => { raceSelector.innerHTML = html; };
    const appendOption = (opt) => raceSelector.appendChild(opt);

    const applyGradeStyle = (option, grade) => {
        if (!grade) return;
        if (grade.includes("G1")) option.style.color = "#d4af37";
        else if (grade.includes("G2")) option.style.color = "#c0c0c0";
        else if (grade.includes("G3")) option.style.color = "#cd7f32";
    };

    const buildDefaultRaceOptions = ({ mainRaceNumber = 11, mainLabel = "メインレース", raceInfo } = {}) => {
        setOptions('<option value="">レースを選択...</option>');

        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = String(i);

            const isMain = i === mainRaceNumber && !!raceInfo;
            option.dataset.isMain = isMain ? "true" : "false";

            if (isMain) {
                const daysText = raceInfo.daysUntil > 0 ? ` (あと${raceInfo.daysUntil}日)` : ` (今日開催)`;
                const gradeText = raceInfo.grade ? ` [${raceInfo.grade}]` : "";

                option.text = `${i}R 🏆 ${raceInfo.name}${gradeText}${daysText}`;

                option.dataset.raceName = raceInfo.name;
                option.dataset.raceDate = raceInfo.date;
                option.dataset.grade = raceInfo.grade || "G?";

                applyGradeStyle(option, raceInfo.grade);
            } else {
                option.text = `${i}R${i === mainRaceNumber && !raceInfo ? ` ${mainLabel}` : ""}`;
            }

            appendOption(option);
        }
    };

    if (!place) {
        setOptions('<option value="">先に開催地を選んでください</option>');
        return;
    }

    setOptions('<option value="">レースを読み込み中...</option>');

    try {
        const pivotDate = getMainRacePivotDate(new Date());
        const raceInfo = await getMainRaceInfoForVenue(place, pivotDate);

        // 「メイン=11R」を基本にしつつ、raceInfo側に mainRaceNumber があれば優先（12Rメイン等に対応）
        const mainRaceNumber = Number(raceInfo?.mainRaceNumber ?? 11);

        buildDefaultRaceOptions({ mainRaceNumber, raceInfo });
    } catch (error) {
        console.log("レースリスト更新エラー:", error);
        // 取得に失敗したら、従来どおり 11R をメイン扱いでフォールバック
        buildDefaultRaceOptions({ mainRaceNumber: 11, raceInfo: null });
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

    document.body.appendChild(debugDiv);
}

// 実行
testCurrentDate();

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

