class ContractExtractor {
    static SELL_VALUE_OBSERVER_CONFIG = { childList: true, characterData: true, subtree: true };
    static STATUS_OBSERVER_CONFIG = { attributes: true, attributeFilter: ["class"] };
    static CONTAINER_SELECTOR = ".contract-wrapper";
    static SELL_TEXT_SELECTOR = ".price.sell";
    static SELL_TEXT_CONTAINER_SELECTOR = ".price-series.sell .price-item:first-child";
    static NAME_SELECTOR = ".name";

    static CIRCLE_DEFAULT_COLOR = "#00CA84";
    static CIRCLE_WARNING_COLOR = "#FF8000";

    static initFromContainers($wrappers, market) {
        let contracts = [];
        Array.from($wrappers).forEach(($contractContainer) => {
            const contract = new ContractExtractor(market);
            contract.init($contractContainer);
            contracts.push(contract);
        });
        return contracts;
    }

    constructor(market) {
        this.id = null; // gets set up when setting $container
        this.name = null; // gets set up when setting $container
        this._$container = null; // gets set up when setting $container
        this.market = market;
        this.event = market.event;
        this.prevSellValue = 0;
        this.$observeStatusCircle = null;
        this.minInputElements = null;
        this.maxInputElements = null;
        this.$toggleBtn = null;
        this.inserted = false;
        this.isSellValueObserved = false;
        this.isStatusObserved = false;
    }

    init($container) {
        this.$observeStatusCircle = this.createObserveStatusCircle();
        this.setObserveStatusCircleColor(ContractExtractor.CIRCLE_DEFAULT_COLOR);
        this.minInputElements = this.createInput("Below");
        this.maxInputElements = this.createInput("Above");
        this.$toggleBtn = this.createToggleButton();
        this.$container = $container;
    }

    get upperThreshold() {
        return parseFloat(this.maxInputElements.$input.value);
    }

    get lowerThreshold() {
        return parseFloat(this.minInputElements.$input.value);
    }

    get status() {
        if (!this.isSellValueObserved) {
            return "inactive";
        }

        if (this.sellValue >= this.upperThreshold || this.sellValue <= this.lowerThreshold) {
            return "warning";
        }

        return "active";
    }

    get sellValueObserver() {
        if (!this._sellValueObserver) {
            this._sellValueObserver = new MutationObserver(this.handleSellValueMutation.bind(this));
        }
        return this._sellValueObserver;
    }

    get statusObserver() {
        if (!this._statusObserver) {
            this._statusObserver = new MutationObserver(this.handleStatusMutation.bind(this));
        }
        return this._statusObserver;
    }

    get $container() {
        return this._$container;
    }

    set $container($newContainer) {
        // Validation
        if ($newContainer === this.$container) {
            return;
        }
        if (!$newContainer) {
            console.log("No new container.");
            return;
        }

        const name = $newContainer.querySelector(ContractExtractor.NAME_SELECTOR)?.innerText || "";
        if (!name) {
            console.log(`Invalid name - skipping contract.`);
            return;
        }

        // Set up new object properties
        this.id = App.generateId(name);
        this.name = name;
        this._$container = $newContainer;
    }

    get $sellTextContainer() {
        return this.$container?.querySelector(ContractExtractor.SELL_TEXT_CONTAINER_SELECTOR);
    }

    get $sellText() {
        return this.$sellTextContainer?.querySelector(ContractExtractor.SELL_TEXT_SELECTOR);
    }
    get sellValue() {
        return this.$sellText?.textContent ? parseFloat(this.$sellText.textContent) : 0;
    }
    get isSellValueObserved() {
        return this._isSellValueObserved;
    }
    set isSellValueObserved(newValue) {
        this._isSellValueObserved = newValue;
        if (this.$observeStatusCircle) {
            this.$observeStatusCircle.style.opacity = newValue ? "1" : "0.4";
        }
    }

