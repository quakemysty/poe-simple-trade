chrome.runtime.onMessage.addListener((msg, _sender, response) => {
    // 리그 목록 조회
    if (msg.action == "fetchLeagues") {
        const game = msg.gameType === "poe2" ? "poe2" : "poe1";

        fetch(`https://poe.ninja/${game}/api/economy/leagues`)
            .then((res) => res.json())
            .then((data) => response({ success: true, leagues: data }))
            .catch(() => response({ success: false }));

        return true; // important
    }
    // 화폐 시세 조회 : poe.ninja Currency API
    else if (msg.action === "fetchPoeNinjaCurrency") {
        const game = msg.gameType === "poe2" ? "poe2" : "poe1";
        const league = encodeURIComponent(msg.leagueName);

        fetch(
            `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${league}&type=Currency`,
        )
            .then((res) => res.json())
            .then((data) => response({ success: true, overview: data }))
            .catch(() => response({ success: false }));

        return true; // important
    }
    // POE1 Item 조회
    else if (msg.action === "fetchItemPOE1") {
        const url = `https://www.pathofexile.com/api/trade/fetch/${msg.itemId}`;
        //console.log(url);
        fetch(url)
            .then((res) => res.json())
            .then((data) => response({ success: true, item: data.result?.[0]?.item }))
            .catch(() => response({ success: false }));

        return true; // important
    }
    // POE2 Item 조회
    else if (msg.action === "fetchItemPOE2") {
        const url = `https://www.pathofexile.com/api/trade2/fetch/${msg.itemId}`;
        //console.log(url);
        fetch(url)
            .then((res) => res.json())
            .then((data) => response({ success: true, item: data.result?.[0]?.item }))
            .catch(() => response({ success: false }));

        return true; // important
    }
});
