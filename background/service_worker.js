import MessageValidator from "./MessageValidator.class.js";

// Add dirty hack to stop service worker sleeping every 30sec
async function createOffscreen() {
    await chrome.offscreen
        .createDocument({
            url: "offscreen/offscreen.html",
            reasons: ["BLOBS"],
            justification: "keep service worker running",
        })
        .catch(() => {});
}
chrome.runtime.onStartup.addListener(createOffscreen);
self.onmessage = (e) => {}; // keepAlive
createOffscreen();

(async () => {
    const connections = {};

    const savedResult = await chrome.storage.local.get(["events", "markets", "contracts"]);
    let events = savedResult.events || [];
    let markets = savedResult.markets || [];
    let contracts = savedResult.contracts || [];

    const MSG_FROM_CONTENT_SCRIPT_VALIDATION = [
        { type: "add-event", requiredFields: ["id", "homeTeam", "awayTeam"], notFoundIn: events },
        { type: "update-event", requiredFields: ["id"], foundIn: events },
        { type: "remove-event", requiredFields: ["id"], foundIn: events },
        { type: "add-market", requiredFields: ["id", "eventId", "name"], notFoundIn: markets },
        { type: "update-market", requiredFields: ["id"], foundIn: markets },
        { type: "remove-market", requiredFields: ["id"], foundIn: markets },
        { type: "add-contract", requiredFields: ["id", "eventId", "marketId", "name"], notFoundIn: contracts },
        { type: "update-contract", requiredFields: ["id", "eventId", "marketId"], foundIn: contracts },
        { type: "remove-contract", requiredFields: ["id"], foundIn: contracts },
    ];
    const validator = new MessageValidator(MSG_FROM_CONTENT_SCRIPT_VALIDATION);

    // Listen for messages from the popup script
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        console.assert(!sender.tab);
        if (message.type === "clear-data") {
            chrome.storage.local.remove(["events", "contracts", "markets"], () => {
                events = [];
                markets = [];
                contracts = [];
                sendResponse({ message: "Data cleared." });
            });
            // Return true to let the popup know this is an async response
            return true;
        }
    });

    // Listen for connections from content scripts and the popup script
    chrome.runtime.onConnect.addListener((port) => {
        // Check if the connection is from a content script
        if (port.name === "content-script") {
            const tabId = port.sender.tab.id;
            connections[tabId] = port;

            port.onMessage.addListener((message) => {
                const { type, data } = message;

                // Do some basic validation
                if (!validator.validateMessage(type, data)) {
                    console.error(validator.errorMessages);
                    return;
                }

                switch (type) {
                    case "add-event":
                        addEvent(data, tabId);
                        break;
                    case "update-event":
                        updateEvent(data);
                        break;
                    case "remove-event":
                        removeEvent(data.id);
                        break;
                    case "add-market":
                        addMarket(data);
                        break;
                    case "update-market":
                        updateMarket(data);
                        break;
                    case "remove-market":
                        removeMarket(data.id);
                        break;
                    case "add-contract":
                        addContract(data);
                        break;
                    case "update-contract":
                        updateContract(data);
                        break;
                    case "remove-contract":
                        removeContract(data.id);
                        break;
                }

                // Send message to popup script for instant updates
                if (popupPort) {
                    console.log(popupPort);
                    popupPort.postMessage(message);
                }
            });

            port.onDisconnect.addListener(() => {
                delete connections[tabId];
            });
        }
    });

    // Add an event to local storage
    function addEvent(event, tabId) {
        events.push({ ...event, tabId });

        chrome.storage.local.set({ events }, () => {
            console.log("Event added to local storage:", event);
        });
    }

    // Update an existing event
    function updateEvent(event) {
        console.log("Updating existing event in local storage:", event);
        const existingEventIndex = events.findIndex((e) => e.id === event.id);
        events[existingEventIndex] = {
            ...events[existingEventIndex],
            ...event,
        };

        chrome.storage.local.set({ events }, () => {
            console.log("Event updated:", event);
        });
    }

    // Remove an event from local storage
    function removeEvent(id) {
        console.log("Removing event from local storage:", { id });
        events = events.filter((event) => event.id !== id);

        // Remove markets and contracts with the same eventId
        markets = markets.filter((market) => market.eventId !== id);
        contracts = contracts.filter((contract) => contract.eventId !== id);

        chrome.storage.local.set({ events, markets, contracts }, () => {
            console.log("Event and its markets + contracts removed from local storage:", { id });
        });
    }

    // Add a market to local storage
    function addMarket(market) {
        markets.push(market);

        chrome.storage.local.set({ markets }, () => {
            console.log("Market added to local storage:", market);
        });
    }

    // Add a market to local storage
    function updateMarket(market) {
        console.log("Updating existing market in local storage:", market);
        const existingMarketIndex = markets.findIndex((m) => m.id === market.id);
        markets[existingMarketIndex] = {
            ...markets[existingMarketIndex],
            ...market,
        };

        chrome.storage.local.set({ markets }, () => {
            console.log("Market updated:", market);
        });
    }

    // Remove a market and its contracts from local storage
    function removeMarket(id) {
        console.log("Removing market from local storage:", { id });

        // Remove markets and contracts with the same id
        markets = markets.filter((market) => market.id !== id);
        contracts = contracts.filter((contract) => contract.marketId !== id);

        chrome.storage.local.set({ markets, contracts }, () => {
            console.log("Market and its contracts removed from local storage:", { id, eventId });
        });
    }

    // Add a contract to local storage
    function addContract(contract) {
        console.log("Adding contract to local storage:", contract);
        contracts.push(contract);

        chrome.storage.local.set({ contracts }, () => {
            console.log("Contract added to local storage:", contract);
        });
    }

    // Add a contract to local storage
    function updateContract(contract) {
        console.log("Updating existing contract in local storage:", contract);
        const existingContractIndex = contracts.findIndex((m) => m.id === contract.id);
        contracts[existingContractIndex] = {
            ...contracts[existingContractIndex],
            ...contract,
        };

        chrome.storage.local.set({ contracts }, () => {
            console.log("Contract updated:", contract);
        });
    }

    // Remove a contract from local storage
    function removeContract(id) {
        console.log("Removing contract from local storage:", { id });
        const updatedContracts = contracts.filter((contract) => contract.id !== id);

        chrome.storage.local.set({ contracts: updatedContracts }, () => {
            console.log("Contract removed from local storage:", { id });
        });
    }
})();
