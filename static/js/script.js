/**
 * Spectrum Labeling Tool - Complete Fixed Version
 */

// Application State
const appState = {
    currentIndex: 0,
    currentFilter: "all",
    filteredIndices: [],
    starData: [],
    notes: [],  // 统一使用 notes 替代 optionalNotes
    currentObsid: null,
    currentStartTime: null,
    viewDurations: []  // 单位：秒数
};

const predefinedNotes = {
        'H': 'Halpha',
        'F': 'Feature',
        'B': 'LowSNR'
    };

const predefinedLabels = {
        '1' : 'Confirmed',
        '2' : 'Likely',
        '3' : 'Unlikely',
        '4' : 'Non-detected'
}

// DOM Elements
const domElements = {
    liImage: document.getElementById('li-image'),
    liPlaceholder: document.getElementById('li-placeholder'),
    halphaImage: document.getElementById('halpha-image'),
    halphaPlaceholder: document.getElementById('halpha-placeholder'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    tagCount: document.getElementById('tag-count'),
    markStatus: document.getElementById('mark-status'),
    currentLabel: document.getElementById('current-label'),
    filterAllBtn: document.getElementById('filter-all'),
    filterUnmarkedBtn: document.getElementById('filter-unmarked'),
    filterMarkedBtn: document.getElementById('filter-marked'),

    jumpInput: document.getElementById('jump-input'),
    jumpBtn: document.getElementById('jump-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    labelBtns: document.querySelectorAll('.label-btn'),
    noteBtns: document.querySelectorAll('.note-btn'),
    customNoteInput: document.getElementById('custom-note-input'),
    addNoteBtn: document.getElementById('add-note-btn'),
    notesContainer: document.getElementById('notes-container'),
    timeSpent: document.getElementById('time-spent'),
    avgTime: document.getElementById('avg-time')
};

// Initialize Application
async function initApp() {
    console.log("Initializing application...");
    
    try {
        // Load initial data
        const response = await fetch('/get_initial_data');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        appState.starData = data.star_data || [];
        updateFilteredIndices();
        
        console.log("Initial data loaded. Total records:", appState.starData.length);
        
        // 获取上次浏览的 obsid
        const lastObsid = localStorage.getItem('last_obsid');
        let targetIndex = 0;

        if (lastObsid) {
            const index = appState.starData.findIndex(star => String(star.obsid) === lastObsid);
            if (index !== -1 && appState.filteredIndices.includes(index)) {
                targetIndex = appState.filteredIndices.indexOf(index);
            }
        }

        await loadSpectrum(targetIndex);
        
    } catch (error) {
        console.error("Initialization failed:", error);
        alert("初始化失败，请检查控制台日志");
    }
}

// 更新过滤后的索引
function updateFilteredIndices() {
    const prevLength = appState.filteredIndices.length;
    const filter = appState.currentFilter;

    appState.filteredIndices = [];

    for (let i = 0; i < appState.starData.length; i++) {
        const star = appState.starData[i];
        const label = star.label;
        const tag = star.tag;
        const notes = (star.notes || '').split(';').map(n => n.trim()).filter(n => n);

        let shouldInclude = false;

        if (filter === 'all') {
            shouldInclude = true;
        } else if (filter === 'unmarked' && tag === '0') {
            shouldInclude = true;
        } else if (filter === 'marked' && tag !== '0') {
            shouldInclude = true;
        } else if (filter.startsWith('label_')) {
            const labelValue = filter.split('_')[1];
            shouldInclude = label === labelValue;
        } else if (filter.startsWith('note_')) {
            const targetNote = predefinedNotes[filter.split('_')[1]];
            shouldInclude = notes.includes(targetNote);
        }

        if (shouldInclude) {
            appState.filteredIndices.push(i);
        }
    }

    if (prevLength !== appState.filteredIndices.length &&
        appState.currentIndex >= appState.filteredIndices.length) {
        appState.currentIndex = 0;
    }
}

// 加载光谱数据
async function loadSpectrum(index) {
    // 添加边界检查
    if (appState.filteredIndices.length === 0 || 
        index < 0 || 
        index >= appState.filteredIndices.length) {
        return;
    }
    if (index < 0 || index >= appState.filteredIndices.length) {
        console.log("Reached end of spectrum list");
        return;
    }

    console.log(`Loading spectrum at index ${index}`);

    try {
        const spectrumId = appState.filteredIndices[index];
        const response = await fetch(`/get_spectrum/${spectrumId}`);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        console.log("Spectrum data:", data);
        

        appState.currentIndex = index;
        appState.currentObsid = data.obsid;
        appState.notes = data.notes || [];  // 从服务器加载notes
        startTimer(); 
        localStorage.setItem('last_obsid', appState.currentObsid);
        // Update UI
        updateUI(data);
        
    } catch (error) {
        console.error('Error loading spectrum:', error);
        alert('加载光谱数据失败');
    }
}

// 更新UI
function updateUI(data) {
    // 更新图片
    updateImageDisplay(domElements.liImage, domElements.liPlaceholder, data.li_img);
    updateImageDisplay(domElements.halphaImage, domElements.halphaPlaceholder, data.halpha_img); // updateImageDisplay(document.getElementById('halpha-overlay'), null, data.halpha_img, true);

    // 更新进度条
    const totalInFilter = appState.filteredIndices.length;
    const positionInFilter = appState.currentIndex + 1;
    const progressPercent = (positionInFilter / totalInFilter) * 100;
    
    domElements.progressBar.style.width = `${progressPercent}%`;
    domElements.progressText.textContent = 
        `Progress: ${positionInFilter}/${totalInFilter} (Total: ${appState.starData.length})`;
    
    // 更新标记状态
    domElements.tagCount.textContent = `Tag count: ${data.tag_count}`;
    updateMarkStatus(data);
    
    // 更新笔记显示
    updateNotesDisplay();
    document.title = `Spectrum Labeler - ${data.position}/${data.total} (ID: ${data.obsid})`;
}

function updateImageDisplay(imgElement, placeholderElement, filename) {
    if (filename) {
        imgElement.src = `/images/${filename}?t=${Date.now()}`;
        imgElement.style.display = 'block';
        placeholderElement.style.display = 'none';
    } else {
        imgElement.style.display = 'none';
        placeholderElement.style.display = 'block';
        placeholderElement.textContent = `Image not found: ${filename || 'N/A'}`;
    }
}

function updateMarkStatus(data) {
    const hasNotes = appState.notes && appState.notes.length > 0;

    if (data.tag_count > 0) {
        domElements.markStatus.textContent = "★ Marked";
        domElements.markStatus.className = "badge bg-success";
        domElements.currentLabel.textContent = predefinedLabels[data.label];

        if (hasNotes) {
            domElements.markStatus.innerHTML += ' <span title="This spectrum has notes">📌</span>';
        }

        domElements.labelBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-label') === data.label) {
                btn.classList.add('active');
            }
        });
    } else {
        domElements.markStatus.textContent = "Unmarked";
        domElements.markStatus.className = "badge bg-danger";
        domElements.currentLabel.textContent = "";

        domElements.labelBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-label') === data.label) {
                btn.classList.add('active');
            }
        });

        if (hasNotes) {
            domElements.markStatus.innerHTML += ' <span title="This spectrum has notes">📌</span>';
        }
    }
}

