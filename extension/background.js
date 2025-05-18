'use strict';
window.browser = window.browser || window.chrome;

browser.windows.onFocusChanged.addListener(async (id) => {
    if (id !== browser.windows.WINDOW_ID_NONE) {
        try {
            const window = await browser.windows.get(id);
            const iconPath = window.incognito ? "icons/icon-alt.svg" : "icons/icon.svg";
            await browser.action.setIcon({path: iconPath});
        } catch (err) {
            console.error(`Error updating icon: ${err}`);
        }
    }
});

browser.windows.getCurrent().then(async (window) => {
    try {
        const iconPath = window.incognito ? "icons/icon-alt.svg" : "icons/icon.svg";
        await browser.action.setIcon({path: iconPath});
    } catch (err) {
        console.error(`Error updating icon: ${err}`);
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "classifyTweet") {
        fetch("http://localhost:8080/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: message.text })
        })
        .then(response => response.json())
        .then(data => {
            sendResponse({ label: data.label });
        })
        .catch(error => {
            console.error("Error calling predict API:", error);
            sendResponse({ error: true });
        });

        return true;
    }
});

async function classifyTweet({ text, author, id }) {
    if (!text.trim()) return;

    try {
        const response = await fetch("http://localhost:8080/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            console.error("Prediction failed:", await response.text());
            return;
        }

        const { label } = await response.json();
        console.log(`Tweet ID: ${id}, Author: ${author}, Label: ${label}`);

        await saveTweetToDB({ id, author, text, label });

    } catch (error) {
        console.error("Error classifying tweet:", error);
    }
}

async function saveTweetToDB({ id, author, text, label }) {
    try {
        const response = await fetch("http://localhost:8080/store", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id, author, text, label })
        });

        if (!response.ok) {
            console.error("Failed to store tweet:", await response.text());
        }
    } catch (error) {
        console.error("Database storage error:", error);
    }
}