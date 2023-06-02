class Contract {
    static OBSERVER_CONFIG = { characterData: true, subtree: true };

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
        this.minInputElements = this.createInput("Min");
        this.maxInputElements = this.createInput("Max");
        this.$toggleBtn = this.createToggleButton();
        this.$container = $container;
        this.inserted = false;
    }

    get $container() {
        return this._$container;
    }

    set $container($newContainer) {
        // Validation
        if ($newContainer === this.$container) {
            return;
        }

        const name = $newContainer.querySelector(".name")?.innerText || "";
        if (!name) {
            console.log(`Invalid name - skipping contract.`);
            return;
        }

        // Set up new object properties
        this.id = App.generateId(name);
        this.name = name;
        this.$sellText = $newContainer.querySelector(".price-series.sell .price.sell");
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
        const $wrapper = document.createElement("div");
        $wrapper.style.margin = "10px";
        const $label = document.createElement("label");
        $label.textContent = label;
        const $input = document.createElement("input");
        $input.type = "number";
        $input.step = "0.01";
        $input.style.opacity = "0.2";
        $input.style.maxWidth = "60px";
        $input.className = label.toLowerCase() + "-input";
        $input.addEventListener("change", function () {
            this.style.opacity = parseFloat(this.value) > 0 ? "1" : "0.2";
        });
        $wrapper.appendChild($label);
        $wrapper.appendChild($input);
        return {
            $wrapper,
            $input,
            $label,
        };
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
        this.startObserving();
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
        console.log(`Observer connected for ${this.id}.`);
        this.observer = new MutationObserver(this.handleSellValueMutation.bind(this));
        this.observer.observe(this.$sellText, Contract.OBSERVER_CONFIG);
    }

    stopObserving() {
        if (this.observer) {
            console.log(`Observer disconnected for ${this.id}.`);
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

class Market {
    static OBSERVER_CONFIG = { childList: true };

    static fromContainers($wrappers) {
        const markets = Array.from($wrappers)
            .map(($container) => new Market($container))
            .filter(Boolean); // Remove null values

        return markets;
    }

    constructor($container) {
        this.observer = null;
        this.$container = $container;
        this.name = $container.querySelector(".market-name").textContent;
        this.id = App.generateId(this.name);
        this.contracts = Contract.fromContainers($container.querySelectorAll(".contract-wrapper"));
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
                    const contracts = Contract.fromContainers(node.querySelectorAll(".contract-wrapper"));
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

class App {
    static EVENT_BADGE_BASE_CLASS = "event-badge";
    static EVENT_BADGE_COMPLETED_CLASS = "-complete";
    static OBSERVER_CONFIG = { attributes: true, attributeFilter: ["class"] };
    static MUTE_SVG_PATH = chrome.runtime.getURL("images/mute.svg");
    static PING_AUDIO = new Audio(chrome.runtime.getURL("audio/ping.mp3"));

    static generateId(slug) {
        return slug.toLowerCase().replace(/ /g, "-");
    }

    constructor() {
        this.$eventBadge = document.querySelector(`.${App.EVENT_BADGE_BASE_CLASS}`);
        if (!this.$eventBadge) {
            console.log("Event badge not found, stopping app setup.");
            return;
        }
        if (this.isEventFinished()) {
            console.log("Event finished, stopping app setup.");
            return;
        }

        const $marketContainers = Array.from(document.querySelectorAll(".market-container")).map(
            ($container) => $container.firstElementChild
        );
        this.markets = Market.fromContainers($marketContainers);
        console.log("App initialized.");
        console.log(this.markets);

        this.startObserving();
    }

    isEventFinished() {
        return this.$eventBadge.classList.contains(App.EVENT_BADGE_COMPLETED_CLASS);
    }

    handleEventStatusMutation(mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === "attributes" && mutation.attributeName === "class") {
                const currentClasses = mutation.target.classList;
                if (currentClasses.contains(App.EVENT_BADGE_COMPLETED_CLASS)) {
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
        this.observer = new MutationObserver(this.handleEventStatusMutation.bind(this));
        this.observer.observe(this.$eventBadge, App.OBSERVER_CONFIG);
    }

    stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

window.addEventListener("load", () => {
    console.log("DOM fully loaded and parsed. Creating new App instance and starting monitoring...");
    const app = new App();
});