    handleSellValueMutation(mutationsList, observer) {
        console.log(mutationsList);
        // Sometimes when the sell price changes to "ASK", the sell value <span> gets replaced by a <div>
        if (!this.$sellText) {
            console.log("Sell text element is not found.");
            return;
        }

        if (this.prevSellValue === this.sellValue) {
            console.log("Sell text element has no change.");
            return;
        }

        this.prevSellValue = this.sellValue;
        console.log({
            id: this.id,
            sellValue: this.sellValue,
            upperThreshold: this.upperThreshold,
            lowerThreshold: this.lowerThreshold,
        });
        App.sendMessage({
            type: "update-contract",
            data: {
                id: this.id,
                status: this.status,
                sellValue: this.sellValue,
                eventId: this.event.id,
                marketId: this.market.id,
            },
        });

        if (this.status === "warning") {
            this.setObserveStatusCircleColor(ContractExtractor.CIRCLE_WARNING_COLOR);
            if (!this.isMuted()) {
                App.PING_AUDIO.play();
            }
        } else {
            this.setObserveStatusCircleColor(ContractExtractor.CIRCLE_DEFAULT_COLOR);
        }
    }

    handleStatusMutation(mutationsList, observer) {
        console.log(mutationsList);
        for (let mutation of mutationsList) {
            if (mutation.target.classList.contains("halted")) {
                console.log("ContractExtractor halted, stopping sell value observation.");
                this.stopObservingSellValue();
            } else {
                console.log("ContractExtractor resuming, starting sell value observation.");
                this.startObservingSellValue();
            }
        }
    }

    createObserveStatusCircle() {
        const circle = document.createElement("div");
        circle.style.width = `15px`;
        circle.style.height = `15px`;
        circle.style.borderRadius = "50%";
        circle.style.margin = "0 20px 0 10px";

        return circle;
    }

    setObserveStatusCircleColor(color) {
        this.$observeStatusCircle.style.backgroundColor = color;
        this.$observeStatusCircle.style.mozBoxShadow = `0px 0px 10px 1px ${color}`;
        this.$observeStatusCircle.style.boxShadow = `0px 0px 10px 1px ${color}`;
    }

    createInput(label) {
        // Create wrapper
        const $wrapper = document.createElement("div");
        $wrapper.style.margin = "10px";

        // Create label
        const $label = document.createElement("label");
        $label.textContent = label;

        // Create input
        const $input = document.createElement("input");
        $input.type = "number";
        $input.step = "0.01";
        $input.style.opacity = "0.2";
        $input.style.maxWidth = "60px";
        $input.className = label.toLowerCase() + "-input";
        $input.addEventListener("input", this.handleInput.bind(this));

        $wrapper.appendChild($label);
        $wrapper.appendChild($input);
        return {
            $wrapper,
            $input,
            $label,
        };
    }

    handleInput(e) {
        const value = parseFloat(e.target.value);
        this.setObserveStatusCircleColor(ContractExtractor.CIRCLE_DEFAULT_COLOR);
        if (value > 0) {
            e.target.style.opacity = "1";
            this.startObservingSellValue();
        } else {
            e.target.style.opacity = "0.2";
            this.stopObservingSellValue();
        }
    }

    createToggleButton() {
        const button = document.createElement("img");
        button.src = App.MUTE_SVG_PATH;
        button.style.opacity = "0.2";
        button.style.cursor = "pointer";
        button.style.width = "35px";
        button.style.height = "35px";
        button.style.margin = "10px";
        button.className = "toggle-button";
        button.setAttribute("data-active", "false");
        button.addEventListener("click", this.toggleMute);
        return button;
    }

    toggleMute(e) {
        const isActive = e.target.getAttribute("data-active") === "true";
        e.target.setAttribute("data-active", isActive ? "false" : "true");
        e.target.style.opacity = isActive ? "0.2" : "1";
    }

