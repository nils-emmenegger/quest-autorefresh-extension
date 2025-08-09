import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [buttonText, setButtonText] = useState<"Start" | "Stop">("Start");
  const [inputText, setInputText] = useState<string>("");
  const [available, setAvailable] = useState<boolean>(true);
  const [refreshCount, setRefreshCount] = useState<number>(0);

  const handleClick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      return;
    }

    try {
      const msg: any = {
        from: "popup",
        action: buttonText
      };
      if (buttonText === "Start") {
        msg.delay_secs = parseInt(inputText) || 60;
        msg.delay_secs = Math.max(msg.delay_secs, 1);
      }

      await chrome.tabs.sendMessage(tabId, msg);
      setButtonText(buttonText === "Start" ? "Stop" : "Start");
    } catch (e) {
    }
  };

  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (!tabId) {
        return;
      }

      try {
        const runningResponse: any = await chrome.tabs.sendMessage(tabId, { from: "popup", action: "GetRunning" });
        const refreshResponse: any = await chrome.tabs.sendMessage(tabId, { from: "popup", action: "GetRefreshCount" });

        if (runningResponse?.running !== undefined) {
          setButtonText(runningResponse.running ? "Stop" : "Start");
        }

        if (refreshResponse?.refreshCount !== undefined) {
          setRefreshCount(refreshResponse.refreshCount);
        }
      } catch (e) {
        setAvailable(false);
      }
    })()
  }, [])

  return (
    <>
      {available ? <>
        <button onClick={handleClick}>{buttonText}</button>
        <input type="text" placeholder="Delay" value={inputText} onChange={(e) => setInputText(e.target.value)} />
        <div>Refresh Count: {refreshCount}</div>
      </>
        : <span>Switch tabs</span>
      }
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
