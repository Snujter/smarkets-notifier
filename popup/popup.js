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

    addMarket(market) {
        const { id, name, eventId } = market;
        const $marketsSlot = this.shadowRoot.querySelector('slot[name="markets"]');
        const $market = document.createElement("market-element");
        $market.setAttribute("id", id);
        $market.setAttribute("name", name);
        $market.setAttribute("event-id", eventId);
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

    addContract(options) {
        const { id, name, sellValue, status } = options;
        const $contractsSlot = this.shadowRoot.querySelector('slot[name="contracts"]');
        const $contract = document.createElement("contract-element");
        $contract.setAttribute("id", id);
        $contract.setAttribute("name", name);
        $contract.setAttribute("sell-value", sellValue || 0);
        $contract.setAttribute("status", status || "inactive");
        $contractsSlot.append($contract);
        return $contract;
    }
}

class ContractElement extends HTMLElement {
    static TEMPLATE_ID = "contract-template";

    static get observedAttributes() {
        return ["name", "sell-value", "status"];
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
                this.$clearDataBtn = document.getElementById("clear-button");
                this.$clearDataBtn.addEventListener("click", this.clearData.bind(this));

                // Add a listener for messages from the service worker
                chrome.runtime.onMessage.addListener((message) => {
                    const { type, data } = message;
                    // Handle the incoming message based on its type
                    switch (type) {
                        case "add-contract":
                            this.handleAddContract(data);
                            break;
                        case "update-contract":
                            this.handleUpdateContract(data);
                            break;
                        case "remove-contract":
                            this.handleRemoveContract(data);
                            break;
                        case "add-event":
                            this.handleAddEvent(data);
                            break;
                        case "update-event":
                            this.handleUpdateEvent(data);
                            break;
                        case "remove-event":
                            this.handleRemoveEvent(data);
                            break;
                        case "add-market":
                            this.handleAddMarket(data);
                            break;
                        case "update-market":
                            this.handleUpdateMarket(data);
                            break;
                        case "remove-market":
                            this.handleRemoveMarket(data);
                            break;
                        default:
                            // Handle unknown message types, if needed
                            break;
                    }
                });

                this.displayEventsFromLocalStorage();
            });
        });
    }

    findMarketElement(id, eventId) {
        // Otherwise find event
        const $event = document.getElementById(eventId);
        if (!$event) {
            console.warn(`Event with id ${eventId} not found`);
            return;
        }

        return $event.shadowRoot.getElementById(id);
    }

    findContractElement(id, marketId, eventId) {
        const $market = this.findMarketElement(id, eventId);
        if (!$market) {
            console.warn(`Market with id ${marketId} not found`);
            return;
        }

        return $market.shadowRoot.getElementById(id);
    }

    handleAddContract(contract) {
        console.log("HANDLING ADDED CONTRACT: ", contract);
        const { eventId, marketId } = contract;

        // Find market on event
        const $market = this.findMarketElement(marketId, eventId);
        if (!$market) {
            console.log(`Market with id ${marketId} not found`);
            return;
        }

        // Add contract to market
        $market.addContract(contract);
    }

    handleUpdateContract(contract) {
        const { id, marketId, eventId } = contract;

        // Find contract on market
        const $contract = this.findContractElement(id, marketId, eventId);
        if (!$contract) {
            console.log("No contract found to update.");
            return;
        }

        for (let key in contract) {
            if (key !== "id" && contract.hasOwnProperty(key)) {
                if (key === "sellValue") {
                    $contract.setAttribute("sell-value", contract[key]);
                } else {
                    $contract.setAttribute(key, contract[key]);
                }
            }
        }
    }

    handleRemoveContract(contract) {
        const { id, marketId, eventId } = contract;

        const $contract = this.findContractElement(id, marketId, eventId);
        if (!$contract) {
            console.log("No contract found to remove.");
            return;
        }

        $contract.remove();
    }

    handleAddEvent(event) {
        const $event = document.createElement("event-element");
        $event.setAttribute("id", event.id);
        $event.setAttribute("home-team", event.homeTeam);
        $event.setAttribute("away-team", event.awayTeam);
        $event.setAttribute("tab-id", event.tabId);

        this.$eventsContainer.insertBefore($event, this.$eventsContainer.firstChild);
    }

    handleRemoveEvent(event) {
        const $event = document.getElementById(event.id);
        if (!$event) {
            console.warn(`Event with id ${event.id} not found`);
            return;
        }

        $event.remove();
    }

    handleAddMarket(market) {
        const { eventId } = market;

        const $event = document.getElementById(eventId);
        if (!$event) {
            console.warn(`Event with id ${eventId} not found`);
            return;
        }

        // Add market element to events
        $event.addMarket(market);
    }

    handleRemoveMarket(market) {
        const { id, eventId } = market;
        const $market = this.findMarketElement(id, eventId);
        if (!$market) {
            console.log(`Market with id ${id} not found`);
            return;
        }
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

    clearData() {
        var confirmation = confirm("Are you sure you want to clear data?");
        if (confirmation) {
            chrome.runtime.sendMessage({ type: "clear-data" }, (response) => {
                alert(response.message);
            });
        }
    }

    displayEventsFromLocalStorage() {
        this.$eventsContainer.innerHTML = "";

        chrome.storage.local.get(["events", "markets", "contracts"], (result) => {
            const events = result.events || [];
            const markets = result.markets || [];
            const contracts = result.contracts || [];

            console.log("events", events);
            console.log("markets", markets);
            console.log("contracts", contracts);

            events.forEach((event) => {
                // filter out markets for the current event
                const eventMarkets = markets.filter((market) => market.eventId === event.id);
                console.log(eventMarkets);

                const $event = document.createElement("event-element");
                $event.setAttribute("id", event.id);
                $event.setAttribute("home-team", event.homeTeam);
                $event.setAttribute("away-team", event.awayTeam);
                $event.setAttribute("tab-id", event.tabId);

                eventMarkets.forEach((market) => {
                    // Filter out contracts for the current market
                    const marketContracts = contracts.filter(
                        (contract) => contract.eventId === event.id && contract.marketId === market.id
                    );
                    // Check if market has any contracts, if not don't display it
                    if (!marketContracts.length) {
                        return;
                    }

                    // Add market element to events
                    const $market = $event.addMarket(market);

                    // Add contract elements for the market element
                    marketContracts.forEach((contract) => {
                        $market.addContract(contract);
                    });
                });

                this.$eventsContainer.insertBefore($event, this.$eventsContainer.firstChild);
            });
        });
    }
}

const app = new App();
