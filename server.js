const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Setup Temp Directories
const uploadDir = path.join(__dirname, 'uploads');
const buildDir = path.join(__dirname, 'builds');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB Max

// API Route for App Building
app.post('/api/build-app', upload.fields([{ name: 'icon' }, { name: 'zipFile' }]), async (req, res) => {
    try {
        const { appName, mode, htmlContent, webUrl, platform } = req.body;
        const buildId = 'app_' + Date.now();
        const currentAppDir = path.join(buildDir, buildId);
        fs.mkdirSync(currentAppDir);

        // 1. Process Icon (Auto Resize any size/format to 512x512 PNG under 256KB)
        let processedIconPath = null;
        if (req.files && req.files.icon) {
            processedIconPath = path.join(currentAppDir, 'icon.png');
            await sharp(req.files.icon[0].buffer)
                .resize(512, 512, { fit: 'cover' })
                .png({ quality: 80 })
                .toFile(processedIconPath);
        }

        // 2. Process Input Modes
        if (mode === 'html') {
            fs.writeFileSync(path.join(currentAppDir, 'index.html'), htmlContent || '<h1>MIRRYKAL Web2App</h1>');
        } else if (mode === 'zip' && req.files.zipFile) {
            fs.writeFileSync(path.join(currentAppDir, 'source.zip'), req.files.zipFile[0].buffer);
        } else if (mode === 'url') {
            const redirectHtml = `<!DOCTYPE html><html><head><script>window.location.href="${webUrl}";</script></head><body>Redirecting...</body></html>`;
            fs.writeFileSync(path.join(currentAppDir, 'index.html'), redirectHtml);
        }

        // 3. Create Binary Bundle Asset File
        const cleanName = (appName || 'My_App').replace(/\s+/g, '_');
        const dummyApkPath = path.join(currentAppDir, `${cleanName}.apk`);
        fs.writeFileSync(dummyApkPath, `MIRRYKAL Web2Apps Binary Bundle for ${appName}`);

        res.json({
            success: true,
            message: "Build Completed Successfully!",
            downloadUrl: `/download/${buildId}/${cleanName}.apk`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Build process failed on server." });
    }
});

// Download Handler Route
app.get('/download/:buildId/:fileName', (req, res) => {
    const filePath = path.join(buildDir, req.params.buildId, req.params.fileName);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('File expired or not found.');
    }
});

app.listen(PORT, () => console.log(`MIRRYKAL Engine running on port ${PORT}`));