function updateNotesDisplay() {
    // 清除自定义笔记显示
    domElements.notesContainer.innerHTML = '';

    // 高亮按钮
    domElements.noteBtns.forEach(btn => {
        const noteKey = btn.getAttribute('data-note');
        const noteText = predefinedNotes[noteKey];
        btn.classList.toggle('active', appState.notes.includes(noteText));
    });

    // 显示 notes
    appState.notes.forEach(note => {
        const badge = document.createElement('span');
        badge.className = 'badge bg-info me-1 mb-1';
        badge.textContent = note;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-close btn-close-white ms-2';
        removeBtn.style.fontSize = '0.6rem';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            const index = appState.notes.indexOf(note);
            if (index >= 0) {
                appState.notes.splice(index, 1);
                updateNotesDisplay();  // 立即刷新 UI
                saveNotes();           // 保存到后端
            }
        };

        badge.appendChild(removeBtn);
        domElements.notesContainer.appendChild(badge);
    });
}

// 导航功能
function navigate(direction) {
    stopTimerAndRecord();
    const total = appState.filteredIndices.length;
    if (total === 0) return;
    
    let newIndex = appState.currentIndex + direction;
    if (newIndex < 0) newIndex = total - 1;
    if (newIndex >= total) newIndex = 0;
    
    loadSpectrum(newIndex);
}

