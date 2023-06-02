class Contract {
    static OBSERVER_CONFIG = { characterData: true, subtree: true };
    static CONTAINER_SELECTOR = ".contract-wrapper";
    static SELL_TEXT_SELECTOR = ".price-series.sell .price.sell";
    static NAME_SELECTOR = ".name";

    static fromContainers($wrappers) {
        const contracts = Array.from($wrappers)
            .map(($contractContainer) => new Contract($contractContainer))
            .filter(Boolean); // Remove null values

        return contracts;
    }

    constructor($container) {
        this.id = null; // gets set up when setting $container
        this.name = null; // gets set up when setting $container
        this.$sellText = null; // gets set up when setting $container
        this._$container = null; // gets set up when setting $container
        this.minInputElements = this.createInput("Below");
        this.maxInputElements = this.createInput("Above");
        this.$toggleBtn = this.createToggleButton();
        this.$container = $container;
        this.inserted = false;
        this.isObserved = false;
    }

    get $container() {
        return this._$container;
    }

    set $container($newContainer) {
        // Validation
        if ($newContainer === this.$container) {
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
        this.$sellText = $newContainer.querySelector(Contract.SELL_TEXT_SELECTOR);
        this._$container = $newContainer;
    }

    handleSellValueMutation(mutationsList, observer) {
        console.log(mutationsList);
        for (let mutation of mutationsList) {
            if (mutation.type === "characterData") {
                const sellValue = parseFloat(this.$sellText.textContent.trim());
                const lowerThreshold = parseFloat(this.minInputElements.$input.value);
                const upperThreshold = parseFloat(this.maxInputElements.$input.value);
                console.log({
                    id: this.id,
                    sellValue,
                    upperThreshold,
                    lowerThreshold,
                });

                if (!isNaN(sellValue) && (sellValue >= upperThreshold || sellValue <= lowerThreshold)) {
                    this.$container.style.backgroundColor = "#6e0404";
                    if (!this.isMuted()) {
                        App.PING_AUDIO.play();
                    }
                } else {
                    this.$container.style.backgroundColor = "";
                }
            }
        }
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
        this.$container.style.backgroundColor = "";
        if (value > 0) {
            e.target.style.opacity = "1";
            this.startObserving();
        } else {
            e.target.style.opacity = "0.2";
            this.stopObserving();
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

        this.$optionsContainer.appendChild(this.minInputElements.$wrapper);
        this.$optionsContainer.appendChild(this.maxInputElements.$wrapper);
        this.$optionsContainer.appendChild(this.$toggleBtn);

        this.$container.appendChild(this.$optionsContainer);

        this.inserted = true;
        console.log(`Inserted into DOM.`);
    }

    removeOptionsFromDOM() {
        this.$optionsContainer.remove();
        this.inserted = false;
        this.stopObserving();
    }

    isMuted() {
        return this.inserted && this.$toggleBtn.getAttribute("data-active") === "true";
    }

    startObserving() {
        if (this.$sellText && this.$sellText instanceof Node && this.inserted && !this.isObserved) {
            console.log(`Observer connected for ${this.id}.`);
            this.observer = new MutationObserver(this.handleSellValueMutation.bind(this));
            this.observer.observe(this.$sellText, Contract.OBSERVER_CONFIG);
            this.isObserved = true;
        }
    }

    stopObserving() {
        if (this.isObserved) {
            console.log(`Observer disconnected for ${this.id}.`);
            this.observer.disconnect();
            this.observer = null;
            this.isObserved = false;
        }
    }
}

class Market {
    static OBSERVER_CONFIG = { childList: true };
    static CONTAINER_SELECTOR = ".market-container";
    static NAME_SELECTOR = ".market-name";

    static fromContainers($wrappers) {
        const markets = Array.from($wrappers)
            .map(($container) => new Market($container))
            .filter(Boolean); // Remove null values

        return markets;
    }

    constructor($container) {
        this.observer = null;
        this.$container = $container;
        this.name = $container.querySelector(Market.NAME_SELECTOR).textContent || "";
        this.id = App.generateId(this.name);
        this.contracts = Contract.fromContainers($container.querySelectorAll(Contract.CONTAINER_SELECTOR));
        this.contracts.forEach((contract) => {
            contract.insertOptionsIntoDOM();
        });

        this.startObserving();
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

    startObserving() {
        this.observer = new MutationObserver(this.handleContractListMutation.bind(this));
        this.observer.observe(this.$container, Market.OBSERVER_CONFIG);
    }

    stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

class Event {
    static STATUS_BADGE_SELECTOR = ".event-badge";
    static STATUS_BADGE_COMPLETED_CLASS = "-complete";
    static OBSERVER_CONFIG = { attributes: true, attributeFilter: ["class"] };

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
        this.startObserving();
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
                    this.stopObserving();
                    // Clean up market & contract observers
                    this.markets.forEach((market) => {
                        market.stopObserving();
                        market.contracts.forEach((contract) => {
                            contract.stopObserving();
                            contract.removeOptionsFromDOM();
                        });
                    });
                }
            }
        }
    }

    startObserving() {
        this.observer = new MutationObserver(this.handleStatusMutation.bind(this));
        this.observer.observe(this.$statusBadge, Event.OBSERVER_CONFIG);
    }

    stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
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
