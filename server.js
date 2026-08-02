const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configs
const GITHUB_USERNAME = 'sanamxkasam'; // Username verified
const REPO_NAME = 'W2Apk';           // Repository Name
const GITHUB_TOKEN = 'ghp_qq2tOBgxaZ4K57pc8pODAotSYNysn304s82f'; // Token

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'uploads');
const buildDir = path.join(__dirname, 'builds');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

app.post('/api/build-app', upload.fields([{ name: 'icon' }, { name: 'zipFile' }]), async (req, res) => {
    try {
        const { appName, mode, htmlContent, webUrl } = req.body;

        let finalHtml = '<h1>MIRRYKAL Web2App</h1>';
        if (mode === 'html' && htmlContent) {
            finalHtml = htmlContent;
        } else if (mode === 'url' && webUrl) {
            finalHtml = `<!DOCTYPE html><html><head><script>window.location.href="${webUrl}";</script></head><body>Redirecting...</body></html>`;
        }

        // Trigger GitHub Dispatch Event
        const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'MIRRYKAL-App',
                'X-GitHub-Api-Version': '2022-11-28'
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
            res.json({
                success: true,
                message: "Build triggered successfully!",
                downloadUrl: `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/actions`
            });
        } else {
            const errText = await githubResponse.text();
            console.error('GitHub API Response Error:', githubResponse.status, errText);
            res.status(500).json({ 
                success: false, 
                message: `GitHub API Error (${githubResponse.status}): ${errText || 'Check permissions or Token'}` 
            });
        }

    } catch (error) {
        console.error('Server Exception:', error);
        res.status(500).json({ success: false, message: "Server connection failed." });
    }
});

app.listen(PORT, () => console.log(`MIRRYKAL Engine running on port ${PORT}`));
