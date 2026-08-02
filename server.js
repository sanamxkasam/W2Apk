const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configs (Inko apni GitHub details se replace karein)
const GITHUB_USERNAME = 'sanamxkasam'; // Apna GitHub username daalein
const REPO_NAME = 'W2Apk';                      // Apni repo ka naam
const GITHUB_TOKEN = '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';   // GitHub Personal Access Token

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

// API Route for Real App Building via GitHub Actions Engine
app.post('/api/build-app', upload.fields([{ name: 'icon' }, { name: 'zipFile' }]), async (req, res) => {
    try {
        const { appName, mode, htmlContent, webUrl, platform } = req.body;

        // 1. Prepare HTML Content based on Mode
        let finalHtml = '<h1>MIRRYKAL Web2App</h1>';
        if (mode === 'html' && htmlContent) {
            finalHtml = htmlContent;
        } else if (mode === 'url' && webUrl) {
            finalHtml = `<!DOCTYPE html><html><head><script>window.location.href="${webUrl}";</script></head><body>Redirecting...</body></html>`;
        }

        // 2. Trigger GitHub Actions Workflow via API
        const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'MIRRYKAL-App'
            },
            body: JSON.stringify({
                event_type: 'build_apk',
                client_payload: {
                    app_name: appName || 'My_App',
                    html_content: finalHtml
                }
            })
        });

        if (githubResponse.status === 204) {
            // Workflow triggered successfully
            res.json({
                success: true,
                message: "Real APK Compilation Triggered Successfully on GitHub Engine!",
                downloadUrl: `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/actions`
            });
        } else {
            const errData = await githubResponse.json();
            console.error('GitHub API Error:', errData);
            res.status(500).json({ 
                success: false, 
                message: "Failed to trigger GitHub Builder. Please check GITHUB_TOKEN." 
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ success: false, message: "Build process failed on server." });
    }
});

app.listen(PORT, () => console.log(`MIRRYKAL Engine running on port ${PORT}`));