async function jumpToObsid() {
    const obsid = domElements.jumpInput.value.trim();
    if (!obsid) return;

    try {
        const obsidNum = parseInt(obsid);
        const index = appState.starData.findIndex(
            star => parseInt(star.obsid) === obsidNum
        );
        
        if (index !== -1) {
            const filteredIndex = appState.filteredIndices.indexOf(index);
            if (filteredIndex !== -1) {
                await loadSpectrum(filteredIndex);
            } else {
                alert("OBSID not found in current filter");
            }
        } else {
            alert("OBSID not found in database");
        }
    } catch (error) {
        console.error("Jump error:", error);
        alert("Invalid OBSID format");
    }
}

// 过滤器功能
function setFilter(filter) {
    if (appState.currentFilter === filter) return;

    appState.currentFilter = filter;
    updateFilteredIndices();

    // 移除所有已激活按钮的高亮状态
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 设置当前按钮为 active
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    if (appState.filteredIndices.length > 0) {
        loadSpectrum(0);
    } else {
        alert(`No spectra found with filter: ${filter}`);
        setFilter('all');
    }
}

// 标签功能
async function setLabel(label) {
    console.log(`Setting label to: ${label}`);
    stopTimerAndRecord();

    try {
        // 获取当前显示的obsid
        const currentObsid = document.querySelector('.spectrum-image').src
            .match(/(\d+)_(Li|Halpha)_region/)?.[1];
        
        if (!currentObsid) {
            throw new Error("Cannot determine current obsid");
        }        
        const response = await fetch('/save_label', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                obsid: appState.currentObsid,
                label: label,
                notes: appState.notes
            })
        });
        
        if (!response.ok) throw new Error("Failed to save label");

        const currentStarIndex = appState.filteredIndices[appState.currentIndex];
        appState.starData[currentStarIndex].label = label;
        appState.starData[currentStarIndex].tag = '1';
        
        const result = await response.json();
        console.log("Label saved:", result);

        // 重新加载当前光谱
        updateFilteredIndices();

        // 在all模式下自动跳转
        if (appState.currentFilter === 'all') {
            updateFilteredIndices();
            // 跳转到新的第一条未标记光谱（index=0）
            if (appState.filteredIndices.length > 0) {
                setTimeout(() => navigate(1), 200);
            } 
        }

        // 在未标记模式下自动跳转
        if (appState.currentFilter === 'unmarked') {
            updateFilteredIndices();
            // 跳转到新的第一条未标记光谱（index=0）
            if (appState.filteredIndices.length > 0) {
                setTimeout(() => loadSpectrum(0), 200); // 短暂延迟让UI更流畅
            } else {
                alert("所有光谱已标记完成！");
            }
        }
    } catch (error) {
        console.error('Error saving label:', error);
        alert('保存标签失败');
    }
}

// 笔记功能
function toggleNote(noteKey) {
    const noteText = predefinedNotes[noteKey];
    console.log('Note is :', noteText)
    
    const index = appState.notes.indexOf(noteText);
    if (index >= 0) {
        appState.notes.splice(index, 1);
    } else {
        appState.notes.push(noteText);
    }
    
    updateNotesDisplay();
    saveNotes();
}

function addCustomNote() {
    const note = domElements.customNoteInput.value.trim();
    if (note && !appState.notes.includes(note)) {
        appState.notes.push(note);
        domElements.customNoteInput.value = '';
        updateNotesDisplay();
        saveNotes();
    }
}

// function toggleNote(noteText) {
//     const index = appState.notes.indexOf(noteText);
//     if (index === -1) {
//         appState.notes.push(noteText);
//     } else {
//         appState.notes.splice(index, 1);
//     }
//     updateNotesDisplay();
//     saveNotes();
// }

async function saveNotes() {
    try {
        const currentStar = appState.starData[appState.filteredIndices[appState.currentIndex]];
        const label = currentStar.label || '0';  // 保留现有 label

        const response = await fetch('/save_label', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                obsid: appState.currentObsid,
                label: label,
                notes: appState.notes
            })
        });

        if (!response.ok) throw new Error("Failed to save notes");
        console.log("Notes saved successfully");
    } catch (error) {
        console.error('Error saving notes:', error);
    }
}


