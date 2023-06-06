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
        const $marketsSlot = this.shadowRoot.querySelector('slot[name="markets"]');
        const $market = document.createElement("market-element");
        $market.setAttribute("name", name);
        $marketsSlot.append($market);
        return $market;
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
        const $slot = this.shadowRoot.querySelector(`slot[name="${name}"]`);
        $slot.textContent = value;
    }

    addContract(name, value, status = "inactive") {
        const $contractsSlot = this.shadowRoot.querySelector('slot[name="contracts"]');
        const $contract = document.createElement("contract-element");
        $contract.setAttribute("name", name);
        $contract.setAttribute("value", value);
        $contract.setAttribute("status", status);
        $contractsSlot.append($contract);
        return $contract;
    }
}

class ContractElement extends HTMLElement {
    static TEMPLATE_ID = "contract-template";

    static get observedAttributes() {
        return ["name", "value", "status"];
    }

    constructor() {
        super();
        const template = document.getElementById(ContractElement.TEMPLATE_ID);
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
        const $slot = this.shadowRoot.querySelector(`slot[name="${name}"]`);

        if (name == "status") {
            const $container = this.shadowRoot.querySelector(`.container`);
            $slot.classList.toggle("active", value === "active");
            $slot.classList.toggle("inactive", value === "inactive");
            $slot.classList.toggle("warning", value === "warning");
            $container.classList.toggle("inactive", value === "inactive");
            $container.classList.toggle("warning", value === "warning");
        } else {
            $slot.textContent = value;
        }
    }
}

class App {
    constructor() {
        this.$eventsContainer = null;
        this.backgroundPort = null;

        document.addEventListener("DOMContentLoaded", () => {
            this.loadTemplates(["event", "market", "contract"]).then(() => {
                customElements.define("event-element", EventElement);
                customElements.define("market-element", MarketElement);
                customElements.define("contract-element", ContractElement);

                this.$eventsContainer = document.getElementById("events-container");

                this.backgroundPort = chrome.runtime.connect({ name: "popup-script" });

                this.backgroundPort.onMessage.addListener((message) => {
                    console.log("Message received in the popup script:", message);
                });

                this.backgroundPort.postMessage({ text: "Hello from the popup script!" });
            });
        });
    }

    loadTemplates(templatePaths) {
        const fetchPromises = templatePaths.map((templatePath) => {
            return fetch(`templates/${templatePath}.html`).then((response) => {
                return response.text();
            });
        });

        return Promise.all(fetchPromises)
            .then((templateContents) => {
                templateContents.forEach((templateContent) => {
                    const templateDiv = document.createElement("div");
                    templateDiv.innerHTML = templateContent;
                    document.body.appendChild(templateDiv);
                });
            })
            .catch((error) => {
                console.error("Failed to load templates:", error);
            });
    }
}

const app = new App();
