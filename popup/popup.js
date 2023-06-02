document.getElementById("clear").addEventListener("click", function () {
    document.getElementById("log").innerHTML = "";
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type === "logChange") {
        const logElement = document.createElement("div");
        logElement.textContent = `${request.marketName} - ${request.contractName} - ${request.sell}`;
        document.getElementById("log").appendChild(logElement);
    }
});