// 设置事件监听器
function setupEventListeners() {
    // timer switch
    let timerHidden = false;

    domElements.timeSpent.addEventListener('click', () => {
        timerHidden = !timerHidden;
        domElements.timeSpent.classList.toggle('hidden', timerHidden);
    });

    // navigation
    domElements.prevBtn.addEventListener('click', () => navigate(-1));
    domElements.nextBtn.addEventListener('click', () => navigate(1));
    domElements.jumpBtn.addEventListener('click', jumpToObsid);
    
    // filter
    domElements.filterAllBtn.addEventListener('click', () => setFilter('all'));
    domElements.filterUnmarkedBtn.addEventListener('click', () => setFilter('unmarked'));
    domElements.filterMarkedBtn.addEventListener('click', () => setFilter('marked'));
    
    ['label_1', 'label_2', 'label_3', 'label_4', 'note_H', 'note_F', 'note_B'].forEach(id => {
        const btn = document.getElementById(`filter-${id}`);
        if (btn) {
            btn.addEventListener('click', () => setFilter(id));
        }
    });

    // resume to last viewed
    document.getElementById('resume-shared').addEventListener('click', async () => {
    try {
        setFilter('all');
        const res = await fetch('/get_shared_last_obsid');
        const data = await res.json();
        const sharedObsid = data.last_obsid;

        if (!sharedObsid) {
            alert("No shared last viewed OBSID found.");
            return;
        }

        const starIndex = appState.starData.findIndex(star => String(star.obsid) === sharedObsid);
        if (starIndex === -1) {
            alert("Shared OBSID not found in current dataset.");
            return;
        }

        const filteredIndex = appState.filteredIndices.indexOf(starIndex);
        if (filteredIndex !== -1) {
            await loadSpectrum(filteredIndex);
        } else {
            alert("Shared OBSID is not in the current dataset.");
        }

    } catch (error) {
        console.error("Failed to resume shared view:", error);
        alert("Failed to resume shared view.");
    }
    });

    // label
    domElements.labelBtns.forEach(btn => {
        btn.addEventListener('click', () => setLabel(btn.getAttribute('data-label')));
    });
    
    // note
    domElements.noteBtns.forEach(btn => {
        btn.addEventListener('click', () => toggleNote(btn.getAttribute('data-note')));
    });
    
    domElements.addNoteBtn.addEventListener('click', addCustomNote);
    
    // Exception handling when loading images
    domElements.liImage.addEventListener('error', () => {
        domElements.liImage.style.display = 'none';
        domElements.liPlaceholder.style.display = 'block';
        domElements.liPlaceholder.textContent = 'Failed to load Li image';
    });
    
    domElements.halphaImage.addEventListener('error', () => {
        domElements.halphaImage.style.display = 'none';
        domElements.halphaPlaceholder.style.display = 'block';
        domElements.halphaPlaceholder.textContent = 'Failed to load H-alpha image';
    });

    // listening to keyboard input
    document.addEventListener('keydown', (event) => {
        const key = event.key.toUpperCase();
        // console.log('input key: ', key)

        // 防止在输入框里误触
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        switch (key) {
            // 1–4 => 标签标记
            case '1':
            case '2':
            case '3':
            case '4':
                setLabel(key);
                break;

            // Notes H/F/B
            case 'H':
                toggleNote('H');
                break;
            case 'F':
                toggleNote('F');
                break;
            case 'B':
                toggleNote('B');
                break;

            // 空格键 => 跳转下一条
            case ' ':
                event.preventDefault(); // 避免滚动
                navigate(1);  // next
                break;

            // ← → 键进行上下导航
            case 'ARROWRIGHT':
                navigate(1); break;
            case 'ARROWLEFT':
                navigate(-1); break;
        }
    });
}

// Utility Functions
let viewTimer = null;

function startTimer() {
    clearInterval(viewTimer);  // 停止之前的
    appState.currentStartTime = Date.now();

    updateTimerDisplay(); // 立即更新一次

    viewTimer = setInterval(updateTimerDisplay, 1000);
}

function stopTimerAndRecord() {
    if (!appState.currentStartTime) return;

    const elapsedMs = Date.now() - appState.currentStartTime;
    const elapsedSec = Math.round(elapsedMs / 1000);

    if (elapsedSec <= 120) {
        appState.viewDurations.push(elapsedSec);
    }

    appState.currentStartTime = null;
    clearInterval(viewTimer);

    updateAvgDisplay();
}

function updateTimerDisplay() {
    if (!appState.currentStartTime) {
        domElements.timeSpent.textContent = '⏱ 0s';
        return;
    }

    const elapsedSec = Math.floor((Date.now() - appState.currentStartTime) / 1000);
    domElements.timeSpent.textContent = `⏱ ${elapsedSec}s`;
}

function updateAvgDisplay() {
    const validDurations = appState.viewDurations.filter(t => t <= 120);
    if (validDurations.length === 0) {
        domElements.avgTime.textContent = 'Avg: --';
        return;
    }

    const sum = validDurations.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / validDurations.length);
    domElements.avgTime.textContent = `Avg: ${avg}s`;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});