    insertOptionsIntoDOM() {
        if (this.inserted) {
            console.log(`ContractExtractor ${this.id} is already inserted into DOM.`);
            return;
        }

        console.log(`Inserting ${this.id} into DOM...`);
        console.log({
            minInputElements: this.minInputElements,
            maxInputElements: this.maxInputElements,
            $toggleBtn: this.$toggleBtn,
            $container: this.$container,
        });

        this.$optionsContainer = document.createElement("div");
        this.$optionsContainer.style.display = "flex";
        this.$optionsContainer.style.alignItems = "center";

        this.$optionsContainer.appendChild(this.$observeStatusCircle);
        this.$optionsContainer.appendChild(this.minInputElements.$wrapper);
        this.$optionsContainer.appendChild(this.maxInputElements.$wrapper);
        this.$optionsContainer.appendChild(this.$toggleBtn);

        this.$container.appendChild(this.$optionsContainer);

        this.inserted = true;
        console.log(`Inserted into DOM.`);

        this.startObservingStatus();
        this.startObservingSellValue();
    }

    removeOptionsFromDOM() {
        this.$optionsContainer.remove();
        this.inserted = false;
        this.stopObservingSellValue();
        this.stopObservingStatus();
    }

    isMuted() {
        return this.inserted && this.$toggleBtn.getAttribute("data-active") === "true";
    }

    startObservingSellValue() {
        console.log("Doing checks for sell value observation...");
        // If it's already observed or not inserted in the DOM then pointless to check
        if (this.isSellValueObserved || !this.inserted) {
            console.log("Sell value already observed or not inserted in DOM.");
            return;
        }

        // Check if text container to be observed exists
        const hasValidSellTextContainer = this.$sellTextContainer && this.$sellTextContainer instanceof Node;

        // Check if any of the inputs have valid values
        const hasValidInputValues =
            parseFloat(this.minInputElements.$input.value) > 0 || parseFloat(this.maxInputElements.$input.value) > 0;

        if (hasValidSellTextContainer && hasValidInputValues) {
            console.log("Attempting sell value observation...");
            this.sellValueObserver.observe(this.$sellTextContainer, ContractExtractor.SELL_VALUE_OBSERVER_CONFIG);
            this.isSellValueObserved = true;
            console.log(`Sell value observer connected for ${this.id}.`);
            App.sendMessage({
                type: "update-contract",
                data: {
                    id: this.id,
                    eventId: this.event.id,
                    marketId: this.market.id,
                    sellValue: this.sellValue,
                    status: "active",
                },
            });
        }
    }

    stopObservingSellValue() {
        if (this.isSellValueObserved) {
            this.sellValueObserver.disconnect();
            this.isSellValueObserved = false;
            console.log(`Sell value observer disconnected for ${this.id}.`);
            App.sendMessage({
                type: "update-contract",
                data: {
                    id: this.id,
                    eventId: this.event.id,
                    marketId: this.market.id,
                    sellValue: this.sellValue,
                    status: "inactive",
                },
            });
        }
    }

    startObservingStatus() {
        if (this.inserted && !this.isStatusObserved && this.$container?.firstChild instanceof Node) {
            this.statusObserver.observe(this.$container.firstChild, ContractExtractor.STATUS_OBSERVER_CONFIG);
            this.isStatusObserved = true;
            console.log(`Status observer connected for ${this.id}.`);

            // Send message to service worker with new contract
            App.sendMessage({
                type: "add-contract",
                data: {
                    id: this.id,
                    name: this.name,
                    marketId: this.market.id,
                    eventId: this.event.id,
                    sellValue: this.sellValue,
                    status: "inactive",
                },
            });
        }
    }

    stopObservingStatus() {
        if (this.isStatusObserved) {
            this.statusObserver.disconnect();
            this.isStatusObserved = false;
            console.log(`Status observer disconnected for ${this.id}.`);

            // Send message to service worker with new event
            App.sendMessage({
                type: "remove-contract",
                data: {
                    id: this.id,
                    marketId: this.market.id,
                    eventId: this.event.id,
                },
            });
        }
    }
}

class MarketExtractor {
    static CONTRACT_LIST_OBSERVER_CONFIG = { childList: true };
    static CONTAINER_SELECTOR = ".market-container";
    static NAME_SELECTOR = ".market-name";

