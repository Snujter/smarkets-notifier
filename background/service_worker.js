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
    let popupPort;

    const savedResult = await chrome.storage.local.get(["events", "markets", "contracts"]);
    let events = savedResult.events || [];
    let markets = savedResult.markets || [];
    let contracts = savedResult.contracts || [];

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

                const validator = new MessageValidator(message);

                switch (type) {
                    case "add-event":
                        validator.requiredDataFields = ["id", "homeTeam", "awayTeam"];
                        validator.notFoundIn = { fields: ["id"], searchArray: events };

                        validator.onValidationSuccess = addEvent.bind(null, data, tabId);
                        break;
                    case "update-event":
                        validator.requiredDataFields = ["id"];
                        validator.foundIn = { fields: ["id"], searchArray: events };

                        validator.onValidationSuccess = updateEvent.bind(null, data);
                        break;
                    case "remove-event":
                        validator.requiredDataFields = ["id"];
                        validator.foundIn = { fields: ["id"], searchArray: events };

                        validator.onValidationSuccess = removeEvent.bind(null, data.id);
                        break;
                    case "add-market":
                        validator.requiredDataFields = ["id", "eventId", "name"];
                        validator.notFoundIn = { fields: ["id", "eventId"], searchArray: markets };

                        validator.onValidationSuccess = addMarket.bind(null, data);
                        break;
                    case "update-market":
                        validator.requiredDataFields = ["id", "eventId"];
                        validator.foundIn = { fields: ["id", "eventId"], searchArray: markets };

                        validator.onValidationSuccess = updateMarket.bind(null, data);
                        break;
                    case "remove-market":
                        validator.requiredDataFields = ["id", "eventId"];
                        validator.foundIn = { fields: ["id", "eventId"], searchArray: markets };

                        validator.onValidationSuccess = removeMarket.bind(null, data);
                        break;
                    case "add-contract":
                        validator.requiredDataFields = ["id", "eventId", "marketId", "name"];
                        validator.notFoundIn = { fields: ["id", "eventId", "marketId"], searchArray: contracts };

                        validator.onValidationSuccess = addContract.bind(null, data);
                        break;
                    case "update-contract":
                        validator.requiredDataFields = ["id", "eventId", "marketId"];
                        validator.foundIn = { fields: ["id", "eventId", "marketId"], searchArray: contracts };

                        validator.onValidationSuccess = updateContract.bind(null, data);
                        break;
                    case "remove-contract":
                        validator.requiredDataFields = ["id", "eventId", "marketId"];
                        validator.foundIn = { fields: ["id", "eventId", "marketId"], searchArray: contracts };

                        validator.onValidationSuccess = removeContract.bind(null, data);
                        break;
                    default:
                        return;
                }

                validator
                    .validate()
                    .then(async (callback) => {
                        callback();
                        // Send message to popup script for instant updates
                        if (popupPort) {
                            console.log(popupPort);
                            popupPort.postMessage(message);
                        }
                    })
                    .catch((response) => {
                        console.warn("An error happened during validation, skipping: ", {
                            errors: response.errors,
                            message: response.message,
                        });
                    });
            });

            port.onDisconnect.addListener(() => {
                console.log("Port disconnected in SERVICE WORKER.");
                delete connections[tabId];
            });
        } else if (port.name === "popup-script") {
            popupPort = port;
            port.onDisconnect.addListener(() => {
                popupPort = null;
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
