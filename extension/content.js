"use strict";
window.browser = window.browser || window.chrome;

const observedTweets = new Set();

const processTweet = (tweetNode) => {
    const textContainer = tweetNode.querySelector('[data-testid="tweetText"]');
    if (!textContainer) return;

    const tweetText = Array.from(textContainer.querySelectorAll("span"))
        .map((span) => span.textContent.trim())
        .join(" ")
        .trim();

    if (!tweetText || observedTweets.has(tweetText)) return;

    const authorLink = tweetNode.querySelector('a[href^="/"][role="link"]');
    const authorHandle = authorLink
        ? authorLink.getAttribute("href").split("/")[1]
        : "unknown";

    const tweetLink = tweetNode.querySelector('a[href*="/status/"]');
    let tweetId = "unknown";
    if (tweetLink) {
        const match = tweetLink.getAttribute("href").match(/status\/(\d+)/);
        if (match) tweetId = match[1];
    }

    observedTweets.add(tweetText);

    const tweetData = {
        text: tweetText,
        author: `@${authorHandle}`,
        id: tweetId,
    };

    browser.runtime.sendMessage(
        { type: "classifyTweet", text: tweetText },
        (response) => {
            if (response?.label.label === "cyberbullying") {
                const container =
                    tweetNode.querySelector('div[role="group"]')?.parentElement
                        ?.parentElement?.parentElement;

                if (container && container.children.length > 2) {
                    const hiddenChildren = [];
                    for (let i = 1; i < container.children.length - 1; i++) {
                        container.children[i].style.display = "none";
                        hiddenChildren.push(container.children[i]);
                    }

                    const warning = document.createElement("div");
                    warning.style.padding = "0.75em 1em";
                    warning.style.display = "flex";
                    warning.style.flexDirection = "column";
                    warning.style.justifyContent = "center";
                    warning.style.alignItems = "center";
                    warning.style.zIndex = "9999";

                    const label = document.createElement("section");
                    label.textContent = "⚠️ Possible Cyberbullying";
                    label.style.width = "100%";
                    label.style.padding = "0.75em 1em";
                    label.style.backgroundColor = "#b33a3a";
                    label.style.color = "white";
                    label.style.borderRadius = "8px";
                    label.style.fontWeight = "bold";
                    label.style.textAlign = "center";
                    label.style.fontSize = "16px";
                    label.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.2)";
                    warning.appendChild(label);

                    const button = document.createElement("button");
                    button.textContent = "Show Tweet";
                    button.style.marginTop = "0.5rem";
                    button.style.padding = "0.5rem 1rem";
                    button.style.backgroundColor = "transparent";
                    button.style.color = "#fff";
                    button.style.border = "2px solid transparent";
                    button.style.fontWeight = "bold";
                    button.style.cursor = "pointer";
                    button.style.borderRadius = "4px";
                    button.style.fontSize = "14px";
                    button.style.textDecoration = "none";
                    button.style.transition = "border 0.2s ease";

                    button.addEventListener("mouseenter", () => {
                        button.style.borderBottom = "2px solid white";
                    });

                    button.addEventListener("mouseleave", () => {
                        button.style.borderBottom = "2px solid transparent";
                    });

                    button.addEventListener("click", (e) => {
                        e.preventDefault();
                        hiddenChildren.forEach((el) => (el.style.display = ""));
                        tweetNode.style.backgroundColor = "";
                        warning.remove();
                    });

                    warning.appendChild(button);

                    container.insertBefore(warning, container.children[1]);

                    tweetNode.style.backgroundColor = "#b00020";
                    tweetNode.style.position = "relative";
                }
            }
        }
    );
};

const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        for (const addedNode of mutation.addedNodes) {
            if (!(addedNode instanceof HTMLElement)) continue;

            if (addedNode.matches?.('article[role="article"]')) {
                processTweet(addedNode);
            }

            const tweetNodes = addedNode.querySelectorAll?.(
                'article[role="article"]'
            );
            tweetNodes?.forEach(processTweet);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
});