    static initFromContainers($wrappers, event) {
        let markets = [];
        Array.from($wrappers).forEach(($wrapper) => {
            const market = new MarketExtractor(event);
            market.init($wrapper);
            markets.push(market);
        });
        return markets;
    }

    constructor(event) {
        this.contractListObserver = null;
        this.$container = null;
        this.event = event;
        this.name = null;
        this.id = null;
        this.contracts = [];
    }

    init($container) {
        this.$container = $container;
        this.contracts = ContractExtractor.initFromContainers(
            $container.querySelectorAll(ContractExtractor.CONTAINER_SELECTOR),
            this
        );
        this.name = $container.querySelector(MarketExtractor.NAME_SELECTOR).textContent || "";
        this.id = App.generateId(this.name);
    }

    handleContractListMutation(mutationsList, observer) {
        console.log("A CHANGE!!!!!!!!!!");
        console.log(mutationsList);
        for (let mutation of mutationsList) {
            // handle new contract elements showing up
            if (mutation.type === "childList") {
                const addedNodes = Array.from(mutation.addedNodes);
                const removedNodes = Array.from(mutation.removedNodes);
                console.log("Added / removed nodes:");
                console.log({ addedNodes, removedNodes });
                addedNodes.forEach((node) => {
                    const contracts = ContractExtractor.initFromContainers(
                        node.querySelectorAll(ContractExtractor.CONTAINER_SELECTOR),
                        this
                    );
                    console.log("New contracts:");
                    console.log(contracts);

                    contracts.forEach((contract) => {
                        const existingContract = this.contracts.find((c) => c.id === contract.id);
                        if (existingContract) {
                            existingContract.$container = contract.$container;
                            existingContract.insertOptionsIntoDOM();
                        } else {
                            contract.insertOptionsIntoDOM();
                            this.contracts.push(contract);
                        }
                    });
                });

                // If the parent element has been removed that means all contracts should be removed
                if (removedNodes && removedNodes.length > 0) {
                    console.log("Removing all contracts for the market");
                    this.contracts.forEach((contract) => contract.removeOptionsFromDOM());
                }
                console.log("-------------");
            }
        }
    }

    startObservingContractList() {
        this.contractListObserver = new MutationObserver(this.handleContractListMutation.bind(this));
        this.contractListObserver.observe(this.$container, MarketExtractor.CONTRACT_LIST_OBSERVER_CONFIG);

        // Send message to service worker with new event
        App.sendMessage({
            type: "add-market",
            data: {
                id: this.id,
                eventId: this.event.id,
                name: this.name,
            },
        });
    }

    stopObservingContractList() {
        if (this.contractListObserve) {
            this.contractListObserve.disconnect();
            this.contractListObserve = null;

            // Send message to service worker with new event
            App.sendMessage({
                type: "remove-market",
                data: {
                    id: this.id,
                    eventId: this.event.id,
                },
            });
        }
    }
}

class EventExtractor {
    static STATUS_BADGE_SELECTOR = ".event-badge";
    static STATUS_BADGE_COMPLETED_CLASS = "-complete";
    static PLAYERS_SELECTOR = ".name.competitor";
    static STATUS_OBSERVER_CONFIG = { attributes: true, attributeFilter: ["class"] };

    constructor() {
        this.id = null;
        this.homeTeam = null;
        this.awayTeam = null;
        this.markets = [];
        this.$statusBadge = null;
    }

