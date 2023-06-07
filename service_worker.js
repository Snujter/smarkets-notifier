(async () => {
    const connections = {};

    const savedResult = await chrome.storage.local.get(["events", "markets", "contracts"]);
    let events = savedResult.events || [];
    let markets = savedResult.markets || [];
    let contracts = savedResult.contracts || [];

    console.log("markets init: ", markets);

    // Add listener for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            console.log({ key, namespace, oldValue, newValue });
        }
    });

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
        console.assert(port.name === "content-script");
        const tabId = port.sender.tab.id;
        connections[tabId] = port;

        // port.onMessage.addListener(handleMessage);

        port.onMessage.addListener((message) => {
            const validation = validateMessage(message);
            if (!validation.isValid) {
                console.error("ERROR: ", validation.messages || []);
                return;
            }

            switch (message.type) {
                case "add-event":
                    addEvent(message, tabId);
                    break;
                case "remove-event":
                    removeEvent(message);
                    break;
                case "add-market":
                    addMarket(message);
                    break;
                case "remove-market":
                    removeMarket(message);
                    break;
                case "add-contract":
                    addContract(message);
                    break;
                case "remove-contract":
                    removeContract(message);
                    break;
                default:
                    console.log("Unknown message type:", message.type);
                    break;
            }
        });
        port.onDisconnect.addListener(() => {
            delete connections[tabId];
        });
    });

    function validateMessage(message) {
        let validation = {
            isValid: true,
            messages: [],
        };
        const { type } = message;
        switch (type) {
            case "add-event":
                if (!message.id) {
                    validation.messages.push("No id found.");
                }
                if (!message.homeTeam) {
                    validation.messages.push("No event home team found.");
                }
                if (!message.awayTeam) {
                    validation.messages.push("No event away team found.");
                }
                break;
            case "remove-event":
                if (!message.id) {
                    validation.messages.push("No id found.");
                }
                break;
            case "add-market":
                if (!message.id) {
                    validation.messages.push("No id found.");
                }
                if (!message.eventId) {
                    validation.messages.push("No event id found.");
                }
                if (!message.name) {
                    validation.messages.push("No name found.");
                }
                break;
            case "remove-market":
                if (!message.id) {
                    validation.messages.push("No id found.");
                }
                if (!message.eventId) {
                    validation.messages.push("No event id found.");
                }
                break;
            case "add-contract":
                if (!message.id) {
                    validation.messages.push("No id found.");
                }
                if (!message.eventId) {
                    validation.messages.push("No event id found.");
                }
                if (!message.marketId) {
                    validation.messages.push("No market id found.");
                }
                if (!message.name) {
                    validation.messages.push("No name found.");
                }
                break;
            case "remove-contract":
                if (!message.id) {
                    validation.messages.push("No id found.");
                }
                if (!message.eventId) {
                    validation.messages.push("No event id found.");
                }
                if (!message.marketId) {
                    validation.messages.push("No market id found.");
                }
                break;
            default:
                validation.messages.push(`Unknown message type: ${message.type}.`);
        }

        if (validation.messages.length > 0) {
            validation.isValid = false;
        }

        return validation;
    }

    // Add an event to local storage
    function addEvent(message, tabId) {
        const { id, homeTeam, awayTeam } = message;

        console.log("Adding event to local storage:", { id, homeTeam, awayTeam, tabId });
        const existingEventIndex = events.findIndex((event) => event.id === id && event.tabId === tabId);

        if (existingEventIndex !== -1) {
            // Update existing event with new values
            events[existingEventIndex] = { id, homeTeam, awayTeam, tabId };
        } else {
            // Add new event to the array
            events.push({ id, homeTeam, awayTeam, tabId });
        }

        chrome.storage.local.set({ events }, () => {
            console.log("Event added to local storage:", { id, homeTeam, awayTeam, tabId });
        });
    }

    // Remove an event from local storage
    function removeEvent(message) {
        const { id } = message;

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
    function addMarket(message) {
        const { id, eventId, name } = message;

        console.log("Adding market to local storage:", { id, eventId, name });
        const existingMarketIndex = markets.findIndex((market) => market.id === id);

        if (existingMarketIndex !== -1) {
            // Update existing market with new values
            markets[existingMarketIndex] = { id, eventId, name };
        } else {
            // Add new market to the array
            markets.push({ id, eventId, name });
        }

        chrome.storage.local.set({ markets }, () => {
            console.log("Market added to local storage:", { id, eventId });
        });
    }

    // Remove a market and its contracts from local storage
    function removeMarket(message) {
        const { id, eventId } = message;

        console.log("Removing market from local storage:", { id });

        // Remove markets and contracts with the same id
        markets = markets.filter((market) => market.id !== id && market.eventId !== eventId);
        contracts = contracts.filter((contract) => contract.marketId !== id && contract.eventId !== eventId);

        chrome.storage.local.set({ markets, contracts }, () => {
            console.log("Market and its contracts removed from local storage:", { id, eventId });
        });
    }

    // Add a contract to local storage
    function addContract(message) {
        const { id, name, value, marketId, eventId } = message;

        console.log("Adding contract to local storage:", { id, name, value, marketId, eventId });
        const existingContractIndex = contracts.findIndex((contract) => contract.id === id);

        if (existingContractIndex !== -1) {
            // Update existing contract with new values
            contracts[existingContractIndex] = { id, name, value, marketId, eventId };
        } else {
            // Add new contract to the array
            contracts.push({ id, name, value, marketId, eventId });
        }

        chrome.storage.local.set({ contracts }, () => {
            console.log("Contract added to local storage:", { id, name, value, marketId, eventId });
        });
    }

    // Remove a contract from local storage
    function removeContract(message) {
        const { id, marketId, eventId } = message;

        console.log("Removing contract from local storage:", { id });
        const updatedContracts = contracts.filter(
            (contract) => contract.id !== id && contract.marketId !== marketId && contract.eventId !== eventId
        );

        chrome.storage.local.set({ contracts: updatedContracts }, () => {
            console.log("Contract removed from local storage:", { id });
        });
    }
})();
