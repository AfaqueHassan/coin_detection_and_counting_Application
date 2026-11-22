const statusBadge = document.getElementById('statusBadge');
const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const cameraBtn = document.getElementById('cameraBtn');
const dropZone = document.getElementById('dropZone');
const imgElement = document.getElementById('imageSrc');
const placeholderText = document.getElementById('placeholderText');
const canvasOutput = document.getElementById('canvasOutput');

const sensitivitySlider = document.getElementById('sensitivity');
const sensLabel = document.getElementById('sensLabel');
const coinValueInput = document.getElementById('coinValue');
const coinCountEl = document.getElementById('coinCount');
const totalValueEl = document.getElementById('totalValue');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

// Camera Elements
const cameraSection = document.getElementById('cameraSection');
const videoInput = document.getElementById('videoInput');
const captureBtn = document.getElementById('captureBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
let stream = null;
let detectedCount = 0;

// 1. OpenCV Ready
function onOpenCvReady() {
    statusBadge.innerText = "Created by F24 AI Candidate Section: A ";
    statusBadge.className = "badge ready";
    imageInput.disabled = false;
    uploadBtn.disabled = false;
    cameraBtn.disabled = false;
}

// 2. Upload & Drag-Drop Handlers
uploadBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadImageFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) loadImageFile(e.dataTransfer.files[0]);
});

function loadImageFile(file) {
    imgElement.src = URL.createObjectURL(file);
}

imgElement.onload = function() {
    placeholderText.style.display = 'none';
    imgElement.style.display = 'block';
    canvasOutput.style.display = 'block';
    detectCoins();
};

// 3. Live Camera Features
cameraBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoInput.srcObject = stream;
        cameraSection.classList.remove('hidden');
    } catch (err) {
        alert("Camera access denied or not available on this device.");
    }
});

captureBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoInput.videoWidth;
    tempCanvas.height = videoInput.videoHeight;
    tempCanvas.getContext('2d').drawImage(videoInput, 0, 0);
    imgElement.src = tempCanvas.toDataURL('image/png');
    stopCamera();
});

closeCameraBtn.addEventListener('click', stopCamera);

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    cameraSection.classList.add('hidden');
}

sensitivitySlider.addEventListener('input', function() {
    let val = parseInt(this.value);
    if (val < 38) sensLabel.innerText = "High (" + val + ")";
    else if (val <= 55) sensLabel.innerText = "Balanced (" + val + ")";
    else sensLabel.innerText = "Strict (" + val + ")";
    
    if (imgElement.src) detectCoins();
});

coinValueInput.addEventListener('input', updateTotalValue);

function updateTotalValue() {
    let valPerCoin = parseFloat(coinValueInput.value) || 0;
    totalValueEl.innerText = (detectedCount * valPerCoin).toLocaleString();
}

function detectCoins() {
    let src = cv.imread(imgElement);
    
    
    let scale = 600 / src.cols;
    let dsize = new cv.Size(600, Math.round(src.rows * scale));
    cv.resize(src, src, dsize, 0, 0, cv.INTER_AREA);

    let dst = src.clone();
    let gray = new cv.Mat();
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.medianBlur(gray, gray, 9);
    cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);

    let circles = new cv.Mat();
    let param2 = parseInt(sensitivitySlider.value);

    cv.HoughCircles(
        gray,
        circles,
        cv.HOUGH_GRADIENT,
        1,
        60,      
        100,     
        param2,   
        22,       
        140       
    );

    let validCoins = [];
    for (let i = 0; i < circles.cols; ++i) {
        let x = circles.data32F[i * 3];
        let y = circles.data32F[i * 3 + 1];
        let r = circles.data32F[i * 3 + 2];

        let isDuplicate = false;
        for (let existing of validCoins) {
            let dist = Math.hypot(x - existing.x, y - existing.y);
            if (dist < (r + existing.r) * 0.75) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            validCoins.push({ x, y, r });
        }
    }

    validCoins.sort((a, b) => a.x - b.x);

    validCoins.forEach((coin, index) => {
        let center = new cv.Point(coin.x, coin.y);
        // Outer Green Ring
        cv.circle(dst, center, coin.r, [22, 163, 74, 255], 4);
        // Coin Number (#1, #2...)
        cv.putText(
            dst,
            "#" + (index + 1),
            new cv.Point(coin.x - 18, coin.y + 6),
            cv.FONT_HERSHEY_SIMPLEX,
            0.7,
            [255, 255, 255, 255],
            2
        );
    });

    detectedCount = validCoins.length;
    coinCountEl.innerText = detectedCount;
    updateTotalValue();

    cv.imshow('canvasOutput', dst);
    downloadBtn.disabled = false;

    // Cleanup memory
    src.delete(); dst.delete(); gray.delete(); circles.delete();
}

// 6. Download Result Image
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'counted-coins-result.png';
    link.href = canvasOutput.toDataURL();
    link.click();
});

// 7. Reset App
resetBtn.addEventListener('click', () => {
    imgElement.src = "";
    imgElement.style.display = 'none';
    canvasOutput.style.display = 'none';
    placeholderText.style.display = 'block';
    coinCountEl.innerText = "0";
    totalValueEl.innerText = "0";
    sensitivitySlider.value = 45;
    sensLabel.innerText = "Balanced (Auto)";
    downloadBtn.disabled = true;
    imageInput.value = "";
});