    init() {
        // Set up status badge
        this.$statusBadge = document.querySelector(EventExtractor.STATUS_BADGE_SELECTOR);
        if (!this.$statusBadge) {
            console.log("Status badge not found, stopping event setup.");
            console.log(document);
            debugger;
            return;
        }
        if (this.hasEnded()) {
            console.log("Event finished, stopping event setup.");
            return;
        }

        // Set up players
        const players = Array.from(document.querySelectorAll(EventExtractor.PLAYERS_SELECTOR)).map(($player) =>
            $player.textContent.trim()
        );
        this.homeTeam = players[0] || "";
        this.awayTeam = players[1] || "";
        if (!this.homeTeam || !this.awayTeam) {
            console.log("Teams not found, stopping event setup.");
            console.log(document);
            debugger;
            return;
        }

        // Set up id
        this.id = App.generateId(`${this.homeTeam}-${this.awayTeam}`);

        // Set up markets
        const $marketContainers = Array.from(document.querySelectorAll(MarketExtractor.CONTAINER_SELECTOR)).map(
            ($container) => $container.firstElementChild
        );
        this.markets = MarketExtractor.initFromContainers($marketContainers, this);
    }

    hasEnded() {
        return this.$statusBadge.classList.contains(EventExtractor.STATUS_BADGE_COMPLETED_CLASS);
    }

    handleStatusMutation(mutationsList, observer) {
        console.log("Status badge mutation!");
        console.log(mutationsList);
        for (let mutation of mutationsList) {
            if (mutation.type === "attributes" && mutation.attributeName === "class") {
                const currentClasses = mutation.target.classList;
                if (currentClasses.contains(EventExtractor.STATUS_BADGE_COMPLETED_CLASS)) {
                    const customEvent = new CustomEvent("event-status-change", { detail: { status: "completed" } });
                    document.dispatchEvent(customEvent);
                }
            }
        }
    }

    startObservingStatus() {
        this.statusObserver = new MutationObserver(this.handleStatusMutation.bind(this));
        this.statusObserver.observe(this.$statusBadge, EventExtractor.STATUS_OBSERVER_CONFIG);

        // Send message to service worker with new event
        App.sendMessage({
            type: "add-event",
            data: {
                id: this.id,
                homeTeam: this.homeTeam,
                awayTeam: this.awayTeam,
            },
        });
    }

    stopObservingStatus() {
        if (this.statusObserver) {
            this.statusObserver.disconnect();
            this.statusObserver = null;

            // Send message to service worker with new event
            App.sendMessage({
                type: "remove-event",
                data: {
                    id: this.id,
                },
            });
        }
    }
}

class App {
    static MUTE_SVG_PATH = chrome.runtime.getURL("images/mute.svg");
    static PING_AUDIO = new Audio(chrome.runtime.getURL("audio/ping.mp3"));
    static PORT = chrome.runtime.connect({ name: "content-script" });

    static generateId(slug) {
        return slug.toLowerCase().replace(/ /g, "-");
    }

    static sendMessage(message) {
        try {
            App.PORT.postMessage(message);
        } catch (error) {
            alert(error.message + " - please try refreshing the page.");
            console.error(error);
        }
    }

    constructor() {
        this.event = null;
    }

    init() {
        // Set up event
        this.event = new EventExtractor();
        this.event.init();
        if (!this.event.markets || this.event.markets.length == 0) {
            console.log("No markets found.");
            return;
        }

        this.event.markets.forEach((market) => {
            // market.init();
            market.contracts.forEach((contract) => {
                // contract.init();
                contract.insertOptionsIntoDOM();
            });
        });
    }

    startMonitoring() {
        this.event.startObservingStatus();
        this.event.markets.forEach((market) => {
            market.startObservingContractList();
            market.contracts.forEach((contract) => {
                contract.startObservingStatus();
            });
        });
    }

    stopMonitoring() {
        this.event.stopObservingStatus();
        this.event.markets.forEach((market) => {
            market.stopObservingContractList();
            market.contracts.forEach((contract) => {
                contract.stopObservingStatus();
                contract.stopObservingSellValue();
            });
        });
    }
}

const app = new App();

window.addEventListener("load", () => {
    console.log("DOM fully loaded and parsed. Creating new App instance and starting monitoring...");
    app.init();
    app.startMonitoring();

    document.addEventListener("event-status-change", (data) => {
        if (data.status === "completed") {
            app.stopMonitoring();
        }
    });
});

window.addEventListener("beforeunload", () => {
    app.stopMonitoring();
});
