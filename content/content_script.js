class Contract {
    static SELL_VALUE_OBSERVER_CONFIG = { childList: true, characterData: true, subtree: true };
    static STATUS_OBSERVER_CONFIG = { attributes: true, attributeFilter: ["class"] };
    static CONTAINER_SELECTOR = ".contract-wrapper";
    static SELL_TEXT_SELECTOR = ".price.sell";
    static SELL_TEXT_CONTAINER_SELECTOR = ".price-series.sell .price-item:first-child";
    static NAME_SELECTOR = ".name";

    static CIRCLE_DEFAULT_COLOR = "#00CA84";
    static CIRCLE_WARNING_COLOR = "#FF8000";

    static fromContainers($wrappers) {
        const contracts = Array.from($wrappers)
            .map(($contractContainer) => new Contract($contractContainer))
            .filter(Boolean); // Remove null values

        return contracts;
    }

    constructor($container) {
        this.id = null; // gets set up when setting $container
        this.name = null; // gets set up when setting $container
        this._$container = null; // gets set up when setting $container
        this.prevSellValue = 0;
        this.$observeStatusCircle = this.createObserveStatusCircle();
        this.setObserveStatusCircleColor(Contract.CIRCLE_DEFAULT_COLOR);
        this.minInputElements = this.createInput("Below");
        this.maxInputElements = this.createInput("Above");
        this.$toggleBtn = this.createToggleButton();
        this.$container = $container;
        this.inserted = false;
        this.isSellValueObserved = false;
        this.isStatusObserved = false;
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

        const name = $newContainer.querySelector(Contract.NAME_SELECTOR)?.innerText || "";
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
        return this.$container.querySelector(Contract.SELL_TEXT_CONTAINER_SELECTOR);
    }

    get $sellText() {
        return this.$sellTextContainer.querySelector(Contract.SELL_TEXT_SELECTOR);
    }
    get sellValue() {
        return this.$sellText.textContent ? parseFloat(this.$sellText.textContent) : 0;
    }
    get isSellValueObserved() {
        return this._isSellValueObserved;
    }
    set isSellValueObserved(newValue) {
        this._isSellValueObserved = newValue;
        this.$observeStatusCircle.style.opacity = newValue ? "1" : "0.4";
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
        const lowerThreshold = parseFloat(this.minInputElements.$input.value);
        const upperThreshold = parseFloat(this.maxInputElements.$input.value);
        console.log({
            id: this.id,
            sellValue: this.sellValue,
            upperThreshold,
            lowerThreshold,
        });

        if (this.sellValue >= upperThreshold || this.sellValue <= lowerThreshold) {
            this.setObserveStatusCircleColor(Contract.CIRCLE_WARNING_COLOR);
            if (!this.isMuted()) {
                App.PING_AUDIO.play();
            }
        } else {
            this.setObserveStatusCircleColor(Contract.CIRCLE_DEFAULT_COLOR);
        }
    }

    handleStatusMutation(mutationsList, observer) {
        console.log(mutationsList);
        for (let mutation of mutationsList) {
            if (mutation.target.classList.contains("halted")) {
                console.log("Contract halted, stopping sell value observation.");
                this.stopObservingSellValue();
            } else {
                console.log("Contract resuming, starting sell value observation.");
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
        this.setObserveStatusCircleColor(Contract.CIRCLE_DEFAULT_COLOR);
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
            console.log(`Contract ${this.id} is already inserted into DOM.`);
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
        // If it's already observed or not inserted in the DOM then pointless to check
        if (this.isSellValueObserved || !this.inserted) {
            return;
        }

        // Check if text container to be observed exists
        const hasValidSellTextContainer = this.$sellTextContainer && this.$sellTextContainer instanceof Node;

        // Check if any of the inputs have valid values
        const hasValidInputValues =
            parseFloat(this.minInputElements.$input.value) > 0 || parseFloat(this.maxInputElements.$input.value) > 0;

        if (hasValidSellTextContainer && hasValidInputValues) {
            this.sellValueObserver.observe(this.$sellTextContainer, Contract.SELL_VALUE_OBSERVER_CONFIG);
            this.isSellValueObserved = true;
            console.log(`Sell value observer connected for ${this.id}.`);
        }
    }

    stopObservingSellValue() {
        if (this.isSellValueObserved) {
            this.sellValueObserver.disconnect();
            this.isSellValueObserved = false;
            console.log(`Sell value observer disconnected for ${this.id}.`);
        }
    }

    startObservingStatus() {
        if (this.inserted && !this.isStatusObserved && this.$container?.firstChild instanceof Node) {
            this.statusObserver.observe(this.$container.firstChild, Contract.STATUS_OBSERVER_CONFIG);
            this.isStatusObserved = true;
            console.log(`Status observer connected for ${this.id}.`);
        }
    }

    stopObservingStatus() {
        if (this.isStatusObserved) {
            this.statusObserver.disconnect();
            this.isStatusObserved = false;
            console.log(`Status observer disconnected for ${this.id}.`);
        }
    }
}

class Market {
    static CONTRACT_LIST_OBSERVER_CONFIG = { childList: true };
    static CONTAINER_SELECTOR = ".market-container";
    static NAME_SELECTOR = ".market-name";

    static fromContainers($wrappers) {
        const markets = Array.from($wrappers)
            .map(($container) => new Market($container))
            .filter(Boolean); // Remove null values

        return markets;
    }

    constructor($container) {
        this.contractListObserver = null;
        this.$container = $container;
        this.name = $container.querySelector(Market.NAME_SELECTOR).textContent || "";
        this.id = App.generateId(this.name);
        this.contracts = Contract.fromContainers($container.querySelectorAll(Contract.CONTAINER_SELECTOR));
        this.contracts.forEach((contract) => {
            contract.insertOptionsIntoDOM();
        });

        this.startObservingContractList();
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
                    const contracts = Contract.fromContainers(node.querySelectorAll(Contract.CONTAINER_SELECTOR));
                    console.log("New contracts:");
                    console.log(contracts);

                    contracts.forEach((contract) => {
                        const existingContract = this.contracts.find((c) => c.id === contract.id);
                        if (existingContract) {
                            existingContract.$container = contract.$container;
                            existingContract.insertOptionsIntoDOM();
                        } else {
                            this.contracts.push(contract);
                            contract.insertOptionsIntoDOM();
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
        this.contractListObserver.observe(this.$container, Market.CONTRACT_LIST_OBSERVER_CONFIG);
    }

    stopObservingContractList() {
        if (this.contractListObserve) {
            this.contractListObserve.disconnect();
            this.contractListObserve = null;
        }
    }
}

class Event {
    static STATUS_BADGE_SELECTOR = ".event-badge";
    static STATUS_BADGE_COMPLETED_CLASS = "-complete";
    static STATUS_OBSERVER_CONFIG = { attributes: true, attributeFilter: ["class"] };

    constructor() {
        this.markets = [];
        this.$statusBadge = document.querySelector(Event.STATUS_BADGE_SELECTOR);
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

        // Set up markets
        const $marketContainers = Array.from(document.querySelectorAll(Market.CONTAINER_SELECTOR)).map(
            ($container) => $container.firstElementChild
        );
        this.markets = Market.fromContainers($marketContainers);

        // Start observing event badge
        this.startObservingStatus();
    }

    hasEnded() {
        return this.$statusBadge.classList.contains(Event.STATUS_BADGE_COMPLETED_CLASS);
    }

    handleStatusMutation(mutationsList, observer) {
        console.log("Status badge mutation!");
        console.log(mutationsList);
        for (let mutation of mutationsList) {
            if (mutation.type === "attributes" && mutation.attributeName === "class") {
                const currentClasses = mutation.target.classList;
                if (currentClasses.contains(Event.STATUS_BADGE_COMPLETED_CLASS)) {
                    console.log("Event finished, starting cleanup...");
                    this.stopObservingStatus();
                    // Clean up market & contract observers
                    this.markets.forEach((market) => {
                        market.stopObservingContractList();
                        market.contracts.forEach((contract) => {
                            contract.removeOptionsFromDOM();
                        });
                    });
                }
            }
        }
    }

    startObservingStatus() {
        this.statusObserver = new MutationObserver(this.handleStatusMutation.bind(this));
        this.statusObserver.observe(this.$statusBadge, Event.STATUS_OBSERVER_CONFIG);
    }

    stopObservingStatus() {
        if (this.statusObserver) {
            this.statusObserver.disconnect();
            this.statusObserver = null;
        }
    }
}

class App {
    static MUTE_SVG_PATH = chrome.runtime.getURL("images/mute.svg");
    static PING_AUDIO = new Audio(chrome.runtime.getURL("audio/ping.mp3"));

    static generateId(slug) {
        return slug.toLowerCase().replace(/ /g, "-");
    }

    constructor() {
        this.event = new Event();
        if (!this.event.markets || this.event.markets.length == 0) {
            console.log("No markets found.");
            return;
        }
    }
}

window.addEventListener("load", () => {
    console.log("DOM fully loaded and parsed. Creating new App instance and starting monitoring...");
    const app = new App();
});
