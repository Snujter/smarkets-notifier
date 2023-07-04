class Event {
    constructor(options = {}) {
        const { id, homeTeam, awayTeam, tabId } = options;

        this.id = String(id || "");
        this.homeTeam = String(homeTeam || "");
        this.awayTeam = String(awayTeam || "");
        this.tabId = Number(tabId || 0);
    }
}

class Market {
    constructor(options = {}) {
        const { id, name, eventId } = options;

        this.id = String(id || "");
        this.name = String(name || "");
        this.eventId = String(eventId || "");
    }
}

class Contract {
    constructor(options = {}) {
        const { id, name, sellValue, marketId, eventId, status } = options;

        this.id = String(id || "");
        this.name = String(name || "");
        this.sellValue = Number(sellValue || 0);
        this.marketId = String(marketId || "");
        this.eventId = String(eventId || "");
        this.status = String(status || "inactive");
    }
}

export { Event, Market, Contract };
