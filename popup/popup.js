chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type === "logChange") {
        const logElement = document.createElement("div");
        logElement.textContent = `${request.marketName} - ${request.contractName} - ${request.sell}`;
        document.getElementById("log").appendChild(logElement);
    }
});

class EventElement extends HTMLElement {
    static TEMPLATE_ID = "event-template";

    static get observedAttributes() {
        return ["home-team", "away-team"];
    }

    constructor() {
        super();
        const template = document.getElementById(EventElement.TEMPLATE_ID);
        const templateContent = template.content.cloneNode(true);

        const shadowRoot = this.attachShadow({ mode: "open" });
        shadowRoot.appendChild(templateContent.cloneNode(true));
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.updateSlotContent(name, newValue);
        }
    }

    updateSlotContent(name, value) {
        const slotElement = this.shadowRoot.querySelector(`slot[name="${name}"]`);
        slotElement.textContent = value;
    }

    addMarket(name) {
        const marketsSlot = this.shadowRoot.querySelector('slot[name="markets"]');
        const marketElement = document.createElement("market-element");
        marketElement.setAttribute("name", name);
        marketsSlot.parentNode.insertBefore(marketElement, marketsSlot.nextSibling);
        return marketElement;
    }
}

class MarketElement extends HTMLElement {
    static TEMPLATE_ID = "market-template";

    static get observedAttributes() {
        return ["name"];
    }

    constructor() {
        super();
        const template = document.getElementById(MarketElement.TEMPLATE_ID);
        const templateContent = template.content.cloneNode(true);

        const shadowRoot = this.attachShadow({ mode: "open" });
        shadowRoot.appendChild(templateContent.cloneNode(true));
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.updateSlotContent(name, newValue);
        }
    }

    updateSlotContent(name, value) {
        const slotElement = this.shadowRoot.querySelector(`slot[name="${name}"]`);
        slotElement.textContent = value;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Load templates to DOM
    loadTemplates(["event", "market"]).then(function () {
        // Create custom elements from templates
        customElements.define("event-element", EventElement);
        customElements.define("market-element", MarketElement);
    });
});

function loadTemplates(templatePaths) {
    const fetchPromises = templatePaths.map(function (templatePath) {
        return fetch(`templates/${templatePath}.html`).then(function (response) {
            return response.text();
        });
    });

    return Promise.all(fetchPromises)
        .then(function (templateContents) {
            templateContents.forEach(function (templateContent) {
                const templateDiv = document.createElement("div");
                templateDiv.innerHTML = templateContent;
                document.body.appendChild(templateDiv);
            });
        })
        .catch(function (error) {
            console.error("Failed to load templates:", error);
        });
}
