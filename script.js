/* script.js */
const statusMessages = [
    "JRA全レースデータを解析中...",
    "馬のテンションを測定中...",
    "鞍上の勝負気配を検知...",
    "運命のプロットを自動生成中...",
    "最終的な『態度』を決定しています..."
];

const venueSettings = {
    "東京": { max: 18, min: 14 },
    "中京": { max: 18, min: 12 },
    "小倉": { max: 18, min: 10 }
};

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
            const horses = Math.floor(Math.random() * (venueSettings[place].max - venueSettings[place].min + 1)) + venueSettings[place].min;
            let opt = document.createElement('option');
            opt.value = horses;
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